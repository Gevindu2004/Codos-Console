from datetime import datetime
import hashlib
import json
import random
import secrets
import time
from typing import Any, Optional

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from pydantic import BaseModel
from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db
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
from app.services import booking_tools, google_calendar
from app.services.vapi_service import (
    bind_vapi_phone_number,
    build_vapi_assistant_dto,
    create_vapi_assistant,
    delete_vapi_assistant,
    fetch_vapi_calls,
    update_vapi_assistant,
)

router = APIRouter(tags=["CallColleague.ai"])


def _tenant_load_options():
    return (
        selectinload(CcTenant.operating_hours),
        selectinload(CcTenant.services),
        selectinload(CcTenant.departments),
        selectinload(CcTenant.knowledge_faqs),
    )


def _serialize_tenant(t: CcTenant) -> dict[str, Any]:
    return {
        "id": t.id,
        "email": t.email,
        "businessName": t.business_name,
        "industry": t.industry,
        "virtualPhoneNumber": t.virtual_phone_number or "+1 (888) 412-9940",
        "agentActive": t.agent_active,
        "planTier": t.plan_tier,
        "timezone": t.timezone,
        "voicePersona": t.voice_persona,
        "vapiAssistantId": t.vapi_assistant_id or t.id,
        "vapiPhoneNumberId": t.vapi_phone_number_id,
        "telephonySetupType": t.telephony_setup_type,
        "forwardingNumber": t.forwarding_number or "",
        "selectedCarrierId": t.selected_carrier_id or "dialog_sl",
        "isNumberVerified": t.is_number_verified,
        "sipConfig": t.sip_config,
        "googleCalendarConnected": t.google_calendar_connected,
        "calendarEmail": t.calendar_email or "",
        "operatingHours": [
            {
                "day": h.day,
                "openTime": h.open_time,
                "closeTime": h.close_time,
                "isClosed": h.is_closed,
            }
            for h in t.operating_hours
        ],
        "services": [
            {
                "id": s.id.replace(f"{t.id}_", ""),
                "name": s.name,
                "staffMember": s.staff_member,
                "price": float(s.price),
                "durationMinutes": s.duration_minutes,
                "description": s.description,
            }
            for s in t.services
        ],
        "departments": [
            {
                "id": d.id.replace(f"{t.id}_", ""),
                "name": d.name,
                "phoneNumber": d.phone_number,
                "description": d.description,
            }
            for d in t.departments
        ],
        "knowledgeFaqs": [
            {
                "id": f.id.replace(f"{t.id}_", ""),
                "category": f.category,
                "question": f.question,
                "answer": f.answer,
            }
            for f in t.knowledge_faqs
        ],
    }


def _serialize_call(c: CcCallLog) -> dict[str, Any]:
    return {
        "id": c.id,
        "tenantId": c.tenant_id,
        "callerName": c.caller_name,
        "callerPhone": c.caller_phone,
        "timestamp": c.timestamp_label,
        "duration": c.duration,
        "status": c.status,
        "sentiment": c.sentiment,
        "serviceRequested": c.service_requested,
        "summary": c.summary,
        "recordingUrl": c.recording_url,
        "transcript": c.transcript,
    }


def _serialize_appointment(a: CcAppointment) -> dict[str, Any]:
    return {
        "id": a.id,
        "tenantId": a.tenant_id,
        "clientName": a.client_name,
        "clientPhone": a.client_phone,
        "serviceName": a.service_name,
        "staffMember": a.staff_member,
        "dateTime": a.date_time,
        "durationMinutes": a.duration_minutes,
        "price": float(a.price),
        "status": a.status,
        "bookedVia": a.booked_via,
    }


async def _find_tenant(
    db: AsyncSession, agent_id: Optional[str] = None, phone_number: Optional[str] = None
) -> Optional[CcTenant]:
    res = await db.execute(select(CcTenant).options(*_tenant_load_options()))
    tenants = res.scalars().all()
    target_digits = "".join(ch for ch in (phone_number or "") if ch.isdigit())

    for t in tenants:
        if agent_id and (t.id == agent_id or t.vapi_assistant_id == agent_id):
            return t
        if target_digits and t.virtual_phone_number:
            t_digits = "".join(ch for ch in t.virtual_phone_number if ch.isdigit())
            if t_digits == target_digits:
                return t
    return None


