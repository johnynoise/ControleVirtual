"""Relatório fiscal consolidado do período (base para a declaração).

Reúne num só lugar o que está espalhado pelo sistema: receita, devoluções,
custo da mercadoria vendida, compras por fornecedor, perdas, despesas, estoque
e contas a receber. A ideia é ser a memória de cálculo que o lojista leva para
o contador, não um cálculo de imposto — o enquadramento e a apuração dependem
do regime tributário e são decisão do contador.

Três escolhas de método que valem registrar:

1. **Receita por competência x por caixa.** Competência é a data da venda; caixa
   é a data em que o dinheiro entrou. Numa venda à vista as duas coincidem; no
   fiado, a competência é a venda e o caixa são os pagamentos, que podem cair em
   outro mês (ou outro ano).
2. **Devoluções não são subtraídas da receita.** Ao aplicar uma devolução, o
   sistema recalcula os totais da venda original. Então a receita já sai líquida
   de devoluções, inclusive das que foram aplicadas depois do fim do período.
   O total devolvido aparece como informação, e subtraí-lo de novo seria contar
   duas vezes.
3. **Estoque é a posição de hoje.** O custo guardado no produto é o atual e o
   estoque pode ser editado direto no cadastro (sem gerar movimentação), então
   não há como reconstruir com segurança o valor do estoque numa data passada.
   Quando o período não termina hoje, isso é avisado no próprio relatório.
"""
from collections import defaultdict
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.crud import despesa as crud_despesa
from app.crud import relatorio as crud_relatorio
from app.crud.relatorio import Periodo
from app.models.configuracao import Configuracao
from app.schemas.configuracao import rotulo_regime
from app.models.despesa import Despesa
from app.models.devolucao import Devolucao
from app.models.fornecedor import Fornecedor
from app.models.movimentacao import MovimentacaoEstoque
from app.models.pagamento import PagamentoVenda
from app.models.venda import Venda

_CENTAVOS = Decimal("0.01")
_FIADO = "fiado"

_MESES_ABREV = [
    "jan",
    "fev",
    "mar",
    "abr",
    "mai",
    "jun",
    "jul",
    "ago",
    "set",
    "out",
    "nov",
    "dez",
]


def _q(valor) -> Decimal:
    """Converte para Decimal com 2 casas (dinheiro)."""
    return Decimal(valor or 0).quantize(_CENTAVOS)


def _pct(parte: Decimal, total: Decimal) -> Decimal:
    """Percentual de `parte` sobre `total`, com 2 casas. Zero se total <= 0."""
    if total <= 0:
        return Decimal("0.00")
    return (parte / total * 100).quantize(_CENTAVOS)


def _meses_do_periodo(periodo: Periodo) -> list[tuple[int, int]]:
    """Lista de (ano, mês) cobertos pelo período, em ordem."""
    meses: list[tuple[int, int]] = []
    ano, mes = periodo.inicio_data.year, periodo.inicio_data.month
    ultimo = (periodo.fim_data.year, periodo.fim_data.month)
    while (ano, mes) <= ultimo:
        meses.append((ano, mes))
        if mes == 12:
            ano, mes = ano + 1, 1
        else:
            mes += 1
    return meses


def _rotulo_mes(ano: int, mes: int) -> str:
    return f"{_MESES_ABREV[mes - 1]}/{ano}"


def _identificacao(db: Session) -> dict:
    """Dados da loja para o cabeçalho do relatório.

    Tudo além do nome é opcional: quem vende como pessoa física não tem razão
    social nem inscrição estadual, e o relatório sai igual sem esses campos.
    """
    config = db.get(Configuracao, 1)
    if config is None:
        return {
            "nome": "ControleVirtual",
            "razao_social": None,
            "documento": None,
            "documento_rotulo": "CPF / CNPJ",
            "tipo_pessoa": None,
            "regime_tributario": None,
            "regime_rotulo": None,
            "inscricao_estadual": None,
            "inscricao_municipal": None,
            "cnae": None,
            "data_abertura": None,
            "telefone": None,
            "email": None,
            "endereco": None,
            "cep": None,
            "cidade": None,
            "estado": None,
            "contador_nome": None,
            "contador_contato": None,
            "cadastro_incompleto": True,
        }

    return {
        "nome": config.nome_loja,
        "razao_social": config.razao_social,
        "documento": config.documento,
        "documento_rotulo": _rotulo_documento(config.tipo_pessoa),
        "tipo_pessoa": config.tipo_pessoa,
        "regime_tributario": config.regime_tributario,
        "regime_rotulo": rotulo_regime(config.regime_tributario),
        "inscricao_estadual": config.inscricao_estadual,
        "inscricao_municipal": config.inscricao_municipal,
        "cnae": config.cnae,
        "data_abertura": config.data_abertura,
        "telefone": config.telefone,
        "email": config.email,
        "endereco": config.endereco,
        "cep": config.cep,
        "cidade": config.cidade,
        "estado": config.estado,
        "contador_nome": config.contador_nome,
        "contador_contato": config.contador_contato,
        # Documento e regime são o mínimo para o contador identificar o negócio.
        "cadastro_incompleto": not (config.documento and config.regime_tributario),
    }


