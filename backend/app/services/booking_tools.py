"""Voice-agent tool handlers (availability / book / cancel) for CallColleague.ai.

Python port of the Amja Travels Node tools (`checkAvailability.js`, `bookAppointment.js`,
`cancelAppointment.js`), made multi-tenant. Google Calendar is used when the tenant has
connected it; otherwise availability falls back to the tenant's own `cc_appointments`.
"""

import logging
import re
import time
from datetime import date, datetime, timedelta
from typing import Any, Optional
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.call_colleague import CcAppointment, CcTenant
from app.services import google_calendar as gcal

logger = logging.getLogger("call_colleague.tools")

DAY_NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
MONTHS = {
    "january": 1, "jan": 1, "february": 2, "feb": 2, "march": 3, "mar": 3,
    "april": 4, "apr": 4, "may": 5, "june": 6, "jun": 6, "july": 7, "jul": 7,
    "august": 8, "aug": 8, "september": 9, "sep": 9, "sept": 9, "october": 10,
    "oct": 10, "november": 11, "nov": 11, "december": 12, "dec": 12,
}
ORDINALS = {
    "first": 1, "second": 2, "third": 3, "fourth": 4, "fifth": 5, "sixth": 6,
    "seventh": 7, "eighth": 8, "ninth": 9, "tenth": 10, "eleventh": 11,
    "twelfth": 12, "thirteenth": 13, "fourteenth": 14, "fifteenth": 15,
    "sixteenth": 16, "seventeenth": 17, "eighteenth": 18, "nineteenth": 19,
    "twentieth": 20, "twenty-first": 21, "twenty-second": 22, "twenty-third": 23,
    "twenty-fourth": 24, "twenty-fifth": 25, "twenty-sixth": 26,
    "twenty-seventh": 27, "twenty-eighth": 28, "twenty-ninth": 29,
    "thirtieth": 30, "thirty-first": 31,
}


def tenant_tz(tenant: CcTenant) -> ZoneInfo:
    try:
        return ZoneInfo(tenant.timezone)
    except Exception:
        return ZoneInfo("UTC")


def now_in(tenant: CcTenant) -> datetime:
    return datetime.now(tenant_tz(tenant))


def parse_flexible_date(text: Any, now: datetime) -> Optional[date]:
    """Handles 'tomorrow', 'day after tomorrow', '5th June', 'June 5', 'next friday', ISO."""
    if not text or not isinstance(text, str):
        return None
    clean = text.strip().lower()
    if re.search(r"\d{4}-\d{2}-\d{2}", clean):
        try:
            return date.fromisoformat(re.search(r"\d{4}-\d{2}-\d{2}", clean).group(0))
        except ValueError:
            pass
    if "day after tomorrow" in clean:
        return (now + timedelta(days=2)).date()
    if "tomorrow" in clean:
        return (now + timedelta(days=1)).date()
    if "today" in clean or "tonight" in clean:
        return now.date()

    for day_idx, day_name in enumerate(DAY_NAMES):
        if re.search(rf"\b{day_name}\b", clean):
            delta = (day_idx - now.weekday()) % 7
            if delta == 0 and "next" in clean:
                delta = 7
            return (now + timedelta(days=delta)).date()

    for word in sorted(ORDINALS, key=len, reverse=True):
        clean = re.sub(rf"\b{word}\b", str(ORDINALS[word]), clean)
    clean = re.sub(r"\b(\d+)(st|nd|rd|th)\b", r"\1", clean)
    clean = re.sub(r"\b(of|the)\b", " ", clean)

    month = None
    for name, idx in MONTHS.items():
        if re.search(rf"\b{name}\b", clean):
            month = idx
            clean = re.sub(rf"\b{name}\b", " ", clean, count=1)
            break
    if month:
        m = re.search(r"\b(\d{1,2})\b", clean)
        if m:
            try:
                parsed = date(now.year, month, int(m.group(1)))
                if parsed < now.date():
                    parsed = date(now.year + 1, month, int(m.group(1)))
                return parsed
            except ValueError:
                return None
    return None


def parse_flexible_time(text: Any) -> Optional[tuple[int, int]]:
    if not text or not isinstance(text, str):
        return None
    clean = text.strip().lower()
    m = re.search(r"\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b", clean)
    if m:
        h, mi, ap = int(m.group(1)), int(m.group(2) or 0), m.group(3)
        if ap == "pm" and h < 12:
            h += 12
        if ap == "am" and h == 12:
            h = 0
        return h, mi
    m = re.search(r"\b([01]?\d|2[0-3]):([0-5]\d)\b", clean)
    if m:
        return int(m.group(1)), int(m.group(2))
    return None


