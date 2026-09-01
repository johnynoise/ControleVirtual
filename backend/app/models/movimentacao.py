"""Model de Movimentação de Estoque (log de entradas, saídas e ajustes).

Cada movimentação é um registro imutável de histórico. Para o histórico
sobreviver mesmo que o produto seja removido, guardamos um "retrato"
(``produto_nome``) e usamos ``ON DELETE SET NULL`` na FK.
"""
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


class MovimentacaoEstoque(Base):
    __tablename__ = "movimentacoes_estoque"

    id = Column(Integer, primary_key=True, index=True)

    produto_id = Column(
        Integer, ForeignKey("produtos.id", ondelete="SET NULL"), nullable=True, index=True
    )
    variacao_id = Column(
        Integer,
        ForeignKey("variacoes_produto.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # Fornecedor da compra (relevante em entradas). Opcional.
    fornecedor_id = Column(
        Integer, ForeignKey("fornecedores.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Retrato do produto no momento da movimentação (preserva o histórico).
    produto_nome = Column(String(200), nullable=False)
    # Retrato do fornecedor no momento da movimentação (preserva o histórico).
    fornecedor_nome = Column(String(200), nullable=True)

    # "entrada", "saida" ou "ajuste".
    tipo = Column(String(20), nullable=False, index=True)

    # entrada/saida: quantidade movimentada. ajuste: novo valor absoluto.
    quantidade = Column(Integer, nullable=False)

    # Estoque do alvo logo após aplicar esta movimentação (snapshot).
    estoque_resultante = Column(Integer, nullable=False)

    # Ex.: compra, venda, perda, inventario, devolucao...
    motivo = Column(String(40), nullable=True)

    # Custo unitário (relevante em entradas de compra).
    custo_unitario = Column(Numeric(12, 2), nullable=True)

    observacao = Column(Text, nullable=True)

    criado_em = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    produto = relationship("Produto")
    variacao = relationship("VariacaoProduto")
    fornecedor = relationship("Fornecedor")
