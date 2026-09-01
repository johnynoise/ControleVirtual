"""Operações de banco para Movimentação de Estoque.

Ao registrar uma movimentação, o estoque do alvo (produto ou variação) é
atualizado na mesma transação e o resultado é gravado como histórico. Em
entradas com custo informado, o preço de custo do produto é recalculado pela
média ponderada (custo médio).
"""
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.fornecedor import Fornecedor
from app.models.movimentacao import MovimentacaoEstoque
from app.models.produto import Produto, VariacaoProduto
from app.schemas.movimentacao import MovimentacaoCreate, TipoMovimentacao


class ErroMovimentacao(ValueError):
    """Erro de regra de negócio ao movimentar estoque."""


def listar(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    produto_id: int | None = None,
    tipo: str | None = None,
) -> list[MovimentacaoEstoque]:
    query = db.query(MovimentacaoEstoque)
    if produto_id is not None:
        query = query.filter(MovimentacaoEstoque.produto_id == produto_id)
    if tipo is not None:
        query = query.filter(MovimentacaoEstoque.tipo == tipo)
    return (
        query.order_by(MovimentacaoEstoque.criado_em.desc(), MovimentacaoEstoque.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def obter(db: Session, movimentacao_id: int) -> MovimentacaoEstoque | None:
    return db.get(MovimentacaoEstoque, movimentacao_id)


def _aplicar_ao_estoque(estoque_atual: int, dados: MovimentacaoCreate) -> int:
    """Calcula o novo estoque conforme o tipo de movimentação."""
    if dados.tipo == TipoMovimentacao.entrada:
        return estoque_atual + dados.quantidade
    if dados.tipo == TipoMovimentacao.saida:
        if dados.quantidade > estoque_atual:
            raise ErroMovimentacao(
                f"Estoque insuficiente: disponível {estoque_atual}, "
                f"saída solicitada {dados.quantidade}."
            )
        return estoque_atual - dados.quantidade
    # ajuste: define o valor absoluto.
    return dados.quantidade


def _recalcular_custo_medio(
    produto: Produto, quantidade_entrada: int, custo_unitario: Decimal
) -> None:
    """Atualiza produto.preco_custo pela média ponderada na entrada."""
    estoque_antigo = produto.estoque
    custo_antigo = produto.preco_custo or Decimal("0")
    total_unidades = estoque_antigo + quantidade_entrada
    if total_unidades <= 0:
        produto.preco_custo = custo_unitario
        return
    valor_total = (Decimal(estoque_antigo) * custo_antigo) + (
        Decimal(quantidade_entrada) * custo_unitario
    )
    produto.preco_custo = (valor_total / Decimal(total_unidades)).quantize(Decimal("0.01"))


def criar(db: Session, dados: MovimentacaoCreate, produto: Produto) -> MovimentacaoEstoque:
    """Registra a movimentação e atualiza o estoque na mesma transação."""
    variacao: VariacaoProduto | None = None
    if dados.variacao_id is not None:
        variacao = db.get(VariacaoProduto, dados.variacao_id)
        if variacao is None or variacao.produto_id != produto.id:
            raise ErroMovimentacao("Variação não encontrada para este produto.")

    fornecedor: Fornecedor | None = None
    if dados.fornecedor_id is not None:
        fornecedor = db.get(Fornecedor, dados.fornecedor_id)
        if fornecedor is None:
            raise ErroMovimentacao("Fornecedor informado não existe.")

    # O alvo do estoque é a variação, se informada; senão, o próprio produto.
    if variacao is not None:
        novo_estoque = _aplicar_ao_estoque(variacao.estoque, dados)
        variacao.estoque = novo_estoque
    else:
        novo_estoque = _aplicar_ao_estoque(produto.estoque, dados)
        # Custo médio só se aplica a entradas de produto com custo informado.
        if dados.tipo == TipoMovimentacao.entrada and dados.custo_unitario is not None:
            _recalcular_custo_medio(produto, dados.quantidade, dados.custo_unitario)
        produto.estoque = novo_estoque

    movimentacao = MovimentacaoEstoque(
        produto_id=produto.id,
        variacao_id=variacao.id if variacao else None,
        fornecedor_id=fornecedor.id if fornecedor else None,
        produto_nome=produto.nome,
        fornecedor_nome=fornecedor.nome if fornecedor else None,
        tipo=dados.tipo.value,
        quantidade=dados.quantidade,
        estoque_resultante=novo_estoque,
        motivo=dados.motivo,
        custo_unitario=dados.custo_unitario,
        observacao=dados.observacao,
    )
    db.add(movimentacao)
    db.commit()
    db.refresh(movimentacao)
    return movimentacao
