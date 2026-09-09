"""Operações de banco para a Configuração da loja (linha única, id=1)."""
from enum import Enum

from sqlalchemy.orm import Session

from app.models.configuracao import Configuracao
from app.schemas.configuracao import ConfiguracaoUpdate

_ID_UNICO = 1


def obter(db: Session) -> Configuracao:
    """Retorna a configuração, criando a linha padrão na primeira vez."""
    cfg = db.get(Configuracao, _ID_UNICO)
    if cfg is None:
        cfg = Configuracao(id=_ID_UNICO)
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg


def atualizar(db: Session, cfg: Configuracao, dados: ConfiguracaoUpdate) -> Configuracao:
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        # Os campos de lista (tipo de pessoa, regime) chegam como Enum e as
        # colunas são texto: grava o valor "cru", não o membro do Enum.
        if isinstance(valor, Enum):
            valor = valor.value
        setattr(cfg, campo, valor)
    db.commit()
    db.refresh(cfg)
    return cfg
