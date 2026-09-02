"""Schemas Pydantic dos relatórios (dashboard)."""
from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class ResumoPeriodo(BaseModel):
    """Cartões da visão do período."""

    dias: int
    inicio: date
    num_vendas: int
    faturamento: Decimal  # soma dos totais líquidos
    custo: Decimal
    lucro: Decimal
    desconto: Decimal
    ticket_medio: Decimal
    margem_percentual: Decimal


class VendaDia(BaseModel):
    dia: date
    faturamento: Decimal
    lucro: Decimal
    num_vendas: int


class ProdutoRanking(BaseModel):
    produto_id: int | None
    produto_nome: str
    quantidade: int
    faturamento: Decimal
    lucro: Decimal


class MaisVendidos(BaseModel):
    por_quantidade: list[ProdutoRanking]
    por_lucro: list[ProdutoRanking]


class ItemEstoqueBaixo(BaseModel):
    produto_id: int
    nome: str
    estoque: int
    estoque_minimo: int


class ResumoEstoque(BaseModel):
    num_produtos: int
    valor_custo_total: Decimal  # dinheiro imobilizado (estoque x custo)
    valor_venda_total: Decimal  # potencial de venda (estoque x preco)
    qtd_estoque_baixo: int
    itens_estoque_baixo: list[ItemEstoqueBaixo]
