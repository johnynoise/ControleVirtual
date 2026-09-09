"""Schemas Pydantic da Configuração da loja.

O bloco fiscal é todo opcional: quem vende como pessoa física não tem razão
social, CNPJ nem inscrição estadual. Nenhum campo daqui é exigido para usar o
sistema — eles só enriquecem o recibo e o cabeçalho do relatório fiscal.
"""
from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, computed_field


class TipoPessoa(str, Enum):
    fisica = "fisica"
    juridica = "juridica"


class RegimeTributario(str, Enum):
    pessoa_fisica = "pessoa_fisica"
    mei = "mei"
    simples_nacional = "simples_nacional"
    lucro_presumido = "lucro_presumido"
    lucro_real = "lucro_real"


ROTULOS_TIPO_PESSOA: dict[str, str] = {
    "fisica": "Pessoa física",
    "juridica": "Pessoa jurídica",
}

ROTULOS_REGIME: dict[str, str] = {
    "pessoa_fisica": "Pessoa física (sem CNPJ)",
    "mei": "MEI",
    "simples_nacional": "Simples Nacional",
    "lucro_presumido": "Lucro presumido",
    "lucro_real": "Lucro real",
}


def rotulo_regime(valor: str | None) -> str | None:
    """Rótulo de exibição do regime. Nulo quando não informado."""
    if not valor:
        return None
    return ROTULOS_REGIME.get(valor, valor.replace("_", " ").capitalize())


def rotulo_tipo_pessoa(valor: str | None) -> str | None:
    """Rótulo de exibição do tipo de pessoa. Nulo quando não informado."""
    if not valor:
        return None
    return ROTULOS_TIPO_PESSOA.get(valor, valor.capitalize())


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

    # Cadastro fiscal (opcional).
    tipo_pessoa: TipoPessoa | None = None
    razao_social: str | None = Field(default=None, max_length=200)
    inscricao_estadual: str | None = Field(default=None, max_length=30)
    inscricao_municipal: str | None = Field(default=None, max_length=30)
    cnae: str | None = Field(default=None, max_length=20)
    data_abertura: date | None = None
    regime_tributario: RegimeTributario | None = None
    cep: str | None = Field(default=None, max_length=12)
    cidade: str | None = Field(default=None, max_length=120)
    estado: str | None = Field(default=None, max_length=2)
    contador_nome: str | None = Field(default=None, max_length=200)
    contador_contato: str | None = Field(default=None, max_length=200)


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

    tipo_pessoa: str | None = None
    razao_social: str | None = None
    inscricao_estadual: str | None = None
    inscricao_municipal: str | None = None
    cnae: str | None = None
    data_abertura: date | None = None
    regime_tributario: str | None = None
    cep: str | None = None
    cidade: str | None = None
    estado: str | None = None
    contador_nome: str | None = None
    contador_contato: str | None = None

    atualizado_em: datetime

    @computed_field
    @property
    def regime_rotulo(self) -> str | None:
        """Nome amigável do regime, para a tela não repetir o mapa."""
        return rotulo_regime(self.regime_tributario)

    @computed_field
    @property
    def documento_rotulo(self) -> str:
        """Como chamar o campo ``documento`` conforme o tipo de pessoa."""
        if self.tipo_pessoa == "fisica":
            return "CPF"
        if self.tipo_pessoa == "juridica":
            return "CNPJ"
        return "CPF / CNPJ"


class OpcaoConfiguracao(BaseModel):
    """Opção de lista para montar os selects da tela."""

    valor: str
    rotulo: str


class OpcoesConfiguracao(BaseModel):
    """Listas de escolha do cadastro fiscal."""

    tipos_pessoa: list[OpcaoConfiguracao]
    regimes_tributarios: list[OpcaoConfiguracao]
