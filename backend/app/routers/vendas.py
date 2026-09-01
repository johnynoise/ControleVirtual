"""Endpoints de Vendas (PDV).

A venda é registrada de forma transacional e imutável: ao criar, o estoque é
baixado e movimentações de saída são geradas. Não há edição/exclusão; para
corrigir, registre um ajuste de estoque ou uma nova operação.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.crud import venda as crud_venda
from app.crud.venda import ErroVenda
from app.database import get_db
from app.schemas.venda import VendaCreate, VendaOut

router = APIRouter(prefix="/vendas", tags=["Vendas"])


@router.get("", response_model=list[VendaOut])
def listar_vendas(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud_venda.listar(db, skip=skip, limit=limit)


@router.get("/{venda_id}", response_model=VendaOut)
def obter_venda(venda_id: int, db: Session = Depends(get_db)):
    venda = crud_venda.obter(db, venda_id)
    if venda is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Venda não encontrada.")
    return venda


@router.post("", response_model=VendaOut, status_code=status.HTTP_201_CREATED)
def criar_venda(dados: VendaCreate, db: Session = Depends(get_db)):
    try:
        return crud_venda.criar(db, dados)
    except ErroVenda as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
