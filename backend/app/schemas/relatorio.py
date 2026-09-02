"""Schemas Pydantic dos relatórios (dashboard)."""
from datetime import date, datetime
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


# ---------------------------------------------------------------------------
# Schemas da seção "Relatórios".
# ---------------------------------------------------------------------------


class FormaPagamentoLinha(BaseModel):
    forma: str
    forma_rotulo: str
    num_vendas: int
    faturamento: Decimal
    percentual: Decimal


class RelatorioFormaPagamento(BaseModel):
    dias: int
    inicio: date
    faturamento_total: Decimal
    linhas: list[FormaPagamentoLinha]


class CurvaAbcLinha(BaseModel):
    produto_id: int | None
    produto_nome: str
    quantidade: int
    faturamento: Decimal
    percentual: Decimal
    percentual_acumulado: Decimal
    classe: str  # "A", "B" ou "C"


class RelatorioCurvaAbc(BaseModel):
    dias: int
    inicio: date
    faturamento_total: Decimal
    qtd_classe_a: int
    qtd_classe_b: int
    qtd_classe_c: int
    linhas: list[CurvaAbcLinha]


class SemGiroLinha(BaseModel):
    produto_id: int
    produto_nome: str
    estoque: int
    valor_parado: Decimal
    ultima_venda: date | None
    dias_sem_venda: int | None


class RelatorioSemGiro(BaseModel):
    dias: int
    inicio: date
    qtd_produtos: int
    valor_parado_total: Decimal
    linhas: list[SemGiroLinha]


class KardexLinha(BaseModel):
    id: int
    criado_em: datetime
    tipo: str
    quantidade: int
    estoque_resultante: int
    motivo: str | None
    fornecedor_nome: str | None
    custo_unitario: Decimal | None


class RelatorioKardex(BaseModel):
    produto_id: int
    produto_nome: str
    estoque_atual: int | None
    dias: int
    inicio: date
    total_entradas: int
    total_saidas: int
    num_movimentacoes: int
    linhas: list[KardexLinha]


class RankingClienteLinha(BaseModel):
    cliente_id: int | None
    cliente_nome: str
    num_compras: int
    faturamento: Decimal
    ticket_medio: Decimal
    ultima_compra: date | None


class RelatorioRankingClientes(BaseModel):
    dias: int
    inicio: date
    qtd_clientes: int
    linhas: list[RankingClienteLinha]


class ComprasFornecedorLinha(BaseModel):
    fornecedor_id: int | None
    fornecedor_nome: str
    num_entradas: int
    quantidade_total: int
    valor_total: Decimal


class RelatorioComprasFornecedor(BaseModel):
    dias: int
    inicio: date
    valor_total_geral: Decimal
    linhas: list[ComprasFornecedorLinha]


# ---------------------------------------------------------------------------
# Segunda leva de relatórios.
# ---------------------------------------------------------------------------


class DiaSemanaLinha(BaseModel):
    indice: int
    rotulo: str
    num_vendas: int
    faturamento: Decimal


class HoraLinha(BaseModel):
    hora: int
    num_vendas: int
    faturamento: Decimal


class RelatorioVendasDiaHorario(BaseModel):
    dias: int
    inicio: date
    por_dia_semana: list[DiaSemanaLinha]
    por_hora: list[HoraLinha]
    melhor_dia: str | None
    melhor_hora: int | None


class DescontoLinha(BaseModel):
    venda_id: int
    criado_em: datetime
    cliente_nome: str
    total_bruto: Decimal
    desconto: Decimal
    percentual: Decimal
    total_liquido: Decimal


class RelatorioDescontos(BaseModel):
    dias: int
    inicio: date
    num_vendas: int
    num_vendas_com_desconto: int
    total_bruto: Decimal
    total_desconto: Decimal
    percentual_medio: Decimal
    linhas: list[DescontoLinha]


class CategoriaLinha(BaseModel):
    categoria_id: int | None
    categoria_nome: str
    quantidade: int
    faturamento: Decimal
    lucro: Decimal
    percentual: Decimal


class RelatorioVendasCategoria(BaseModel):
    dias: int
    inicio: date
    faturamento_total: Decimal
    linhas: list[CategoriaLinha]


class PerdaLinha(BaseModel):
    id: int
    criado_em: datetime
    produto_nome: str
    tipo: str
    quantidade: int
    estoque_resultante: int
    motivo: str | None
    valor_estimado: Decimal | None


class RelatorioPerdas(BaseModel):
    dias: int
    inicio: date
    num_movimentacoes: int
    valor_perdas_estimado: Decimal
    linhas: list[PerdaLinha]


class GiroLinha(BaseModel):
    produto_id: int
    produto_nome: str
    estoque: int
    qtd_vendida: int
    venda_media_diaria: Decimal
    cobertura_dias: int | None


class RelatorioGiro(BaseModel):
    dias: int
    inicio: date
    qtd_produtos: int
    linhas: list[GiroLinha]


class ClienteInativoLinha(BaseModel):
    cliente_id: int
    cliente_nome: str
    telefone: str | None
    ultima_compra: date | None
    dias_sem_comprar: int | None
    num_compras: int
    faturamento_total: Decimal


class RelatorioClientesInativos(BaseModel):
    dias: int
    qtd_clientes: int
    linhas: list[ClienteInativoLinha]
