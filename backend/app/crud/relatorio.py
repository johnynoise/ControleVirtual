"""Agregações para o dashboard.

As somas são feitas em Python a partir das vendas/itens/produtos do período.
Isso mantém o código agnóstico de banco (SQLite ou PostgreSQL) e é adequado
ao volume de uma loja local. Se o volume crescer muito, dá para migrar para
agregações no próprio banco.
"""
from collections import defaultdict
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import NamedTuple

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.categoria import Categoria
from app.models.cliente import Cliente
from app.models.movimentacao import MovimentacaoEstoque
from app.models.produto import Produto
from app.models.venda import ItemVenda, Venda

_CENTAVOS = Decimal("0.01")


def _q(valor) -> Decimal:
    """Converte para Decimal com 2 casas (dinheiro)."""
    return Decimal(valor or 0).quantize(_CENTAVOS)


def _pct(parte: Decimal, total: Decimal) -> Decimal:
    """Percentual de `parte` sobre `total`, com 2 casas. Zero se total <= 0."""
    if total <= 0:
        return Decimal("0.00")
    return (parte / total * 100).quantize(_CENTAVOS)


class Periodo(NamedTuple):
    """Intervalo de datas fechado nas duas pontas, usado por todos os relatórios.

    Guarda os limites já como ``datetime`` (00:00:00 do primeiro dia e
    23:59:59.999999 do último) para comparar direto com as colunas de data/hora
    sem depender de funções de data do banco.
    """

    inicio: datetime
    fim: datetime

    @property
    def inicio_data(self) -> date:
        return self.inicio.date()

    @property
    def fim_data(self) -> date:
        return self.fim.date()

    @property
    def dias(self) -> int:
        """Quantidade de dias do intervalo, contando as duas pontas."""
        return (self.fim.date() - self.inicio.date()).days + 1


def periodo_entre(inicio: date, fim: date) -> Periodo:
    """Período entre duas datas, incluindo o dia inicial e o final."""
    return Periodo(
        inicio=datetime.combine(inicio, time.min),
        fim=datetime.combine(fim, time.max),
    )


def periodo_de_dias(dias: int) -> Periodo:
    """Últimos ``dias`` dias, terminando hoje (hoje conta como o primeiro)."""
    dias = max(1, dias)
    fim = date.today()
    return periodo_entre(fim - timedelta(days=dias - 1), fim)


def vendas_do_periodo(db: Session, periodo: Periodo) -> list[Venda]:
    """Vendas que contam nos relatórios do período.

    Fica de fora o que não é faturamento: vendas estornadas (canceladas) e
    pedidos de entrega ainda pendentes, que nem baixaram estoque. O relatório
    fiscal usa este mesmo recorte, para os números baterem entre as telas.
    """
    return (
        db.query(Venda)
        .filter(
            Venda.criado_em >= periodo.inicio,
            Venda.criado_em <= periodo.fim,
            Venda.cancelada_em.is_(None),
            func.coalesce(Venda.entrega_status, "") != "pendente",
        )
        .all()
    )


def resumo(db: Session, periodo: Periodo) -> dict:
    vendas = vendas_do_periodo(db, periodo)

    faturamento = sum((v.total_liquido or 0) for v in vendas)
    custo = sum((v.custo_total or 0) for v in vendas)
    lucro = sum((v.lucro or 0) for v in vendas)
    desconto = sum((v.desconto or 0) for v in vendas)
    num = len(vendas)

    faturamento = Decimal(faturamento).quantize(_CENTAVOS)
    custo = Decimal(custo).quantize(_CENTAVOS)
    lucro = Decimal(lucro).quantize(_CENTAVOS)
    desconto = Decimal(desconto).quantize(_CENTAVOS)
    ticket = (faturamento / num).quantize(_CENTAVOS) if num else Decimal("0.00")
    margem = (lucro / faturamento * 100).quantize(_CENTAVOS) if faturamento > 0 else Decimal("0.00")

    return {
        "dias": periodo.dias,
        "inicio": periodo.inicio_data,
        "fim": periodo.fim_data,
        "num_vendas": num,
        "faturamento": faturamento,
        "custo": custo,
        "lucro": lucro,
        "desconto": desconto,
        "ticket_medio": ticket,
        "margem_percentual": margem,
    }


