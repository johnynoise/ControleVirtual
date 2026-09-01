"""Endpoints de Categorias."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.crud import categoria as crud_categoria
from app.database import get_db
from app.schemas.categoria import CategoriaCreate, CategoriaOut, CategoriaUpdate

router = APIRouter(prefix="/categorias", tags=["Categorias"])


@router.get("", response_model=list[CategoriaOut])
def listar_categorias(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud_categoria.listar(db, skip=skip, limit=limit)


@router.get("/{categoria_id}", response_model=CategoriaOut)
def obter_categoria(categoria_id: int, db: Session = Depends(get_db)):
    categoria = crud_categoria.obter(db, categoria_id)
    if categoria is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Categoria não encontrada.")
    return categoria


@router.post("", response_model=CategoriaOut, status_code=status.HTTP_201_CREATED)
def criar_categoria(dados: CategoriaCreate, db: Session = Depends(get_db)):
    if crud_categoria.obter_por_nome(db, dados.nome):
        raise HTTPException(status.HTTP_409_CONFLICT, "Já existe uma categoria com esse nome.")
    return crud_categoria.criar(db, dados)


@router.put("/{categoria_id}", response_model=CategoriaOut)
def atualizar_categoria(
    categoria_id: int, dados: CategoriaUpdate, db: Session = Depends(get_db)
):
    categoria = crud_categoria.obter(db, categoria_id)
    if categoria is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Categoria não encontrada.")
    if dados.nome and dados.nome != categoria.nome:
        existente = crud_categoria.obter_por_nome(db, dados.nome)
        if existente and existente.id != categoria_id:
            raise HTTPException(status.HTTP_409_CONFLICT, "Já existe uma categoria com esse nome.")
    return crud_categoria.atualizar(db, categoria, dados)


@router.delete("/{categoria_id}", status_code=status.HTTP_204_NO_CONTENT)
def remover_categoria(categoria_id: int, db: Session = Depends(get_db)):
    categoria = crud_categoria.obter(db, categoria_id)
    if categoria is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Categoria não encontrada.")
    if categoria.produtos:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Não é possível remover: há produtos vinculados a esta categoria.",
        )
    crud_categoria.remover(db, categoria)
