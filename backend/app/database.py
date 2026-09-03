"""Configuração da conexão com o banco de dados via SQLAlchemy.

Suporta PostgreSQL (produção) e SQLite (desenvolvimento local, sem servidor).
O tipo ``JSONType`` usa JSONB no PostgreSQL e JSON no SQLite automaticamente.
"""
from sqlalchemy import JSON, create_engine, event
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

# O SQLite não força foreign keys por padrão (vem desligado por conexão). Sem
# isso, as regras ``ondelete`` (SET NULL / CASCADE) dos models e o
# ``passive_deletes`` são ignorados. Ligamos o PRAGMA a cada nova conexão para
# que a integridade referencial se comporte igual ao PostgreSQL.
if _is_sqlite:

    @event.listens_for(engine, "connect")
    def _habilitar_foreign_keys(dbapi_connection, connection_record):  # noqa: ANN001
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependência do FastAPI que fornece uma sessão de banco por requisição."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
