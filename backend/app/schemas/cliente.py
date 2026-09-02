"""Schemas Pydantic de Cliente."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ClienteBase(BaseModel):
    nome: str = Field(..., min_length=1, max_length=200)
    telefone: str | None = Field(default=None, max_length=30)
    email: str | None = Field(default=None, max_length=120)
    ativo: bool = True


class ClienteCreate(ClienteBase):
    pass


class ClienteUpdate(BaseModel):
    nome: str | None = Field(default=None, min_length=1, max_length=200)
    telefone: str | None = Field(default=None, max_length=30)
    email: str | None = Field(default=None, max_length=120)
    ativo: bool | None = None


class ClienteOut(ClienteBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    criado_em: datetime
    atualizado_em: datetime