def _hours_for(tenant: CcTenant, d: date) -> Optional[tuple[int, int, int, int]]:
    """Returns (open_h, open_m, close_h, close_m) or None when closed."""
    name = DAY_NAMES[d.weekday()]
    for h in tenant.operating_hours:
        if h.day.strip().lower().startswith(name[:3]):
            if h.is_closed:
                return None
            o = parse_flexible_time(h.open_time) or (9, 0)
            c = parse_flexible_time(h.close_time) or (17, 0)
            return o[0], o[1], c[0], c[1]
    return 9, 0, 17, 0


def _is_placeholder(val: Any) -> bool:
    if not isinstance(val, str):
        return False
    low = val.lower().strip()
    return (
        low.startswith("[")
        or "placeholder" in low
        or "caller's name" in low
        or low in ("unknown", "none", "")
    )


def _fmt_slot(dt: datetime) -> str:
    return dt.strftime("%I:%M %p").lstrip("0")


async def _local_busy(
    db: AsyncSession, tenant: CcTenant, tz: ZoneInfo, day_start: datetime, day_end: datetime
) -> list[tuple[datetime, datetime]]:
    res = await db.execute(
        select(CcAppointment).where(
            CcAppointment.tenant_id == tenant.id,
            CcAppointment.status != "cancelled",
            CcAppointment.starts_at.is_not(None),
            CcAppointment.starts_at >= day_start.replace(tzinfo=None),
            CcAppointment.starts_at < day_end.replace(tzinfo=None),
        )
    )
    out = []
    for a in res.scalars().all():
        s = a.starts_at.replace(tzinfo=tz)
        out.append((s, s + timedelta(minutes=a.duration_minutes or 30)))
    return out


async def check_availability(
    db: AsyncSession, tenant: CcTenant, args: dict[str, Any]
) -> dict[str, Any]:
    tz = tenant_tz(tenant)
    now = now_in(tenant)
    target = parse_flexible_date(args.get("date"), now)
    if not target:
        return {"success": False, "message": f"Invalid date '{args.get('date')}'. Ask for a specific date."}
    if target < now.date():
        return {
            "success": False,
            "today": now.strftime("%A, %d %B %Y"),
            "message": f"That date is in the past. Today is {now.strftime('%d %B %Y')}. Ask for a future date.",
        }

    hours = _hours_for(tenant, target)
    if hours is None:
        return {"success": False, "message": f"The business is closed on {target.strftime('%A')}s. Suggest another day."}

    service_name = str(args.get("serviceName") or "").lower()
    svc = next((s for s in tenant.services if s.name.lower() == service_name), None)
    slot_min = svc.duration_minutes if svc else 30

    day_start = datetime(target.year, target.month, target.day, hours[0], hours[1], tzinfo=tz)
    day_end = datetime(target.year, target.month, target.day, hours[2], hours[3], tzinfo=tz)

    busy_local = await _local_busy(db, tenant, tz, day_start, day_end)
    integ = await gcal.get_integration(db, tenant.id) if gcal.is_configured() else None
    calendar_source = "local"
    google_busy: list[dict[str, str]] = []
    if integ:
        try:
            google_busy = await gcal.get_busy(tenant.id, integ, day_start, day_end, tz)
            calendar_source = "google"
        except Exception as e:  # fall back to local DB, like the Node app's non-fatal path
            logger.warning("Google freeBusy failed for %s: %s", tenant.id, e)

    slots: list[str] = []
    cur = day_start
    while cur + timedelta(minutes=slot_min) <= day_end:
        end = cur + timedelta(minutes=slot_min)
        busy = (
            cur < now
            or any(cur < b_end and end > b_start for b_start, b_end in busy_local)
            or (google_busy and gcal.overlaps(google_busy, cur, end))
        )
        if not busy:
            slots.append(_fmt_slot(cur))
        cur = end

    if not slots:
        return {"success": False, "message": "No availability on that date. Suggest the next business day."}
    return {
        "success": True,
        "today": now.strftime("%A, %d %B %Y"),
        "date": target.strftime("%A, %d %B %Y"),
        "slots": slots[:8],
        "source": calendar_source,
    }


