from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import ApiError, get_current_user
from app.models import Template, User
from app.routers.common import get_owned
from app.services.delivery import clean_list, resolve_from
from app.services.renderer import extract_variables, render, render_header

router = APIRouter(prefix="/dashboard/templates", tags=["Dashboard: templates"])


class TemplateIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    subject: str = Field(min_length=1, max_length=300)
    html: str = Field(default="", max_length=200_000)
    text: str = Field(default="", max_length=100_000)
    to_emails: list[str] = Field(default_factory=list, max_length=20)
    from_name: str = Field(default="", max_length=120)
    from_email: str = Field(default="", max_length=320)
    allow_public: bool = False
    auto_reply: bool = False
    auto_reply_subject: str = Field(default="", max_length=300)
    auto_reply_text: str = Field(default="", max_length=20_000)


class PreviewIn(BaseModel):
    variables: dict = Field(default_factory=dict)


def template_view(t: Template) -> dict:
    return {
        "id": t.id,
        "name": t.name,
        "subject": t.subject,
        "html": t.html,
        "text": t.text,
        "to_emails": t.to_emails or [],
        "from_name": t.from_name,
        "from_email": t.from_email,
        "allow_public": t.allow_public,
        "auto_reply": t.auto_reply,
        "auto_reply_subject": t.auto_reply_subject,
        "auto_reply_text": t.auto_reply_text,
        "variables": extract_variables(t.subject, t.html, t.text),
        "created_at": t.created_at,
        "updated_at": t.updated_at,
    }


def _apply(db: Session, user: User, t: Template, body: TemplateIn) -> None:
    if not body.html.strip() and not body.text.strip() and not body.allow_public:
        # Website-form templates may leave the body empty: every submitted field is listed automatically.
        raise ApiError(422, "missing_content", "Write the email body (HTML or plain text).")
    to_emails = clean_list(body.to_emails, "to_emails")
    if body.allow_public and not to_emails:
        raise ApiError(
            422,
            "recipient_required",
            "Website forms need a fixed recipient. Add the email address that should receive form messages.",
        )
    if body.auto_reply and not (body.auto_reply_subject.strip() and body.auto_reply_text.strip()):
        raise ApiError(422, "auto_reply_incomplete", "Add a subject and a message for the auto-reply.")
    t.name = body.name.strip()
    t.subject = body.subject
    t.html = body.html
    t.text = body.text
    t.to_emails = to_emails
    t.from_name = body.from_name.strip()
    t.from_email = resolve_from(db, user.id, body.from_email.strip()) if body.from_email.strip() else ""
    t.allow_public = body.allow_public
    t.auto_reply = body.auto_reply
    t.auto_reply_subject = body.auto_reply_subject
    t.auto_reply_text = body.auto_reply_text


@router.get("")
def list_templates(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Template).where(Template.user_id == user.id).order_by(Template.updated_at.desc())).all()
    return {"data": [template_view(t) for t in rows]}


@router.post("", status_code=201)
def create_template(body: TemplateIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    t = Template(user_id=user.id)
    _apply(db, user, t, body)
    db.add(t)
    db.commit()
    return {"data": template_view(t)}


@router.get("/{template_id}")
def get_template(template_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return {"data": template_view(get_owned(db, Template, template_id, user))}


@router.put("/{template_id}")
def update_template(template_id: str, body: TemplateIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    t = get_owned(db, Template, template_id, user)
    _apply(db, user, t, body)
    db.commit()
    return {"data": template_view(t)}


@router.delete("/{template_id}")
def delete_template(template_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    t = get_owned(db, Template, template_id, user)
    db.delete(t)
    db.commit()
    return {"ok": True}


@router.post("/{template_id}/preview")
def preview_template(template_id: str, body: PreviewIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    t = get_owned(db, Template, template_id, user)
    return {
        "subject": render_header(t.subject, body.variables),
        "html": render(t.html, body.variables, escape_html=True),
        "text": render(t.text, body.variables, escape_html=False),
    }
