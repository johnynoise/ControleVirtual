"""Models de Venda e Item de Venda.

Uma venda tem um cabeçalho (cliente, pagamento, totais, lucro) e vários itens.
Cada item guarda retratos (snapshots) do nome do produto, do preço de venda e
do custo médio no momento da venda, para o histórico e o cálculo de lucro
permanecerem corretos mesmo que preços mudem depois.
"""
from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from app.database import Base


class Venda(Base):
    __tablename__ = "vendas"

    id = Column(Integer, primary_key=True, index=True)

    # Cliente vinculado (opcional). O nome é guardado como retrato (snapshot)
    # para o histórico sobreviver mesmo se o cliente for removido.
    cliente_id = Column(
        Integer, ForeignKey("clientes.id", ondelete="SET NULL"), nullable=True, index=True
    )
    cliente_nome = Column(String(200), nullable=True)
    forma_pagamento = Column(String(30), nullable=True)

    # Totais calculados no fechamento da venda (snapshots).
    total_bruto = Column(Numeric(12, 2), nullable=False, default=0)
    desconto = Column(Numeric(12, 2), nullable=False, default=0)
    total_liquido = Column(Numeric(12, 2), nullable=False, default=0)
    custo_total = Column(Numeric(12, 2), nullable=False, default=0)
    lucro = Column(Numeric(12, 2), nullable=False, default=0)

    observacao = Column(Text, nullable=True)

    # Usa hora local (datetime.now) para o dashboard agrupar "hoje" corretamente,
    # de forma consistente entre SQLite e PostgreSQL.
    criado_em = Column(
        DateTime(timezone=True),
        default=datetime.now,
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    itens = relationship(
        "ItemVenda",
        back_populates="venda",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    cliente = relationship("Cliente")


class ItemVenda(Base):
    __tablename__ = "itens_venda"

    id = Column(Integer, primary_key=True, index=True)
    venda_id = Column(
        Integer, ForeignKey("vendas.id", ondelete="CASCADE"), nullable=False, index=True
    )
    produto_id = Column(
        Integer, ForeignKey("produtos.id", ondelete="SET NULL"), nullable=True, index=True
    )

    produto_nome = Column(String(200), nullable=False)
    quantidade = Column(Integer, nullable=False)
    preco_unitario = Column(Numeric(12, 2), nullable=False)
    custo_unitario = Column(Numeric(12, 2), nullable=False, default=0)
    subtotal = Column(Numeric(12, 2), nullable=False)

    venda = relationship("Venda", back_populates="itens")
    produto = relationship("Produto")
