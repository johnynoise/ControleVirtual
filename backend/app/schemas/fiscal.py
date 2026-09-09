"""Schemas Pydantic do relatório fiscal consolidado."""
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel

from app.schemas.despesa import CategoriaDespesaLinha, MesDespesaLinha
from app.schemas.relatorio import FormaPagamentoLinha


class IdentificacaoLoja(BaseModel):
    """Dados da loja no cabeçalho do relatório (vêm da Configuração).

    Só o nome é garantido. Todo o resto é opcional, porque quem vende como
    pessoa física não tem razão social, CNPJ nem inscrição estadual.
    """

    nome: str
    razao_social: str | None
    documento: str | None
    # "CPF", "CNPJ" ou "CPF / CNPJ" conforme o tipo de pessoa cadastrado.
    documento_rotulo: str
    tipo_pessoa: str | None
    regime_tributario: str | None
    regime_rotulo: str | None
    inscricao_estadual: str | None
    inscricao_municipal: str | None
    cnae: str | None
    data_abertura: date | None
    telefone: str | None
    email: str | None
    endereco: str | None
    cep: str | None
    cidade: str | None
    estado: str | None
    contador_nome: str | None
    contador_contato: str | None
    # Verdadeiro quando falta documento ou regime — o mínimo para identificar
    # o negócio. Vira um aviso no relatório, não um erro.
    cadastro_incompleto: bool


class ReceitaMesLinha(BaseModel):
    """Receita de um mês nos dois regimes."""

    ano: int
    mes: int
    rotulo: str
    num_vendas: int
    # Pela data da venda.
    competencia: Decimal
    # Pela data em que o dinheiro entrou (à vista + quitações de fiado).
    caixa: Decimal


class ReceitaFiscal(BaseModel):
    num_vendas: int
    total_bruto: Decimal
    desconto_total: Decimal
    total_competencia: Decimal
    total_caixa: Decimal
    ticket_medio: Decimal
    # Informativos: a receita acima já está líquida de devoluções.
    devolucoes_qtd: int
    devolucoes_valor: Decimal
    vendas_canceladas_qtd: int
    por_mes: list[ReceitaMesLinha]


class CompraFornecedorLinha(BaseModel):
    fornecedor_id: int | None
    fornecedor_nome: str
    # CNPJ/CPF do fornecedor, quando cadastrado (comprovação da compra).
    documento: str | None
    num_entradas: int
    quantidade: int
    valor: Decimal


class CustoMercadoria(BaseModel):
    # Custo da mercadoria vendida: soma dos custos retratados nas vendas.
    cmv: Decimal
    compras_total: Decimal
    compras_quantidade_itens: int
    perdas_valor: Decimal
    perdas_quantidade: int
    por_fornecedor: list[CompraFornecedorLinha]


class EstoqueFiscal(BaseModel):
    num_produtos: int
    valor_custo: Decimal
    valor_venda: Decimal
    # Falso quando o período já terminou: aí o estoque é a posição de hoje,
    # não a da data de fechamento.
    posicao_atual: bool


class DespesasFiscal(BaseModel):
    total: Decimal
    operacional: Decimal
    nao_operacional: Decimal
    total_pago: Decimal
    total_em_aberto: Decimal
    quantidade: int
    por_categoria: list[CategoriaDespesaLinha]
    por_mes: list[MesDespesaLinha]


class ResultadoFiscal(BaseModel):
    """Apuração do resultado do período, por competência."""

    receita_competencia: Decimal
    cmv: Decimal
    lucro_bruto: Decimal
    perdas: Decimal
    despesas_operacionais: Decimal
    resultado_operacional: Decimal
    margem_bruta_percentual: Decimal
    margem_liquida_percentual: Decimal


class ContasReceberFiscal(BaseModel):
    """Fiado ainda em aberto na data de fechamento do período."""

    qtd_vendas: int
    qtd_clientes: int
    total_vendido: Decimal
    total_recebido: Decimal
    total_em_aberto: Decimal


class RelatorioFiscal(BaseModel):
    loja: IdentificacaoLoja
    inicio: date
    fim: date
    dias: int
    gerado_em: datetime
    receita: ReceitaFiscal
    formas_pagamento: list[FormaPagamentoLinha]
    custos: CustoMercadoria
    estoque: EstoqueFiscal
    despesas: DespesasFiscal
    resultado: ResultadoFiscal
    contas_a_receber: ContasReceberFiscal
    # Ressalvas de método, para os números não serem lidos fora de contexto.
    avisos: list[str]
