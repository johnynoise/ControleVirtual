"""Fila de defeitos a acertar com o fornecedor.

Toda troca registrada com a marca de defeito nasce com
``status_fornecedor="pendente"`` e fica nesta fila até a dona da loja dar
baixa (o fornecedor trocou a peça, deu crédito ou recusou).

Os produtos não guardam fornecedor: essa informação só existe nas entradas de
estoque de compra. Por isso o fornecedor de cada peça é inferido da última
compra registrada daquele produto — é uma pista para a cobrança, não um
vínculo formal.
"""
from datetime import datetime
from decimal import Decimal

from sqlalchemy.orm import Session, joinedload

from app.models.devolucao import Devolucao
from app.models.movimentacao import MovimentacaoEstoque
from app.schemas.defeito import FiltroDefeito
from app.schemas.venda import StatusFornecedor

_CENTAVOS = Decimal("0.01")


class ErroDefeito(ValueError):
    """Erro de regra de negócio no acerto de um defeito."""


def _status(devolucao: Devolucao) -> str:
    """Status do acerto, tratando registros antigos sem status como pendentes."""
    return devolucao.status_fornecedor or StatusFornecedor.pendente.value


def _ultimo_fornecedor_por_produto(
    db: Session, produto_ids: set[int]
) -> dict[int, tuple[int | None, str | None]]:
    """Fornecedor da compra mais recente de cada produto informado."""
    if not produto_ids:
        return {}
    movimentacoes = (
        db.query(MovimentacaoEstoque)
        .filter(
            MovimentacaoEstoque.produto_id.in_(produto_ids),
            MovimentacaoEstoque.motivo == "compra",
            MovimentacaoEstoque.fornecedor_id.isnot(None),
        )
        .order_by(MovimentacaoEstoque.criado_em.desc())
        .all()
    )
    encontrados: dict[int, tuple[int | None, str | None]] = {}
    for mov in movimentacoes:
        # A lista vem da mais recente para a mais antiga: o primeiro vence.
        if mov.produto_id not in encontrados:
            encontrados[mov.produto_id] = (mov.fornecedor_id, mov.fornecedor_nome)
    return encontrados


def _consultar(db: Session, filtro: FiltroDefeito) -> list[Devolucao]:
    """Trocas marcadas como defeito, aplicando o filtro de status."""
    query = (
        db.query(Devolucao)
        .options(joinedload(Devolucao.itens), joinedload(Devolucao.venda))
        .filter(Devolucao.defeito.is_(True))
    )
    if filtro == FiltroDefeito.pendente:
        # Registros antigos podem estar sem status: contam como pendentes.
        query = query.filter(
            (Devolucao.status_fornecedor == StatusFornecedor.pendente.value)
            | (Devolucao.status_fornecedor.is_(None))
        )
    elif filtro == FiltroDefeito.resolvido:
        query = query.filter(
            Devolucao.status_fornecedor == StatusFornecedor.resolvido.value
        )
    return query.order_by(Devolucao.criado_em.desc()).all()


def _montar_linha(
    devolucao: Devolucao, fornecedores: dict[int, tuple[int | None, str | None]]
) -> dict:
    """Monta a linha da tela a partir de uma troca com defeito."""
    itens = []
    custo_total = Decimal("0")
    quantidade_total = 0
    for item in devolucao.itens:
        fornecedor_id, fornecedor_nome = fornecedores.get(item.produto_id, (None, None))
        custo_total += Decimal(item.custo_unitario or 0) * item.quantidade
        quantidade_total += item.quantidade
        itens.append(
            {
                "produto_id": item.produto_id,
                "produto_nome": item.produto_nome,
                "quantidade": item.quantidade,
                "custo_unitario": Decimal(item.custo_unitario or 0),
                "preco_unitario": Decimal(item.preco_unitario or 0),
                "fornecedor_id": fornecedor_id,
                "fornecedor_nome": fornecedor_nome,
            }
        )

    venda = devolucao.venda
    return {
        "devolucao_id": devolucao.id,
        "venda_id": devolucao.venda_id,
        "cliente_id": venda.cliente_id if venda else None,
        "cliente_nome": venda.cliente_nome if venda else None,
        "criado_em": devolucao.criado_em,
        "motivo": devolucao.motivo,
        "observacao": devolucao.observacao,
        "status_fornecedor": _status(devolucao),
        "resolvido_em": devolucao.resolvido_em,
        "resolucao_observacao": devolucao.resolucao_observacao,
        "quantidade_total": quantidade_total,
        "valor_devolvido": Decimal(devolucao.valor_devolvido or 0),
        "custo_total": custo_total.quantize(_CENTAVOS),
        "itens": itens,
    }


