"""Agregações para o dashboard.

As somas são feitas em Python a partir das vendas/itens/produtos do período.
Isso mantém o código agnóstico de banco (SQLite ou PostgreSQL) e é adequado
ao volume de uma loja local. Se o volume crescer muito, dá para migrar para
agregações no próprio banco.
"""
from collections import defaultdict
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.produto import Produto
from app.models.venda import ItemVenda, Venda

_CENTAVOS = Decimal("0.01")


def _inicio_periodo(dias: int) -> datetime:
    """Retorna a meia-noite de (hoje - (dias-1))."""
    dias = max(1, dias)
    dia_inicial = date.today() - timedelta(days=dias - 1)
    return datetime.combine(dia_inicial, time.min)


def _vendas_periodo(db: Session, inicio: datetime) -> list[Venda]:
    return db.query(Venda).filter(Venda.criado_em >= inicio).all()


def resumo(db: Session, dias: int) -> dict:
    inicio = _inicio_periodo(dias)
    vendas = _vendas_periodo(db, inicio)

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
        "dias": dias,
        "inicio": inicio.date(),
        "num_vendas": num,
        "faturamento": faturamento,
        "custo": custo,
        "lucro": lucro,
        "desconto": desconto,
        "ticket_medio": ticket,
        "margem_percentual": margem,
    }


def vendas_por_dia(db: Session, dias: int) -> list[dict]:
    inicio = _inicio_periodo(dias)
    vendas = _vendas_periodo(db, inicio)

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
    for i in range(dias):
        d = inicio.date() + timedelta(days=i)
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


def mais_vendidos(db: Session, dias: int, limite: int = 10) -> dict:
    inicio = _inicio_periodo(dias)
    itens = (
        db.query(ItemVenda)
        .join(Venda, ItemVenda.venda_id == Venda.id)
        .filter(Venda.criado_em >= inicio)
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
