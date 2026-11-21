"""Create (or reset) a local demo login for development.

    Email:    test@test.com
    Password: test

It is marked as verified, but as a test address it can't receive mail, so
send your tests to a real inbox of yours.

Run from the thumbsup-api folder:
    .\\.venv\\Scripts\\python.exe scripts\\create_demo_user.py

This skips the normal password rules on purpose, so it refuses to run when
ENVIRONMENT=production.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select  # noqa: E402

from app.config import settings  # noqa: E402
from app.db import SessionLocal, init_db  # noqa: E402
from app.models import User  # noqa: E402
from app.security import hash_password  # noqa: E402

EMAIL = "test@test.com"
PASSWORD = "test"


def main() -> None:
    if settings.is_production:
        sys.exit("Refusing to create a demo account in production.")
    init_db()
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == EMAIL))
        if user:
            user.password_hash = hash_password(PASSWORD)
            user.email_verified = True
            action = "reset"
        else:
            user = User(email=EMAIL, name="Test User", company="Demo", password_hash=hash_password(PASSWORD), email_verified=True)
            db.add(user)
            action = "created"
        db.commit()
    print(f"Demo account {action}.  Email: {EMAIL}   Password: {PASSWORD}")


if __name__ == "__main__":
    main()
