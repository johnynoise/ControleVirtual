"""Model de Pagamento de Venda (quitações de vendas a prazo / fiado).

Uma venda "a prazo" (forma de pagamento ``fiado``) nasce com o valor total em
aberto. Os pagamentos que o cliente faz depois — parciais ou totais — são
registrados aqui. O saldo devedor da venda é o total líquido menos a soma dos
pagamentos. Cada pagamento é um registro imutável, para preservar o histórico.
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


class PagamentoVenda(Base):
    __tablename__ = "pagamentos_venda"

    id = Column(Integer, primary_key=True, index=True)
    venda_id = Column(
        Integer, ForeignKey("vendas.id", ondelete="CASCADE"), nullable=False, index=True
    )

    valor = Column(Numeric(12, 2), nullable=False)
    # Como o pagamento entrou (dinheiro, pix, cartão...). Livre, mas normalmente
    # usa os mesmos valores da forma de pagamento da venda (menos "fiado").
    forma_pagamento = Column(String(30), nullable=True)
    observacao = Column(Text, nullable=True)

    criado_em = Column(
        DateTime(timezone=True),
        default=datetime.now,
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    venda = relationship("Venda", back_populates="pagamentos")