async def book_appointment(
    db: AsyncSession, tenant: CcTenant, args: dict[str, Any], call_customer: dict[str, Any]
) -> dict[str, Any]:
    name = args.get("clientName") or args.get("customer_name") or call_customer.get("name")
    phone = args.get("clientPhone") or args.get("phone") or call_customer.get("number")
    missing = []
    if not name or _is_placeholder(name):
        missing.append("clientName")
    if not phone or _is_placeholder(phone):
        missing.append("clientPhone")
    if missing:
        return {
            "success": False,
            "missing_fields": missing,
            "message": f"Cannot book: missing {', '.join(missing)}. Ask the caller directly.",
        }

    tz = tenant_tz(tenant)
    now = now_in(tenant)
    raw_dt = str(args.get("dateTime") or "")
    d = parse_flexible_date(raw_dt or args.get("date"), now)
    t = parse_flexible_time(raw_dt or args.get("time"))
    if not d or not t:
        return {
            "success": False,
            "message": "Could not understand the date/time. Confirm an exact date and time (e.g. 2026-11-20 2:00 PM) with the caller.",
        }
    start = datetime(d.year, d.month, d.day, t[0], t[1], tzinfo=tz)
    if start < now:
        return {"success": False, "message": "That time is in the past. Ask for a future time."}
    hours = _hours_for(tenant, d)
    if hours is None:
        return {"success": False, "message": f"The business is closed on {d.strftime('%A')}s."}

    service_name = str(args.get("serviceName") or "Consultation")
    svc = next((s for s in tenant.services if s.name.lower() == service_name.lower()), None)
    duration = svc.duration_minutes if svc else 30
    end = start + timedelta(minutes=duration)

    # Double-booking guard (local DB + Google when connected)
    day_start = start.replace(hour=0, minute=0)
    local = await _local_busy(db, tenant, tz, day_start, day_start + timedelta(days=1))
    if any(start < b_end and end > b_start for b_start, b_end in local):
        return {"success": False, "message": "That slot was just taken. Call check_calendar_availability again."}

    integ = await gcal.get_integration(db, tenant.id) if gcal.is_configured() else None
    gcal_id = None
    if integ:
        try:
            busy = await gcal.get_busy(tenant.id, integ, day_start, day_start + timedelta(days=1), tz)
            if gcal.overlaps(busy, start, end):
                return {"success": False, "message": "That slot is no longer free. Call check_calendar_availability again."}
            gcal_id = await gcal.insert_event(
                tenant.id,
                integ,
                f"{service_name}: {name}",
                f"Customer: {name}\nPhone: {phone}\nService: {service_name}\nBooked by AI receptionist ({tenant.business_name})",
                start,
                end,
                tenant.timezone,
            )
        except Exception as e:  # non-fatal, DB booking still succeeds
            logger.warning("Google event insert failed for %s: %s", tenant.id, e)

    appt = CcAppointment(
        id=f"apt_{int(time.time() * 1000)}",
        tenant_id=tenant.id,
        client_name=str(name),
        client_phone=str(phone),
        service_name=svc.name if svc else service_name,
        staff_member=str(args.get("staffMember") or (svc.staff_member if svc else None) or "Available Specialist"),
        date_time=f"{start.strftime('%A, %d %B %Y')}, {_fmt_slot(start)}",
        starts_at=start.replace(tzinfo=None),
        duration_minutes=duration,
        price=float(svc.price) if svc else 0,
        status="confirmed",
        booked_via="AI Voice Receptionist",
        gcal_event_id=gcal_id,
    )
    db.add(appt)
    await db.commit()
    return {
        "success": True,
        "booking_id": appt.id,
        "calendar_synced": bool(gcal_id),
        "message": f"Appointment confirmed for {appt.client_name}: {appt.service_name} on {appt.date_time}.",
    }


async def cancel_appointment(
    db: AsyncSession, tenant: CcTenant, args: dict[str, Any], call_customer: dict[str, Any]
) -> dict[str, Any]:
    phone = args.get("clientPhone") or args.get("phone") or call_customer.get("number")
    if not phone:
        return {"success": False, "message": "No phone number provided."}
    last9 = re.sub(r"\D", "", str(phone))[-9:]
    now = now_in(tenant).replace(tzinfo=None)

    res = await db.execute(
        select(CcAppointment)
        .where(CcAppointment.tenant_id == tenant.id, CcAppointment.status == "confirmed")
        .order_by(CcAppointment.starts_at.asc().nulls_last())
    )
    match = next(
        (
            a
            for a in res.scalars().all()
            if last9 and last9 in re.sub(r"\D", "", a.client_phone)
            and (a.starts_at is None or a.starts_at >= now)
        ),
        None,
    )
    if not match:
        return {"success": False, "message": "No upcoming appointment found for that number."}

    details = {"name": match.client_name, "service": match.service_name, "when": match.date_time}
    if not args.get("commit", True):
        return {"success": True, "message": "Appointment found. Confirm with the caller before cancelling.", "appointment": details}

    if match.gcal_event_id and gcal.is_configured():
        integ = await gcal.get_integration(db, tenant.id)
        if integ:
            try:
                await gcal.delete_event(tenant.id, integ, match.gcal_event_id)
            except Exception as e:
                logger.warning("Google event delete failed: %s", e)
    match.status = "cancelled"
    await db.commit()
    return {"success": True, "message": "Appointment cancelled.", "appointment": details}
