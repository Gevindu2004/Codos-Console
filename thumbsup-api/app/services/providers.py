"""Delivery providers: ThumbsUp builds the email, the provider hands it to the internet.

Errors are classified so the queue knows what to do:
  - temporary (network down, server busy, rate limited)  -> retry later
  - permanent (rejected message, bad credentials)        -> fail now
  - bounced recipients (mailbox doesn't exist)           -> add to the suppression list
"""

import base64
import os
import smtplib
import ssl
import uuid
from email.message import EmailMessage as MimeMessage
from email.utils import formataddr, getaddresses, make_msgid, parseaddr

from app.config import settings
from app.services.files import Attachment


class ProviderError(Exception):
    def __init__(self, message: str, *, temporary: bool = False, bounced: dict[str, str] | None = None):
        super().__init__(message)
        self.temporary = temporary
        self.bounced = bounced or {}  # address -> reason


def build_mime(
    *,
    from_email: str,
    from_name: str,
    to: list[str],
    cc: list[str],
    reply_to: str | None,
    subject: str,
    html: str,
    text: str,
    attachments: list[Attachment],
    message_id: str,
) -> MimeMessage:
    msg = MimeMessage()
    from_name = " ".join((from_name or "").split())  # defence in depth: never a line break in a header
    msg["From"] = formataddr((from_name, from_email)) if from_name else from_email
    msg["To"] = ", ".join(to)
    if cc:
        msg["Cc"] = ", ".join(cc)
    if reply_to:
        msg["Reply-To"] = reply_to
    msg["Subject"] = subject
    domain = from_email.split("@")[-1] if "@" in from_email else "thumbsup.local"
    msg["Message-ID"] = make_msgid(idstring=message_id, domain=domain)
    msg["X-ThumbsUp-Message-Id"] = message_id

    msg.set_content(text or " ")
    if html:
        msg.add_alternative(html, subtype="html")
    for a in attachments:
        maintype, _, subtype = a.content_type.partition("/")
        msg.add_attachment(a.data, maintype=maintype or "application", subtype=subtype or "octet-stream", filename=a.filename)
    return msg


def send(mime: MimeMessage, envelope_to: list[str]) -> str:
    provider = settings.EMAIL_PROVIDER.lower()
    if provider == "smtp":
        return _send_smtp(mime, envelope_to)
    if provider == "ses":
        return _send_ses(mime, envelope_to)
    if provider == "acs":
        return _send_acs(mime, envelope_to)
    if provider == "log" and settings.is_test:
        return _send_log(mime)
    raise ProviderError("No email provider is configured on the server.")


# ---------------------------------------------------------------- SMTP
def _send_smtp(mime: MimeMessage, envelope_to: list[str]) -> str:
    context = ssl.create_default_context()
    try:
        if settings.SMTP_USE_SSL:
            server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, context=context, timeout=30)
        else:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=30)
            server.starttls(context=context)
        with server:
            if settings.SMTP_USERNAME:
                try:
                    server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                except smtplib.SMTPAuthenticationError:
                    raise
                except smtplib.SMTPNotSupportedError as exc:
                    raise ProviderError("This SMTP server doesn't support logging in on this port. Check SMTP_PORT/SMTP_USE_SSL.") from exc
                except (smtplib.SMTPException, OSError) as exc:
                    raise ProviderError(
                        f"The mail server dropped the connection while logging in ({exc.__class__.__name__}). "
                        "Check SMTP_USERNAME/SMTP_PASSWORD. Will retry.",
                        temporary=True,
                    ) from exc
            refused = server.send_message(mime, to_addrs=envelope_to)
    except smtplib.SMTPAuthenticationError as exc:
        raise ProviderError(
            "The mail server rejected the SMTP username/password. Check SMTP_USERNAME and SMTP_PASSWORD "
            "(Gmail needs an App Password).",
        ) from exc
    except smtplib.SMTPRecipientsRefused as exc:
        bounced = {r: _smtp_reason(code, text) for r, (code, text) in exc.recipients.items() if 500 <= code < 600}
        temporary = len(bounced) < len(exc.recipients)
        raise ProviderError("The mail server refused every recipient.", temporary=temporary, bounced=bounced) from exc
    except smtplib.SMTPSenderRefused as exc:
        raise ProviderError(
            f"The mail server refused the sender address ({exc.sender}). Use an address your SMTP account owns.",
            temporary=400 <= exc.smtp_code < 500,
        ) from exc
    except smtplib.SMTPDataError as exc:
        raise ProviderError(
            f"The mail server rejected the message: {_smtp_reason(exc.smtp_code, exc.smtp_error)}",
            temporary=400 <= exc.smtp_code < 500,
        ) from exc
    except smtplib.SMTPResponseException as exc:
        raise ProviderError(
            f"Mail server error: {_smtp_reason(exc.smtp_code, exc.smtp_error)}", temporary=400 <= exc.smtp_code < 500
        ) from exc
    except (smtplib.SMTPException, OSError) as exc:  # connection problems -> try again later
        raise ProviderError(f"Could not reach the mail server ({exc.__class__.__name__}). Will retry.", temporary=True) from exc

    if refused:  # some (not all) recipients refused
        bounced = {r: _smtp_reason(code, text) for r, (code, text) in refused.items() if 500 <= code < 600}
        if bounced:
            # Delivered to the others; the refused ones are recorded as bounces.
            raise PartialDelivery(mime["Message-ID"], bounced)
    return mime["Message-ID"]


