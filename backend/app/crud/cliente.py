"""Operações de banco para Cliente."""
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.cliente import Cliente
from app.models.venda import ItemVenda, Venda
from app.schemas.cliente import ClienteCreate, ClienteUpdate

_CENTAVOS = Decimal("0.01")


def _q(valor) -> Decimal:
    return Decimal(valor or 0).quantize(_CENTAVOS)


def listar(
    db: Session, skip: int = 0, limit: int = 100, apenas_ativos: bool = False
) -> list[Cliente]:
    query = db.query(Cliente)
    if apenas_ativos:
        query = query.filter(Cliente.ativo.is_(True))
    return query.order_by(Cliente.nome).offset(skip).limit(limit).all()


def obter(db: Session, cliente_id: int) -> Cliente | None:
    return db.get(Cliente, cliente_id)


def criar(db: Session, dados: ClienteCreate) -> Cliente:
    cliente = Cliente(**dados.model_dump())
    db.add(cliente)
    db.commit()
    db.refresh(cliente)
    return cliente


def atualizar(db: Session, cliente: Cliente, dados: ClienteUpdate) -> Cliente:
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(cliente, campo, valor)
    db.commit()
    db.refresh(cliente)
    return cliente


def remover(db: Session, cliente: Cliente) -> None:
    db.delete(cliente)
    db.commit()


def ficha(db: Session, cliente_id: int) -> dict | None:
    """Ficha do cliente: dados + estatísticas + favoritos + histórico de compras.

    As estatísticas consideram apenas vendas não estornadas. O histórico lista
    todas as vendas (inclusive estornadas), marcadas com o respectivo status.
    """
    cliente = db.get(Cliente, cliente_id)
    if cliente is None:
        return None

    vendas = (
        db.query(Venda)
        .filter(Venda.cliente_id == cliente_id)
        .order_by(Venda.criado_em.desc(), Venda.id.desc())
        .all()
    )
    # Pedidos de delivery ainda pendentes não são vendas realizadas: ficam de
    # fora das métricas e do histórico de compras da ficha.
    vendas = [v for v in vendas if v.entrega_status != "pendente"]
    validas = [v for v in vendas if v.cancelada_em is None]

    total_gasto = sum((v.total_liquido or 0) for v in validas)
    num_compras = len(validas)
    ticket = (Decimal(total_gasto) / num_compras).quantize(_CENTAVOS) if num_compras else Decimal("0.00")
    total_itens = sum(
        i.quantidade for v in validas for i in v.itens if i.quantidade > 0
    )
    datas = [v.criado_em for v in validas]
    primeira = min(datas) if datas else None
    ultima = max(datas) if datas else None

    # Produtos favoritos (mais comprados por quantidade), só de vendas válidas.
    favoritos_rows = (
        db.query(
            ItemVenda.produto_id,
            ItemVenda.produto_nome,
            func.sum(ItemVenda.quantidade),
            func.sum(ItemVenda.subtotal),
        )
        .join(Venda, ItemVenda.venda_id == Venda.id)
        .filter(
            Venda.cliente_id == cliente_id,
            Venda.cancelada_em.is_(None),
            func.coalesce(Venda.entrega_status, "") != "pendente",
            ItemVenda.quantidade > 0,
        )
        .group_by(ItemVenda.produto_id, ItemVenda.produto_nome)
        .order_by(func.sum(ItemVenda.quantidade).desc())
        .limit(5)
        .all()
    )
    favoritos = [
        {
            "produto_id": pid,
            "produto_nome": nome,
            "quantidade": int(qtd or 0),
            "total": _q(total),
        }
        for pid, nome, qtd, total in favoritos_rows
    ]

    compras = []
    saldo_devedor_total = Decimal("0.00")
    for v in vendas:
        a_prazo = v.forma_pagamento == "fiado"
        total_pago = sum((Decimal(p.valor) for p in v.pagamentos), Decimal("0"))
        if a_prazo and v.cancelada_em is None:
            saldo = (Decimal(v.total_liquido or 0) - total_pago).quantize(_CENTAVOS)
            saldo = saldo if saldo > 0 else Decimal("0.00")
        else:
            saldo = Decimal("0.00")
        saldo_devedor_total += saldo
        compras.append(
            {
                "id": v.id,
                "criado_em": v.criado_em,
                "forma_pagamento": v.forma_pagamento,
                "total_liquido": _q(v.total_liquido),
                "num_itens": sum(i.quantidade for i in v.itens if i.quantidade > 0),
                "estornada": v.cancelada_em is not None,
                "tem_devolucao": len(v.devolucoes) > 0,
                "a_prazo": a_prazo,
                "total_pago": _q(total_pago),
                "saldo_devedor": saldo,
            }
        )

    return {
        "cliente": cliente,
        "num_compras": num_compras,
        "total_gasto": _q(total_gasto),
        "ticket_medio": ticket,
        "total_itens": total_itens,
        "primeira_compra": primeira,
        "ultima_compra": ultima,
        "saldo_devedor": _q(saldo_devedor_total),
        "favoritos": favoritos,
        "compras": compras,
    }