def vendas_por_dia(db: Session, periodo: Periodo) -> list[dict]:
    vendas = vendas_do_periodo(db, periodo)

    por_dia: dict[date, dict] = defaultdict(
        lambda: {"faturamento": Decimal("0"), "lucro": Decimal("0"), "num_vendas": 0}
    )
    for v in vendas:
        d = v.criado_em.date()
        por_dia[d]["faturamento"] += v.total_liquido or 0
        por_dia[d]["lucro"] += v.lucro or 0
        por_dia[d]["num_vendas"] += 1

    # Preenche todos os dias do período, inclusive os sem venda (zerados).
    resultado: list[dict] = []
    for i in range(periodo.dias):
        d = periodo.inicio_data + timedelta(days=i)
        dados = por_dia.get(d)
        resultado.append(
            {
                "dia": d,
                "faturamento": Decimal(dados["faturamento"]).quantize(_CENTAVOS)
                if dados
                else Decimal("0.00"),
                "lucro": Decimal(dados["lucro"]).quantize(_CENTAVOS)
                if dados
                else Decimal("0.00"),
                "num_vendas": dados["num_vendas"] if dados else 0,
            }
        )
    return resultado


def mais_vendidos(db: Session, periodo: Periodo, limite: int = 10) -> dict:
    itens = (
        db.query(ItemVenda)
        .join(Venda, ItemVenda.venda_id == Venda.id)
        .filter(
            Venda.criado_em >= periodo.inicio,
            Venda.criado_em <= periodo.fim,
            Venda.cancelada_em.is_(None),
            func.coalesce(Venda.entrega_status, "") != "pendente",
            ItemVenda.quantidade > 0,
        )
        .all()
    )

    agregado: dict = {}
    for item in itens:
        chave = item.produto_id if item.produto_id is not None else f"nome:{item.produto_nome}"
        registro = agregado.setdefault(
            chave,
            {
                "produto_id": item.produto_id,
                "produto_nome": item.produto_nome,
                "quantidade": 0,
                "faturamento": Decimal("0"),
                "lucro": Decimal("0"),
            },
        )
        registro["quantidade"] += item.quantidade
        registro["faturamento"] += item.subtotal or 0
        registro["lucro"] += (item.preco_unitario - item.custo_unitario) * item.quantidade

    lista = list(agregado.values())
    for r in lista:
        r["faturamento"] = Decimal(r["faturamento"]).quantize(_CENTAVOS)
        r["lucro"] = Decimal(r["lucro"]).quantize(_CENTAVOS)

    por_quantidade = sorted(lista, key=lambda r: r["quantidade"], reverse=True)[:limite]
    por_lucro = sorted(lista, key=lambda r: r["lucro"], reverse=True)[:limite]
    return {"por_quantidade": por_quantidade, "por_lucro": por_lucro}


def estoque(db: Session) -> dict:
    produtos = db.query(Produto).all()

    valor_custo = Decimal("0")
    valor_venda = Decimal("0")
    baixos: list[dict] = []

    for p in produtos:
        estoque_qtd = p.estoque or 0
        valor_custo += (p.preco_custo or 0) * estoque_qtd
        valor_venda += (p.preco_venda or 0) * estoque_qtd
        if estoque_qtd <= (p.estoque_minimo or 0):
            baixos.append(
                {
                    "produto_id": p.id,
                    "nome": p.nome,
                    "estoque": estoque_qtd,
                    "estoque_minimo": p.estoque_minimo or 0,
                }
            )

    baixos.sort(key=lambda x: x["estoque"])
    return {
        "num_produtos": len(produtos),
        "valor_custo_total": valor_custo.quantize(_CENTAVOS),
        "valor_venda_total": valor_venda.quantize(_CENTAVOS),
        "qtd_estoque_baixo": len(baixos),
        "itens_estoque_baixo": baixos,
    }


# ---------------------------------------------------------------------------
# Relatórios da seção "Relatórios" (além do dashboard).
# ---------------------------------------------------------------------------

# Rótulos amigáveis das formas de pagamento (a coluna guarda o valor "cru").
_FORMAS_PAGAMENTO = {
    "dinheiro": "Dinheiro",
    "cartao_credito": "Cartão de crédito",
    "cartao_debito": "Cartão de débito",
    "pix": "Pix",
    "outro": "Outro",
}


