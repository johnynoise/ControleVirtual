"""Endpoints de Movimentações de Estoque.

Movimentações são um log imutável: só é permitido listar, consultar e criar.
Para reverter uma movimentação, registre uma movimentação oposta.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.crud import movimentacao as crud_mov
from app.crud import produto as crud_produto
from app.crud.movimentacao import ErroMovimentacao
from app.database import get_db
from app.schemas.movimentacao import MovimentacaoCreate, MovimentacaoOut

router = APIRouter(prefix="/movimentacoes", tags=["Movimentações"])


@router.get("", response_model=list[MovimentacaoOut])
def listar_movimentacoes(
    skip: int = 0,
    limit: int = 100,
    produto_id: int | None = None,
    tipo: str | None = None,
    db: Session = Depends(get_db),
):
    return crud_mov.listar(db, skip=skip, limit=limit, produto_id=produto_id, tipo=tipo)


@router.get("/{movimentacao_id}", response_model=MovimentacaoOut)
def obter_movimentacao(movimentacao_id: int, db: Session = Depends(get_db)):
    mov = crud_mov.obter(db, movimentacao_id)
    if mov is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Movimentação não encontrada.")
    return mov


@router.post("", response_model=MovimentacaoOut, status_code=status.HTTP_201_CREATED)
def criar_movimentacao(dados: MovimentacaoCreate, db: Session = Depends(get_db)):
    produto = crud_produto.obter(db, dados.produto_id)
    if produto is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Produto informado não existe.")
    try:
        return crud_mov.criar(db, dados, produto)
    except ErroMovimentacao as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
