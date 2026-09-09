"""Endpoints da Configuração da loja (personalização e cadastro fiscal)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.crud import configuracao as crud_config
from app.database import get_db
from app.schemas.configuracao import (
    ROTULOS_REGIME,
    ROTULOS_TIPO_PESSOA,
    ConfiguracaoOut,
    ConfiguracaoUpdate,
    OpcoesConfiguracao,
    RegimeTributario,
    TipoPessoa,
)

router = APIRouter(prefix="/configuracao", tags=["Configuração"])


@router.get("/opcoes", response_model=OpcoesConfiguracao)
def listar_opcoes():
    """Listas do cadastro fiscal, com rótulo pronto para exibição.

    A tela usa isto para montar os selects sem duplicar as listas no frontend.
    """
    return {
        "tipos_pessoa": [
            {"valor": t.value, "rotulo": ROTULOS_TIPO_PESSOA[t.value]} for t in TipoPessoa
        ],
        "regimes_tributarios": [
            {"valor": r.value, "rotulo": ROTULOS_REGIME[r.value]} for r in RegimeTributario
        ],
    }


@router.get("", response_model=ConfiguracaoOut)
def obter_configuracao(db: Session = Depends(get_db)):
    return crud_config.obter(db)


@router.put("", response_model=ConfiguracaoOut)
def atualizar_configuracao(dados: ConfiguracaoUpdate, db: Session = Depends(get_db)):
    cfg = crud_config.obter(db)
    return crud_config.atualizar(db, cfg, dados)