def vendas_por_forma_pagamento(db: Session, periodo: Periodo) -> dict:
    """Mix de faturamento por forma de pagamento no período."""
    vendas = vendas_do_periodo(db, periodo)

    agregado: dict = defaultdict(
        lambda: {"num_vendas": 0, "faturamento": Decimal("0")}
    )
    for v in vendas:
        chave = v.forma_pagamento or "outro"
        agregado[chave]["num_vendas"] += 1
        agregado[chave]["faturamento"] += v.total_liquido or 0

    faturamento_total = sum((r["faturamento"] for r in agregado.values()), Decimal("0"))

    linhas: list[dict] = []
    for chave, dados in agregado.items():
        fat = _q(dados["faturamento"])
        pct = (fat / faturamento_total * 100).quantize(_CENTAVOS) if faturamento_total > 0 else Decimal("0.00")
        linhas.append(
            {
                "forma": chave,
                "forma_rotulo": _FORMAS_PAGAMENTO.get(chave, chave.title()),
                "num_vendas": dados["num_vendas"],
                "faturamento": fat,
                "percentual": pct,
            }
        )

    linhas.sort(key=lambda x: x["faturamento"], reverse=True)
    return {
        "dias": periodo.dias,
        "inicio": periodo.inicio_data,
        "fim": periodo.fim_data,
        "faturamento_total": _q(faturamento_total),
        "linhas": linhas,
    }


def curva_abc(db: Session, periodo: Periodo) -> dict:
    """Curva ABC de produtos por faturamento no período.

    Classe A: produtos que somam até 80% do faturamento acumulado.
    Classe B: de 80% a 95%. Classe C: os demais.
    """
    itens = (
        db.query(ItemVenda)
        .join(Venda, ItemVenda.venda_id == Venda.id)
        .filter(
            Venda.criado_em >= periodo.inicio,
            Venda.criado_em <= periodo.fim,
            Venda.cancelada_em.is_(None),
            func.coalesce(Venda.entrega_status, "") != "pendente",
            ItemVenda.quantidade > 0,
        )
        .all()
    )

    agregado: dict = {}
    for item in itens:
        chave = item.produto_id if item.produto_id is not None else f"nome:{item.produto_nome}"
        registro = agregado.setdefault(
            chave,
            {
                "produto_id": item.produto_id,
                "produto_nome": item.produto_nome,
                "quantidade": 0,
                "faturamento": Decimal("0"),
            },
        )
        registro["quantidade"] += item.quantidade
        registro["faturamento"] += item.subtotal or 0

    lista = sorted(agregado.values(), key=lambda r: r["faturamento"], reverse=True)
    faturamento_total = sum((r["faturamento"] for r in lista), Decimal("0"))

    acumulado = Decimal("0")
    linhas: list[dict] = []
    contagem = {"A": 0, "B": 0, "C": 0}
    for r in lista:
        fat = _q(r["faturamento"])
        acumulado += r["faturamento"]
        pct = (fat / faturamento_total * 100).quantize(_CENTAVOS) if faturamento_total > 0 else Decimal("0.00")
        pct_acum = (
            (acumulado / faturamento_total * 100).quantize(_CENTAVOS)
            if faturamento_total > 0
            else Decimal("0.00")
        )
        if pct_acum <= Decimal("80"):
            classe = "A"
        elif pct_acum <= Decimal("95"):
            classe = "B"
        else:
            classe = "C"
        contagem[classe] += 1
        linhas.append(
            {
                "produto_id": r["produto_id"],
                "produto_nome": r["produto_nome"],
                "quantidade": r["quantidade"],
                "faturamento": fat,
                "percentual": pct,
                "percentual_acumulado": pct_acum,
                "classe": classe,
            }
        )

    return {
        "dias": periodo.dias,
        "inicio": periodo.inicio_data,
        "fim": periodo.fim_data,
        "faturamento_total": _q(faturamento_total),
        "qtd_classe_a": contagem["A"],
        "qtd_classe_b": contagem["B"],
        "qtd_classe_c": contagem["C"],
        "linhas": linhas,
    }


