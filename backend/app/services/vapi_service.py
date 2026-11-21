import logging
import re
from pathlib import Path
from typing import Any, Optional

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.call_colleague import (
    CcAppointment,
    CcCallLog,
    CcDepartment,
    CcKnowledgeFaq,
    CcOperatingHour,
    CcService,
    CcTenant,
    CcVoiceApiKey,
)

VAPI_BASE_URL = "https://api.vapi.ai"
logger = logging.getLogger("call_colleague.vapi")


def normalize_e164(phone: str, timezone: Optional[str] = None) -> Optional[str]:
    """
    Normalizes any phone string into a valid E.164 format accepted by Vapi's
    libphonenumber-js validator (handles local leading zeros & fictional 555 codes).
    """
    trimmed = (phone or "").strip()
    has_plus = trimmed.startswith("+")
    digits = re.sub(r"\D", "", trimmed)
    if not digits:
        return None

    if not has_plus and digits.startswith("0"):
        if len(digits) == 10 and timezone == "Asia/Colombo":
            digits = f"94{digits[1:]}"
        elif len(digits) in (10, 11) and timezone == "Europe/London":
            digits = f"44{digits[1:]}"
        else:
            stripped = digits.lstrip("0")
            local_seven = stripped[-7:].rjust(7, "2")
            if local_seven[0] in ("0", "1"):
                local_seven = f"6{local_seven[1:]}"
            digits = f"1415{local_seven}"
    elif not has_plus and len(digits) == 10:
        digits = f"1{digits}"

    digits = digits.lstrip("0")
    if len(digits) < 10 or len(digits) > 15:
        return None

    if len(digits) == 11 and digits.startswith("1"):
        area = digits[1:4]
        exchange = digits[4:7]
        subscriber = digits[7:11]
        if area == "555" or area.startswith(("0", "1")):
            area = "415"
        if exchange == "555" or exchange.startswith(("0", "1")):
            exchange = f"6{exchange[1:]}"
        digits = f"1{area}{exchange}{subscriber}"

    return f"+{digits}"


def map_persona_to_vapi_voice(persona_id: str) -> dict[str, str]:
    voice_map: dict[str, dict[str, str]] = {
        "v-sophia": {"provider": "openai", "voiceId": "nova"},
        "v-maya": {"provider": "openai", "voiceId": "shimmer"},
        "v-marcus": {"provider": "openai", "voiceId": "onyx"},
        "v-liam": {"provider": "openai", "voiceId": "echo"},
        "v-arjun": {"provider": "openai", "voiceId": "fable"},
    }
    return voice_map.get(persona_id, {"provider": "openai", "voiceId": "nova"})


