"""Models de Venda e Item de Venda.

Uma venda tem um cabeçalho (cliente, pagamento, totais, lucro) e vários itens.
Cada item guarda retratos (snapshots) do nome do produto, do preço de venda e
do custo médio no momento da venda, para o histórico e o cálculo de lucro
permanecerem corretos mesmo que preços mudem depois.
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

    # Estorno (cancelamento) da venda. Quando preenchido, a venda deixa de
    # contar nos relatórios e o estoque dos itens já foi devolvido.
    cancelada_em = Column(DateTime(timezone=True), nullable=True, index=True)
    motivo_cancelamento = Column(String(200), nullable=True)

    # Renegociação de dívida: quando um cliente tem várias vendas a prazo em
    # aberto, o vendedor pode consolidá-las em uma nova venda "fiado" com um
    # novo parcelamento. As vendas antigas não são estornadas (o estoque já
    # foi vendido de fato) — apenas marcadas como renegociadas, para saírem do
    # saldo devedor e apontarem para a venda consolidada que assumiu a dívida.
    renegociada_em = Column(DateTime(timezone=True), nullable=True, index=True)
    renegociada_para_venda_id = Column(
        Integer, ForeignKey("vendas.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # Marca a venda consolidada criada pela própria renegociação (o "destino"
    # da dívida). Ela não representa mercadoria vendida agora — é só o novo
    # acordo de pagamento — então fica de fora de faturamento/lucro/CMV nos
    # relatórios, para não contar de novo um dinheiro cujo lucro já foi
    # contabilizado nas vendas originais. Continua valendo normalmente para
    # saldo devedor e contas a receber.
    eh_renegociacao = Column(Boolean, nullable=False, default=False, server_default="0")

    # Entrega (delivery). Quando `entrega_status` é "pendente", a venda é um
    # pedido ainda não realizado: NÃO baixou estoque nem gerou movimentação e
    # não conta em relatórios/faturamento. Ao confirmar a entrega, o estoque é
    # baixado e a venda passa a valer (status "entregue"). Vendas normais (balcão)
    # ficam com `entrega_status` nulo.
    entrega_status = Column(String(20), nullable=True, index=True)
    entregue_em = Column(DateTime(timezone=True), nullable=True)
    endereco_entrega = Column(String(300), nullable=True)

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
    devolucoes = relationship(
        "Devolucao",
        back_populates="venda",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="Devolucao.criado_em",
    )
    pagamentos = relationship(
        "PagamentoVenda",
        back_populates="venda",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="PagamentoVenda.criado_em",
    )
    parcelas = relationship(
        "ParcelaVenda",
        back_populates="venda",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="ParcelaVenda.numero",
    )
    cliente = relationship("Cliente")

    # Vendas antigas que foram consolidadas nesta (quando esta é o resultado de
    # uma renegociação de dívida). Ver `renegociada_para_venda_id`.
    vendas_renegociadas = relationship(
        "Venda",
        backref="renegociada_para",
        remote_side=[id],
        foreign_keys="Venda.renegociada_para_venda_id",
    )


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
    # Desconto em reais aplicado sobre a linha inteira do item (preço unitário
    # × quantidade), independente do desconto total da venda. `subtotal` já
    # sai líquido deste desconto: subtotal = (preco_unitario * quantidade) - desconto.
    desconto = Column(Numeric(12, 2), nullable=False, default=0)
    subtotal = Column(Numeric(12, 2), nullable=False)

    venda = relationship("Venda", back_populates="itens")
    produto = relationship("Produto")