def produtos_sem_giro(db: Session, periodo: Periodo) -> dict:
    """Produtos ativos sem nenhuma venda no período (capital parado)."""
    # Produtos vendidos no período (para excluí-los da lista).
    vendidos_periodo = {
        pid
        for (pid,) in db.query(ItemVenda.produto_id)
        .join(Venda, ItemVenda.venda_id == Venda.id)
        .filter(
            Venda.criado_em >= periodo.inicio,
            Venda.criado_em <= periodo.fim,
            Venda.cancelada_em.is_(None),
            func.coalesce(Venda.entrega_status, "") != "pendente",
            ItemVenda.produto_id.isnot(None),
            ItemVenda.quantidade > 0,
        )
        .distinct()
        .all()
    }

    # Data da última venda de cada produto (de qualquer período).
    ultima_venda = dict(
        db.query(ItemVenda.produto_id, func.max(Venda.criado_em))
        .join(Venda, ItemVenda.venda_id == Venda.id)
        .filter(
            ItemVenda.produto_id.isnot(None),
            Venda.cancelada_em.is_(None),
            func.coalesce(Venda.entrega_status, "") != "pendente",
        )
        .group_by(ItemVenda.produto_id)
        .all()
    )

    produtos = db.query(Produto).filter(Produto.ativo.is_(True)).all()

    hoje = date.today()
    linhas: list[dict] = []
    valor_parado_total = Decimal("0")
    for p in produtos:
        if p.id in vendidos_periodo:
            continue
        estoque_qtd = p.estoque or 0
        valor_parado = _q((p.preco_custo or 0) * estoque_qtd)
        valor_parado_total += valor_parado

        ult = ultima_venda.get(p.id)
        ult_data = ult.date() if ult else None
        dias_sem_venda = (hoje - ult_data).days if ult_data else None

        linhas.append(
            {
                "produto_id": p.id,
                "produto_nome": p.nome,
                "estoque": estoque_qtd,
                "valor_parado": valor_parado,
                "ultima_venda": ult_data,
                "dias_sem_venda": dias_sem_venda,
            }
        )

    # Ordena por maior capital parado (mais relevante primeiro).
    linhas.sort(key=lambda x: x["valor_parado"], reverse=True)
    return {
        "dias": periodo.dias,
        "inicio": periodo.inicio_data,
        "fim": periodo.fim_data,
        "qtd_produtos": len(linhas),
        "valor_parado_total": _q(valor_parado_total),
        "linhas": linhas,
    }


def kardex(db: Session, produto_id: int, periodo: Periodo) -> dict:
    """Extrato de movimentações de estoque de um produto (entradas/saídas/ajustes)."""
    produto = db.get(Produto, produto_id)

    movimentacoes = (
        db.query(MovimentacaoEstoque)
        .filter(
            MovimentacaoEstoque.produto_id == produto_id,
            MovimentacaoEstoque.criado_em >= periodo.inicio,
            MovimentacaoEstoque.criado_em <= periodo.fim,
        )
        .order_by(MovimentacaoEstoque.criado_em.asc(), MovimentacaoEstoque.id.asc())
        .all()
    )

    total_entradas = sum(m.quantidade for m in movimentacoes if m.tipo == "entrada")
    total_saidas = sum(m.quantidade for m in movimentacoes if m.tipo == "saida")

    linhas = [
        {
            "id": m.id,
            "criado_em": m.criado_em,
            "tipo": m.tipo,
            "quantidade": m.quantidade,
            "estoque_resultante": m.estoque_resultante,
            "motivo": m.motivo,
            "fornecedor_nome": m.fornecedor_nome,
            "custo_unitario": _q(m.custo_unitario) if m.custo_unitario is not None else None,
        }
        for m in movimentacoes
    ]

    return {
        "produto_id": produto_id,
        "produto_nome": produto.nome if produto else "(produto removido)",
        "estoque_atual": produto.estoque if produto else None,
        "dias": periodo.dias,
        "inicio": periodo.inicio_data,
        "fim": periodo.fim_data,
        "total_entradas": total_entradas,
        "total_saidas": total_saidas,
        "num_movimentacoes": len(linhas),
        "linhas": linhas,
    }


