"""Configuração da conexão com o banco de dados via SQLAlchemy.

Suporta PostgreSQL (produção) e SQLite (desenvolvimento local, sem servidor).
O tipo ``JSONType`` usa JSONB no PostgreSQL e JSON no SQLite automaticamente.
"""
from sqlalchemy import JSON, create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import settings

# Tipo JSON portável: JSONB no PostgreSQL, JSON genérico nos demais bancos.
JSONType = JSON().with_variant(JSONB(), "postgresql")

# O SQLite precisa desabilitar a checagem de thread para funcionar com o FastAPI.
_is_sqlite = settings.database_url.startswith("sqlite")
_connect_args = {"check_same_thread": False} if _is_sqlite else {}

engine = create_engine(
    settings.database_url,
    pool_pre_ping=not _is_sqlite,
    connect_args=_connect_args,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependência do FastAPI que fornece uma sessão de banco por requisição."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
