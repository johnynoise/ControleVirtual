"""Operações de banco para Cliente."""
from sqlalchemy.orm import Session

from app.models.cliente import Cliente
from app.schemas.cliente import ClienteCreate, ClienteUpdate


def listar(
    db: Session, skip: int = 0, limit: int = 100, apenas_ativos: bool = False
) -> list[Cliente]:
    query = db.query(Cliente)
    if apenas_ativos:
        query = query.filter(Cliente.ativo.is_(True))
    return query.order_by(Cliente.nome).offset(skip).limit(limit).all()


def obter(db: Session, cliente_id: int) -> Cliente | None:
    return db.get(Cliente, cliente_id)


def criar(db: Session, dados: ClienteCreate) -> Cliente:
    cliente = Cliente(**dados.model_dump())
    db.add(cliente)
    db.commit()
    db.refresh(cliente)
    return cliente


def atualizar(db: Session, cliente: Cliente, dados: ClienteUpdate) -> Cliente:
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(cliente, campo, valor)
    db.commit()
    db.refresh(cliente)
    return cliente


def remover(db: Session, cliente: Cliente) -> None:
    db.delete(cliente)
    db.commit()