def ranking_clientes(db: Session, periodo: Periodo, limite: int = 20) -> dict:
    """Ranking de clientes por faturamento no período.

    Só entram no ranking as vendas com cliente identificado. As vendas de
    balcão (sem cliente) somariam num único "cliente" que quase sempre lidera
    a lista e achata os clientes reais, então elas saem do ranking e viram
    informação à parte — que também serve de termômetro de quanto do
    faturamento está sem dono.
    """
    vendas = vendas_do_periodo(db, periodo)

    agregado: dict = {}
    num_vendas_sem_cliente = 0
    faturamento_sem_cliente = Decimal("0")

    for v in vendas:
        liquido = Decimal(v.total_liquido or 0)
        if v.cliente_id is None:
            num_vendas_sem_cliente += 1
            faturamento_sem_cliente += liquido
            continue
        registro = agregado.setdefault(
            v.cliente_id,
            {
                "cliente_id": v.cliente_id,
                "cliente_nome": v.cliente_nome or f"Cliente #{v.cliente_id}",
                "num_compras": 0,
                "faturamento": Decimal("0"),
                "ultima_compra": None,
            },
        )
        registro["num_compras"] += 1
        registro["faturamento"] += liquido
        if registro["ultima_compra"] is None or v.criado_em > registro["ultima_compra"]:
            registro["ultima_compra"] = v.criado_em

    linhas: list[dict] = []
    for r in agregado.values():
        fat = _q(r["faturamento"])
        num = r["num_compras"]
        ticket = (fat / num).quantize(_CENTAVOS) if num else Decimal("0.00")
        linhas.append(
            {
                "cliente_id": r["cliente_id"],
                "cliente_nome": r["cliente_nome"],
                "num_compras": num,
                "faturamento": fat,
                "ticket_medio": ticket,
                "ultima_compra": r["ultima_compra"].date() if r["ultima_compra"] else None,
            }
        )

    linhas.sort(key=lambda x: x["faturamento"], reverse=True)

    faturamento_identificado = sum((l["faturamento"] for l in linhas), Decimal("0"))
    faturamento_total = faturamento_identificado + faturamento_sem_cliente

    return {
        "dias": periodo.dias,
        "inicio": periodo.inicio_data,
        "fim": periodo.fim_data,
        "qtd_clientes": len(linhas),
        "faturamento_identificado": _q(faturamento_identificado),
        "num_vendas_sem_cliente": num_vendas_sem_cliente,
        "faturamento_sem_cliente": _q(faturamento_sem_cliente),
        "percentual_sem_cliente": _pct(faturamento_sem_cliente, faturamento_total),
        "linhas": linhas[:limite],
    }


def compras_por_fornecedor(db: Session, periodo: Periodo) -> dict:
    """Total comprado por fornecedor (entradas de estoque) no período."""
    entradas = (
        db.query(MovimentacaoEstoque)
        .filter(
            MovimentacaoEstoque.tipo == "entrada",
            MovimentacaoEstoque.criado_em >= periodo.inicio,
            MovimentacaoEstoque.criado_em <= periodo.fim,
            # Entradas de estorno/devolução não são compras.
            (MovimentacaoEstoque.motivo.is_(None))
            | ~MovimentacaoEstoque.motivo.in_(["estorno", "devolucao"]),
        )
        .all()
    )

    agregado: dict = {}
    for m in entradas:
        chave = m.fornecedor_id if m.fornecedor_id is not None else "sem_fornecedor"
        registro = agregado.setdefault(
            chave,
            {
                "fornecedor_id": m.fornecedor_id,
                "fornecedor_nome": m.fornecedor_nome or "Sem fornecedor",
                "num_entradas": 0,
                "quantidade_total": 0,
                "valor_total": Decimal("0"),
            },
        )
        registro["num_entradas"] += 1
        registro["quantidade_total"] += m.quantidade
        if m.custo_unitario is not None:
            registro["valor_total"] += Decimal(m.custo_unitario) * m.quantidade

    linhas = [
        {
            "fornecedor_id": r["fornecedor_id"],
            "fornecedor_nome": r["fornecedor_nome"],
            "num_entradas": r["num_entradas"],
            "quantidade_total": r["quantidade_total"],
            "valor_total": _q(r["valor_total"]),
        }
        for r in agregado.values()
    ]
    linhas.sort(key=lambda x: x["valor_total"], reverse=True)

    valor_total_geral = sum((r["valor_total"] for r in linhas), Decimal("0"))
    return {
        "dias": periodo.dias,
        "inicio": periodo.inicio_data,
        "fim": periodo.fim_data,
        "valor_total_geral": _q(valor_total_geral),
        "linhas": linhas,
    }