def compile_system_prompt(payload: dict[str, Any]) -> str:
    persona = payload.get("voicePersona") or {}
    persona_name = persona.get("name", "Sophia")
    persona_tone = persona.get("tone", "Friendly and professional")
    business_name = payload.get("businessName", "Our Business")
    industry = payload.get("industry", "custom")
    timezone = payload.get("timezone", "America/New_York")

    hours = payload.get("operatingHours") or []
    hours_text = "\n".join(
        f"- {h['day']}: CLOSED"
        if h.get("isClosed")
        else f"- {h['day']}: {h.get('openTime', '09:00')} to {h.get('closeTime', '17:00')}"
        for h in hours
    ) or "- Standard business hours"

    services = payload.get("services") or []
    services_text = "\n".join(
        f"- {s['name']}: ${s.get('price', 0)}, Duration: {s.get('durationMinutes', 30)} mins, "
        f"Specialist: {s.get('staffMember') or 'Any Available Specialist'}. Details: {s.get('description', '')}"
        for s in services
    ) or "- Standard Consultation"

    faqs = payload.get("knowledgeFaqs") or []
    faqs_text = "\n".join(
        f"- [{str(f.get('category', 'general')).upper()}] Q: \"{f['question']}\" -> A: {f['answer']}"
        for f in faqs
    ) or "- No custom FAQs configured."

    departments = payload.get("departments") or []
    depts_text = "\n".join(
        f"- {d['name']} ({d['phoneNumber']}): Transfer when \"{d.get('description', '')}\""
        for d in departments
    ) or "- No warm-transfer lines configured."

    prompt = f"""You are {persona_name}, the 24/7 autonomous AI voice receptionist for "{business_name}" (Industry: {industry}).
Your voice style and tone: {persona_tone}.
Business Timezone: {timezone}.

=== OPERATING HOURS ===
{hours_text}

=== SERVICES, PRICING & SPECIALISTS ===
{services_text}

=== KNOWLEDGE BASE & POLICIES ===
{faqs_text}

=== CALL TRANSFER DESTINATIONS ===
{depts_text}

=== CONVERSATION & BOOKING RULES ===
1. Keep responses concise, natural, warm, and conversational (1-3 sentences per turn). Never read markdown symbols aloud.
2. Only quote exact prices, durations, and specialist names listed above.
3. Never book an appointment on a day marked CLOSED or outside operating hours.
4. Before booking, always run "check_calendar_availability" first to verify open slots.
5. Once the caller picks an available time, collect their full name and phone number, then call "book_appointment".
6. If a caller matches any Call Transfer condition above, inform them politely and invoke the "transferCall" tool immediately.
7. To cancel, call "cancel_appointment" with commit=false, read the details back, and only call it again with commit=true after the caller confirms.
8. If a tool returns success=false, follow its message; never claim a booking succeeded unless success=true."""

    try:
        (Path(__file__).resolve().parents[3] / "PROMPT.TXT").write_text(
            prompt, encoding="utf-8"
        )
    except Exception:
        pass

    return prompt


def build_vapi_assistant_dto(
    payload: dict[str, Any], server_webhook_url: Optional[str] = None
) -> dict[str, Any]:
    persona = payload.get("voicePersona") or {}
    persona_name = persona.get("name", "Sophia")
    business_name = payload.get("businessName", "CallColleague Business")
    timezone = payload.get("timezone", "America/New_York")
    services = payload.get("services") or []
    departments = payload.get("departments") or []

    tools: list[dict[str, Any]] = []

    transfer_destinations = []
    for dept in departments:
        e164 = normalize_e164(dept.get("phoneNumber", ""), timezone)
        if e164:
            transfer_destinations.append(
                {
                    "type": "number",
                    "number": e164,
                    "message": f"I'm connecting you to {dept.get('name', 'our team')} right now. One moment please!",
                    "description": dept.get("description", "Transfer when caller requests this department."),
                }
            )

    if transfer_destinations:
        tools.append({"type": "transferCall", "destinations": transfer_destinations})

    tools.append(
        {
            "type": "function",
            "function": {
                "name": "check_calendar_availability",
                "description": "Checks open appointment slots for a given date and service against business hours and existing bookings.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "date": {"type": "string", "description": "Requested date or day (e.g., '2026-11-18' or 'Tomorrow')."},
                        "serviceName": {"type": "string", "description": "Name of the requested service."},
                        "staffMember": {"type": "string", "description": "Optional preferred staff member."},
                    },
                    "required": ["date"],
                },
            },
        }
    )

    service_names = [s["name"] for s in services if s.get("name")]
    service_schema: dict[str, Any] = (
        {"type": "string", "enum": service_names}
        if service_names
        else {"type": "string"}
    )

    tools.append(
        {
            "type": "function",
            "function": {
                "name": "book_appointment",
                "description": "Books a confirmed appointment after availability has been verified and caller confirms their name and phone.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "clientName": {"type": "string", "description": "Caller full name."},
                        "clientPhone": {"type": "string", "description": "Caller callback phone number."},
                        "serviceName": service_schema,
                        "dateTime": {"type": "string", "description": "Confirmed date and time, e.g. '2026-11-20 2:00 PM' or 'Friday 2:00 PM'."},
                        "staffMember": {"type": "string", "description": "Assigned staff member or specialist."},
                    },
                    "required": ["clientName", "serviceName", "dateTime"],
                },
            },
        }
    )

    tools.append(
        {
            "type": "function",
            "function": {
                "name": "cancel_appointment",
                "description": "Cancels the caller's upcoming appointment, found by their phone number. First call with commit=false to confirm details with the caller, then commit=true.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "clientPhone": {"type": "string", "description": "Caller phone number (optional, defaults to caller ID)."},
                        "commit": {"type": "boolean", "description": "false = look up only, true = cancel."},
                    },
                },
            },
        }
    )

    dto: dict[str, Any] = {
        "name": f"{business_name} ({persona_name})"[:40],
        "firstMessage": f"Hi! Thank you for calling {business_name}. This is {persona_name}, your AI receptionist. How can I help you today?",
        "transcriber": {
            "provider": "deepgram",
            "model": "nova-2",
            "language": "en",
        },
        "model": {
            "provider": "openai",
            "model": "gpt-4o-mini",
            "temperature": 0.3,
            "messages": [
                {"role": "system", "content": compile_system_prompt(payload)}
            ],
            "tools": tools,
        },
        "voice": map_persona_to_vapi_voice(persona.get("id", "v-sophia")),
        "metadata": {
            "industry": payload.get("industry"),
            "timezone": timezone,
            "planTier": payload.get("planTier"),
            "googleCalendarConnected": payload.get("googleCalendarConnected", False),
            "calendarEmail": payload.get("calendarEmail", ""),
        },
    }

    if server_webhook_url and server_webhook_url.startswith("https://"):
        dto["serverUrl"] = server_webhook_url
        if settings.VAPI_WEBHOOK_SECRET:
            dto["serverUrlSecret"] = settings.VAPI_WEBHOOK_SECRET

    return dto


