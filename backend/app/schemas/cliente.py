"""Schemas Pydantic de Cliente."""
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class ClienteBase(BaseModel):
    nome: str = Field(..., min_length=1, max_length=200)
    telefone: str | None = Field(default=None, max_length=30)
    email: str | None = Field(default=None, max_length=120)
    data_nascimento: date | None = None
    endereco: str | None = Field(default=None, max_length=300)
    ativo: bool = True


class ClienteCreate(ClienteBase):
    pass


class ClienteUpdate(BaseModel):
    nome: str | None = Field(default=None, min_length=1, max_length=200)
    telefone: str | None = Field(default=None, max_length=30)
    email: str | None = Field(default=None, max_length=120)
    data_nascimento: date | None = None
    endereco: str | None = Field(default=None, max_length=300)
    ativo: bool | None = None


class ClienteOut(ClienteBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    criado_em: datetime
    atualizado_em: datetime


# --------------------------------------------------------------------------- #
# Ficha do cliente
# --------------------------------------------------------------------------- #
class ProdutoFavorito(BaseModel):
    produto_id: int | None
    produto_nome: str
    quantidade: int
    total: Decimal


class CompraResumo(BaseModel):
    id: int
    criado_em: datetime
    forma_pagamento: str | None
    total_liquido: Decimal
    num_itens: int
    estornada: bool
    tem_devolucao: bool
    a_prazo: bool = False
    total_pago: Decimal = Decimal("0")
    saldo_devedor: Decimal = Decimal("0")


class FichaCliente(BaseModel):
    cliente: ClienteOut
    num_compras: int
    total_gasto: Decimal
    ticket_medio: Decimal
    total_itens: int
    primeira_compra: datetime | None
    ultima_compra: datetime | None
    saldo_devedor: Decimal = Decimal("0")
    favoritos: list[ProdutoFavorito]
    compras: list[CompraResumo]