# ---------------------------------------------------------------------------
# Segunda leva de relatórios.
# ---------------------------------------------------------------------------

_DIAS_SEMANA = [
    "Segunda",
    "Terça",
    "Quarta",
    "Quinta",
    "Sexta",
    "Sábado",
    "Domingo",
]


def vendas_por_dia_semana_horario(db: Session, periodo: Periodo) -> dict:
    """Distribui as vendas do período por dia da semana e por hora do dia."""
    vendas = vendas_do_periodo(db, periodo)

    por_semana = [
        {"indice": i, "rotulo": nome, "num_vendas": 0, "faturamento": Decimal("0")}
        for i, nome in enumerate(_DIAS_SEMANA)
    ]
    por_hora = [
        {"hora": h, "num_vendas": 0, "faturamento": Decimal("0")} for h in range(24)
    ]

    for v in vendas:
        fat = v.total_liquido or 0
        dia_semana = v.criado_em.weekday()  # 0 = segunda
        por_semana[dia_semana]["num_vendas"] += 1
        por_semana[dia_semana]["faturamento"] += fat
        hora = v.criado_em.hour
        por_hora[hora]["num_vendas"] += 1
        por_hora[hora]["faturamento"] += fat

    for linha in por_semana:
        linha["faturamento"] = _q(linha["faturamento"])
    for linha in por_hora:
        linha["faturamento"] = _q(linha["faturamento"])

    # Destaques (melhor dia e melhor hora por faturamento).
    melhor_dia = max(por_semana, key=lambda x: x["faturamento"], default=None)
    melhor_hora = max(por_hora, key=lambda x: x["faturamento"], default=None)

    return {
        "dias": periodo.dias,
        "inicio": periodo.inicio_data,
        "fim": periodo.fim_data,
        "por_dia_semana": por_semana,
        "por_hora": por_hora,
        "melhor_dia": melhor_dia["rotulo"] if melhor_dia and melhor_dia["num_vendas"] else None,
        "melhor_hora": melhor_hora["hora"] if melhor_hora and melhor_hora["num_vendas"] else None,
    }


def descontos(db: Session, periodo: Periodo) -> dict:
    """Resumo dos descontos concedidos e as vendas que os tiveram."""
    vendas = vendas_do_periodo(db, periodo)

    total_bruto = sum((v.total_bruto or 0) for v in vendas)
    total_desconto = sum((v.desconto or 0) for v in vendas)
    com_desconto = [v for v in vendas if (v.desconto or 0) > 0]

    total_bruto = _q(total_bruto)
    total_desconto = _q(total_desconto)
    pct_medio = (
        (total_desconto / total_bruto * 100).quantize(_CENTAVOS)
        if total_bruto > 0
        else Decimal("0.00")
    )

    linhas = []
    for v in sorted(com_desconto, key=lambda x: (x.desconto or 0), reverse=True):
        bruto = _q(v.total_bruto)
        desc = _q(v.desconto)
        pct = (desc / bruto * 100).quantize(_CENTAVOS) if bruto > 0 else Decimal("0.00")
        linhas.append(
            {
                "venda_id": v.id,
                "criado_em": v.criado_em,
                "cliente_nome": v.cliente_nome or "Sem cliente",
                "total_bruto": bruto,
                "desconto": desc,
                "percentual": pct,
                "total_liquido": _q(v.total_liquido),
            }
        )

    return {
        "dias": periodo.dias,
        "inicio": periodo.inicio_data,
        "fim": periodo.fim_data,
        "num_vendas": len(vendas),
        "num_vendas_com_desconto": len(com_desconto),
        "total_bruto": total_bruto,
        "total_desconto": total_desconto,
        "percentual_medio": pct_medio,
        "linhas": linhas,
    }


