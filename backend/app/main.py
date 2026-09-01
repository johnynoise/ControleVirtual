"""Ponto de entrada da API do ControleVirtual."""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app.routers import categorias, fornecedores, movimentacoes, produtos, vendas

# Importa os models para que fiquem registrados no metadata do SQLAlchemy.
from app import models  # noqa: F401

logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.app_name,
    description="API do sistema de controle de vendas ControleVirtual.",
    version="0.1.0",
)


@app.on_event("startup")
def criar_tabelas() -> None:
    """Cria as tabelas no banco caso ainda não existam.

    Solução simples para desenvolvimento local. Quando o projeto amadurecer,
    a evolução do schema deve migrar para o Alembic.
    """
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as exc:  # pragma: no cover - depende do banco estar de pé
        logger.warning("Não foi possível criar as tabelas no startup: %s", exc)

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
app.include_router(vendas.router)


@app.get("/")
def read_root():
    """Rota raiz, apenas informativa."""
    return {"app": settings.app_name, "status": "online"}


@app.get("/health")
def health_check():
    """Rota de verificação de saúde da API."""
    return {"status": "ok"}
