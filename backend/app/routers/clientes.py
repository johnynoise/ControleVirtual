"""Endpoints de Clientes."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.crud import cliente as crud_cliente
from app.database import get_db
from app.schemas.cliente import (
    ClienteCreate,
    ClienteOut,
    ClienteUpdate,
    FichaCliente,
)

router = APIRouter(prefix="/clientes", tags=["Clientes"])


@router.get("", response_model=list[ClienteOut])
def listar_clientes(
    skip: int = 0,
    limit: int = 100,
    apenas_ativos: bool = False,
    db: Session = Depends(get_db),
):
    return crud_cliente.listar(db, skip=skip, limit=limit, apenas_ativos=apenas_ativos)


@router.get("/{cliente_id}", response_model=ClienteOut)
def obter_cliente(cliente_id: int, db: Session = Depends(get_db)):
    cliente = crud_cliente.obter(db, cliente_id)
    if cliente is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cliente não encontrado.")
    return cliente


@router.get("/{cliente_id}/ficha", response_model=FichaCliente)
def ficha_cliente(cliente_id: int, db: Session = Depends(get_db)):
    ficha = crud_cliente.ficha(db, cliente_id)
    if ficha is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cliente não encontrado.")
    return ficha


@router.post("", response_model=ClienteOut, status_code=status.HTTP_201_CREATED)
def criar_cliente(dados: ClienteCreate, db: Session = Depends(get_db)):
    return crud_cliente.criar(db, dados)


@router.put("/{cliente_id}", response_model=ClienteOut)
def atualizar_cliente(cliente_id: int, dados: ClienteUpdate, db: Session = Depends(get_db)):
    cliente = crud_cliente.obter(db, cliente_id)
    if cliente is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cliente não encontrado.")
    return crud_cliente.atualizar(db, cliente, dados)


@router.delete("/{cliente_id}", status_code=status.HTTP_204_NO_CONTENT)
def remover_cliente(cliente_id: int, db: Session = Depends(get_db)):
    cliente = crud_cliente.obter(db, cliente_id)
    if cliente is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cliente não encontrado.")
    crud_cliente.remover(db, cliente)
