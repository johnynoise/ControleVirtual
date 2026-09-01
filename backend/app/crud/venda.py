"""Operações de banco para Venda.

Criar uma venda é uma operação transacional: para cada item validamos o
estoque, damos baixa no produto, registramos uma movimentação de saída
(motivo "venda") e calculamos os totais e o lucro. Tudo é confirmado de uma
vez; qualquer erro (ex.: estoque insuficiente) desfaz a venda inteira.
"""
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.movimentacao import MovimentacaoEstoque
from app.models.produto import Produto
from app.models.venda import ItemVenda, Venda
from app.schemas.venda import VendaCreate


class ErroVenda(ValueError):
    """Erro de regra de negócio ao registrar uma venda."""


def listar(db: Session, skip: int = 0, limit: int = 100) -> list[Venda]:
    return (
        db.query(Venda)
        .order_by(Venda.criado_em.desc(), Venda.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def obter(db: Session, venda_id: int) -> Venda | None:
    return db.get(Venda, venda_id)


def criar(db: Session, dados: VendaCreate) -> Venda:
    venda = Venda(
        cliente_nome=dados.cliente_nome,
        forma_pagamento=dados.forma_pagamento.value if dados.forma_pagamento else None,
        desconto=dados.desconto,
        observacao=dados.observacao,
    )

    total_bruto = Decimal("0")
    custo_total = Decimal("0")

    for item in dados.itens:
        produto = db.get(Produto, item.produto_id)
        if produto is None:
            raise ErroVenda(f"Produto {item.produto_id} não encontrado.")

        if item.quantidade > produto.estoque:
            raise ErroVenda(
                f"Estoque insuficiente para '{produto.nome}': "
                f"disponível {produto.estoque}, solicitado {item.quantidade}."
            )

        # Preço de venda: o informado ou o preço atual do produto.
        preco = item.preco_unitario if item.preco_unitario is not None else produto.preco_venda
        preco = Decimal(preco)
        custo = Decimal(produto.preco_custo or 0)
        subtotal = (preco * item.quantidade).quantize(Decimal("0.01"))

        total_bruto += subtotal
        custo_total += (custo * item.quantidade).quantize(Decimal("0.01"))

        # Baixa no estoque.
        novo_estoque = produto.estoque - item.quantidade
        produto.estoque = novo_estoque

        # Item da venda (snapshots).
        venda.itens.append(
            ItemVenda(
                produto_id=produto.id,
                produto_nome=produto.nome,
                quantidade=item.quantidade,
                preco_unitario=preco,
                custo_unitario=custo,
                subtotal=subtotal,
            )
        )

        # Movimentação de saída no histórico de estoque.
        db.add(
            MovimentacaoEstoque(
                produto_id=produto.id,
                produto_nome=produto.nome,
                tipo="saida",
                quantidade=item.quantidade,
                estoque_resultante=novo_estoque,
                motivo="venda",
            )
        )

    desconto = Decimal(dados.desconto or 0)
    if desconto > total_bruto:
        raise ErroVenda("O desconto não pode ser maior que o total da venda.")

    total_liquido = (total_bruto - desconto).quantize(Decimal("0.01"))
    lucro = (total_liquido - custo_total).quantize(Decimal("0.01"))

    venda.total_bruto = total_bruto.quantize(Decimal("0.01"))
    venda.custo_total = custo_total.quantize(Decimal("0.01"))
    venda.total_liquido = total_liquido
    venda.lucro = lucro

    db.add(venda)
    db.commit()
    db.refresh(venda)
    return venda
