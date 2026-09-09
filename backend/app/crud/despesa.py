"""Operações de banco para Despesa.

As agregações do resumo são feitas em Python, seguindo o mesmo critério do
``crud/relatorio.py``: mantém o código agnóstico de banco (SQLite ou
PostgreSQL) e é adequado ao volume de uma loja local.
"""
from collections import defaultdict
from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.despesa import Despesa
from app.models.fornecedor import Fornecedor
from app.schemas.despesa import DespesaCreate, DespesaUpdate, rotulo_categoria

_CENTAVOS = Decimal("0.01")

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


class ErroDespesa(Exception):
    """Erro de regra de negócio ao lançar ou editar uma despesa."""


def _q(valor) -> Decimal:
    """Converte para Decimal com 2 casas (dinheiro)."""
    return Decimal(valor or 0).quantize(_CENTAVOS)


def _consulta_filtrada(
    db: Session,
    inicio: date | None = None,
    fim: date | None = None,
    categoria: str | None = None,
    situacao: str | None = None,
    apenas_operacionais: bool = False,
    busca: str | None = None,
):
    """Monta a consulta com os filtros comuns à listagem e ao resumo.

    O período filtra por ``data_competencia`` (o mês a que a despesa se refere),
    que é o recorte usado na apuração do resultado.
    """
    query = db.query(Despesa)
    if inicio is not None:
        query = query.filter(Despesa.data_competencia >= inicio)
    if fim is not None:
        query = query.filter(Despesa.data_competencia <= fim)
    if categoria:
        query = query.filter(Despesa.categoria == categoria)
    if situacao == "paga":
        query = query.filter(Despesa.data_pagamento.isnot(None))
    elif situacao == "aberta":
        query = query.filter(Despesa.data_pagamento.is_(None))
    if apenas_operacionais:
        query = query.filter(Despesa.operacional.is_(True))
    if busca:
        termo = f"%{busca.strip()}%"
        query = query.filter(Despesa.descricao.ilike(termo))
    return query


