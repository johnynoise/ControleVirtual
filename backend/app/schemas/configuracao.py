"""Schemas Pydantic da Configuração da loja."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ConfiguracaoUpdate(BaseModel):
    """Todos os campos opcionais: o cliente envia só o que quer alterar."""

    nome_loja: str | None = Field(default=None, min_length=1, max_length=120)
    cor: str | None = Field(default=None, max_length=20)
    logo: str | None = Field(default=None)  # data URL base64 ou null para remover
    documento: str | None = Field(default=None, max_length=30)
    telefone: str | None = Field(default=None, max_length=30)
    endereco: str | None = Field(default=None, max_length=200)
    email: str | None = Field(default=None, max_length=120)
    recibo_rodape: str | None = Field(default=None, max_length=200)


class ConfiguracaoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nome_loja: str
    cor: str
    logo: str | None = None
    documento: str | None = None
    telefone: str | None = None
    endereco: str | None = None
    email: str | None = None
    recibo_rodape: str | None = None
    atualizado_em: datetime