class PartialDelivery(Exception):
    def __init__(self, provider_id: str, bounced: dict[str, str]):
        super().__init__("Some recipients were refused")
        self.provider_id = provider_id
        self.bounced = bounced


def _smtp_reason(code: int, text) -> str:
    if isinstance(text, bytes):
        text = text.decode(errors="replace")
    return f"{code} {text}".strip()[:300]


# ---------------------------------------------------------------- Amazon SES
def ses_client():
    try:
        import boto3
    except ImportError as exc:  # pragma: no cover
        raise ProviderError("Amazon SES needs boto3: pip install boto3") from exc
    kwargs = {"region_name": settings.AWS_REGION}
    if settings.AWS_ACCESS_KEY_ID:
        kwargs["aws_access_key_id"] = settings.AWS_ACCESS_KEY_ID
        kwargs["aws_secret_access_key"] = settings.AWS_SECRET_ACCESS_KEY
    return boto3.client("sesv2", **kwargs)


def _send_ses(mime: MimeMessage, envelope_to: list[str]) -> str:
    params = {"Destination": {"ToAddresses": envelope_to}, "Content": {"Raw": {"Data": mime.as_bytes()}}}
    if settings.SES_CONFIGURATION_SET:
        params["ConfigurationSetName"] = settings.SES_CONFIGURATION_SET
    try:
        resp = ses_client().send_email(**params)
    except Exception as exc:  # botocore ClientError and network errors
        code = getattr(exc, "response", {}).get("Error", {}).get("Code", exc.__class__.__name__)
        temporary = code in ("Throttling", "TooManyRequestsException", "ServiceUnavailable", "InternalFailure",
                             "EndpointConnectionError", "ConnectTimeoutError", "ReadTimeoutError")
        raise ProviderError(f"Amazon SES error: {code}: {exc}", temporary=temporary) from exc
    return resp.get("MessageId", "")


# ---------------------------------------------------------------- Azure Communication Services Email
_acs_client = None


def acs_client():
    """Azure email client: a connection string, or (recommended on Azure) the app's managed identity."""
    global _acs_client
    if _acs_client is None:
        from azure.communication.email import EmailClient

        # retry_total=0: our queue does the retrying (with backoff, and visible in the email log)
        opts = {"retry_total": 0, **_acs_transport}
        if settings.ACS_CONNECTION_STRING:
            _acs_client = EmailClient.from_connection_string(settings.ACS_CONNECTION_STRING, **opts)
        else:
            from azure.identity import DefaultAzureCredential

            _acs_client = EmailClient(settings.ACS_ENDPOINT, DefaultAzureCredential(), **opts)
    return _acs_client


_acs_transport: dict = {}  # tests plug in a fake Azure here


