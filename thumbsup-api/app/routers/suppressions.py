"""Suppression list: addresses that bounced, complained, or were blocked by hand.

Sending to them again hurts deliverability for everyone, so ThumbsUp skips them.
"""

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models import Suppression, User
from app.routers.common import get_owned
from app.services.delivery import clean_email
from app.services.queue import suppress

router = APIRouter(prefix="/dashboard/suppressions", tags=["Dashboard: suppression list"])


class SuppressionIn(BaseModel):
    email: str = Field(max_length=320)
    detail: str = Field(default="", max_length=300)


def view(s: Suppression) -> dict:
    return {"id": s.id, "email": s.email, "reason": s.reason, "detail": s.detail, "message_id": s.message_id, "created_at": s.created_at}


@router.get("")
def list_suppressions(
    q: str | None = Query(default=None, max_length=200),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = select(Suppression).where(Suppression.user_id == user.id)
    if q:
        stmt = stmt.where(Suppression.email.ilike(f"%{q.strip().lower()}%"))
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = db.scalars(stmt.order_by(Suppression.created_at.desc()).limit(limit).offset(offset)).all()
    return {"data": [view(s) for s in rows], "total": total}


@router.post("", status_code=201)
def add_suppression(body: SuppressionIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    suppress(db, user.id, clean_email(body.email, "email"), "manual", body.detail)
    db.commit()
    return {"ok": True}


@router.delete("/{suppression_id}")
def remove_suppression(suppression_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.delete(get_owned(db, Suppression, suppression_id, user))
    db.commit()
    return {"ok": True}
