"""Model da tabela de fornecedores."""
from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, func

from app.database import Base


class Fornecedor(Base):
    __tablename__ = "fornecedores"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(200), nullable=False, index=True)
    nome_fantasia = Column(String(200), nullable=True)

    # CNPJ ou CPF (armazenado como texto para preservar formatação/zeros).
    documento = Column(String(20), unique=True, nullable=True, index=True)

    email = Column(String(120), nullable=True)
    telefone = Column(String(30), nullable=True)
    contato = Column(String(120), nullable=True)

    endereco = Column(String(200), nullable=True)
    cidade = Column(String(120), nullable=True)
    estado = Column(String(2), nullable=True)

    observacao = Column(Text, nullable=True)
    ativo = Column(Boolean, nullable=False, default=True)

    criado_em = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    atualizado_em = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
