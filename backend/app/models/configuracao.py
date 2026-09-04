"""Model da configuração da loja (personalização).

Tabela de linha única (id fixo = 1) com os dados que o lojista pode
personalizar: nome, logo, cor de destaque e dados para o recibo.
"""
from sqlalchemy import Column, DateTime, Integer, String, Text, func

from app.database import Base


class Configuracao(Base):
    __tablename__ = "configuracao"

    id = Column(Integer, primary_key=True, index=True)

    # Identidade (Fase 1)
    nome_loja = Column(String(120), nullable=False, default="ControleVirtual")
    cor = Column(String(20), nullable=False, default="#2f6bff")
    # Logo em data URL base64 (ex.: "data:image/png;base64,....").
    logo = Column(Text, nullable=True)

    # Dados do negócio para o recibo (Fase 2 — já disponíveis no schema)
    documento = Column(String(30), nullable=True)
    telefone = Column(String(30), nullable=True)
    endereco = Column(String(200), nullable=True)
    email = Column(String(120), nullable=True)
    recibo_rodape = Column(String(200), nullable=True)

    atualizado_em = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
