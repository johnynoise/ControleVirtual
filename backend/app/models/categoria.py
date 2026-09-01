"""Model da tabela de categorias.

Cada categoria define, via ``campos_schema`` (JSONB), quais atributos os
produtos daquela categoria possuem. É isso que permite ao formulário do
frontend se montar dinamicamente conforme a categoria escolhida.
"""
from sqlalchemy import Column, DateTime, Integer, String, Text, func
from sqlalchemy.orm import relationship

from app.database import Base, JSONType


class Categoria(Base):
    __tablename__ = "categorias"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(120), nullable=False, unique=True)
    descricao = Column(Text, nullable=True)

    # Lista de definições de campos que os produtos desta categoria terão.
    # Exemplo:
    # [
    #   {"chave": "tamanho", "rotulo": "Tamanho", "tipo": "lista",
    #    "opcoes": ["P", "M", "G", "GG"], "obrigatorio": true},
    #   {"chave": "cor", "rotulo": "Cor", "tipo": "texto", "obrigatorio": false}
    # ]
    campos_schema = Column(JSONType, nullable=False, default=list)

    criado_em = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    atualizado_em = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    produtos = relationship("Produto", back_populates="categoria")