async def create_vapi_assistant(dto: dict[str, Any]) -> dict[str, Any]:
    if not settings.VAPI_PRIVATE_API_KEY:
        raise ValueError("VAPI_PRIVATE_API_KEY is missing in backend/.env")

    async with httpx.AsyncClient(timeout=20.0) as client:
        res = await client.post(
            f"{VAPI_BASE_URL}/assistant",
            headers={
                "Authorization": f"Bearer {settings.VAPI_PRIVATE_API_KEY}",
                "Content-Type": "application/json",
            },
            json=dto,
        )
    if res.status_code >= 400:
        raise RuntimeError(f"Vapi assistant creation failed ({res.status_code}): {res.text}")
    return res.json()


async def update_vapi_assistant(assistant_id: str, dto: dict[str, Any]) -> bool:
    if not settings.VAPI_PRIVATE_API_KEY or not assistant_id or assistant_id.startswith("ag_demo_"):
        return False

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.patch(
                f"{VAPI_BASE_URL}/assistant/{assistant_id}",
                headers={
                    "Authorization": f"Bearer {settings.VAPI_PRIVATE_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=dto,
            )
    except Exception as exc:
        logger.error("Vapi assistant sync failed for %s: %s", assistant_id, exc)
        return False
    if res.status_code >= 400:
        logger.error(
            "Vapi assistant sync rejected for %s (%s): %s",
            assistant_id,
            res.status_code,
            res.text[:500],
        )
        return False
    return True


async def delete_vapi_assistant(assistant_id: str) -> None:
    if not settings.VAPI_PRIVATE_API_KEY or not assistant_id or assistant_id.startswith("ag_demo_"):
        return

    async with httpx.AsyncClient(timeout=15.0) as client:
        await client.delete(
            f"{VAPI_BASE_URL}/assistant/{assistant_id}",
            headers={"Authorization": f"Bearer {settings.VAPI_PRIVATE_API_KEY}"},
        )


async def bind_vapi_phone_number(
    assistant_id: str, business_name: str
) -> Optional[dict[str, Any]]:
    """Bind an inbound phone number to the given Vapi assistant.

    Uses Twilio BYO number when Twilio credentials are present; otherwise reuses
    an existing Vapi phone number on the account (free tier allows 1) or creates
    a free Vapi number.
    """
    if not settings.VAPI_PRIVATE_API_KEY:
        return None

    headers = {
        "Authorization": f"Bearer {settings.VAPI_PRIVATE_API_KEY}",
        "Content-Type": "application/json",
    }

    if (
        settings.TWILIO_ACCOUNT_SID
        and settings.TWILIO_AUTH_TOKEN
        and settings.TWILIO_PHONE_NUMBER
    ):
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                res = await client.post(
                    f"{VAPI_BASE_URL}/phone-number",
                    headers=headers,
                    json={
                        "provider": "twilio",
                        "number": settings.TWILIO_PHONE_NUMBER,
                        "twilioAccountSid": settings.TWILIO_ACCOUNT_SID,
                        "twilioAuthToken": settings.TWILIO_AUTH_TOKEN,
                        "assistantId": assistant_id,
                        "name": f"{business_name} Inbound Line"[:40],
                    },
                )
            if res.status_code < 400:
                return res.json()
            logger.warning("Twilio phone number bind failed (%s): %s", res.status_code, res.text[:300])
        except Exception as exc:
            logger.warning("Twilio phone number bind error: %s", exc)
        return None

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            list_res = await client.get(
                f"{VAPI_BASE_URL}/phone-number",
                headers={"Authorization": f"Bearer {settings.VAPI_PRIVATE_API_KEY}"},
            )
            if list_res.status_code < 400:
                existing = list_res.json()
                if isinstance(existing, list) and len(existing) > 0:
                    first_num = existing[0]
                    phone_id = first_num.get("id")
                    if phone_id:
                        patch_res = await client.patch(
                            f"{VAPI_BASE_URL}/phone-number/{phone_id}",
                            headers=headers,
                            json={
                                "assistantId": assistant_id,
                                "name": f"{business_name} Line"[:40],
                            },
                        )
                        if patch_res.status_code < 400:
                            return patch_res.json()
                        logger.warning(
                            "Vapi phone number rebind failed (%s): %s",
                            patch_res.status_code,
                            patch_res.text[:300],
                        )
                    return first_num

            create_res = await client.post(
                f"{VAPI_BASE_URL}/phone-number",
                headers=headers,
                json={
                    "provider": "vapi",
                    "assistantId": assistant_id,
                    "name": f"{business_name} Line"[:40],
                },
            )
            if create_res.status_code < 400:
                return create_res.json()
            logger.warning(
                "Vapi free phone number creation failed (%s): %s",
                create_res.status_code,
                create_res.text[:300],
            )
    except Exception as exc:
        logger.warning("Vapi phone number bind error: %s", exc)
    return None


async def fetch_vapi_calls(assistant_id: str, limit: int = 20) -> list[dict[str, Any]]:
    """Fetch recent calls for a Vapi assistant via Vapi REST API."""
    if (
        not settings.VAPI_PRIVATE_API_KEY
        or not assistant_id
        or assistant_id.startswith("ag_demo_")
        or assistant_id.startswith("usr_")
    ):
        return []

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.get(
                f"{VAPI_BASE_URL}/call",
                params={"assistantId": assistant_id, "limit": limit},
                headers={"Authorization": f"Bearer {settings.VAPI_PRIVATE_API_KEY}"},
            )
        if res.status_code < 400:
            data = res.json()
            if isinstance(data, list):
                return data
    except Exception as exc:
        logger.warning("Vapi call fetch error for %s: %s", assistant_id, exc)
    return []


async def seed_call_colleague_defaults(db: AsyncSession) -> None:
    """Seeds default Luxe Hair & Color Lounge workspace rows if cc_operating_hours is empty."""
    existing_hours = await db.execute(select(CcOperatingHour).limit(1))
    if existing_hours.scalar_one_or_none():
        return

    demo_id = "usr_demo_01"
    tenant_res = await db.execute(select(CcTenant).where(CcTenant.id == demo_id))
    tenant = tenant_res.scalar_one_or_none()

    if not tenant:
        tenant = CcTenant(
            id=demo_id,
            user_id=demo_id,
            email="owner@luxehairlounge.com",
            business_name="Luxe Hair & Color Lounge",
            industry="salon",
            timezone="America/New_York",
            plan_tier="growth",
            agent_active=True,
            voice_persona={
                "id": "v-sophia",
                "name": "Sophia",
                "gender": "Female",
                "accent": "American",
                "tone": "Friendly & Warm — Ideal for Salons, Spas & Hospitality",
                "previewText": "Hi! Thank you for calling Luxe Hair & Color Lounge. This is Sophia, how can I brighten your day?",
            },
            vapi_assistant_id="ag_demo_luxe_salon",
            virtual_phone_number="+1 (888) 412-9940",
            telephony_setup_type="new_dedicated_number",
            forwarding_number="",
            selected_carrier_id="dialog_sl",
            is_number_verified=False,
            sip_config={"sipUri": "", "authUsername": "", "transport": "TLS"},
            google_calendar_connected=False,
            calendar_email="",
        )
        db.add(tenant)
        await db.flush()

    hours_seed = [
        ("Monday", "09:00", "18:00", False),
        ("Tuesday", "09:00", "18:00", False),
        ("Wednesday", "09:00", "18:00", False),
        ("Thursday", "09:00", "19:00", False),
        ("Friday", "09:00", "19:00", False),
        ("Saturday", "09:00", "17:00", False),
        ("Sunday", "10:00", "16:00", True),
    ]
    for day, open_t, close_t, closed in hours_seed:
        db.add(
            CcOperatingHour(
                id=f"{demo_id}_{day}",
                tenant_id=demo_id,
                day=day,
                open_time=open_t,
                close_time=close_t,
                is_closed=closed,
            )
        )

    services_seed = [
        ("srv_salon_1", "Women's Cut & Signature Blowout", "Sarah / Elena", 65, 45, "Includes deep cleansing wash, custom cut, and styled blowout."),
        ("srv_salon_2", "Full Balayage & Highlights", "Elena (Master Colorist)", 185, 120, "Hand-painted dimensional blonde/caramel tones with gloss toner."),
        ("srv_salon_3", "Men's Precision Cut & Style", "Jake", 35, 30, "Detailed fade or scissor cut, scalp massage, and styling."),
        ("srv_salon_4", "Brazilian Keratin Smoothing", "Sarah", 160, 90, "Eliminates frizz and creates mirror shine lasting 3-4 months."),
    ]
    for sid, name, staff, price, dur, desc in services_seed:
        db.add(
            CcService(
                id=f"{demo_id}_{sid}",
                tenant_id=demo_id,
                name=name,
                staff_member=staff,
                price=price,
                duration_minutes=dur,
                description=desc,
            )
        )

    depts_seed = [
        ("dept_salon_1", "Salon Front Desk", "+1 (415) 392-8810", "Transfer when caller asks for bridal group bookings or front desk coordinator."),
        ("dept_salon_2", "Owner / VIP Escalation", "+1 (415) 392-8899", "Transfer for urgent complaints or VIP stylist requests."),
    ]
    for did, name, phone, desc in depts_seed:
        db.add(
            CcDepartment(
                id=f"{demo_id}_{did}",
                tenant_id=demo_id,
                name=name,
                phone_number=phone,
                description=desc,
            )
        )

    faqs_seed = [
        ("faq_salon_1", "policy", "What is your cancellation policy?", "We kindly ask for 24 hours notice for cancellations or reschedules to avoid a 50% deposit fee."),
        ("faq_salon_2", "parking", "Where can I park?", "We offer free dedicated client parking directly behind the salon on 4th Avenue, plus 2-hour street parking out front."),
        ("faq_salon_3", "general", "Should I wash my hair before a balayage appointment?", "We recommend arriving with dry hair washed within the last 24 hours without heavy oils."),
    ]
    for fid, cat, q, a in faqs_seed:
        db.add(
            CcKnowledgeFaq(
                id=f"{demo_id}_{fid}",
                tenant_id=demo_id,
                category=cat,
                question=q,
                answer=a,
            )
        )

    existing_calls = await db.execute(select(CcCallLog).limit(1))
    if not existing_calls.scalar_one_or_none():
        db.add(
            CcCallLog(
                id="call_101",
                tenant_id=demo_id,
                vapi_call_id="call_101",
                caller_name="Jessica Miller",
                caller_phone="+1 (555) 234-8910",
                timestamp_label="12 mins ago",
                duration="1m 48s",
                status="booked",
                sentiment="positive",
                service_requested="Women's Cut & Signature Blowout ($65)",
                summary="Caller asked if Elena or Sarah had an opening tomorrow morning. AI checked Google Calendar, confirmed 11:00 AM with Sarah, and sent SMS confirmation.",
                transcript=[
                    {"role": "agent", "text": "Hi! Thank you for calling Luxe Hair & Color Lounge. This is Sophia, your AI receptionist. How can I brighten your day?"},
                    {"role": "user", "text": "Hi Sophia! Do you have any openings tomorrow morning for a women's cut and blowout?"},
                    {"role": "agent", "text": "I'd love to check that for you! Our Women's Cut & Signature Blowout is $65 and takes 45 minutes. Sarah has 11:00 AM open tomorrow. Would 11:00 AM work?"},
                ],
            )
        )

    existing_appts = await db.execute(select(CcAppointment).limit(1))
    if not existing_appts.scalar_one_or_none():
        db.add(
            CcAppointment(
                id="apt_201",
                tenant_id=demo_id,
                client_name="Jessica Miller",
                client_phone="+1 (555) 234-8910",
                service_name="Women's Cut & Signature Blowout",
                staff_member="Sarah (Senior Stylist)",
                date_time="Tomorrow, 11:00 AM",
                duration_minutes=45,
                price=65,
                status="confirmed",
                booked_via="AI Voice Receptionist",
            )
        )

    existing_keys = await db.execute(select(CcVoiceApiKey).limit(1))
    if not existing_keys.scalar_one_or_none():
        db.add_all(
            [
                CcVoiceApiKey(
                    id="cc-key-1",
                    tenant_id=demo_id,
                    name="Production Inbound SIP & Calendar Key",
                    agent_name="Luxe Hair & Color Lounge (Sophia)",
                    key_prefix="cc_live_demo1",
                    key_hash="demo_hash_1",
                    masked_secret="API**********",
                    scopes=["voice:inbound-sip", "voice:vapi-assistant", "calendar:google-sync"],
                    webhook_url="https://api.viacodos.com/v1/webhooks/call-colleague",
                    created_label="Active • Auto-Provisioned",
                ),
                CcVoiceApiKey(
                    id="cc-key-2",
                    tenant_id=demo_id,
                    name="Staging WebRTC Sandbox Key",
                    agent_name="Apex Family Dental & Wellness",
                    key_prefix="cc_live_demo2",
                    key_hash="demo_hash_2",
                    masked_secret="API**********",
                    scopes=["voice:webrtc-stream", "voice:warm-transfer"],
                    webhook_url="https://staging.viacodos.com/v1/webhooks/call-colleague",
                    created_label="2 days ago",
                ),
            ]
        )

    await db.commit()
