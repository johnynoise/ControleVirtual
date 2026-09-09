"""Operações de banco para Produto (e suas variações)."""
from sqlalchemy.orm import Session

from app.crud.validacao import validar_atributos
from app.models.categoria import Categoria
from app.models.produto import Produto, VariacaoProduto
from app.schemas.produto import ProdutoCreate, ProdutoUpdate


def listar(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    categoria_id: int | None = None,
    apenas_ativos: bool = False,
) -> list[Produto]:
    query = db.query(Produto)
    if categoria_id is not None:
        query = query.filter(Produto.categoria_id == categoria_id)
    if apenas_ativos:
        query = query.filter(Produto.ativo.is_(True))
    return query.order_by(Produto.nome).offset(skip).limit(limit).all()


def obter(db: Session, produto_id: int) -> Produto | None:
    return db.get(Produto, produto_id)


def criar(db: Session, dados: ProdutoCreate, categoria: Categoria) -> Produto:
    atributos = validar_atributos(dados.atributos, categoria)

    produto = Produto(
        nome=dados.nome,
        sku=dados.sku,
        codigo_barras=dados.codigo_barras,
        descricao=dados.descricao,
        categoria_id=categoria.id,
        preco_custo=dados.preco_custo,
        preco_venda=dados.preco_venda,
        preco_venda_prazo=dados.preco_venda_prazo,
        estoque=dados.estoque,
        estoque_minimo=dados.estoque_minimo,
        atributos=atributos,
        ativo=dados.ativo,
    )
    for var in dados.variacoes:
        produto.variacoes.append(
            VariacaoProduto(
                sku=var.sku,
                codigo_barras=var.codigo_barras,
                atributos=var.atributos,
                preco_venda=var.preco_venda,
                estoque=var.estoque,
            )
        )

    db.add(produto)
    db.commit()
    db.refresh(produto)
    return produto


def atualizar(
    db: Session, produto: Produto, dados: ProdutoUpdate, categoria: Categoria
) -> Produto:
    valores = dados.model_dump(exclude_unset=True)

    if "atributos" in valores and valores["atributos"] is not None:
        valores["atributos"] = validar_atributos(valores["atributos"], categoria)

    for campo, valor in valores.items():
        setattr(produto, campo, valor)

    db.commit()
    db.refresh(produto)
    return produto


def remover(db: Session, produto: Produto) -> None:
    db.delete(produto)
    db.commit()
