"""Operações de banco para Categoria."""
from sqlalchemy.orm import Session

from app.models.categoria import Categoria
from app.schemas.categoria import CategoriaCreate, CategoriaUpdate


def listar(db: Session, skip: int = 0, limit: int = 100) -> list[Categoria]:
    return db.query(Categoria).order_by(Categoria.nome).offset(skip).limit(limit).all()


def obter(db: Session, categoria_id: int) -> Categoria | None:
    return db.get(Categoria, categoria_id)


def obter_por_nome(db: Session, nome: str) -> Categoria | None:
    return db.query(Categoria).filter(Categoria.nome == nome).first()


def criar(db: Session, dados: CategoriaCreate) -> Categoria:
    categoria = Categoria(
        nome=dados.nome,
        descricao=dados.descricao,
        campos_schema=[c.model_dump() for c in dados.campos_schema],
    )
    db.add(categoria)
    db.commit()
    db.refresh(categoria)
    return categoria


def atualizar(db: Session, categoria: Categoria, dados: CategoriaUpdate) -> Categoria:
    valores = dados.model_dump(exclude_unset=True)
    if "campos_schema" in valores and valores["campos_schema"] is not None:
        valores["campos_schema"] = [c.model_dump() for c in dados.campos_schema]
    for campo, valor in valores.items():
        setattr(categoria, campo, valor)
    db.commit()
    db.refresh(categoria)
    return categoria


def remover(db: Session, categoria: Categoria) -> None:
    db.delete(categoria)
    db.commit()
