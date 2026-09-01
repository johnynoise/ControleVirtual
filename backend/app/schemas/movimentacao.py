"""Schemas Pydantic de Movimentação de Estoque."""
from datetime import datetime
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, model_validator


class TipoMovimentacao(str, Enum):
    entrada = "entrada"
    saida = "saida"
    ajuste = "ajuste"


class MovimentacaoBase(BaseModel):
    produto_id: int
    variacao_id: int | None = None
    fornecedor_id: int | None = None
    tipo: TipoMovimentacao
    # entrada/saida: quantidade a movimentar (> 0).
    # ajuste: novo valor absoluto do estoque (>= 0).
    quantidade: int
    motivo: str | None = Field(default=None, max_length=40)
    custo_unitario: Decimal | None = Field(default=None, ge=0)
    observacao: str | None = None

    @model_validator(mode="after")
    def _validar_quantidade(self) -> "MovimentacaoBase":
        if self.tipo in (TipoMovimentacao.entrada, TipoMovimentacao.saida):
            if self.quantidade <= 0:
                raise ValueError("A quantidade deve ser maior que zero.")
        elif self.tipo == TipoMovimentacao.ajuste:
            if self.quantidade < 0:
                raise ValueError("No ajuste, a quantidade (novo estoque) não pode ser negativa.")
        return self


class MovimentacaoCreate(MovimentacaoBase):
    pass


class MovimentacaoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    produto_id: int | None
    variacao_id: int | None
    fornecedor_id: int | None
    produto_nome: str
    fornecedor_nome: str | None
    tipo: TipoMovimentacao
    quantidade: int
    estoque_resultante: int
    motivo: str | None
    custo_unitario: Decimal | None
    observacao: str | None
    criado_em: datetime
