"""Operações de banco para Venda.

Criar uma venda é uma operação transacional: para cada item validamos o
estoque, damos baixa no produto, registramos uma movimentação de saída
(motivo "venda") e calculamos os totais e o lucro. Tudo é confirmado de uma
vez; qualquer erro (ex.: estoque insuficiente) desfaz a venda inteira.
"""
from datetime import datetime
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.cliente import Cliente
from app.models.devolucao import Devolucao, ItemDevolucao
from app.models.movimentacao import MovimentacaoEstoque
from app.models.produto import Produto
from app.models.venda import ItemVenda, Venda
from app.schemas.venda import DevolucaoRequest, VendaCreate


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
    # Resolve o cliente (se informado) e usa o nome dele como snapshot.
    cliente_nome = dados.cliente_nome
    cliente_id = None
    if dados.cliente_id is not None:
        cliente = db.get(Cliente, dados.cliente_id)
        if cliente is None:
            raise ErroVenda("Cliente informado não existe.")
        cliente_id = cliente.id
        cliente_nome = cliente.nome

    venda = Venda(
        cliente_id=cliente_id,
        cliente_nome=cliente_nome,
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


def estornar(db: Session, venda_id: int, motivo: str | None = None) -> Venda | None:
    """Estorna (cancela) uma venda, devolvendo o estoque dos itens.

    Operação lógica: a venda não é apagada, apenas marcada como cancelada, para
    preservar o histórico. Cada item devolve a quantidade ao produto e gera uma
    movimentação de entrada com motivo "estorno". Produtos removidos desde a
    venda são ignorados na devolução (não há mais estoque para atualizar).
    """
    venda = db.get(Venda, venda_id)
    if venda is None:
        return None
    if venda.cancelada_em is not None:
        raise ErroVenda("Esta venda já foi estornada.")

    for item in venda.itens:
        if item.produto_id is None:
            continue
        produto = db.get(Produto, item.produto_id)
        if produto is None:
            continue
        produto.estoque = (produto.estoque or 0) + item.quantidade
        db.add(
            MovimentacaoEstoque(
                produto_id=produto.id,
                produto_nome=produto.nome,
                tipo="entrada",
                quantidade=item.quantidade,
                estoque_resultante=produto.estoque,
                motivo="estorno",
                observacao=f"Estorno da venda #{venda.id}",
            )
        )

    venda.cancelada_em = datetime.now()
    venda.motivo_cancelamento = (motivo or "").strip() or None

    db.add(venda)
    db.commit()
    db.refresh(venda)
    return venda


def devolver(db: Session, venda_id: int, dados: DevolucaoRequest) -> Venda | None:
    """Registra uma devolução (parcial ou total) de itens de uma venda.

    Para cada item devolvido: valida a quantidade contra o que ainda resta na
    venda, reduz o item, devolve o estoque e registra uma movimentação de
    entrada (motivo "devolucao"). Ao final, os totais da venda são recalculados
    a partir dos itens restantes. Se não sobrar nenhum item, a venda é marcada
    como cancelada (estornada). A devolução fica registrada para auditoria.
    """
    venda = db.get(Venda, venda_id)
    if venda is None:
        return None
    if venda.cancelada_em is not None:
        raise ErroVenda("Esta venda já foi estornada; não é possível devolver itens.")

    itens_por_id = {item.id: item for item in venda.itens}

    # Consolida quantidades por item (evita duplicatas no pedido).
    pedidos: dict[int, int] = {}
    for pedido in dados.itens:
        pedidos[pedido.item_venda_id] = pedidos.get(pedido.item_venda_id, 0) + pedido.quantidade

    devolucao = Devolucao(
        motivo=dados.motivo.value,
        observacao=(dados.observacao or "").strip() or None,
    )

    valor_devolvido = Decimal("0")

    for item_id, qtd in pedidos.items():
        item = itens_por_id.get(item_id)
        if item is None:
            raise ErroVenda(f"Item {item_id} não pertence a esta venda.")
        if qtd > item.quantidade:
            raise ErroVenda(
                f"Não é possível devolver {qtd} de '{item.produto_nome}': "
                f"restam {item.quantidade} nesta venda."
            )

        preco = Decimal(item.preco_unitario)
        custo = Decimal(item.custo_unitario)
        subtotal_devolvido = (preco * qtd).quantize(Decimal("0.01"))
        valor_devolvido += subtotal_devolvido

        # Reduz o item da venda e recalcula o subtotal restante.
        item.quantidade -= qtd
        item.subtotal = (preco * item.quantidade).quantize(Decimal("0.01"))

        # Devolve o estoque, se o produto ainda existir.
        if item.produto_id is not None:
            produto = db.get(Produto, item.produto_id)
            if produto is not None:
                produto.estoque = (produto.estoque or 0) + qtd
                db.add(
                    MovimentacaoEstoque(
                        produto_id=produto.id,
                        produto_nome=produto.nome,
                        tipo="entrada",
                        quantidade=qtd,
                        estoque_resultante=produto.estoque,
                        motivo="devolucao",
                        observacao=f"Devolução da venda #{venda.id} ({dados.motivo.value})",
                    )
                )

        devolucao.itens.append(
            ItemDevolucao(
                item_venda_id=item.id,
                produto_id=item.produto_id,
                produto_nome=item.produto_nome,
                quantidade=qtd,
                preco_unitario=preco,
                custo_unitario=custo,
                subtotal=subtotal_devolvido,
            )
        )

    devolucao.valor_devolvido = valor_devolvido.quantize(Decimal("0.01"))
    venda.devolucoes.append(devolucao)

    # Recalcula os totais da venda a partir dos itens restantes.
    total_bruto = sum((Decimal(i.subtotal) for i in venda.itens), Decimal("0"))
    custo_total = sum(
        (Decimal(i.custo_unitario) * i.quantidade for i in venda.itens), Decimal("0")
    )
    # Mantém o desconto, limitado ao novo total bruto.
    desconto = min(Decimal(venda.desconto or 0), total_bruto)
    total_liquido = (total_bruto - desconto).quantize(Decimal("0.01"))

    venda.total_bruto = total_bruto.quantize(Decimal("0.01"))
    venda.custo_total = custo_total.quantize(Decimal("0.01"))
    venda.desconto = desconto.quantize(Decimal("0.01"))
    venda.total_liquido = total_liquido
    venda.lucro = (total_liquido - custo_total).quantize(Decimal("0.01"))

    # Se todos os itens foram devolvidos, a venda é estornada por completo.
    if all(i.quantidade == 0 for i in venda.itens):
        venda.cancelada_em = datetime.now()
        venda.motivo_cancelamento = f"Devolução total ({dados.motivo.value})"

    db.add(venda)
    db.commit()
    db.refresh(venda)
    return venda
