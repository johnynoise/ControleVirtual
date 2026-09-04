"""Ponto de entrada da API do ControleVirtual."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from app.config import settings
from app.database import Base, engine
from app.routers import (
    categorias,
    clientes,
    configuracao,
    fornecedores,
    movimentacoes,
    produtos,
    relatorios,
    vendas,
)

# Importa os models para que fiquem registrados no metadata do SQLAlchemy.
from app import models  # noqa: F401

logger = logging.getLogger(__name__)


def _migrar_colunas() -> None:
    """Adiciona colunas novas a tabelas já existentes (mini-migração).

    O ``create_all`` cria tabelas que faltam, mas não altera as existentes.
    Enquanto o projeto não adota Alembic, adicionamos colunas novas aqui de
    forma idempotente. ``ADD COLUMN`` é suportado por SQLite e PostgreSQL.
    """
    novas_colunas = {
        "vendas": {
            "cancelada_em": "TIMESTAMP",
            "motivo_cancelamento": "VARCHAR(200)",
        },
    }
    try:
        insp = inspect(engine)
        for tabela, colunas in novas_colunas.items():
            if not insp.has_table(tabela):
                continue
            existentes = {c["name"] for c in insp.get_columns(tabela)}
            with engine.begin() as conn:
                for coluna, tipo in colunas.items():
                    if coluna not in existentes:
                        conn.execute(
                            text(f"ALTER TABLE {tabela} ADD COLUMN {coluna} {tipo}")
                        )
                        logger.info("Coluna %s.%s adicionada.", tabela, coluna)
    except Exception as exc:  # pragma: no cover - depende do banco estar de pé
        logger.warning("Não foi possível migrar colunas no startup: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Ciclo de vida da aplicação.

    No startup, cria as tabelas que ainda não existem e aplica a mini-migração
    de colunas. Solução simples para desenvolvimento local; quando o projeto
    amadurecer, a evolução do schema deve migrar para o Alembic.
    """
    try:
        Base.metadata.create_all(bind=engine)
        _migrar_colunas()
    except Exception as exc:  # pragma: no cover - depende do banco estar de pé
        logger.warning("Não foi possível criar as tabelas no startup: %s", exc)
    yield


app = FastAPI(
    title=settings.app_name,
    description="API do sistema de controle de vendas ControleVirtual.",
    version="0.1.0",
    lifespan=lifespan,
)

# Libera o acesso do frontend (React) durante o desenvolvimento.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(categorias.router)
app.include_router(produtos.router)
app.include_router(movimentacoes.router)
app.include_router(fornecedores.router)
app.include_router(clientes.router)
app.include_router(vendas.router)
app.include_router(relatorios.router)
app.include_router(configuracao.router)


@app.get("/")
def read_root():
    """Rota raiz, apenas informativa."""
    return {"app": settings.app_name, "status": "online"}


@app.get("/health")
def health_check():
    """Rota de verificação de saúde da API."""
    return {"status": "ok"}