def _rotulo_documento(tipo_pessoa: str | None) -> str:
    """Como chamar o documento conforme o tipo de pessoa."""
    if tipo_pessoa == "fisica":
        return "CPF"
    if tipo_pessoa == "juridica":
        return "CNPJ"
    return "CPF / CNPJ"


def _pagamentos_periodo(db: Session, periodo: Periodo) -> list[PagamentoVenda]:
    """Quitações de fiado recebidas no período (de vendas que valem)."""
    return (
        db.query(PagamentoVenda)
        .join(Venda, PagamentoVenda.venda_id == Venda.id)
        .filter(
            PagamentoVenda.criado_em >= periodo.inicio,
            PagamentoVenda.criado_em <= periodo.fim,
            Venda.cancelada_em.is_(None),
            func.coalesce(Venda.entrega_status, "") != "pendente",
        )
        .all()
    )


def _receita(db: Session, periodo: Periodo, vendas: list[Venda]) -> dict:
    """Receita do período por competência e por caixa, com o corte mensal."""
    pagamentos = _pagamentos_periodo(db, periodo)

    total_bruto = Decimal("0")
    total_desconto = Decimal("0")
    total_competencia = Decimal("0")
    total_caixa = Decimal("0")

    por_mes: dict[tuple[int, int], dict] = defaultdict(
        lambda: {
            "num_vendas": 0,
            "competencia": Decimal("0"),
            "caixa": Decimal("0"),
        }
    )

    for v in vendas:
        liquido = Decimal(v.total_liquido or 0)
        chave = (v.criado_em.year, v.criado_em.month)
        total_bruto += Decimal(v.total_bruto or 0)
        total_desconto += Decimal(v.desconto or 0)
        total_competencia += liquido
        por_mes[chave]["num_vendas"] += 1
        por_mes[chave]["competencia"] += liquido

        # Caixa: venda à vista entra na hora; fiado entra pelos pagamentos.
        if v.forma_pagamento != _FIADO:
            total_caixa += liquido
            por_mes[chave]["caixa"] += liquido

    for p in pagamentos:
        valor = Decimal(p.valor or 0)
        chave = (p.criado_em.year, p.criado_em.month)
        total_caixa += valor
        por_mes[chave]["caixa"] += valor

    # Devoluções e cancelamentos do período (informativos).
    devolucoes = (
        db.query(
            func.count(Devolucao.id), func.coalesce(func.sum(Devolucao.valor_devolvido), 0)
        )
        .filter(
            Devolucao.criado_em >= periodo.inicio,
            Devolucao.criado_em <= periodo.fim,
        )
        .one()
    )
    canceladas = (
        db.query(func.count(Venda.id))
        .filter(
            Venda.cancelada_em.isnot(None),
            Venda.cancelada_em >= periodo.inicio,
            Venda.cancelada_em <= periodo.fim,
        )
        .scalar()
        or 0
    )

    num_vendas = len(vendas)
    total_competencia = total_competencia.quantize(_CENTAVOS)

    linhas_mes = [
        {
            "ano": ano,
            "mes": mes,
            "rotulo": _rotulo_mes(ano, mes),
            "num_vendas": por_mes[(ano, mes)]["num_vendas"],
            "competencia": _q(por_mes[(ano, mes)]["competencia"]),
            "caixa": _q(por_mes[(ano, mes)]["caixa"]),
        }
        for ano, mes in _meses_do_periodo(periodo)
    ]

    return {
        "num_vendas": num_vendas,
        "total_bruto": _q(total_bruto),
        "desconto_total": _q(total_desconto),
        "total_competencia": total_competencia,
        "total_caixa": _q(total_caixa),
        "ticket_medio": (total_competencia / num_vendas).quantize(_CENTAVOS)
        if num_vendas
        else Decimal("0.00"),
        "devolucoes_qtd": int(devolucoes[0] or 0),
        "devolucoes_valor": _q(devolucoes[1]),
        "vendas_canceladas_qtd": int(canceladas),
        "por_mes": linhas_mes,
    }


