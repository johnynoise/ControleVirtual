"""Endpoints da Configuração da loja (personalização)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.crud import configuracao as crud_config
from app.database import get_db
from app.schemas.configuracao import ConfiguracaoOut, ConfiguracaoUpdate

router = APIRouter(prefix="/configuracao", tags=["Configuração"])


@router.get("", response_model=ConfiguracaoOut)
def obter_configuracao(db: Session = Depends(get_db)):
    return crud_config.obter(db)


@router.put("", response_model=ConfiguracaoOut)
def atualizar_configuracao(dados: ConfiguracaoUpdate, db: Session = Depends(get_db)):
    cfg = crud_config.obter(db)
    return crud_config.atualizar(db, cfg, dados)
