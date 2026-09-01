"""Endpoints de Produtos."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.crud import categoria as crud_categoria
from app.crud import produto as crud_produto
from app.crud.validacao import ErroValidacaoAtributos
from app.database import get_db
from app.schemas.produto import ProdutoCreate, ProdutoOut, ProdutoUpdate

router = APIRouter(prefix="/produtos", tags=["Produtos"])


@router.get("", response_model=list[ProdutoOut])
def listar_produtos(
    skip: int = 0,
    limit: int = 100,
    categoria_id: int | None = None,
    apenas_ativos: bool = False,
    db: Session = Depends(get_db),
):
    return crud_produto.listar(
        db, skip=skip, limit=limit, categoria_id=categoria_id, apenas_ativos=apenas_ativos
    )


@router.get("/{produto_id}", response_model=ProdutoOut)
def obter_produto(produto_id: int, db: Session = Depends(get_db)):
    produto = crud_produto.obter(db, produto_id)
    if produto is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Produto não encontrado.")
    return produto


@router.post("", response_model=ProdutoOut, status_code=status.HTTP_201_CREATED)
def criar_produto(dados: ProdutoCreate, db: Session = Depends(get_db)):
    categoria = crud_categoria.obter(db, dados.categoria_id)
    if categoria is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Categoria informada não existe.")
    try:
        return crud_produto.criar(db, dados, categoria)
    except ErroValidacaoAtributos as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc


@router.put("/{produto_id}", response_model=ProdutoOut)
def atualizar_produto(produto_id: int, dados: ProdutoUpdate, db: Session = Depends(get_db)):
    produto = crud_produto.obter(db, produto_id)
    if produto is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Produto não encontrado.")

    # A categoria usada na validação dos atributos é a nova (se enviada) ou a atual.
    categoria_id = dados.categoria_id if dados.categoria_id is not None else produto.categoria_id
    categoria = crud_categoria.obter(db, categoria_id)
    if categoria is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Categoria informada não existe.")

    try:
        return crud_produto.atualizar(db, produto, dados, categoria)
    except ErroValidacaoAtributos as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc


@router.delete("/{produto_id}", status_code=status.HTTP_204_NO_CONTENT)
def remover_produto(produto_id: int, db: Session = Depends(get_db)):
    produto = crud_produto.obter(db, produto_id)
    if produto is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Produto não encontrado.")
    crud_produto.remover(db, produto)