def _produto_ids(devolucoes: list[Devolucao]) -> set[int]:
    return {
        item.produto_id
        for devolucao in devolucoes
        for item in devolucao.itens
        if item.produto_id is not None
    }


def listar(db: Session, filtro: FiltroDefeito = FiltroDefeito.pendente) -> list[dict]:
    """Fila de defeitos, da troca mais recente para a mais antiga."""
    devolucoes = _consultar(db, filtro)
    fornecedores = _ultimo_fornecedor_por_produto(db, _produto_ids(devolucoes))
    return [_montar_linha(devolucao, fornecedores) for devolucao in devolucoes]


def obter(db: Session, devolucao_id: int) -> dict | None:
    """Uma única linha da fila (usada no retorno das ações)."""
    devolucao = _obter_defeito(db, devolucao_id)
    if devolucao is None:
        return None
    fornecedores = _ultimo_fornecedor_por_produto(db, _produto_ids([devolucao]))
    return _montar_linha(devolucao, fornecedores)


def resumo(db: Session) -> dict:
    """Contagens e valores da fila (pendentes) e total já resolvido."""
    devolucoes = (
        db.query(Devolucao)
        .options(joinedload(Devolucao.itens))
        .filter(Devolucao.defeito.is_(True))
        .all()
    )
    pendentes = [
        d for d in devolucoes if _status(d) == StatusFornecedor.pendente.value
    ]
    pecas = sum(item.quantidade for d in pendentes for item in d.itens)
    custo = sum(
        (
            Decimal(item.custo_unitario or 0) * item.quantidade
            for d in pendentes
            for item in d.itens
        ),
        Decimal("0"),
    )
    valor = sum(
        (Decimal(d.valor_devolvido or 0) for d in pendentes), Decimal("0")
    )
    return {
        "pendentes": len(pendentes),
        "pecas_pendentes": pecas,
        "custo_pendente": custo.quantize(_CENTAVOS),
        "valor_pendente": valor.quantize(_CENTAVOS),
        "resolvidos": len(devolucoes) - len(pendentes),
    }


def _obter_defeito(db: Session, devolucao_id: int) -> Devolucao | None:
    devolucao = db.get(Devolucao, devolucao_id)
    if devolucao is None:
        return None
    if not devolucao.defeito:
        raise ErroDefeito(
            f"A troca #{devolucao_id} não está marcada como defeito."
        )
    return devolucao


def resolver(
    db: Session, devolucao_id: int, observacao: str | None = None
) -> dict | None:
    """Dá baixa no acerto com o fornecedor."""
    devolucao = _obter_defeito(db, devolucao_id)
    if devolucao is None:
        return None

    devolucao.status_fornecedor = StatusFornecedor.resolvido.value
    devolucao.resolvido_em = datetime.now()
    devolucao.resolucao_observacao = (observacao or "").strip() or None
    db.add(devolucao)
    db.commit()
    db.refresh(devolucao)
    return obter(db, devolucao_id)


def reabrir(db: Session, devolucao_id: int) -> dict | None:
    """Volta o defeito para a fila de pendentes (desfaz uma baixa errada)."""
    devolucao = _obter_defeito(db, devolucao_id)
    if devolucao is None:
        return None

    devolucao.status_fornecedor = StatusFornecedor.pendente.value
    devolucao.resolvido_em = None
    devolucao.resolucao_observacao = None
    db.add(devolucao)
    db.commit()
    db.refresh(devolucao)
    return obter(db, devolucao_id)
