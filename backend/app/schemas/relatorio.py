"""Schemas Pydantic dos relatórios (dashboard).

Os relatórios de período devolvem sempre ``inicio``, ``fim`` e ``dias`` (a
quantidade de dias do intervalo, contando as duas pontas). Assim a tela sabe
exatamente qual recorte foi usado, tanto quando ela pede "últimos N dias" como
quando informa um intervalo de datas.
"""
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel


class ResumoPeriodo(BaseModel):
    """Cartões da visão do período."""

    dias: int
    inicio: date
    fim: date
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
    fim: date
    faturamento_total: Decimal
    linhas: list[FormaPagamentoLinha]


class ProdutoFaturamentoLinha(BaseModel):
    produto_id: int | None
    produto_nome: str
    categoria_nome: str
    quantidade: int
    faturamento: Decimal
    lucro: Decimal
    margem_percentual: Decimal
    percentual: Decimal
    percentual_acumulado: Decimal
    classe: str  # "A", "B" ou "C" (curva ABC)


class CategoriaFaturamentoLinha(BaseModel):
    categoria_id: int | None
    categoria_nome: str
    quantidade: int
    faturamento: Decimal
    lucro: Decimal
    margem_percentual: Decimal
    percentual: Decimal


class RelatorioProdutosFaturamento(BaseModel):
    """De onde vem o faturamento, nos dois grãos: produto e categoria."""

    dias: int
    inicio: date
    fim: date
    faturamento_total: Decimal
    lucro_total: Decimal
    qtd_classe_a: int
    qtd_classe_b: int
    qtd_classe_c: int
    por_produto: list[ProdutoFaturamentoLinha]
    por_categoria: list[CategoriaFaturamentoLinha]


class SaudeEstoqueLinha(BaseModel):
    produto_id: int
    produto_nome: str
    # "repor" | "parado" | "sem_estoque" | "saudavel" — é por aqui que a tela
    # separa as abas "vai faltar" e "está parado".
    situacao: str
    estoque: int
    estoque_minimo: int
    qtd_vendida: int
    venda_media_diaria: Decimal
    cobertura_dias: int | None  # None = sem venda no período
    valor_em_estoque: Decimal
    ultima_venda: date | None
    dias_sem_venda: int | None


class RelatorioSaudeEstoque(BaseModel):
    dias: int
    inicio: date
    fim: date
    cobertura_curta_dias: int  # limite usado para classificar como "repor"
    qtd_produtos: int
    qtd_repor: int
    qtd_parado: int
    # Sem venda e sem estoque: não é dinheiro parado nem risco de falta, então
    # fica fora das abas, mas é contado para o número não sumir sem explicação.
    qtd_sem_estoque: int
    valor_parado_total: Decimal
    valor_estoque_total: Decimal
    linhas: list[SaudeEstoqueLinha]


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
    fim: date
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
    fim: date
    qtd_clientes: int
    faturamento_identificado: Decimal
    # Vendas de balcão (sem cliente): ficam fora do ranking e viram termômetro
    # de quanto do faturamento está sem dono.
    num_vendas_sem_cliente: int
    faturamento_sem_cliente: Decimal
    percentual_sem_cliente: Decimal
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
    fim: date
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
    fim: date
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
    fim: date
    num_vendas: int
    num_vendas_com_desconto: int
    total_bruto: Decimal
    total_desconto: Decimal
    percentual_medio: Decimal
    linhas: list[DescontoLinha]


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
    fim: date
    num_movimentacoes: int
    valor_perdas_estimado: Decimal
    linhas: list[PerdaLinha]


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


# ---------------------------------------------------------------------------
# Apuração do resultado ("quanto sobrou").
# ---------------------------------------------------------------------------


class ApuracaoResultado(BaseModel):
    """Cascata do resultado de um período. Usada no atual e no de comparação."""

    receita: Decimal
    cmv: Decimal  # custo da mercadoria vendida
    lucro_bruto: Decimal
    perdas: Decimal
    despesas_operacionais: Decimal
    resultado_operacional: Decimal  # a "sobra" do período
    margem_bruta_percentual: Decimal
    margem_liquida_percentual: Decimal
    num_vendas: int
    ticket_medio: Decimal
    desconto_total: Decimal


class DespesaCategoriaLinha(BaseModel):
    categoria: str
    categoria_rotulo: str
    quantidade: int
    total: Decimal
    percentual: Decimal


class RelatorioResultado(BaseModel):
    dias: int
    inicio: date
    fim: date
    # Recorte de comparação escolhido pelo backend (mês anterior quando o
    # período começa no dia 1º, senão a janela anterior de mesma duração).
    anterior_inicio: date
    anterior_fim: date
    atual: ApuracaoResultado
    anterior: ApuracaoResultado
    despesas_total: Decimal
    despesas_nao_operacionais: Decimal
    despesas_em_aberto: Decimal
    despesas_quantidade: int
    despesas_por_categoria: list[DespesaCategoriaLinha]
    num_movimentacoes_perda: int
    avisos: list[str]
