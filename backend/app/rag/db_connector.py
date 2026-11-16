import asyncio
from sqlalchemy import create_engine, inspect, text
from app.core.security import decrypt_secret


def _normalize_sync_uri(connection_uri: str) -> str:
    """Ensures SQLAlchemy uses synchronous drivers for external DB introspection."""
    uri = connection_uri.strip()
    if uri.startswith("postgres://"):
        uri = "postgresql+psycopg2://" + uri[len("postgres://"):]
    elif uri.startswith("postgresql://"):
        uri = "postgresql+psycopg2://" + uri[len("postgresql://"):]
    elif uri.startswith("mysql://"):
        uri = "mysql+pymysql://" + uri[len("mysql://"):]
    return uri


async def test_and_inspect_external_db(connection_uri: str) -> dict:
    """Validates connectivity and returns available public tables for user selection."""
    def _inspect():
        sync_uri = _normalize_sync_uri(connection_uri)
        ext_engine = create_engine(sync_uri, pool_pre_ping=True, connect_args={"connect_timeout": 10})
        try:
            with ext_engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            inspector = inspect(ext_engine)
            tables = inspector.get_table_names()
            return {"connected": True, "tables": tables}
        finally:
            ext_engine.dispose()

    return await asyncio.to_thread(_inspect)


async def extract_rows_from_external_db(
    encrypted_uri: str,
    selected_tables: list[str] | None = None,
    max_rows_per_table: int = 250,
) -> list[dict]:
    """
    Safely reads rows (SELECT only) from connected user database tables and serializes them
    into structured text passages ready for vector embedding alongside uploaded documents.
    """
    raw_uri = decrypt_secret(encrypted_uri)

    def _fetch():
        sync_uri = _normalize_sync_uri(raw_uri)
        ext_engine = create_engine(sync_uri, pool_pre_ping=True, connect_args={"connect_timeout": 15})
        passages: list[dict] = []
        try:
            inspector = inspect(ext_engine)
            all_tables = inspector.get_table_names()
            target_tables = (
                [t for t in selected_tables if t in all_tables]
                if selected_tables
                else all_tables[:10]
            )

            with ext_engine.connect() as conn:
                for table_name in target_tables:
                    # Quote identifier safely using dialect preparer
                    quoted_table = ext_engine.dialect.identifier_preparer.quote(table_name)
                    result = conn.execute(text(f"SELECT * FROM {quoted_table} LIMIT :lim"), {"lim": max_rows_per_table})
                    columns = list(result.keys())
                    for idx, row in enumerate(result.fetchall()):
                        row_dict = dict(zip(columns, row))
                        formatted = f"[Table: {table_name}] " + " | ".join(
                            f"{col}: {val}" for col, val in row_dict.items() if val is not None
                        )
                        passages.append({
                            "table": table_name,
                            "row_index": idx,
                            "text": formatted,
                        })
            return passages
        finally:
            ext_engine.dispose()

    return await asyncio.to_thread(_fetch)