from sqlalchemy.orm import Session

from app.deps import ApiError
from app.models import User


def get_owned(db: Session, model, obj_id: str, user: User):
    """Load a row ONLY if it belongs to the logged-in user.

    Someone else's id returns the same 404 as a missing id, so nobody can even
    learn that another account's keys/templates/emails exist.
    """
    obj = db.get(model, obj_id)
    if obj is None or getattr(obj, "user_id", None) != user.id:
        raise ApiError(404, "not_found", f"{model.__name__.replace('Endpoint', '')} not found.")
    return obj
