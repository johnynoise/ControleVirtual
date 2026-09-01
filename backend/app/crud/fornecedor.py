"""Operações de banco para Fornecedor."""
from sqlalchemy.orm import Session

from app.models.fornecedor import Fornecedor
from app.schemas.fornecedor import FornecedorCreate, FornecedorUpdate


def listar(
    db: Session, skip: int = 0, limit: int = 100, apenas_ativos: bool = False
) -> list[Fornecedor]:
    query = db.query(Fornecedor)
    if apenas_ativos:
        query = query.filter(Fornecedor.ativo.is_(True))
    return query.order_by(Fornecedor.nome).offset(skip).limit(limit).all()


def obter(db: Session, fornecedor_id: int) -> Fornecedor | None:
    return db.get(Fornecedor, fornecedor_id)


def obter_por_documento(db: Session, documento: str) -> Fornecedor | None:
    return db.query(Fornecedor).filter(Fornecedor.documento == documento).first()


def criar(db: Session, dados: FornecedorCreate) -> Fornecedor:
    fornecedor = Fornecedor(**dados.model_dump())
    db.add(fornecedor)
    db.commit()
    db.refresh(fornecedor)
    return fornecedor


def atualizar(db: Session, fornecedor: Fornecedor, dados: FornecedorUpdate) -> Fornecedor:
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(fornecedor, campo, valor)
    db.commit()
    db.refresh(fornecedor)
    return fornecedor


def remover(db: Session, fornecedor: Fornecedor) -> None:
    db.delete(fornecedor)
    db.commit()
