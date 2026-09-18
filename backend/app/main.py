"""Ponto de entrada da API do ControleVirtual."""
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text

from app.config import settings
from app.database import Base, engine
from app.routers import (
    categorias,
    clientes,
    configuracao,
    defeitos,
    despesas,
    fiscal,
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
            "entrega_status": "VARCHAR(20)",
            "entregue_em": "TIMESTAMP",
            "endereco_entrega": "VARCHAR(300)",
        },
        "clientes": {
            "data_nascimento": "DATE",
            "endereco": "VARCHAR(300)",
        },
        "produtos": {
            "preco_venda_prazo": "NUMERIC(12, 2)",
        },
        # Costura os meses gerados a partir de uma despesa fixa mensal.
        "despesas": {
            "grupo_recorrencia": "VARCHAR(36)",
        },
        "devolucoes": {
            "defeito": "BOOLEAN NOT NULL DEFAULT '0'",
            "status_fornecedor": "VARCHAR(20)",
            "resolvido_em": "TIMESTAMP",
            "resolucao_observacao": "TEXT",
        },
        # Cadastro fiscal da loja. Tudo nulo por padrão: quem vende como pessoa
        # física não tem razão social, inscrição estadual nem CNPJ.
        "configuracao": {
            "tipo_pessoa": "VARCHAR(20)",
            "razao_social": "VARCHAR(200)",
            "inscricao_estadual": "VARCHAR(30)",
            "inscricao_municipal": "VARCHAR(30)",
            "cnae": "VARCHAR(20)",
            "data_abertura": "DATE",
            "regime_tributario": "VARCHAR(30)",
            "cep": "VARCHAR(12)",
            "cidade": "VARCHAR(120)",
            "estado": "VARCHAR(2)",
            "contador_nome": "VARCHAR(200)",
            "contador_contato": "VARCHAR(200)",
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

# Libera o acesso do frontend (React). `frontend_origins` aceita uma lista
# (CSV no .env), útil para liberar ao mesmo tempo o acesso local e o acesso
# de outros dispositivos pela rede (ex.: celular acessando pelo IP do notebook).
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_origins,
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
app.include_router(defeitos.router)
app.include_router(despesas.router)
app.include_router(relatorios.router)
app.include_router(fiscal.router)
app.include_router(configuracao.router)


@app.get("/health")
def health_check():
    """Rota de verificação de saúde da API."""
    return {"status": "ok"}


# --------------------------------------------------------------------- #
# Serve o build do frontend (frontend/dist), quando presente.
#
# Isso permite rodar a aplicação inteira numa porta só: o próprio backend
# entrega o site e a API. Útil para expor o app na rede local (ex.: o
# notebook funcionando como servidor) sem precisar manter um segundo
# processo (vite preview) e uma segunda porta abertos.
#
# Gere o build com `npm run build` dentro de frontend/ antes de rodar em
# modo servidor. Em desenvolvimento (vite dev, porta 5173) essa pasta
# normalmente não existe e este bloco é ignorado.
# --------------------------------------------------------------------- #
_frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"

if _frontend_dist.is_dir():
    app.mount("/assets", StaticFiles(directory=_frontend_dist / "assets"), name="assets")

    @app.get("/")
    @app.get("/{caminho_completo:path}")
    def servir_frontend(caminho_completo: str = ""):
        """Entrega os arquivos do frontend; para rotas desconhecidas, cai no index.html (SPA)."""
        candidato = _frontend_dist / caminho_completo
        if caminho_completo and candidato.is_file():
            return FileResponse(candidato)
        return FileResponse(_frontend_dist / "index.html")
else:

    @app.get("/")
    def read_root():
        """Rota raiz informativa (sem build do frontend disponível)."""
        return {"app": settings.app_name, "status": "online"}
