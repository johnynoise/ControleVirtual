"""Schemas Pydantic de Venda e Item de Venda."""
from datetime import datetime
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, computed_field


class FormaPagamento(str, Enum):
    dinheiro = "dinheiro"
    cartao_credito = "cartao_credito"
    cartao_debito = "cartao_debito"
    pix = "pix"
    outro = "outro"


# --------------------------------------------------------------------------- #
# Itens
# --------------------------------------------------------------------------- #
class ItemVendaCreate(BaseModel):
    produto_id: int
    quantidade: int = Field(..., gt=0)
    # Se não informado, usa o preço de venda atual do produto.
    preco_unitario: Decimal | None = Field(default=None, ge=0)


class ItemVendaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    produto_id: int | None
    produto_nome: str
    quantidade: int
    preco_unitario: Decimal
    custo_unitario: Decimal
    subtotal: Decimal

    @computed_field
    @property
    def lucro(self) -> Decimal:
        """Lucro do item: (preço - custo) * quantidade."""
        return (self.preco_unitario - self.custo_unitario) * self.quantidade


# --------------------------------------------------------------------------- #
# Venda
# --------------------------------------------------------------------------- #
class VendaCreate(BaseModel):
    cliente_id: int | None = None
    cliente_nome: str | None = Field(default=None, max_length=200)
    forma_pagamento: FormaPagamento | None = None
    desconto: Decimal = Field(default=Decimal("0"), ge=0)
    observacao: str | None = None
    itens: list[ItemVendaCreate] = Field(..., min_length=1)


class EstornoRequest(BaseModel):
    """Corpo opcional do estorno, com o motivo do cancelamento."""

    motivo: str | None = Field(default=None, max_length=200)


class MotivoDevolucao(str, Enum):
    defeito = "defeito"
    nao_gostou = "nao_gostou"
    tamanho_errado = "tamanho_errado"
    produto_errado = "produto_errado"
    arrependimento = "arrependimento"
    outro = "outro"


class ItemDevolucaoRequest(BaseModel):
    item_venda_id: int
    quantidade: int = Field(..., gt=0)


class DevolucaoRequest(BaseModel):
    motivo: MotivoDevolucao
    observacao: str | None = Field(default=None, max_length=300)
    itens: list[ItemDevolucaoRequest] = Field(..., min_length=1)


class ItemDevolucaoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    produto_id: int | None
    produto_nome: str
    quantidade: int
    preco_unitario: Decimal
    custo_unitario: Decimal
    subtotal: Decimal


class DevolucaoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    venda_id: int
    motivo: str
    observacao: str | None
    valor_devolvido: Decimal
    criado_em: datetime
    itens: list[ItemDevolucaoOut] = Field(default_factory=list)


class VendaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    cliente_id: int | None
    cliente_nome: str | None
    forma_pagamento: str | None
    total_bruto: Decimal
    desconto: Decimal
    total_liquido: Decimal
    custo_total: Decimal
    lucro: Decimal
    observacao: str | None
    criado_em: datetime
    cancelada_em: datetime | None = None
    motivo_cancelamento: str | None = None
    itens: list[ItemVendaOut] = Field(default_factory=list)
    devolucoes: list["DevolucaoOut"] = Field(default_factory=list)

    @computed_field
    @property
    def margem_percentual(self) -> Decimal:
        """Margem da venda: lucro / total_liquido * 100."""
        if self.total_liquido <= 0:
            return Decimal("0")
        return (self.lucro / self.total_liquido * 100).quantize(Decimal("0.01"))