def listar(
    db: Session,
    skip: int = 0,
    limit: int = 500,
    inicio: date | None = None,
    fim: date | None = None,
    categoria: str | None = None,
    situacao: str | None = None,
    apenas_operacionais: bool = False,
    busca: str | None = None,
) -> list[Despesa]:
    """Despesas do período, mais recentes primeiro."""
    query = _consulta_filtrada(
        db,
        inicio=inicio,
        fim=fim,
        categoria=categoria,
        situacao=situacao,
        apenas_operacionais=apenas_operacionais,
        busca=busca,
    )
    return (
        query.order_by(Despesa.data_competencia.desc(), Despesa.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def obter(db: Session, despesa_id: int) -> Despesa | None:
    return db.get(Despesa, despesa_id)


def _resolver_fornecedor(db: Session, fornecedor_id: int | None) -> str | None:
    """Valida o fornecedor e devolve o nome para o retrato (snapshot)."""
    if fornecedor_id is None:
        return None
    fornecedor = db.get(Fornecedor, fornecedor_id)
    if fornecedor is None:
        raise ErroDespesa("Fornecedor informado não existe.")
    return fornecedor.nome


def criar(db: Session, dados: DespesaCreate) -> Despesa:
    valores = dados.model_dump()
    valores["categoria"] = dados.categoria.value
    valores["fornecedor_nome"] = _resolver_fornecedor(db, dados.fornecedor_id)

    despesa = Despesa(**valores)
    db.add(despesa)
    db.commit()
    db.refresh(despesa)
    return despesa


def atualizar(db: Session, despesa: Despesa, dados: DespesaUpdate) -> Despesa:
    alteracoes = dados.model_dump(exclude_unset=True)

    if "categoria" in alteracoes and dados.categoria is not None:
        alteracoes["categoria"] = dados.categoria.value
    # Refaz o retrato do fornecedor sempre que o vínculo muda.
    if "fornecedor_id" in alteracoes:
        alteracoes["fornecedor_nome"] = _resolver_fornecedor(db, alteracoes["fornecedor_id"])

    for campo, valor in alteracoes.items():
        setattr(despesa, campo, valor)
    db.commit()
    db.refresh(despesa)
    return despesa


def remover(db: Session, despesa: Despesa) -> None:
    db.delete(despesa)
    db.commit()


def marcar_paga(db: Session, despesa: Despesa, data_pagamento: date | None = None) -> Despesa:
    """Registra o pagamento da despesa (padrão: hoje)."""
    if despesa.data_pagamento is not None:
        raise ErroDespesa("Esta despesa já está marcada como paga.")
    despesa.data_pagamento = data_pagamento or date.today()
    db.commit()
    db.refresh(despesa)
    return despesa


def resumo(
    db: Session,
    inicio: date,
    fim: date,
    categoria: str | None = None,
    situacao: str | None = None,
    busca: str | None = None,
) -> dict:
    """Totais do período, por categoria e mês a mês (por competência)."""
    despesas = _consulta_filtrada(
        db,
        inicio=inicio,
        fim=fim,
        categoria=categoria,
        situacao=situacao,
        busca=busca,
    ).all()

    total = Decimal("0")
    total_operacional = Decimal("0")
    total_nao_operacional = Decimal("0")
    total_pago = Decimal("0")
    total_em_aberto = Decimal("0")

    por_categoria: dict[str, dict] = defaultdict(
        lambda: {"quantidade": 0, "total": Decimal("0")}
    )
    por_mes: dict[tuple[int, int], dict] = defaultdict(
        lambda: {"quantidade": 0, "total": Decimal("0"), "total_operacional": Decimal("0")}
    )

    for d in despesas:
        valor = Decimal(d.valor or 0)
        total += valor
        if d.operacional:
            total_operacional += valor
        else:
            total_nao_operacional += valor
        if d.data_pagamento is not None:
            total_pago += valor
        else:
            total_em_aberto += valor

        chave_cat = d.categoria or "outros"
        por_categoria[chave_cat]["quantidade"] += 1
        por_categoria[chave_cat]["total"] += valor

        chave_mes = (d.data_competencia.year, d.data_competencia.month)
        por_mes[chave_mes]["quantidade"] += 1
        por_mes[chave_mes]["total"] += valor
        if d.operacional:
            por_mes[chave_mes]["total_operacional"] += valor

    total = total.quantize(_CENTAVOS)

    linhas_categoria = []
    for chave, dados in por_categoria.items():
        valor_cat = _q(dados["total"])
        pct = (valor_cat / total * 100).quantize(_CENTAVOS) if total > 0 else Decimal("0.00")
        linhas_categoria.append(
            {
                "categoria": chave,
                "categoria_rotulo": rotulo_categoria(chave),
                "quantidade": dados["quantidade"],
                "total": valor_cat,
                "percentual": pct,
            }
        )
    linhas_categoria.sort(key=lambda x: x["total"], reverse=True)

    linhas_mes = [
        {
            "ano": ano,
            "mes": mes,
            "rotulo": f"{_MESES_ABREV[mes - 1]}/{ano}",
            "quantidade": dados["quantidade"],
            "total": _q(dados["total"]),
            "total_operacional": _q(dados["total_operacional"]),
        }
        for (ano, mes), dados in por_mes.items()
    ]
    linhas_mes.sort(key=lambda x: (x["ano"], x["mes"]))

    return {
        "inicio": inicio,
        "fim": fim,
        "quantidade": len(despesas),
        "total": total,
        "total_operacional": _q(total_operacional),
        "total_nao_operacional": _q(total_nao_operacional),
        "total_pago": _q(total_pago),
        "total_em_aberto": _q(total_em_aberto),
        "por_categoria": linhas_categoria,
        "por_mes": linhas_mes,
    }