# ---------------------------------------------------------------------------
# 1. Agent Provisioning & Live Vapi Brain Sync
# ---------------------------------------------------------------------------
@router.post("/agents/sandbox-config")
async def compile_sandbox_config(request: Request):
    """Compiles transient Step 1-5 wizard state into a capped Vapi WebRTC sandbox DTO."""
    payload = await request.json()
    webhook_url = f"{settings.APP_PUBLIC_URL.rstrip('/')}{settings.API_V1_STR}/webhooks/call-colleague"
    dto = build_vapi_assistant_dto(payload, webhook_url)
    dto["maxDurationSeconds"] = 180
    dto["silenceTimeoutSeconds"] = 30
    return dto


@router.get("/agents")
async def list_agents(db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(CcTenant)
        .options(*_tenant_load_options())
        .order_by(CcTenant.created_at.desc())
    )
    return {"agents": [_serialize_tenant(t) for t in res.scalars().all()]}


@router.post("/agents/provision", status_code=status.HTTP_201_CREATED)
async def provision_agent(request: Request, db: AsyncSession = Depends(get_db)):
    payload = await request.json()
    business_name = (payload.get("businessName") or "").strip()
    if not business_name:
        raise HTTPException(
            status_code=400, detail="businessName is required to provision a Vapi agent."
        )

    webhook_url = f"{settings.APP_PUBLIC_URL.rstrip('/')}{settings.API_V1_STR}/webhooks/call-colleague"
    assistant_dto = build_vapi_assistant_dto(payload, webhook_url)

    try:
        created = await create_vapi_assistant(assistant_dto)
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    agent_id = created["id"]

    # Phone number or SIP binding
    random_digits = random.randint(1000, 9999)
    telephony_type = payload.get("telephonySetupType", "new_dedicated_number")
    assigned_number = (
        f"+1 (888) 412-{random_digits}"
        if telephony_type == "new_dedicated_number"
        else f"+1 (800) 945-{random_digits}"
    )
    vapi_phone_id: Optional[str] = None
    sip_cfg = payload.get("sipConfig") or {"sipUri": "", "authUsername": "", "transport": "TLS"}
    sip_endpoint_uri = (
        sip_cfg.get("sipUri") or f"sip:{agent_id}@sip.vapi.ai;transport=tls"
        if telephony_type == "sip_pbx_trunk"
        else None
    )

    if telephony_type == "new_dedicated_number":
        phone_data = await bind_vapi_phone_number(agent_id, business_name)
        if phone_data:
            vapi_phone_id = phone_data.get("id")
            if phone_data.get("number"):
                assigned_number = phone_data["number"]

    tenant = CcTenant(
        id=agent_id,
        user_id=agent_id,
        email="owner@yourbusiness.com",
        business_name=business_name,
        industry=payload.get("industry", "salon"),
        timezone=payload.get("timezone", "America/New_York"),
        plan_tier=payload.get("planTier", "growth"),
        agent_active=True,
        voice_persona=payload.get("voicePersona") or {},
        vapi_assistant_id=agent_id,
        vapi_phone_number_id=vapi_phone_id,
        virtual_phone_number=assigned_number,
        telephony_setup_type=telephony_type,
        forwarding_number=payload.get("forwardingNumber", ""),
        selected_carrier_id=payload.get("selectedCarrierId", "dialog_sl"),
        is_number_verified=bool(payload.get("isNumberVerified", False)),
        sip_config=sip_cfg,
        google_calendar_connected=False,  # only true after a real OAuth connect
        calendar_email="",
    )
    db.add(tenant)
    await db.flush()

    for h in payload.get("operatingHours") or []:
        db.add(
            CcOperatingHour(
                id=f"{agent_id}_{h['day']}"[:64],
                tenant_id=agent_id,
                day=h["day"],
                open_time=h["openTime"],
                close_time=h["closeTime"],
                is_closed=bool(h.get("isClosed", False)),
            )
        )

    for s in payload.get("services") or []:
        db.add(
            CcService(
                id=f"{agent_id}_{s['id']}"[:64],
                tenant_id=agent_id,
                name=s["name"],
                staff_member=s.get("staffMember"),
                price=float(s.get("price", 0)),
                duration_minutes=int(s.get("durationMinutes", 30)),
                description=s.get("description", ""),
            )
        )

    for d in payload.get("departments") or []:
        db.add(
            CcDepartment(
                id=f"{agent_id}_{d['id']}"[:64],
                tenant_id=agent_id,
                name=d["name"],
                phone_number=d["phoneNumber"],
                description=d.get("description", ""),
            )
        )

    for f in payload.get("knowledgeFaqs") or []:
        db.add(
            CcKnowledgeFaq(
                id=f"{agent_id}_{f['id']}"[:64],
                tenant_id=agent_id,
                category=f.get("category", "policy"),
                question=f["question"],
                answer=f["answer"],
            )
        )

    await db.commit()

    return {
        "agentId": agent_id,
        "virtualPhoneNumber": assigned_number,
        "sipEndpointUri": sip_endpoint_uri,
        "status": "active",
    }


