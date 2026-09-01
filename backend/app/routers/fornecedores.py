"""Endpoints de Fornecedores."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.crud import fornecedor as crud_fornecedor
from app.database import get_db
from app.schemas.fornecedor import FornecedorCreate, FornecedorOut, FornecedorUpdate

router = APIRouter(prefix="/fornecedores", tags=["Fornecedores"])


@router.get("", response_model=list[FornecedorOut])
def listar_fornecedores(
    skip: int = 0,
    limit: int = 100,
    apenas_ativos: bool = False,
    db: Session = Depends(get_db),
):
    return crud_fornecedor.listar(db, skip=skip, limit=limit, apenas_ativos=apenas_ativos)


@router.get("/{fornecedor_id}", response_model=FornecedorOut)
def obter_fornecedor(fornecedor_id: int, db: Session = Depends(get_db)):
    fornecedor = crud_fornecedor.obter(db, fornecedor_id)
    if fornecedor is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Fornecedor não encontrado.")
    return fornecedor


@router.post("", response_model=FornecedorOut, status_code=status.HTTP_201_CREATED)
def criar_fornecedor(dados: FornecedorCreate, db: Session = Depends(get_db)):
    if dados.documento and crud_fornecedor.obter_por_documento(db, dados.documento):
        raise HTTPException(status.HTTP_409_CONFLICT, "Já existe um fornecedor com esse documento.")
    return crud_fornecedor.criar(db, dados)


@router.put("/{fornecedor_id}", response_model=FornecedorOut)
def atualizar_fornecedor(
    fornecedor_id: int, dados: FornecedorUpdate, db: Session = Depends(get_db)
):
    fornecedor = crud_fornecedor.obter(db, fornecedor_id)
    if fornecedor is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Fornecedor não encontrado.")
    if dados.documento and dados.documento != fornecedor.documento:
        existente = crud_fornecedor.obter_por_documento(db, dados.documento)
        if existente and existente.id != fornecedor_id:
            raise HTTPException(
                status.HTTP_409_CONFLICT, "Já existe um fornecedor com esse documento."
            )
    return crud_fornecedor.atualizar(db, fornecedor, dados)


@router.delete("/{fornecedor_id}", status_code=status.HTTP_204_NO_CONTENT)
def remover_fornecedor(fornecedor_id: int, db: Session = Depends(get_db)):
    fornecedor = crud_fornecedor.obter(db, fornecedor_id)
    if fornecedor is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Fornecedor não encontrado.")
    crud_fornecedor.remover(db, fornecedor)
