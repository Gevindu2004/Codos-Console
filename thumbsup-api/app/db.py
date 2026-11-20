import os

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    pass


def _make_engine(url: str):
    kwargs = {"pool_pre_ping": True}
    if url.startswith("sqlite"):
        path = url.split("///", 1)[-1]
        if path and path != ":memory:":
            os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        kwargs["connect_args"] = {"check_same_thread": False}
    elif url.startswith("postgresql"):
        # Times always in UTC, whatever time zone the database server is set to
        kwargs["connect_args"] = {"options": "-c timezone=UTC"}
    engine = create_engine(url, **kwargs)
    if url.startswith("sqlite"):

        @event.listens_for(engine, "connect")
        def _fk_on(dbapi_conn, _):  # enforce foreign keys in SQLite
            dbapi_conn.execute("PRAGMA foreign_keys=ON")

    return engine


engine = _make_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def init_db() -> None:
    """Bring the database up to date (Alembic migrations). Tests use a fresh in-place schema."""
    from app import models  # noqa: F401  (register tables)

    if settings.is_test:
        Base.metadata.create_all(bind=engine)
        return
    from alembic import command
    from alembic.config import Config
    from sqlalchemy import inspect, text

    cfg = Config(os.path.join(HERE, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(HERE, "migrations"))
    with engine.begin() as connection:
        if connection.dialect.name == "postgresql":
            # Several copies of the API (Azure scale-out, or 2 workers) start together: take turns.
            # The first one upgrades the database; the others wait here, then find nothing left to do.
            connection.execute(text("SELECT pg_advisory_xact_lock(727274001)"))
        tables = set(inspect(connection).get_table_names())
        if "users" in tables and "alembic_version" not in tables:
            from app.config import ConfigError

            raise ConfigError(
                "Your database was created by an older ThumbsUp version that had no migrations.\n"
                f"  It only contains test data. Delete it and start again:  {settings.DATABASE_URL}\n"
                "  (Windows: delete thumbsup-api\\storage\\thumbsup.db)"
            )
        cfg.attributes["connection"] = connection
        command.upgrade(cfg, "head")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
