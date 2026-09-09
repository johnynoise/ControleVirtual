"""Model de Parcela de Venda (plano de parcelamento de vendas a prazo/fiado).

Quando uma venda é feita "a prazo" (fiado), ela pode ser dividida em até 3
parcelas. Cada parcela guarda o número (1, 2, 3), o valor previsto e a data de
vencimento combinada com o cliente. As parcelas são apenas o *plano* de
pagamento; o recebimento efetivo continua registrado em ``PagamentoVenda`` e o
saldo devedor da venda continua sendo o total líquido menos a soma dos
pagamentos.
"""
from datetime import datetime

from sqlalchemy import (
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    func,
)
from sqlalchemy.orm import relationship

from app.database import Base


class ParcelaVenda(Base):
    __tablename__ = "parcelas_venda"

    id = Column(Integer, primary_key=True, index=True)
    venda_id = Column(
        Integer, ForeignKey("vendas.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Número da parcela dentro da venda (1, 2, 3...).
    numero = Column(Integer, nullable=False)
    valor = Column(Numeric(12, 2), nullable=False)
    # Data combinada para o pagamento desta parcela.
    vencimento = Column(Date, nullable=False)

    criado_em = Column(
        DateTime(timezone=True),
        default=datetime.now,
        server_default=func.now(),
        nullable=False,
    )

    venda = relationship("Venda", back_populates="parcelas")
