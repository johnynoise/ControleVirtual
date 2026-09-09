"""Schemas Pydantic de Produto e Variação de Produto."""
from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, computed_field


# --------------------------------------------------------------------------- #
# Variação (grade)
# --------------------------------------------------------------------------- #
class VariacaoBase(BaseModel):
    sku: str | None = Field(default=None, max_length=60)
    codigo_barras: str | None = Field(default=None, max_length=60)
    atributos: dict[str, Any] = Field(default_factory=dict)
    preco_venda: Decimal | None = Field(default=None, ge=0)
    estoque: int = Field(default=0, ge=0)


class VariacaoCreate(VariacaoBase):
    pass


class VariacaoOut(VariacaoBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    criado_em: datetime
    atualizado_em: datetime


# --------------------------------------------------------------------------- #
# Produto
# --------------------------------------------------------------------------- #
class ProdutoBase(BaseModel):
    nome: str = Field(..., min_length=1, max_length=200)
    sku: str | None = Field(default=None, max_length=60)
    codigo_barras: str | None = Field(default=None, max_length=60)
    descricao: str | None = None
    categoria_id: int
    preco_custo: Decimal = Field(default=Decimal("0"), ge=0)
    preco_venda: Decimal = Field(default=Decimal("0"), ge=0)
    preco_venda_prazo: Decimal | None = Field(
        default=None,
        ge=0,
        description="Preço para venda a prazo (fiado). Se nulo, usa o preço de venda à vista.",
    )
    estoque: int = Field(default=0, ge=0)
    estoque_minimo: int = Field(default=0, ge=0)
    atributos: dict[str, Any] = Field(default_factory=dict)
    ativo: bool = True


class ProdutoCreate(ProdutoBase):
    variacoes: list[VariacaoCreate] = Field(default_factory=list)


class ProdutoUpdate(BaseModel):
    nome: str | None = Field(default=None, min_length=1, max_length=200)
    sku: str | None = Field(default=None, max_length=60)
    codigo_barras: str | None = Field(default=None, max_length=60)
    descricao: str | None = None
    categoria_id: int | None = None
    preco_custo: Decimal | None = Field(default=None, ge=0)
    preco_venda: Decimal | None = Field(default=None, ge=0)
    preco_venda_prazo: Decimal | None = Field(default=None, ge=0)
    estoque: int | None = Field(default=None, ge=0)
    estoque_minimo: int | None = Field(default=None, ge=0)
    atributos: dict[str, Any] | None = None
    ativo: bool | None = None


class ProdutoOut(ProdutoBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    criado_em: datetime
    atualizado_em: datetime
    variacoes: list[VariacaoOut] = Field(default_factory=list)

    @computed_field
    @property
    def preco_venda_prazo_efetivo(self) -> Decimal:
        """Preço realmente cobrado numa venda a prazo.

        Usa o preço a prazo quando o produto tem um; senão, cai no preço à
        vista. Concentra a regra do fallback aqui para que o PDV não precise
        repeti-la.
        """
        if self.preco_venda_prazo is None:
            return self.preco_venda
        return self.preco_venda_prazo

    @computed_field
    @property
    def lucro_unitario(self) -> Decimal:
        """Lucro por unidade: preço de venda - preço de custo."""
        return self.preco_venda - self.preco_custo

    @computed_field
    @property
    def margem_percentual(self) -> Decimal:
        """Margem sobre a venda: (venda - custo) / venda * 100."""
        if self.preco_venda <= 0:
            return Decimal("0")
        margem = (self.preco_venda - self.preco_custo) / self.preco_venda * 100
        return margem.quantize(Decimal("0.01"))

    @computed_field
    @property
    def markup_percentual(self) -> Decimal:
        """Markup sobre o custo: (venda - custo) / custo * 100."""
        if self.preco_custo <= 0:
            return Decimal("0")
        markup = (self.preco_venda - self.preco_custo) / self.preco_custo * 100
        return markup.quantize(Decimal("0.01"))

    @computed_field
    @property
    def estoque_total(self) -> int:
        """Estoque efetivo: soma das variações se houver, senão o do produto."""
        if self.variacoes:
            return sum(v.estoque for v in self.variacoes)
        return self.estoque
