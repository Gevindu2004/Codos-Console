"""Twilio phone number search, purchase & release provider for CallColleague.ai.

Cleanly separates Twilio REST calls from Vapi binding so additional carriers
(e.g., Telnyx) can share the same interface later. Falls back to realistic
sandbox preview numbers when Twilio credentials are not configured yet.
"""

import logging
import re
from typing import Any, Optional

import httpx

from app.core.config import settings

TWILIO_API_BASE = "https://api.twilio.com/2010-04-10"
logger = logging.getLogger("call_colleague.twilio")

SUPPORTED_COUNTRIES = {"US", "GB", "AU"}
NUMBER_TYPE_SEGMENTS = {
    "local": "Local",
    "mobile": "Mobile",
    "tollfree": "TollFree",
}
MONTHLY_PRICE_ESTIMATE = {
    "US": "$1.15/mo",
    "GB": "$1.15/mo",
    "AU": "$3.00/mo",
}


def is_twilio_configured() -> bool:
    return bool(settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN)


def get_bundle_sid(country: str) -> Optional[str]:
    code = (country or "US").upper()
    if code == "GB":
        return settings.TWILIO_BUNDLE_SID_GB
    if code == "AU":
        return settings.TWILIO_BUNDLE_SID_AU
    return None


def _sandbox_preview_numbers(
    country: str, area_code: Optional[str], number_type: str
) -> list[dict[str, Any]]:
    digits = re.sub(r"\D", "", area_code or "")
    price = MONTHLY_PRICE_ESTIMATE.get(country, "$1.50/mo")
    requires_bundle = country in ("GB", "AU") and not bool(get_bundle_sid(country))

    if country == "GB":
        if number_type == "local":
            prefix = digits[:3] if len(digits) >= 3 else "20"
            suffixes = [
                ("79460101", "London"),
                ("79460214", "London"),
                ("79460388", "London"),
                ("79460492", "London"),
                ("79460537", "London"),
                ("79460661", "London"),
            ]
            return [
                {
                    "phoneNumber": f"+44{prefix}{num}"[:13],
                    "friendlyName": f"+44 {prefix} {num[:4]} {num[4:]}",
                    "locality": loc,
                    "region": "United Kingdom",
                    "country": "GB",
                    "numberType": "local",
                    "monthlyPrice": price,
                    "requiresBundle": requires_bundle,
                    "capabilities": {"voice": True, "sms": False},
                }
                for num, loc in suffixes
            ]
        mobile_samples = [
            ("7400900112", "UK National Mobile"),
            ("7400900248", "UK National Mobile"),
            ("7400900375", "UK National Mobile"),
            ("7400900489", "UK National Mobile"),
            ("7400900514", "UK National Mobile"),
            ("7400900693", "UK National Mobile"),
        ]
        return [
            {
                "phoneNumber": f"+44{num}",
                "friendlyName": f"+44 {num[:4]} {num[4:]}",
                "locality": loc,
                "region": "UK",
                "country": "GB",
                "numberType": "mobile",
                "monthlyPrice": price,
                "requiresBundle": requires_bundle,
                "capabilities": {"voice": True, "sms": True},
            }
            for num, loc in mobile_samples
        ]

    if country == "AU":
        if digits.startswith("0"):
            digits = digits[1:]
        ac = digits[:1] if digits and digits[0] in ("2", "3", "7", "8") else None
        au_samples = [
            (ac or "2", "80152104", "Sydney", "NSW"),
            (ac or "2", "80154892", "Sydney", "NSW"),
            (ac or "3", "90183310", "Melbourne", "VIC"),
            (ac or "3", "90187625", "Melbourne", "VIC"),
            (ac or "7", "31024481", "Brisbane", "QLD"),
            (ac or "8", "61049920", "Perth", "WA"),
        ]
        return [
            {
                "phoneNumber": f"+61{code}{rest}",
                "friendlyName": f"+61 {code} {rest[:4]} {rest[4:]}",
                "locality": city,
                "region": state,
                "country": "AU",
                "numberType": number_type,
                "monthlyPrice": price,
                "requiresBundle": requires_bundle,
                "capabilities": {"voice": True, "sms": False},
            }
            for code, rest, city, state in au_samples
        ]

    # Default: US (+1)
    if number_type == "tollfree":
        us_samples = [
            ("888", "412", "2910", "US Toll-Free", "National"),
            ("888", "412", "4482", "US Toll-Free", "National"),
            ("833", "710", "6194", "US Toll-Free", "National"),
            ("844", "520", "8831", "US Toll-Free", "National"),
            ("855", "690", "3742", "US Toll-Free", "National"),
            ("866", "340", "9105", "US Toll-Free", "National"),
        ]
    else:
        ac = digits[:3] if len(digits) >= 3 else ""
        city_map = {
            "415": ("San Francisco", "CA"),
            "212": ("New York", "NY"),
            "310": ("Los Angeles", "CA"),
            "512": ("Austin", "TX"),
            "305": ("Miami", "FL"),
            "312": ("Chicago", "IL"),
        }
        loc_city, loc_state = city_map.get(ac, ("Local Metro", "US"))
        if ac:
            us_samples = [
                (ac, "392", "4810", loc_city, loc_state),
                (ac, "418", "7294", loc_city, loc_state),
                (ac, "602", "1953", loc_city, loc_state),
                (ac, "734", "8621", loc_city, loc_state),
                (ac, "845", "3307", loc_city, loc_state),
                (ac, "910", "5748", loc_city, loc_state),
            ]
        else:
            us_samples = [
                ("415", "392", "4810", "San Francisco", "CA"),
                ("212", "418", "7294", "New York", "NY"),
                ("310", "602", "1953", "Los Angeles", "CA"),
                ("512", "734", "8621", "Austin", "TX"),
                ("305", "845", "3307", "Miami", "FL"),
                ("312", "910", "5748", "Chicago", "IL"),
            ]
    return [
        {
            "phoneNumber": f"+1{npa}{nxx}{line}",
            "friendlyName": f"+1 ({npa}) {nxx}-{line}",
            "locality": city,
            "region": state,
            "country": "US",
            "numberType": number_type,
            "monthlyPrice": price,
            "requiresBundle": False,
            "capabilities": {"voice": True, "sms": True},
        }
        for npa, nxx, line, city, state in us_samples
    ]


