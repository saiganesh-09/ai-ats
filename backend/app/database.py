"""Database engine and session factory.

Pattern: one global `engine` (a connection pool), and `SessionLocal` which
creates a new Session per request. Sessions are NOT shared between requests —
each FastAPI request gets its own via the `get_db` dependency.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings

engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    """All ORM models inherit from this so Alembic can discover them."""