def _compras(db: Session, periodo: Periodo) -> dict:
    """Compras de mercadoria no período, por fornecedor (com documento).

    Usa as entradas de estoque, ignorando as que são estorno ou devolução —
    essas voltam mercadoria, não representam compra.
    """
    entradas = (
        db.query(MovimentacaoEstoque, Fornecedor.documento)
        .outerjoin(Fornecedor, MovimentacaoEstoque.fornecedor_id == Fornecedor.id)
        .filter(
            MovimentacaoEstoque.tipo == "entrada",
            MovimentacaoEstoque.criado_em >= periodo.inicio,
            MovimentacaoEstoque.criado_em <= periodo.fim,
            (MovimentacaoEstoque.motivo.is_(None))
            | ~MovimentacaoEstoque.motivo.in_(["estorno", "devolucao"]),
        )
        .all()
    )

    agregado: dict = {}
    total = Decimal("0")
    quantidade_total = 0
    for mov, documento in entradas:
        chave = mov.fornecedor_id if mov.fornecedor_id is not None else "sem_fornecedor"
        registro = agregado.setdefault(
            chave,
            {
                "fornecedor_id": mov.fornecedor_id,
                "fornecedor_nome": mov.fornecedor_nome or "Sem fornecedor",
                "documento": documento,
                "num_entradas": 0,
                "quantidade": 0,
                "valor": Decimal("0"),
            },
        )
        registro["num_entradas"] += 1
        registro["quantidade"] += mov.quantidade
        quantidade_total += mov.quantidade
        if mov.custo_unitario is not None:
            valor = Decimal(mov.custo_unitario) * mov.quantidade
            registro["valor"] += valor
            total += valor

    linhas = [
        {
            "fornecedor_id": r["fornecedor_id"],
            "fornecedor_nome": r["fornecedor_nome"],
            "documento": r["documento"],
            "num_entradas": r["num_entradas"],
            "quantidade": r["quantidade"],
            "valor": _q(r["valor"]),
        }
        for r in agregado.values()
    ]
    linhas.sort(key=lambda x: x["valor"], reverse=True)

    return {
        "total": _q(total),
        "quantidade_itens": quantidade_total,
        "por_fornecedor": linhas,
    }


def _contas_a_receber(db: Session, periodo: Periodo) -> dict:
    """Saldo de fiado ainda em aberto na data de fechamento do período.

    Considera as vendas a prazo feitas até o fim do período e os pagamentos
    recebidos até a mesma data, então reflete a posição naquele momento.
    """
    vendas_fiado = (
        db.query(Venda)
        .filter(
            Venda.forma_pagamento == _FIADO,
            Venda.criado_em <= periodo.fim,
            Venda.cancelada_em.is_(None),
            func.coalesce(Venda.entrega_status, "") != "pendente",
        )
        .all()
    )

    total_em_aberto = Decimal("0")
    total_vendido = Decimal("0")
    total_recebido = Decimal("0")
    qtd_vendas = 0
    clientes: set = set()

    for v in vendas_fiado:
        liquido = Decimal(v.total_liquido or 0)
        recebido = sum(
            (Decimal(p.valor or 0) for p in v.pagamentos if p.criado_em <= periodo.fim),
            Decimal("0"),
        )
        saldo = liquido - recebido
        if saldo <= 0:
            continue
        qtd_vendas += 1
        total_em_aberto += saldo
        total_vendido += liquido
        total_recebido += recebido
        clientes.add(v.cliente_id if v.cliente_id is not None else f"nome:{v.cliente_nome}")

    return {
        "qtd_vendas": qtd_vendas,
        "qtd_clientes": len(clientes),
        "total_vendido": _q(total_vendido),
        "total_recebido": _q(total_recebido),
        "total_em_aberto": _q(total_em_aberto),
    }


def _avisos(periodo: Periodo, receita: dict, despesas: dict, loja: dict) -> list[str]:
    """Ressalvas de método, para o número não ser lido fora de contexto."""
    avisos = [
        "A receita já está líquida de devoluções: quando uma devolução é "
        "registrada, os totais da venda original são recalculados. O valor "
        "devolvido aparece como informação e não deve ser subtraído de novo.",
        "Vendas estornadas (canceladas) ficam fora de todos os totais, "
        "independentemente da data em que o cancelamento aconteceu.",
        "O sistema não registra a taxa retida pela maquininha nem emissão de "
        "nota fiscal. Se houver taxa de cartão ou Pix, lance como despesa na "
        "categoria \"Taxas de cartão e Pix\" para ela entrar no resultado.",
    ]

    if periodo.fim_data < date.today():
        avisos.append(
            "O estoque mostrado é a posição de hoje, não a do fim do período: "
            "o custo guardado no produto é o atual e o estoque pode ser "
            "ajustado direto no cadastro, então não há como reconstruir com "
            "segurança o valor do estoque numa data passada."
        )

    if receita["total_competencia"] > 0 and despesas["total"] == 0:
        avisos.append(
            "Não há nenhuma despesa lançada no período. Sem as despesas "
            "(aluguel, energia, embalagem, impostos), o resultado fica "
            "superestimado. Lance-as na tela de Despesas."
        )

    if despesas["total_em_aberto"] > 0:
        avisos.append(
            "Há despesas lançadas e ainda não pagas no período. Elas entram no "
            "resultado por competência, mas não saíram do caixa."
        )

    if loja["cadastro_incompleto"]:
        avisos.append(
            "O cadastro do negócio está incompleto: informe ao menos o "
            "documento (CPF ou CNPJ) e o regime tributário em Configurações, "
            "para o relatório identificar de quem ele é."
        )

    return avisos