async def search_available_numbers(
    country: str = "US",
    area_code: Optional[str] = None,
    number_type: str = "local",
    limit: int = 8,
) -> dict[str, Any]:
    """Query Twilio AvailablePhoneNumbers or return sandbox preview numbers."""
    code = (country or "US").upper()
    if code not in SUPPORTED_COUNTRIES:
        code = "US"

    ntype = (number_type or "local").lower()
    if ntype not in NUMBER_TYPE_SEGMENTS:
        ntype = "local"
    segment = NUMBER_TYPE_SEGMENTS[ntype]
    requires_bundle = code in ("GB", "AU") and not bool(get_bundle_sid(code))

    if not is_twilio_configured():
        return {
            "mode": "sandbox",
            "country": code,
            "numberType": ntype,
            "requiresBundle": requires_bundle,
            "numbers": _sandbox_preview_numbers(code, area_code, ntype),
        }

    params: dict[str, Any] = {"VoiceEnabled": "true", "PageSize": limit}
    digits = re.sub(r"\D", "", area_code or "")
    if digits:
        if code == "US" and ntype == "local" and len(digits) == 3:
            params["AreaCode"] = digits
        else:
            params["Contains"] = f"*{digits}*"

    url = (
        f"{TWILIO_API_BASE}/Accounts/{settings.TWILIO_ACCOUNT_SID}"
        f"/AvailablePhoneNumbers/{code}/{segment}.json"
    )
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.get(
                url,
                auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
                params=params,
            )
        if res.status_code >= 400:
            err_msg = res.text[:300]
            try:
                err_msg = res.json().get("message") or err_msg
            except Exception:
                pass
            logger.warning("Twilio number search failed (%s): %s", res.status_code, err_msg)
            return {
                "mode": "twilio",
                "country": code,
                "numberType": ntype,
                "requiresBundle": requires_bundle,
                "numbers": [],
                "error": err_msg,
            }

        raw_list = res.json().get("available_phone_numbers") or []
        price = MONTHLY_PRICE_ESTIMATE.get(code, "$1.50/mo")
        numbers = [
            {
                "phoneNumber": item.get("phone_number", ""),
                "friendlyName": item.get("friendly_name") or item.get("phone_number", ""),
                "locality": item.get("locality") or item.get("rate_center") or code,
                "region": item.get("region") or code,
                "country": item.get("iso_country") or code,
                "numberType": ntype,
                "monthlyPrice": price,
                "requiresBundle": requires_bundle,
                "capabilities": item.get("capabilities") or {"voice": True},
            }
            for item in raw_list
            if item.get("phone_number")
        ]
        return {
            "mode": "twilio",
            "country": code,
            "numberType": ntype,
            "requiresBundle": requires_bundle,
            "numbers": numbers,
        }
    except Exception as exc:
        logger.warning("Twilio number search error: %s", exc)
        return {
            "mode": "twilio",
            "country": code,
            "numberType": ntype,
            "requiresBundle": requires_bundle,
            "numbers": [],
            "error": str(exc),
        }


async def purchase_twilio_number(
    phone_number: str,
    country: str = "US",
    friendly_name: str = "",
) -> dict[str, Any]:
    """Purchase a specific E.164 phone number via Twilio IncomingPhoneNumbers API."""
    if not is_twilio_configured() or settings.TWILIO_DRY_RUN:
        return {"sid": None, "phoneNumber": phone_number, "mode": "sandbox"}

    code = (country or "US").upper()
    form_data: dict[str, str] = {
        "PhoneNumber": phone_number,
        "FriendlyName": (friendly_name or "CallColleague AI Line")[:64],
    }
    bundle_sid = get_bundle_sid(code)
    if bundle_sid:
        form_data["BundleSid"] = bundle_sid

    url = (
        f"{TWILIO_API_BASE}/Accounts/{settings.TWILIO_ACCOUNT_SID}"
        "/IncomingPhoneNumbers.json"
    )
    async with httpx.AsyncClient(timeout=20.0) as client:
        res = await client.post(
            url,
            auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
            data=form_data,
        )
    if res.status_code >= 400:
        err_msg = res.text[:400]
        try:
            err_msg = res.json().get("message") or err_msg
        except Exception:
            pass
        raise RuntimeError(f"Twilio number purchase failed ({res.status_code}): {err_msg}")

    data = res.json()
    return {
        "sid": data.get("sid"),
        "phoneNumber": data.get("phone_number") or phone_number,
        "mode": "twilio",
    }


async def release_twilio_number(phone_number_sid: str) -> bool:
    """Release an owned Twilio IncomingPhoneNumber when a tenant is deleted."""
    if not phone_number_sid or not is_twilio_configured() or settings.TWILIO_DRY_RUN:
        return False

    url = (
        f"{TWILIO_API_BASE}/Accounts/{settings.TWILIO_ACCOUNT_SID}"
        f"/IncomingPhoneNumbers/{phone_number_sid}.json"
    )
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.delete(
                url,
                auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
            )
        return res.status_code < 400
    except Exception as exc:
        logger.warning("Twilio number release error for %s: %s", phone_number_sid, exc)
        return False
