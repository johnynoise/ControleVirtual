"""Models de Produto e Variação de Produto (grade).

O produto guarda em colunas fixas tudo que é comum a qualquer item (nome,
SKU, preços, estoque) e, no campo ``atributos`` (JSONB), o que varia conforme
a categoria (tamanho, cor, voltagem, capacidade...).

A VariacaoProduto trata da "grade": a mesma camiseta em P/M/G, cada uma com
estoque próprio. Produtos simples (sem grade) usam o estoque do próprio produto.
"""
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

from app.database import Base, JSONType


class Produto(Base):
    __tablename__ = "produtos"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(200), nullable=False)
    sku = Column(String(60), unique=True, nullable=True, index=True)
    codigo_barras = Column(String(60), unique=True, nullable=True, index=True)
    descricao = Column(Text, nullable=True)

    categoria_id = Column(
        Integer, ForeignKey("categorias.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    preco_custo = Column(Numeric(12, 2), nullable=False, default=0)
    preco_venda = Column(Numeric(12, 2), nullable=False, default=0)

    # Estoque do produto simples (sem grade). Quando há variações, o estoque
    # relevante é o de cada variação.
    estoque = Column(Integer, nullable=False, default=0)
    estoque_minimo = Column(Integer, nullable=False, default=0)

    # Atributos específicos da categoria (valida contra categoria.campos_schema).
    atributos = Column(JSONType, nullable=False, default=dict)

    ativo = Column(Boolean, nullable=False, default=True)

    criado_em = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    atualizado_em = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    categoria = relationship("Categoria", back_populates="produtos")
    variacoes = relationship(
        "VariacaoProduto",
        back_populates="produto",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class VariacaoProduto(Base):
    __tablename__ = "variacoes_produto"

    id = Column(Integer, primary_key=True, index=True)
    produto_id = Column(
        Integer, ForeignKey("produtos.id", ondelete="CASCADE"), nullable=False, index=True
    )

    sku = Column(String(60), unique=True, nullable=True, index=True)
    codigo_barras = Column(String(60), unique=True, nullable=True, index=True)

    # Combinação que define a variação, ex.: {"tamanho": "M", "cor": "azul"}
    atributos = Column(JSONType, nullable=False, default=dict)

    # Preço de venda opcional por variação; se nulo, usa o preço do produto.
    preco_venda = Column(Numeric(12, 2), nullable=True)
    estoque = Column(Integer, nullable=False, default=0)

    criado_em = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    atualizado_em = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    produto = relationship("Produto", back_populates="variacoes")
