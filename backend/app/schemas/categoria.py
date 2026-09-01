"""Schemas Pydantic da Categoria e da definição de campos (esquema)."""
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, model_validator


class TipoCampo(str, Enum):
    """Tipos aceitos para um campo dinâmico de categoria."""

    texto = "texto"
    numero = "numero"
    lista = "lista"
    booleano = "booleano"
    data = "data"


class CampoSchema(BaseModel):
    """Definição de um campo que os produtos de uma categoria possuem."""

    chave: str = Field(..., description="Identificador usado no JSON de atributos, ex.: 'tamanho'")
    rotulo: str = Field(..., description="Rótulo exibido no formulário, ex.: 'Tamanho'")
    tipo: TipoCampo = TipoCampo.texto
    opcoes: list[str] | None = Field(
        default=None, description="Opções permitidas quando o tipo é 'lista'"
    )
    obrigatorio: bool = False

    @model_validator(mode="after")
    def _validar_opcoes(self) -> "CampoSchema":
        if self.tipo == TipoCampo.lista and not self.opcoes:
            raise ValueError(f"O campo '{self.chave}' é do tipo lista e precisa de 'opcoes'.")
        if self.tipo != TipoCampo.lista and self.opcoes:
            raise ValueError(f"O campo '{self.chave}' só pode ter 'opcoes' quando o tipo é lista.")
        return self


class CategoriaBase(BaseModel):
    nome: str = Field(..., min_length=1, max_length=120)
    descricao: str | None = None
    campos_schema: list[CampoSchema] = Field(default_factory=list)

    @model_validator(mode="after")
    def _validar_chaves_unicas(self) -> "CategoriaBase":
        chaves = [c.chave for c in self.campos_schema]
        if len(chaves) != len(set(chaves)):
            raise ValueError("Há chaves de campo repetidas no esquema da categoria.")
        return self


class CategoriaCreate(CategoriaBase):
    pass


class CategoriaUpdate(BaseModel):
    nome: str | None = Field(default=None, min_length=1, max_length=120)
    descricao: str | None = None
    campos_schema: list[CampoSchema] | None = None


class CategoriaOut(CategoriaBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    criado_em: datetime
    atualizado_em: datetime
