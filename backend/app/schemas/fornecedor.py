"""Schemas Pydantic de Fornecedor."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class FornecedorBase(BaseModel):
    nome: str = Field(..., min_length=1, max_length=200)
    nome_fantasia: str | None = Field(default=None, max_length=200)
    documento: str | None = Field(default=None, max_length=20)
    email: str | None = Field(default=None, max_length=120)
    telefone: str | None = Field(default=None, max_length=30)
    contato: str | None = Field(default=None, max_length=120)
    endereco: str | None = Field(default=None, max_length=200)
    cidade: str | None = Field(default=None, max_length=120)
    estado: str | None = Field(default=None, max_length=2)
    observacao: str | None = None
    ativo: bool = True


class FornecedorCreate(FornecedorBase):
    pass


class FornecedorUpdate(BaseModel):
    nome: str | None = Field(default=None, min_length=1, max_length=200)
    nome_fantasia: str | None = Field(default=None, max_length=200)
    documento: str | None = Field(default=None, max_length=20)
    email: str | None = Field(default=None, max_length=120)
    telefone: str | None = Field(default=None, max_length=30)
    contato: str | None = Field(default=None, max_length=120)
    endereco: str | None = Field(default=None, max_length=200)
    cidade: str | None = Field(default=None, max_length=120)
    estado: str | None = Field(default=None, max_length=2)
    observacao: str | None = None
    ativo: bool | None = None


class FornecedorOut(FornecedorBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    criado_em: datetime
    atualizado_em: datetime
