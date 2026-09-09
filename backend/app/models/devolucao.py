"""Models de Devolução e Item de Devolução.

Uma devolução é o registro (imutável, para auditoria) de que parte ou todos os
itens de uma venda voltaram. Ela guarda o motivo, o valor devolvido e retratos
(snapshots) dos itens no momento da devolução. Ao aplicá-la, o estoque é
devolvido e os totais da venda são recalculados; se todos os itens voltarem, a
venda é marcada como cancelada (estornada).
"""
from datetime import datetime

from sqlalchemy import (
    Boolean,
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


class Devolucao(Base):
    __tablename__ = "devolucoes"

    id = Column(Integer, primary_key=True, index=True)
    venda_id = Column(
        Integer, ForeignKey("vendas.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Motivo padronizado (ex.: defeito, nao_gostou...) + observação livre.
    motivo = Column(String(40), nullable=False)
    observacao = Column(Text, nullable=True)

    # Peça com defeito: marca a troca para acerto com o fornecedor. Enquanto
    # ``status_fornecedor`` estiver "pendente", a peça aparece na lista de
    # defeitos a resolver com o fornecedor. Trocas sem defeito ficam com
    # ``status_fornecedor`` nulo (não envolvem o fornecedor).
    defeito = Column(Boolean, nullable=False, default=False, server_default="0")
    status_fornecedor = Column(String(20), nullable=True, index=True)

    # Baixa do acerto com o fornecedor (troca, crédito, recusa...).
    resolvido_em = Column(DateTime(timezone=True), nullable=True)
    resolucao_observacao = Column(Text, nullable=True)

    # Valor bruto devolvido (soma dos itens devolvidos).
    valor_devolvido = Column(Numeric(12, 2), nullable=False, default=0)

    criado_em = Column(
        DateTime(timezone=True),
        default=datetime.now,
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    venda = relationship("Venda", back_populates="devolucoes")
    itens = relationship(
        "ItemDevolucao",
        back_populates="devolucao",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class ItemDevolucao(Base):
    __tablename__ = "itens_devolucao"

    id = Column(Integer, primary_key=True, index=True)
    devolucao_id = Column(
        Integer, ForeignKey("devolucoes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Referência ao item original da venda (retratos preservam o histórico).
    item_venda_id = Column(
        Integer, ForeignKey("itens_venda.id", ondelete="SET NULL"), nullable=True
    )
    produto_id = Column(
        Integer, ForeignKey("produtos.id", ondelete="SET NULL"), nullable=True, index=True
    )

    produto_nome = Column(String(200), nullable=False)
    quantidade = Column(Integer, nullable=False)
    preco_unitario = Column(Numeric(12, 2), nullable=False)
    custo_unitario = Column(Numeric(12, 2), nullable=False, default=0)
    subtotal = Column(Numeric(12, 2), nullable=False)

    devolucao = relationship("Devolucao", back_populates="itens")