def vendas_por_categoria(db: Session, periodo: Periodo) -> dict:
    """Agrega faturamento, lucro e quantidade por categoria de produto."""
    itens = (
        db.query(ItemVenda)
        .join(Venda, ItemVenda.venda_id == Venda.id)
        .filter(
            Venda.criado_em >= periodo.inicio,
            Venda.criado_em <= periodo.fim,
            Venda.cancelada_em.is_(None),
            func.coalesce(Venda.entrega_status, "") != "pendente",
            ItemVenda.quantidade > 0,
        )
        .all()
    )

    # Mapa produto_id -> (categoria_id, categoria_nome) em uma query.
    mapa_categoria: dict[int, tuple[int, str]] = {
        pid: (cid, cnome)
        for pid, cid, cnome in db.query(
            Produto.id, Categoria.id, Categoria.nome
        ).join(Categoria, Produto.categoria_id == Categoria.id)
    }

    agregado: dict = {}
    for item in itens:
        cat = mapa_categoria.get(item.produto_id) if item.produto_id else None
        chave = cat[0] if cat else "sem"
        nome = cat[1] if cat else "Sem categoria"
        registro = agregado.setdefault(
            chave,
            {
                "categoria_id": cat[0] if cat else None,
                "categoria_nome": nome,
                "quantidade": 0,
                "faturamento": Decimal("0"),
                "lucro": Decimal("0"),
            },
        )
        registro["quantidade"] += item.quantidade
        registro["faturamento"] += item.subtotal or 0
        registro["lucro"] += (item.preco_unitario - item.custo_unitario) * item.quantidade

    faturamento_total = sum((r["faturamento"] for r in agregado.values()), Decimal("0"))

    linhas = []
    for r in agregado.values():
        fat = _q(r["faturamento"])
        pct = (fat / faturamento_total * 100).quantize(_CENTAVOS) if faturamento_total > 0 else Decimal("0.00")
        linhas.append(
            {
                "categoria_id": r["categoria_id"],
                "categoria_nome": r["categoria_nome"],
                "quantidade": r["quantidade"],
                "faturamento": fat,
                "lucro": _q(r["lucro"]),
                "percentual": pct,
            }
        )

    linhas.sort(key=lambda x: x["faturamento"], reverse=True)
    return {
        "dias": periodo.dias,
        "inicio": periodo.inicio_data,
        "fim": periodo.fim_data,
        "faturamento_total": _q(faturamento_total),
        "linhas": linhas,
    }


def perdas_e_ajustes(db: Session, periodo: Periodo) -> dict:
    """Movimentações de perda, quebra, inventário e ajustes (fora de venda/compra)."""
    movs = (
        db.query(MovimentacaoEstoque)
        .filter(
            MovimentacaoEstoque.criado_em >= periodo.inicio,
            MovimentacaoEstoque.criado_em <= periodo.fim,
        )
        .filter(
            (MovimentacaoEstoque.tipo == "ajuste")
            | (
                MovimentacaoEstoque.motivo.isnot(None)
                & ~MovimentacaoEstoque.motivo.in_(
                    ["venda", "compra", "estorno", "devolucao"]
                )
            )
        )
        .order_by(MovimentacaoEstoque.criado_em.desc(), MovimentacaoEstoque.id.desc())
        .all()
    )

    # Custo atual dos produtos ainda existentes (para valorizar perdas de saída).
    custo_produto = {
        pid: (custo or Decimal("0"))
        for pid, custo in db.query(Produto.id, Produto.preco_custo)
    }

    linhas = []
    valor_perdas = Decimal("0")
    for m in movs:
        valor = None
        if m.tipo == "saida":
            unit = m.custo_unitario
            if unit is None:
                unit = custo_produto.get(m.produto_id, Decimal("0"))
            valor = _q(Decimal(unit) * m.quantidade)
            valor_perdas += valor
        linhas.append(
            {
                "id": m.id,
                "criado_em": m.criado_em,
                "produto_nome": m.produto_nome,
                "tipo": m.tipo,
                "quantidade": m.quantidade,
                "estoque_resultante": m.estoque_resultante,
                "motivo": m.motivo,
                "valor_estimado": valor,
            }
        )

    return {
        "dias": periodo.dias,
        "inicio": periodo.inicio_data,
        "fim": periodo.fim_data,
        "num_movimentacoes": len(linhas),
        "valor_perdas_estimado": _q(valor_perdas),
        "linhas": linhas,
    }


