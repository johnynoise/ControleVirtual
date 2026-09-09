"""Model da tabela de clientes (cadastro simples)."""
from sqlalchemy import Boolean, Column, Date, DateTime, Integer, String, func

from app.database import Base


class Cliente(Base):
    __tablename__ = "clientes"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(200), nullable=False, index=True)
    telefone = Column(String(30), nullable=True)
    email = Column(String(120), nullable=True)
    # Data de nascimento e endereço (usado como destino padrão no delivery).
    data_nascimento = Column(Date, nullable=True)
    endereco = Column(String(300), nullable=True)
    ativo = Column(Boolean, nullable=False, default=True)

    criado_em = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    atualizado_em = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