def relatorio_anual(db: Session, periodo: Periodo) -> dict:
    """Monta o relatório fiscal consolidado do período."""
    loja = _identificacao(db)
    vendas = crud_relatorio.vendas_do_periodo(db, periodo)

    receita = _receita(db, periodo, vendas)
    compras = _compras(db, periodo)
    estoque = crud_relatorio.estoque(db)
    perdas = crud_relatorio.perdas_e_ajustes(db, periodo)
    formas = crud_relatorio.vendas_por_forma_pagamento(db, periodo)
    despesas = crud_despesa.resumo(
        db, inicio=periodo.inicio_data, fim=periodo.fim_data
    )
    contas = _contas_a_receber(db, periodo)

    cmv = _q(sum((Decimal(v.custo_total or 0) for v in vendas), Decimal("0")))
    receita_competencia = receita["total_competencia"]
    perdas_valor = _q(perdas["valor_perdas_estimado"])
    despesas_operacionais = _q(despesas["total_operacional"])

    # Mesma conta do relatório de resultado, para as duas telas não divergirem.
    apuracao = crud_relatorio.apurar_resultado(
        receita=receita_competencia,
        cmv=cmv,
        perdas=perdas_valor,
        despesas_operacionais=despesas_operacionais,
    )

    return {
        "loja": loja,
        "inicio": periodo.inicio_data,
        "fim": periodo.fim_data,
        "dias": periodo.dias,
        "gerado_em": datetime.now(),
        "receita": receita,
        "formas_pagamento": formas["linhas"],
        "custos": {
            "cmv": cmv,
            "compras_total": compras["total"],
            "compras_quantidade_itens": compras["quantidade_itens"],
            "perdas_valor": perdas_valor,
            "perdas_quantidade": perdas["num_movimentacoes"],
            "por_fornecedor": compras["por_fornecedor"],
        },
        "estoque": {
            "num_produtos": estoque["num_produtos"],
            "valor_custo": estoque["valor_custo_total"],
            "valor_venda": estoque["valor_venda_total"],
            "posicao_atual": periodo.fim_data >= date.today(),
        },
        "despesas": {
            "total": despesas["total"],
            "operacional": despesas["total_operacional"],
            "nao_operacional": despesas["total_nao_operacional"],
            "total_pago": despesas["total_pago"],
            "total_em_aberto": despesas["total_em_aberto"],
            "quantidade": despesas["quantidade"],
            "por_categoria": despesas["por_categoria"],
            "por_mes": despesas["por_mes"],
        },
        "resultado": {
            "receita_competencia": receita_competencia,
            "cmv": apuracao["cmv"],
            "lucro_bruto": apuracao["lucro_bruto"],
            "perdas": apuracao["perdas"],
            "despesas_operacionais": apuracao["despesas_operacionais"],
            "resultado_operacional": apuracao["resultado_operacional"],
            "margem_bruta_percentual": apuracao["margem_bruta_percentual"],
            "margem_liquida_percentual": apuracao["margem_liquida_percentual"],
        },
        "contas_a_receber": contas,
        "avisos": _avisos(periodo, receita, despesas, loja),
    }


def anos_com_dados(db: Session) -> list[int]:
    """Anos que têm venda ou despesa lançada, do mais recente para o mais antigo.

    Serve para a tela montar o seletor de ano sem oferecer ano vazio.
    """
    anos: set[int] = set()

    limites_venda = db.query(
        func.min(Venda.criado_em), func.max(Venda.criado_em)
    ).one()
    limites_despesa = db.query(
        func.min(Despesa.data_competencia), func.max(Despesa.data_competencia)
    ).one()

    for menor, maior in (limites_venda, limites_despesa):
        if menor is None or maior is None:
            continue
        for ano in range(menor.year, maior.year + 1):
            anos.add(ano)

    anos.add(date.today().year)
    return sorted(anos, reverse=True)