def giro_e_cobertura(db: Session, periodo: Periodo) -> dict:
    """Giro e cobertura (dias de estoque) por produto ativo no período."""
    # Quantidade vendida por produto no período.
    vendido = dict(
        db.query(ItemVenda.produto_id, func.sum(ItemVenda.quantidade))
        .join(Venda, ItemVenda.venda_id == Venda.id)
        .filter(
            Venda.criado_em >= periodo.inicio,
            Venda.criado_em <= periodo.fim,
            Venda.cancelada_em.is_(None),
            func.coalesce(Venda.entrega_status, "") != "pendente",
            ItemVenda.produto_id.isnot(None),
            ItemVenda.quantidade > 0,
        )
        .group_by(ItemVenda.produto_id)
        .all()
    )

    produtos = db.query(Produto).filter(Produto.ativo.is_(True)).all()
    dias_periodo = periodo.dias

    linhas = []
    for p in produtos:
        qtd_vendida = int(vendido.get(p.id, 0) or 0)
        estoque_qtd = p.estoque or 0
        venda_media = Decimal(qtd_vendida) / Decimal(dias_periodo)
        venda_media = venda_media.quantize(Decimal("0.01"))
        if venda_media > 0:
            cobertura = int((Decimal(estoque_qtd) / venda_media).to_integral_value())
        else:
            cobertura = None  # sem vendas: cobertura "infinita"
        linhas.append(
            {
                "produto_id": p.id,
                "produto_nome": p.nome,
                "estoque": estoque_qtd,
                "qtd_vendida": qtd_vendida,
                "venda_media_diaria": venda_media,
                "cobertura_dias": cobertura,
            }
        )

    # Ordena: quem tem cobertura (vai acabar) primeiro, menor cobertura no topo;
    # produtos sem venda vão para o fim.
    linhas.sort(key=lambda x: (x["cobertura_dias"] is None, x["cobertura_dias"] or 0))
    return {
        "dias": periodo.dias,
        "inicio": periodo.inicio_data,
        "fim": periodo.fim_data,
        "qtd_produtos": len(linhas),
        "linhas": linhas,
    }


def clientes_inativos(db: Session, dias: int) -> dict:
    """Clientes ativos sem comprar há mais de `dias` (inclui quem nunca comprou).

    Aqui ``dias`` não é um recorte de período como nos outros relatórios: é a
    janela de inatividade contada a partir de hoje. Por isso este relatório não
    recebe um ``Periodo``.
    """
    # Estatísticas de compra por cliente (todo o histórico).
    stats = {
        cid: {"ultima": ultima, "num": num, "total": total or Decimal("0")}
        for cid, ultima, num, total in db.query(
            Venda.cliente_id,
            func.max(Venda.criado_em),
            func.count(Venda.id),
            func.sum(Venda.total_liquido),
        )
        .filter(
            Venda.cliente_id.isnot(None),
            Venda.cancelada_em.is_(None),
            func.coalesce(Venda.entrega_status, "") != "pendente",
        )
        .group_by(Venda.cliente_id)
    }

    clientes = db.query(Cliente).filter(Cliente.ativo.is_(True)).all()
    hoje = date.today()
    limite = hoje - timedelta(days=dias)

    linhas = []
    for c in clientes:
        s = stats.get(c.id)
        ultima = s["ultima"].date() if s and s["ultima"] else None
        # Inativo: nunca comprou, ou última compra antes do limite.
        if ultima is not None and ultima >= limite:
            continue
        dias_sem = (hoje - ultima).days if ultima else None
        linhas.append(
            {
                "cliente_id": c.id,
                "cliente_nome": c.nome,
                "telefone": c.telefone,
                "ultima_compra": ultima,
                "dias_sem_comprar": dias_sem,
                "num_compras": s["num"] if s else 0,
                "faturamento_total": _q(s["total"]) if s else Decimal("0.00"),
            }
        )

    # Nunca comprou (None) por último; entre os demais, mais tempo parado primeiro.
    linhas.sort(key=lambda x: (x["dias_sem_comprar"] is None, -(x["dias_sem_comprar"] or 0)))
    return {
        "dias": dias,
        "qtd_clientes": len(linhas),
        "linhas": linhas,
    }