def reset_acs_client(**transport) -> None:
    global _acs_client, _acs_transport
    _acs_client = None
    _acs_transport = transport


def acs_operation_id(message_id: str) -> str:
    """Same ThumbsUp email -> same Azure operation id, so a retry can never send it twice."""
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"thumbsup:{message_id}"))


def acs_payload(mime: MimeMessage, envelope_to: list[str]) -> dict:
    """Azure needs a structured message, not raw MIME: take ours apart (we built it, so it's well-formed)."""
    to = [a for _, a in getaddresses(mime.get_all("To", []))]
    cc = [a for _, a in getaddresses(mime.get_all("Cc", []))]
    seen = {a.lower() for a in to + cc}
    bcc = [a for a in envelope_to if a.lower() not in seen]
    text = html = ""
    attachments = []
    for part in mime.walk():
        if part.is_multipart():
            continue
        filename = part.get_filename()
        if filename:
            attachments.append({"name": filename, "contentType": part.get_content_type(),
                                "contentInBase64": base64.b64encode(part.get_payload(decode=True) or b"").decode()})
        elif part.get_content_type() == "text/plain" and not text:
            text = part.get_content()
        elif part.get_content_type() == "text/html" and not html:
            html = part.get_content()
    payload = {
        "senderAddress": parseaddr(mime["From"])[1],  # the display name is set on the sender in Azure
        "recipients": {"to": [{"address": a} for a in to]},
        "content": {"subject": str(mime["Subject"] or ""), "plainText": text or " "},
        "headers": {"X-ThumbsUp-Message-Id": str(mime["X-ThumbsUp-Message-Id"])},
        "userEngagementTrackingDisabled": True,
    }
    if html:
        payload["content"]["html"] = html
    if cc:
        payload["recipients"]["cc"] = [{"address": a} for a in cc]
    if bcc:
        payload["recipients"]["bcc"] = [{"address": a} for a in bcc]
    if mime["Reply-To"]:
        payload["replyTo"] = [{"address": parseaddr(mime["Reply-To"])[1]}]
    if attachments:
        payload["attachments"] = attachments
    return payload


def _send_acs(mime: MimeMessage, envelope_to: list[str]) -> str:
    from azure.core.exceptions import ClientAuthenticationError, HttpResponseError, ServiceRequestError, ServiceResponseError

    op_id = acs_operation_id(str(mime["X-ThumbsUp-Message-Id"]))
    try:
        # Don't wait for Azure to finish: delivery results arrive later through Event Grid.
        acs_client().begin_send(acs_payload(mime, envelope_to), operation_id=op_id, polling=False)
    except ClientAuthenticationError as exc:
        raise ProviderError("Azure rejected the email service credentials. Check ACS_CONNECTION_STRING / the app's identity.") from exc
    except HttpResponseError as exc:
        status = exc.status_code or 0
        code = getattr(getattr(exc, "error", None), "code", None) or ""
        temporary = status == 429 or status >= 500 or status == 0
        hint = ""
        if status == 429:
            hint = " (Azure's sending limit was reached; it will be retried. Ask Azure for a higher email quota.)"
        elif "DomainNotLinked" in code or "sender" in str(exc).lower():
            hint = " Check that DEFAULT_FROM_EMAIL is a sender address of a domain connected to the Azure Communication Services resource."
        raise ProviderError(f"Azure email error {status} {code}: {exc.message[:300] if exc.message else exc}{hint}", temporary=temporary) from exc
    except (ServiceRequestError, ServiceResponseError) as exc:
        raise ProviderError("Couldn't reach Azure email. Will retry.", temporary=True) from exc
    return op_id


# ---------------------------------------------------------------- automated tests only
def _send_log(mime: MimeMessage) -> str:
    folder = os.path.join(settings.STORAGE_DIR, "outbox")
    os.makedirs(folder, exist_ok=True)
    msg_id = mime["X-ThumbsUp-Message-Id"]
    with open(os.path.join(folder, f"{msg_id}.eml"), "wb") as fh:
        fh.write(mime.as_bytes())
    return f"log:{msg_id}"
