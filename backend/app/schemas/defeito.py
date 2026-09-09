"""Schemas da fila de defeitos a acertar com o fornecedor.

Uma troca marcada como defeito entra nesta fila. Cada linha é uma troca
(``devolucao``) com as peças defeituosas, o custo parado e o fornecedor
provável de cada peça — a informação que a dona da loja precisa para cobrar
a troca ou o crédito.
"""
from datetime import datetime
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, Field


class FiltroDefeito(str, Enum):
    """Filtro da listagem: pendentes, já resolvidos ou todos."""

    pendente = "pendente"
    resolvido = "resolvido"
    todos = "todos"


class ItemDefeitoOut(BaseModel):
    """Peça defeituosa de uma troca, com o fornecedor provável."""

    produto_id: int | None
    produto_nome: str
    quantidade: int
    custo_unitario: Decimal
    preco_unitario: Decimal
    # Fornecedor da última compra registrada deste produto (pode não existir).
    fornecedor_id: int | None = None
    fornecedor_nome: str | None = None


class DefeitoOut(BaseModel):
    devolucao_id: int
    venda_id: int
    cliente_id: int | None = None
    cliente_nome: str | None = None
    criado_em: datetime
    motivo: str
    observacao: str | None = None
    status_fornecedor: str
    resolvido_em: datetime | None = None
    resolucao_observacao: str | None = None
    # Totais das peças defeituosas desta troca.
    quantidade_total: int
    valor_devolvido: Decimal
    custo_total: Decimal
    itens: list[ItemDefeitoOut] = Field(default_factory=list)


class DefeitoResumo(BaseModel):
    """Números do topo da tela."""

    pendentes: int = 0
    pecas_pendentes: int = 0
    custo_pendente: Decimal = Decimal("0.00")
    valor_pendente: Decimal = Decimal("0.00")
    resolvidos: int = 0


class ResolverDefeitoRequest(BaseModel):
    """Baixa do acerto: como o fornecedor resolveu (troca, crédito, recusa...)."""

    observacao: str | None = Field(default=None, max_length=300)