@router.get("/agents/{agent_id}")
async def get_agent(agent_id: str, db: AsyncSession = Depends(get_db)):
    tenant = await _find_tenant(db, agent_id=agent_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Agent not found")
    return _serialize_tenant(tenant)


@router.patch("/agents/{agent_id}")
async def update_agent(
    agent_id: str, request: Request, db: AsyncSession = Depends(get_db)
):
    updates = await request.json()
    tenant = await _find_tenant(db, agent_id=agent_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Agent not found")

    if "businessName" in updates:
        tenant.business_name = updates["businessName"]
    if "industry" in updates:
        tenant.industry = updates["industry"]
    if "timezone" in updates:
        tenant.timezone = updates["timezone"]
    if "planTier" in updates:
        tenant.plan_tier = updates["planTier"]
    if "agentActive" in updates:
        tenant.agent_active = bool(updates["agentActive"])
    if "voicePersona" in updates:
        tenant.voice_persona = updates["voicePersona"]
    if "virtualPhoneNumber" in updates:
        tenant.virtual_phone_number = updates["virtualPhoneNumber"]

    if "operatingHours" in updates and isinstance(updates["operatingHours"], list):
        await db.execute(
            delete(CcOperatingHour).where(CcOperatingHour.tenant_id == tenant.id)
        )
        for h in updates["operatingHours"]:
            db.add(
                CcOperatingHour(
                    id=f"{tenant.id}_{h['day']}"[:64],
                    tenant_id=tenant.id,
                    day=h["day"],
                    open_time=h["openTime"],
                    close_time=h["closeTime"],
                    is_closed=bool(h.get("isClosed", False)),
                )
            )

    if "services" in updates and isinstance(updates["services"], list):
        await db.execute(delete(CcService).where(CcService.tenant_id == tenant.id))
        for s in updates["services"]:
            db.add(
                CcService(
                    id=f"{tenant.id}_{s['id']}"[:64],
                    tenant_id=tenant.id,
                    name=s["name"],
                    staff_member=s.get("staffMember"),
                    price=float(s.get("price", 0)),
                    duration_minutes=int(s.get("durationMinutes", 30)),
                    description=s.get("description", ""),
                )
            )

    if "departments" in updates and isinstance(updates["departments"], list):
        await db.execute(
            delete(CcDepartment).where(CcDepartment.tenant_id == tenant.id)
        )
        for d in updates["departments"]:
            db.add(
                CcDepartment(
                    id=f"{tenant.id}_{d['id']}"[:64],
                    tenant_id=tenant.id,
                    name=d["name"],
                    phone_number=d["phoneNumber"],
                    description=d.get("description", ""),
                )
            )

    if "knowledgeFaqs" in updates and isinstance(updates["knowledgeFaqs"], list):
        await db.execute(
            delete(CcKnowledgeFaq).where(CcKnowledgeFaq.tenant_id == tenant.id)
        )
        for f in updates["knowledgeFaqs"]:
            db.add(
                CcKnowledgeFaq(
                    id=f"{tenant.id}_{f['id']}"[:64],
                    tenant_id=tenant.id,
                    category=f.get("category", "policy"),
                    question=f["question"],
                    answer=f["answer"],
                )
            )

    tenant_id = tenant.id
    await db.commit()
    db.expire_all()

    # Reload with fresh relations and push updated Brain to Vapi
    refreshed = await _find_tenant(db, agent_id=tenant_id)
    if not refreshed:
        raise HTTPException(status_code=404, detail="Agent not found after update")
    serialized = _serialize_tenant(refreshed)
    webhook_url = f"{settings.APP_PUBLIC_URL.rstrip('/')}{settings.API_V1_STR}/webhooks/call-colleague"
    assistant_dto = build_vapi_assistant_dto(serialized, webhook_url)
    vapi_synced = await update_vapi_assistant(
        serialized["vapiAssistantId"], assistant_dto
    )

    return {"tenant": serialized, "vapiSynced": vapi_synced}


@router.delete("/agents/{agent_id}")
async def delete_agent(agent_id: str, db: AsyncSession = Depends(get_db)):
    tenant = await _find_tenant(db, agent_id=agent_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Agent not found")

    if tenant.vapi_assistant_id:
        await delete_vapi_assistant(tenant.vapi_assistant_id)

    await db.delete(tenant)
    await db.commit()
    return {"deleted": True, "agentId": agent_id}


# ---------------------------------------------------------------------------
# 2. Vapi Server Webhook Receiver
# ---------------------------------------------------------------------------
@router.post("/webhooks/call-colleague")
async def vapi_webhook_receiver(
    request: Request,
    x_vapi_secret: Optional[str] = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    # Secret is mandatory whenever one is configured (constant-time compare).
    if settings.VAPI_WEBHOOK_SECRET:
        if not x_vapi_secret or not secrets.compare_digest(
            x_vapi_secret, settings.VAPI_WEBHOOK_SECRET
        ):
            raise HTTPException(status_code=401, detail="Invalid webhook secret")

    body = await request.json()
    message = body.get("message") or {}
    msg_type = message.get("type")
    if not msg_type:
        return {"ok": True}

    call_obj = message.get("call") or {}
    assistant_id = call_obj.get("assistantId")
    inbound_number = (call_obj.get("phoneNumber") or {}).get("number")

    tenant = await _find_tenant(db, agent_id=assistant_id, phone_number=inbound_number)
    # Never fall back to another tenant: an unmatched call must not touch any client's data.
    if not tenant:
        if msg_type == "tool-calls":
            tool_calls = message.get("toolCallList") or message.get("toolCalls") or []
            return {
                "results": [
                    {
                        "toolCallId": tc.get("id", ""),
                        "result": json.dumps(
                            {"success": False, "message": "This business is not configured. Apologise and offer to take a message."}
                        ),
                    }
                    for tc in tool_calls
                ]
            }
        return {"ok": True, "ignored": "unknown tenant"}

    if msg_type == "assistant-request":
        if tenant and not tenant.agent_active:
            return {
                "error": f"{tenant.business_name} AI receptionist is currently paused. Please leave a message after the tone."
            }
        return {"assistantId": (tenant.vapi_assistant_id if tenant else assistant_id)}

    if msg_type == "tool-calls" and tenant:
        tool_calls = message.get("toolCallList") or message.get("toolCalls") or []
        results: list[dict[str, str]] = []

        for tc in tool_calls:
            tc_id = tc.get("id", "")
            fn = tc.get("function") or {}
            fn_name = fn.get("name")
            raw_args = fn.get("arguments")
            if isinstance(raw_args, str):
                try:
                    args = json.loads(raw_args)
                except Exception:
                    args = {}
            elif isinstance(raw_args, dict):
                args = raw_args
            else:
                args = {}

            customer = call_obj.get("customer") or {}
            if fn_name == "check_calendar_availability":
                out = await booking_tools.check_availability(db, tenant, args)
            elif fn_name == "book_appointment":
                out = await booking_tools.book_appointment(db, tenant, args, customer)
            elif fn_name == "cancel_appointment":
                out = await booking_tools.cancel_appointment(db, tenant, args, customer)
            else:
                out = {"success": False, "message": f"Unknown tool: {fn_name}"}
            results.append({"toolCallId": tc_id, "result": json.dumps(out)})

        return {"results": results}

    if msg_type == "end-of-call-report" and tenant:
        call_id = call_obj.get("id") or f"call_{int(time.time() * 1000)}"
        existing = await db.execute(select(CcCallLog).where(CcCallLog.id == call_id))
        if not existing.scalar_one_or_none():
            duration_sec = round(float(message.get("durationSeconds") or 60))
            mins, secs = divmod(duration_sec, 60)
            artifact = message.get("artifact") or {}
            artifact_msgs = artifact.get("messages") or []

            if artifact_msgs:
                transcript = [
                    {
                        "role": "user" if m.get("role") == "user" else "agent",
                        "text": str(m.get("message") or m.get("content") or ""),
                    }
                    for m in artifact_msgs
                    if m.get("role") in ("assistant", "bot", "user")
                ]
            else:
                transcript = [
                    {
                        "role": "user" if line.lower().startswith("user") else "agent",
                        "text": line.split(":", 1)[-1].strip(),
                    }
                    for line in str(message.get("transcript") or "").splitlines()
                    if line.strip()
                ]

            summary = str(message.get("summary") or "Inbound call handled by CallColleague AI.")
            lower_sum = summary.lower()
            call_status = (
                "transferred"
                if "transfer" in lower_sum
                else "booked"
                if ("book" in lower_sum or "confirm" in lower_sum)
                else "missed"
                if message.get("endedReason") == "customer-did-not-answer"
                else "completed"
            )

            customer = call_obj.get("customer") or {}
            db.add(
                CcCallLog(
                    id=call_id,
                    tenant_id=tenant.id,
                    vapi_call_id=call_id,
                    caller_name=customer.get("name") or "Inbound Caller",
                    caller_phone=customer.get("number") or "Private Number",
                    timestamp_label="Just now",
                    duration=f"{mins}m {secs}s",
                    status=call_status,
                    sentiment="urgent" if "urgent" in lower_sum else "positive",
                    summary=summary,
                    recording_url=message.get("recordingUrl") or artifact.get("recordingUrl"),
                    transcript=transcript,
                )
            )
            await db.commit()

        return {"received": True, "callId": call_id}

    return {"ok": True}


# ---------------------------------------------------------------------------
# 3. Call Logs, Appointments, OTP & Scoped Voice API Keys
# ---------------------------------------------------------------------------
def _compute_call_duration_seconds(vc: dict[str, Any]) -> int:
    if vc.get("durationSeconds") is not None:
        try:
            return max(0, round(float(vc["durationSeconds"])))
        except (TypeError, ValueError):
            pass
    started_raw = vc.get("startedAt")
    ended_raw = vc.get("endedAt")
    if started_raw and ended_raw:
        try:
            s_dt = datetime.fromisoformat(str(started_raw).replace("Z", "+00:00"))
            e_dt = datetime.fromisoformat(str(ended_raw).replace("Z", "+00:00"))
            return max(0, round((e_dt - s_dt).total_seconds()))
        except ValueError:
            pass
    return 60


async def _sync_vapi_calls_for_tenant(db: AsyncSession, tenant: CcTenant) -> None:
    """Pull completed calls from Vapi REST API and upsert missing rows into cc_call_logs."""
    assistant_id = tenant.vapi_assistant_id
    if (
        not assistant_id
        or assistant_id.startswith("ag_demo_")
        or assistant_id.startswith("usr_")
    ):
        return

    raw_calls = await fetch_vapi_calls(assistant_id, limit=15)
    if not raw_calls:
        return

    added = False
    for vc in raw_calls:
        if vc.get("status") != "ended" and not vc.get("endedAt"):
            continue
        call_id = vc.get("id")
        if not call_id:
            continue

        existing = await db.execute(
            select(CcCallLog.id).where(
                or_(CcCallLog.id == call_id, CcCallLog.vapi_call_id == call_id)
            )
        )
        if existing.scalar_one_or_none():
            continue

        duration_sec = _compute_call_duration_seconds(vc)
        mins, secs = divmod(duration_sec, 60)

        artifact = vc.get("artifact") or {}
        analysis = vc.get("analysis") or {}
        raw_msgs = artifact.get("messages") or vc.get("messages") or []
        if raw_msgs:
            transcript = [
                {
                    "role": "user" if m.get("role") == "user" else "agent",
                    "text": str(m.get("message") or m.get("content") or ""),
                }
                for m in raw_msgs
                if m.get("role") in ("assistant", "bot", "user")
                and str(m.get("message") or m.get("content") or "").strip()
            ]
        else:
            transcript = [
                {
                    "role": "user" if line.lower().startswith("user") else "agent",
                    "text": line.split(":", 1)[-1].strip(),
                }
                for line in str(artifact.get("transcript") or vc.get("transcript") or "").splitlines()
                if line.strip()
            ]

        summary = str(
            analysis.get("summary")
            or vc.get("summary")
            or artifact.get("summary")
            or "Live Vapi voice call handled by AI receptionist."
        )
        lower_sum = summary.lower()
        call_status = (
            "transferred"
            if "transfer" in lower_sum
            else "booked"
            if ("book" in lower_sum or "confirm" in lower_sum)
            else "missed"
            if vc.get("endedReason") == "customer-did-not-answer"
            else "completed"
        )

        customer = vc.get("customer") or {}
        caller_phone = customer.get("number") or (
            "WebRTC Browser Call" if vc.get("type") == "webCall" else "Inbound Caller"
        )
        caller_name = customer.get("name") or (
            "Web Test Caller" if vc.get("type") == "webCall" else "Inbound Caller"
        )
        recording_url = artifact.get("recordingUrl") or vc.get("recordingUrl")

        ts_label = "Synced from Vapi"
        ended_raw = vc.get("endedAt") or vc.get("createdAt")
        if ended_raw:
            try:
                ended_dt = datetime.fromisoformat(str(ended_raw).replace("Z", "+00:00"))
                ts_label = ended_dt.strftime("%b %d, %H:%M UTC")
            except ValueError:
                pass

        db.add(
            CcCallLog(
                id=str(call_id)[:64],
                tenant_id=tenant.id,
                vapi_call_id=str(call_id)[:100],
                caller_name=str(caller_name)[:160],
                caller_phone=str(caller_phone)[:40],
                timestamp_label=ts_label[:80],
                duration=f"{mins}m {secs:02d}s",
                status=call_status,
                sentiment="urgent" if "urgent" in lower_sum else "positive",
                summary=summary,
                recording_url=recording_url,
                transcript=transcript,
            )
        )
        added = True

    if added:
        await db.commit()


@router.get("/calls")
async def list_calls(
    tenantId: Optional[str] = Query(default=None), db: AsyncSession = Depends(get_db)
):
    target_tenant = None
    if tenantId:
        target_tenant = await _find_tenant(db, agent_id=tenantId)
    else:
        latest_res = await db.execute(
            select(CcTenant)
            .options(*_tenant_load_options())
            .order_by(CcTenant.created_at.desc())
            .limit(1)
        )
        target_tenant = latest_res.scalar_one_or_none()

    if target_tenant:
        try:
            await _sync_vapi_calls_for_tenant(db, target_tenant)
        except Exception:
            pass

    stmt = select(CcCallLog).order_by(CcCallLog.created_at.desc())
    if tenantId:
        stmt = stmt.where(CcCallLog.tenant_id == tenantId)
    res = await db.execute(stmt)
    return {"calls": [_serialize_call(c) for c in res.scalars().all()]}


@router.post("/calls", status_code=status.HTTP_201_CREATED)
async def simulate_call(request: Request, db: AsyncSession = Depends(get_db)):
    body = await request.json() if await request.body() else {}
    tenant = await _find_tenant(db, agent_id=body.get("tenantId"))
    if not tenant:
        first_res = await db.execute(
            select(CcTenant).options(*_tenant_load_options()).limit(1)
        )
        tenant = first_res.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="No tenant found")

    first_srv = tenant.services[0] if tenant.services else None
    srv_name = first_srv.name if first_srv else "Consultation"
    srv_price = float(first_srv.price) if first_srv else 85.0
    srv_dur = first_srv.duration_minutes if first_srv else 45
    srv_staff = (first_srv.staff_member if first_srv else None) or "Lead Specialist"

    caller = random.choice(
        ["Olivia Rodrigo", "Liam Neeson", "Noah Patel", "Emma Stone", "Lucas Gray"]
    )
    phone = f"+1 (555) {random.randint(200, 899)}-{random.randint(1000, 9999)}"
    now_ms = int(time.time() * 1000)

    new_call = CcCallLog(
        id=f"call_{now_ms}",
        tenant_id=tenant.id,
        vapi_call_id=f"call_{now_ms}",
        caller_name=caller,
        caller_phone=phone,
        timestamp_label="Just now",
        duration="1m 24s",
        status="booked",
        sentiment="positive",
        service_requested=f"{srv_name} (${int(srv_price)})",
        summary=(
            f"Live simulated call: {caller} inquired about {srv_name}. "
            f"AI confirmed Tomorrow at 2:00 PM with {srv_staff} and sent SMS confirmation."
        ),
        transcript=[
            {
                "role": "agent",
                "text": f"Hi! Thank you for calling {tenant.business_name}. This is {tenant.voice_persona.get('name', 'Sophia')}. How can I help you today?",
            },
            {
                "role": "user",
                "text": f"Hi! I'd like to book {srv_name} for tomorrow afternoon if possible.",
            },
            {
                "role": "agent",
                "text": f"All set, {caller}! You are confirmed for tomorrow at 2:00 PM with {srv_staff}. I've sent an SMS reminder to {phone}.",
            },
        ],
    )

    new_appt = CcAppointment(
        id=f"apt_{now_ms}",
        tenant_id=tenant.id,
        client_name=caller,
        client_phone=phone,
        service_name=srv_name,
        staff_member=srv_staff,
        date_time="Tomorrow, 2:00 PM",
        duration_minutes=srv_dur,
        price=srv_price,
        status="confirmed",
        booked_via="AI Voice Receptionist",
    )

    db.add(new_call)
    db.add(new_appt)
    await db.commit()

    return {"call": _serialize_call(new_call), "appointment": _serialize_appointment(new_appt)}


@router.get("/appointments")
async def list_appointments(
    tenantId: Optional[str] = Query(default=None), db: AsyncSession = Depends(get_db)
):
    stmt = select(CcAppointment).order_by(CcAppointment.created_at.desc())
    if tenantId:
        stmt = stmt.where(CcAppointment.tenant_id == tenantId)
    res = await db.execute(stmt)
    return {"appointments": [_serialize_appointment(a) for a in res.scalars().all()]}


class AppointmentPatchRequest(BaseModel):
    status: Optional[str] = None
    dateTime: Optional[str] = None


@router.patch("/appointments/{appointment_id}")
async def update_appointment(
    appointment_id: str, body: AppointmentPatchRequest, db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(CcAppointment).where(CcAppointment.id == appointment_id))
    apt = res.scalar_one_or_none()
    if not apt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    if body.status is not None:
        apt.status = body.status
    if body.dateTime is not None:
        apt.date_time = body.dateTime
        apt.status = "rescheduled"

    await db.commit()
    return {"appointment": _serialize_appointment(apt)}


@router.post("/appointments/{appointment_id}")
async def send_appointment_reminder(
    appointment_id: str, db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(CcAppointment).where(CcAppointment.id == appointment_id))
    apt = res.scalar_one_or_none()
    if not apt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    delivery_mode = "simulated"
    if settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN and settings.TWILIO_PHONE_NUMBER:
        async with httpx.AsyncClient(timeout=15.0) as client:
            twilio_res = await client.post(
                f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json",
                auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
                data={
                    "To": apt.client_phone,
                    "From": settings.TWILIO_PHONE_NUMBER,
                    "Body": f"Reminder: Your {apt.service_name} with {apt.staff_member} is confirmed for {apt.date_time}.",
                },
            )
            if twilio_res.status_code < 400:
                delivery_mode = "twilio"

    return {"sent": True, "deliveryMode": delivery_mode, "recipient": apt.client_phone}


class OtpRequest(BaseModel):
    action: str
    phoneNumber: str
    code: Optional[str] = None


@router.post("/telephony/otp")
async def telephony_otp(body: OtpRequest):
    if not body.phoneNumber.strip():
        raise HTTPException(status_code=400, detail="phoneNumber is required")

    if settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN and settings.TWILIO_VERIFY_SERVICE_SID:
        async with httpx.AsyncClient(timeout=15.0) as client:
            if body.action == "send":
                res = await client.post(
                    f"https://verify.twilio.com/v2/Services/{settings.TWILIO_VERIFY_SERVICE_SID}/Verifications",
                    auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
                    data={"To": body.phoneNumber, "Channel": "sms"},
                )
                return {"sent": res.status_code < 400, "mode": "twilio"}
            if body.action == "verify":
                res = await client.post(
                    f"https://verify.twilio.com/v2/Services/{settings.TWILIO_VERIFY_SERVICE_SID}/VerificationCheck",
                    auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
                    data={"To": body.phoneNumber, "Code": body.code or ""},
                )
                data = res.json()
                return {"verified": data.get("status") == "approved", "mode": "twilio"}

    if body.action == "send":
        return {"sent": True, "demoCode": "4829", "mode": "dev"}

    code_clean = (body.code or "").strip()
    return {"verified": code_clean == "4829" or len(code_clean) >= 4, "mode": "dev"}


@router.get("/voice/keys")
async def list_voice_keys(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(CcVoiceApiKey).order_by(CcVoiceApiKey.created_at.desc()))
    keys = [
        {
            "id": k.id,
            "name": k.name,
            "agentName": k.agent_name,
            "keySecret": "API KEY 1" if k.id == "cc-key-1" else "API KEY 2" if k.id == "cc-key-2" else k.masked_secret,
            "scopes": k.scopes,
            "webhookUrl": k.webhook_url,
            "created": k.created_label,
        }
        for k in res.scalars().all()
    ]
    return {"keys": keys}


@router.post("/voice/keys", status_code=status.HTTP_201_CREATED)
async def mint_voice_key(request: Request, db: AsyncSession = Depends(get_db)):
    body = await request.json() if await request.body() else {}
    res = await db.execute(select(CcTenant).limit(1))
    first_tenant = res.scalar_one_or_none()
    tenant_id = body.get("tenantId") or (first_tenant.id if first_tenant else "usr_demo_01")

    raw_secret = f"cc_live_{secrets.token_hex(20)}"
    key_hash = hashlib.sha256(raw_secret.encode("utf-8")).hexdigest()
    now_ms = int(time.time() * 1000)

    entry = CcVoiceApiKey(
        id=f"cc-key-{now_ms}",
        tenant_id=tenant_id,
        name=(body.get("name") or "").strip() or f"CallColleague Voice Key #{now_ms % 1000}",
        agent_name=body.get("agentName") or (first_tenant.business_name if first_tenant else "CallColleague Agent"),
        key_prefix=raw_secret[:11],
        key_hash=key_hash,
        masked_secret="API**********",
        scopes=body.get("scopes") or ["voice:inbound-sip", "voice:vapi-assistant", "calendar:google-sync"],
        webhook_url=f"{settings.API_V1_STR}/webhooks/call-colleague",
        created_label="Just now",
    )
    db.add(entry)
    await db.commit()

    return {
        "key": {
            "id": entry.id,
            "name": entry.name,
            "agentName": entry.agent_name,
            "keySecret": raw_secret,
            "scopes": entry.scopes,
            "webhookUrl": entry.webhook_url,
            "created": entry.created_label,
        },
        "plainSecret": raw_secret,
    }


@router.delete("/voice/keys")
async def revoke_voice_key(id: str = Query(...), db: AsyncSession = Depends(get_db)):
    await db.execute(delete(CcVoiceApiKey).where(CcVoiceApiKey.id == id))
    await db.commit()
    return {"revoked": True, "id": id}


# ---------------------------------------------------------------------------
# Google Calendar OAuth (per-tenant)
# ---------------------------------------------------------------------------
@router.get("/integrations/google/connect")
async def google_calendar_connect(agentId: str, db: AsyncSession = Depends(get_db)):
    if not google_calendar.is_configured():
        raise HTTPException(
            status_code=503,
            detail="Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env.",
        )
    tenant = await _find_tenant(db, agent_id=agentId)
    if not tenant:
        raise HTTPException(status_code=404, detail="Agent not found")
    return {"authUrl": google_calendar.build_auth_url(tenant.id)}


@router.get("/integrations/google/callback")
async def google_calendar_callback(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    from fastapi.responses import RedirectResponse

    back = settings.FRONTEND_URL.rstrip("/")
    if error or not code or not state:
        return RedirectResponse(f"{back}/console?gcal=error")

    tenant = await _find_tenant(db, agent_id=state)
    if not tenant:
        return RedirectResponse(f"{back}/console?gcal=error")
    try:
        tokens = await google_calendar.exchange_code(code)
        refresh = tokens.get("refresh_token")
        if not refresh:
            return RedirectResponse(f"{back}/console?gcal=error")
        email = await google_calendar.fetch_account_email(tokens["access_token"])
        await google_calendar.save_integration(db, tenant.id, refresh, email)
        tenant.google_calendar_connected = True
        tenant.calendar_email = email or ""
        await db.commit()
    except Exception:
        return RedirectResponse(f"{back}/console?gcal=error")
    return RedirectResponse(f"{back}/console?gcal=connected&agentId={tenant.id}")


@router.delete("/integrations/google/{agent_id}")
async def google_calendar_disconnect(agent_id: str, db: AsyncSession = Depends(get_db)):
    tenant = await _find_tenant(db, agent_id=agent_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Agent not found")
    integ = await google_calendar.get_integration(db, tenant.id)
    if integ:
        await db.delete(integ)
    tenant.google_calendar_connected = False
    tenant.calendar_email = ""
    await db.commit()
    return {"disconnected": True}
