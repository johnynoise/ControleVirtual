"""Operações de banco para Venda.

Criar uma venda é uma operação transacional: para cada item validamos o
estoque, damos baixa no produto, registramos uma movimentação de saída
(motivo "venda") e calculamos os totais e o lucro. Tudo é confirmado de uma
vez; qualquer erro (ex.: estoque insuficiente) desfaz a venda inteira.
"""
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.cliente import Cliente
from app.models.devolucao import Devolucao, ItemDevolucao
from app.models.movimentacao import MovimentacaoEstoque
from app.models.pagamento import PagamentoVenda
from app.models.parcela import ParcelaVenda
from app.models.produto import Produto
from app.models.venda import ItemVenda, Venda
from app.schemas.venda import (
    DevolucaoRequest,
    FormaPagamento,
    PagamentoCreate,
    StatusFornecedor,
    VendaCreate,
)


class ErroVenda(ValueError):
    """Erro de regra de negócio ao registrar uma venda."""


def listar(db: Session, skip: int = 0, limit: int = 100) -> list[Venda]:
    # Pedidos de delivery ainda pendentes não entram no histórico de vendas
    # (não são vendas realizadas); eles ficam na tela de entregas.
    return (
        db.query(Venda)
        .filter(func.coalesce(Venda.entrega_status, "") != "pendente")
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

    # Venda a prazo (fiado) precisa de um cliente identificado para que o saldo
    # devedor tenha a quem ser cobrado.
    eh_fiado = dados.forma_pagamento == FormaPagamento.fiado
    if eh_fiado and cliente_id is None:
        raise ErroVenda("Venda a prazo (fiado) exige um cliente identificado.")

    # Delivery: nasce como pedido pendente. Não baixa estoque nem gera
    # movimentação agora — isso só acontece quando a entrega for confirmada.
    pendente_entrega = bool(dados.entrega)

    venda = Venda(
        cliente_id=cliente_id,
        cliente_nome=cliente_nome,
        forma_pagamento=dados.forma_pagamento.value if dados.forma_pagamento else None,
        desconto=dados.desconto,
        observacao=dados.observacao,
        entrega_status="pendente" if pendente_entrega else None,
        endereco_entrega=(dados.endereco_entrega or "").strip() or None
        if pendente_entrega
        else None,
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

        # Preço de tabela do produto. Venda a prazo (fiado) usa o preço a prazo
        # quando o produto tem um cadastrado; sem ele, vale o preço à vista.
        preco_tabela = produto.preco_venda
        if eh_fiado and produto.preco_venda_prazo is not None:
            preco_tabela = produto.preco_venda_prazo

        # Preço de venda: o informado ou o preço de tabela.
        preco = item.preco_unitario if item.preco_unitario is not None else preco_tabela
        preco = Decimal(preco)
        custo = Decimal(produto.preco_custo or 0)
        subtotal = (preco * item.quantidade).quantize(Decimal("0.01"))

        total_bruto += subtotal
        custo_total += (custo * item.quantidade).quantize(Decimal("0.01"))

        # Item da venda (snapshots). Sempre registrado.
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

        # Estoque só é baixado agora para vendas realizadas (não delivery).
        # Pedidos de delivery só baixam estoque ao confirmar a entrega.
        if not pendente_entrega:
            novo_estoque = produto.estoque - item.quantidade
            produto.estoque = novo_estoque
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

    # Plano de parcelamento (apenas fiado). As parcelas são só o combinado de
    # datas/valores; o recebimento continua sendo feito via pagamentos.
    if dados.parcelas:
        if not eh_fiado:
            raise ErroVenda(
                "Parcelamento só é permitido em vendas a prazo (fiado)."
            )
        if len(dados.parcelas) > 3:
            raise ErroVenda("O parcelamento permite no máximo 3 parcelas.")

        numeros = sorted(p.numero for p in dados.parcelas)
        if numeros != list(range(1, len(dados.parcelas) + 1)):
            raise ErroVenda(
                "As parcelas devem ser numeradas em sequência a partir de 1."
            )

        soma_parcelas = sum(
            (Decimal(p.valor) for p in dados.parcelas), Decimal("0")
        ).quantize(Decimal("0.01"))
        # Tolera diferença de centavos por causa do arredondamento na divisão.
        if abs(soma_parcelas - total_liquido) > Decimal("0.02"):
            raise ErroVenda(
                f"A soma das parcelas ({soma_parcelas}) deve ser igual ao "
                f"total da venda ({total_liquido})."
            )

        for p in sorted(dados.parcelas, key=lambda x: x.numero):
            venda.parcelas.append(
                ParcelaVenda(
                    numero=p.numero,
                    valor=Decimal(p.valor).quantize(Decimal("0.01")),
                    vencimento=p.vencimento,
                )
            )

    db.add(venda)
    db.commit()
    db.refresh(venda)
    return venda


def listar_entregas(db: Session, incluir_entregues: bool = False) -> list[Venda]:
    """Pedidos de delivery. Por padrão só os pendentes (a entregar).

    Ordena os pendentes do mais antigo para o mais recente (fila de entrega).
    Com ``incluir_entregues=True``, também traz os já entregues (mais recentes
    primeiro), para consulta.
    """
    if incluir_entregues:
        return (
            db.query(Venda)
            .filter(Venda.entrega_status.isnot(None))
            .order_by(Venda.criado_em.desc())
            .all()
        )
    return (
        db.query(Venda)
        .filter(
            Venda.entrega_status == "pendente",
            Venda.cancelada_em.is_(None),
        )
        .order_by(Venda.criado_em.asc())
        .all()
    )


def confirmar_entrega(db: Session, venda_id: int) -> Venda | None:
    """Confirma a entrega de um pedido de delivery, realizando a venda.

    É neste momento que a venda "acontece": valida o estoque de cada item, dá a
    baixa e registra a movimentação de saída (motivo "venda"). Depois marca a
    venda como entregue. A partir daí ela passa a contar em relatórios.
    """
    venda = db.get(Venda, venda_id)
    if venda is None:
        return None
    if venda.entrega_status != "pendente":
        raise ErroVenda("Esta venda não é um pedido pendente de entrega.")
    if venda.cancelada_em is not None:
        raise ErroVenda("Este pedido foi cancelado.")

    for item in venda.itens:
        if item.produto_id is None:
            raise ErroVenda(
                f"O produto de '{item.produto_nome}' não existe mais; "
                "não é possível confirmar a entrega."
            )
        produto = db.get(Produto, item.produto_id)
        if produto is None:
            raise ErroVenda(
                f"O produto '{item.produto_nome}' não existe mais; "
                "não é possível confirmar a entrega."
            )
        if item.quantidade > produto.estoque:
            raise ErroVenda(
                f"Estoque insuficiente para '{produto.nome}': "
                f"disponível {produto.estoque}, necessário {item.quantidade}."
            )

    # Estoque validado: dá baixa e registra as movimentações.
    for item in venda.itens:
        produto = db.get(Produto, item.produto_id)
        novo_estoque = produto.estoque - item.quantidade
        produto.estoque = novo_estoque
        db.add(
            MovimentacaoEstoque(
                produto_id=produto.id,
                produto_nome=produto.nome,
                tipo="saida",
                quantidade=item.quantidade,
                estoque_resultante=novo_estoque,
                motivo="venda",
                observacao=f"Entrega do pedido #{venda.id}",
            )
        )

    venda.entrega_status = "entregue"
    venda.entregue_em = datetime.now()

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

    # Pedido de delivery ainda pendente nunca baixou estoque: cancelar é só
    # marcar como cancelado, sem devolver estoque nem gerar movimentação.
    pendente_entrega = venda.entrega_status == "pendente"

    if not pendente_entrega:
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

    # Peça com defeito entra na fila de acerto com o fornecedor; troca sem
    # defeito não envolve o fornecedor (status fica nulo).
    devolucao = Devolucao(
        motivo=dados.motivo.value,
        observacao=(dados.observacao or "").strip() or None,
        defeito=dados.defeito,
        status_fornecedor=StatusFornecedor.pendente.value if dados.defeito else None,
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
                        observacao=(
                            f"Troca da venda #{venda.id} ({dados.motivo.value})"
                            + (" · defeito" if dados.defeito else "")
                        ),
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


# --------------------------------------------------------------------------- #
# Fiado (venda a prazo) — pagamentos e saldo devedor
# --------------------------------------------------------------------------- #
_CENTAVOS = Decimal("0.01")


def _total_pago(venda: Venda) -> Decimal:
    """Soma dos pagamentos (quitações) já registrados para a venda."""
    return sum((Decimal(p.valor) for p in venda.pagamentos), Decimal("0")).quantize(
        _CENTAVOS
    )


def _saldo_devedor(venda: Venda) -> Decimal:
    """Saldo em aberto da venda a prazo. Zero se não for fiado ou já estornada."""
    if venda.forma_pagamento != FormaPagamento.fiado.value:
        return Decimal("0.00")
    if venda.cancelada_em is not None:
        return Decimal("0.00")
    saldo = (Decimal(venda.total_liquido or 0) - _total_pago(venda)).quantize(_CENTAVOS)
    return saldo if saldo > 0 else Decimal("0.00")


def _parcelas_vencidas(venda: Venda, hoje: date | None = None) -> tuple[int, Decimal]:
    """Parcelas em atraso de uma venda: (quantidade, valor total vencido).

    Uma parcela está vencida quando ainda tem valor em aberto (não foi coberta
    pelo total já pago) e a data de vencimento já passou. Como os pagamentos são
    acumulados, o status de cada parcela é deduzido varrendo-as em ordem. Vendas
    sem parcelas (fiado sem plano de parcelamento) não têm prazo, logo não geram
    atraso por aqui.
    """
    if not venda.parcelas:
        return 0, Decimal("0.00")

    hoje = hoje or date.today()
    pago = _total_pago(venda)
    acumulado = Decimal("0")
    qtd = 0
    total = Decimal("0.00")
    for p in sorted(venda.parcelas, key=lambda x: x.numero):
        valor = Decimal(p.valor)
        inicio = acumulado
        acumulado += valor
        fim = acumulado
        if pago >= fim - _CENTAVOS:
            restante = Decimal("0")  # parcela quitada
        elif pago > inicio:
            restante = (fim - pago).quantize(_CENTAVOS)  # parcialmente paga
        else:
            restante = valor  # totalmente em aberto
        if restante > 0 and p.vencimento is not None and p.vencimento < hoje:
            qtd += 1
            total += restante
    return qtd, total.quantize(_CENTAVOS)


def registrar_pagamento(
    db: Session, venda_id: int, dados: PagamentoCreate
) -> Venda | None:
    """Registra um pagamento (quitação parcial ou total) de uma venda a prazo.

    Valida que a venda é fiado, não está estornada e que o valor não excede o
    saldo devedor atual. O pagamento fica registrado no histórico da venda.
    """
    venda = db.get(Venda, venda_id)
    if venda is None:
        return None
    if venda.forma_pagamento != FormaPagamento.fiado.value:
        raise ErroVenda("Esta venda não é a prazo; não há saldo a receber.")
    if venda.cancelada_em is not None:
        raise ErroVenda("Esta venda foi estornada; não há saldo a receber.")

    saldo = _saldo_devedor(venda)
    if saldo <= 0:
        raise ErroVenda("Esta venda já está quitada.")

    valor = Decimal(dados.valor).quantize(_CENTAVOS)
    if valor > saldo:
        raise ErroVenda(
            f"Valor acima do saldo devedor. Falta receber {saldo}."
        )

    venda.pagamentos.append(
        PagamentoVenda(
            valor=valor,
            forma_pagamento=dados.forma_pagamento.value,
            observacao=(dados.observacao or "").strip() or None,
        )
    )

    db.add(venda)
    db.commit()
    db.refresh(venda)
    return venda


def fiado_por_cliente(
    db: Session, cliente_id: int, apenas_abertas: bool = False
) -> list[Venda]:
    """Vendas a prazo (fiado) de um cliente, da mais antiga à mais recente.

    Por padrão retorna todo o histórico de fiado (em aberto e já quitadas), para
    permitir avaliar o comportamento de pagamento do cliente. Estornadas são
    sempre excluídas. Com ``apenas_abertas=True``, devolve só as que ainda têm
    saldo devedor. Cada venda traz seus itens e parcelas (via relacionamento).
    """
    vendas = (
        db.query(Venda)
        .filter(
            Venda.cliente_id == cliente_id,
            Venda.forma_pagamento == FormaPagamento.fiado.value,
            Venda.cancelada_em.is_(None),
            func.coalesce(Venda.entrega_status, "") != "pendente",
        )
        .order_by(Venda.criado_em.asc())
        .all()
    )
    if apenas_abertas:
        return [v for v in vendas if _saldo_devedor(v) > 0]
    return vendas


def contas_a_receber(db: Session) -> list[dict]:
    """Agrupa o saldo devedor em aberto por cliente (vendas a prazo).

    Considera apenas vendas fiado não estornadas com saldo maior que zero.
    Retorna, por cliente, o total devido, o número de vendas em aberto e a
    data da venda em aberto mais antiga (para priorizar a cobrança).
    """
    vendas = (
        db.query(Venda)
        .filter(
            Venda.forma_pagamento == FormaPagamento.fiado.value,
            Venda.cancelada_em.is_(None),
            func.coalesce(Venda.entrega_status, "") != "pendente",
        )
        .order_by(Venda.criado_em.asc())
        .all()
    )

    hoje = date.today()
    agrupado: dict[int | None, dict] = {}
    for venda in vendas:
        saldo = _saldo_devedor(venda)
        if saldo <= 0:
            continue
        chave = venda.cliente_id
        linha = agrupado.get(chave)
        if linha is None:
            linha = {
                "cliente_id": venda.cliente_id,
                "cliente_nome": venda.cliente_nome or "Sem cliente",
                "cliente_telefone": venda.cliente.telefone if venda.cliente else None,
                "num_vendas": 0,
                "total_devido": Decimal("0.00"),
                "venda_mais_antiga": venda.criado_em,
                "parcelas_vencidas": 0,
                "valor_vencido": Decimal("0.00"),
            }
            agrupado[chave] = linha
        linha["num_vendas"] += 1
        linha["total_devido"] = (linha["total_devido"] + saldo).quantize(_CENTAVOS)
        if venda.criado_em < linha["venda_mais_antiga"]:
            linha["venda_mais_antiga"] = venda.criado_em

        qtd_venc, valor_venc = _parcelas_vencidas(venda, hoje)
        linha["parcelas_vencidas"] += qtd_venc
        linha["valor_vencido"] = (linha["valor_vencido"] + valor_venc).quantize(
            _CENTAVOS
        )

    # Maiores devedores primeiro.
    return sorted(
        agrupado.values(), key=lambda l: l["total_devido"], reverse=True
    )
