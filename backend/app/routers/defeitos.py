"""Rotas da fila de defeitos a acertar com o fornecedor.

As trocas marcadas como defeito no histórico de vendas entram aqui como
pendentes. A dona da loja dá baixa quando o fornecedor troca a peça, dá
crédito ou recusa — e pode reabrir se der baixa por engano.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.crud import defeito as crud_defeito
from app.crud.defeito import ErroDefeito
from app.database import get_db
from app.schemas.defeito import (
    DefeitoOut,
    DefeitoResumo,
    FiltroDefeito,
    ResolverDefeitoRequest,
)

router = APIRouter(prefix="/defeitos", tags=["Defeitos"])


@router.get("", response_model=list[DefeitoOut])
def listar_defeitos(
    filtro: FiltroDefeito = FiltroDefeito.pendente,
    db: Session = Depends(get_db),
):
    """Trocas com defeito. Por padrão só as pendentes com o fornecedor."""
    return crud_defeito.listar(db, filtro)


@router.get("/resumo", response_model=DefeitoResumo)
def resumo_defeitos(db: Session = Depends(get_db)):
    """Quantidade de peças, custo parado e total já resolvido."""
    return crud_defeito.resumo(db)


@router.post("/{devolucao_id}/resolver", response_model=DefeitoOut)
def resolver_defeito(
    devolucao_id: int,
    dados: ResolverDefeitoRequest | None = None,
    db: Session = Depends(get_db),
):
    """Marca o defeito como acertado com o fornecedor."""
    try:
        linha = crud_defeito.resolver(
            db, devolucao_id, dados.observacao if dados else None
        )
    except ErroDefeito as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    if linha is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Troca não encontrada.")
    return linha


@router.post("/{devolucao_id}/reabrir", response_model=DefeitoOut)
def reabrir_defeito(devolucao_id: int, db: Session = Depends(get_db)):
    """Devolve o defeito para a fila de pendentes."""
    try:
        linha = crud_defeito.reabrir(db, devolucao_id)
    except ErroDefeito as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    if linha is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Troca não encontrada.")
    return linha
