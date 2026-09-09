"""Schemas Pydantic de Despesa."""
from datetime import date, datetime
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, computed_field, model_validator


class CategoriaDespesa(str, Enum):
    """Categorias de despesa da loja.

    A lista cobre o que costuma aparecer no dia a dia de um comércio. O banco
    guarda o valor como texto, então incluir categorias novas aqui não exige
    migração.
    """

    aluguel = "aluguel"
    condominio = "condominio"
    energia = "energia"
    agua = "agua"
    internet_telefone = "internet_telefone"
    embalagem = "embalagem"
    frete = "frete"
    taxas_cartao = "taxas_cartao"
    tarifas_bancarias = "tarifas_bancarias"
    marketing = "marketing"
    salarios = "salarios"
    pro_labore = "pro_labore"
    impostos = "impostos"
    contador = "contador"
    manutencao = "manutencao"
    material = "material"
    software = "software"
    transporte = "transporte"
    imobilizado = "imobilizado"
    retirada_socio = "retirada_socio"
    outros = "outros"


# Rótulos amigáveis para exibição (a coluna guarda o valor "cru").
ROTULOS_CATEGORIA: dict[str, str] = {
    "aluguel": "Aluguel",
    "condominio": "Condomínio / IPTU",
    "energia": "Energia elétrica",
    "agua": "Água",
    "internet_telefone": "Internet e telefone",
    "embalagem": "Embalagens e sacolas",
    "frete": "Frete e entrega",
    "taxas_cartao": "Taxas de cartão e Pix",
    "tarifas_bancarias": "Tarifas bancárias",
    "marketing": "Marketing e divulgação",
    "salarios": "Salários e encargos",
    "pro_labore": "Pró-labore",
    "impostos": "Impostos e taxas",
    "contador": "Contador",
    "manutencao": "Manutenção e reparos",
    "material": "Material de escritório e limpeza",
    "software": "Sistemas e assinaturas",
    "transporte": "Transporte e combustível",
    "imobilizado": "Compra de bem (equipamento, móvel)",
    "retirada_socio": "Retirada do dono",
    "outros": "Outros",
}

# Categorias que são saída de dinheiro mas não despesa operacional do período:
# retirada do dono é distribuição de resultado, e a compra de um bem vira
# patrimônio (se deprecia ao longo dos anos, não no mês da compra).
CATEGORIAS_NAO_OPERACIONAIS = frozenset({"retirada_socio", "imobilizado"})


def rotulo_categoria(valor: str | None) -> str:
    """Rótulo de exibição da categoria, com fallback para valores desconhecidos."""
    if not valor:
        return "Outros"
    return ROTULOS_CATEGORIA.get(valor, valor.replace("_", " ").capitalize())


class DespesaBase(BaseModel):
    descricao: str = Field(..., min_length=1, max_length=200)
    categoria: CategoriaDespesa
    valor: Decimal = Field(..., gt=0, decimal_places=2)
    data_competencia: date
    data_pagamento: date | None = None
    forma_pagamento: str | None = Field(default=None, max_length=30)
    fornecedor_id: int | None = None
    documento: str | None = Field(default=None, max_length=60)
    operacional: bool = True
    recorrente: bool = False
    observacao: str | None = None


class DespesaCreate(DespesaBase):
    # Mês final da repetição, usado só quando ``recorrente`` é verdadeiro. Vale
    # o mês da data (o dia é ignorado). Nulo = repete até dezembro do ano da
    # competência inicial.
    repetir_ate: date | None = None

    @model_validator(mode="after")
    def _ajustar_operacional(self) -> "DespesaCreate":
        """Pré-marca retirada do dono e compra de bem como não operacionais.

        Só age quando o cliente não mandou ``operacional`` explicitamente, então
        continua sendo possível sobrescrever a marcação.
        """
        if "operacional" not in self.model_fields_set:
            if self.categoria.value in CATEGORIAS_NAO_OPERACIONAIS:
                self.operacional = False
        return self

    @model_validator(mode="after")
    def _validar_repeticao(self) -> "DespesaCreate":
        """Garante que o mês final da repetição não é anterior ao inicial."""
        if self.repetir_ate is None:
            return self
        if not self.recorrente:
            # Sem marcação de despesa fixa, o campo não tem efeito: descarta
            # para não guardar uma intenção que ninguém vai cumprir.
            self.repetir_ate = None
            return self
        inicio = (self.data_competencia.year, self.data_competencia.month)
        if (self.repetir_ate.year, self.repetir_ate.month) < inicio:
            raise ValueError(
                "O mês final da repetição não pode ser anterior ao mês inicial."
            )
        return self


class DespesaUpdate(BaseModel):
    descricao: str | None = Field(default=None, min_length=1, max_length=200)
    categoria: CategoriaDespesa | None = None
    valor: Decimal | None = Field(default=None, gt=0, decimal_places=2)
    data_competencia: date | None = None
    data_pagamento: date | None = None
    forma_pagamento: str | None = Field(default=None, max_length=30)
    fornecedor_id: int | None = None
    documento: str | None = Field(default=None, max_length=60)
    operacional: bool | None = None
    recorrente: bool | None = None
    observacao: str | None = None


class DespesaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    descricao: str
    categoria: str
    valor: Decimal
    data_competencia: date
    data_pagamento: date | None
    forma_pagamento: str | None
    fornecedor_id: int | None
    fornecedor_nome: str | None
    documento: str | None
    operacional: bool
    recorrente: bool
    grupo_recorrencia: str | None
    observacao: str | None
    criado_em: datetime
    atualizado_em: datetime

    @computed_field
    @property
    def categoria_rotulo(self) -> str:
        """Nome amigável da categoria, para a tela não repetir o mapa."""
        return rotulo_categoria(self.categoria)

    @computed_field
    @property
    def paga(self) -> bool:
        """Verdadeiro quando a despesa já foi paga (tem data de pagamento)."""
        return self.data_pagamento is not None


class CategoriaDespesaLinha(BaseModel):
    """Uma linha do resumo por categoria."""

    categoria: str
    categoria_rotulo: str
    quantidade: int
    total: Decimal
    percentual: Decimal


class MesDespesaLinha(BaseModel):
    """Uma linha do resumo mês a mês (competência)."""

    ano: int
    mes: int
    rotulo: str
    quantidade: int
    total: Decimal
    total_operacional: Decimal


class ResumoDespesas(BaseModel):
    """Totais do período, para os cartões da tela e para o relatório fiscal."""

    inicio: date
    fim: date
    quantidade: int
    total: Decimal
    total_operacional: Decimal
    total_nao_operacional: Decimal
    total_pago: Decimal
    total_em_aberto: Decimal
    por_categoria: list[CategoriaDespesaLinha]
    por_mes: list[MesDespesaLinha]


class CategoriaDespesaOpcao(BaseModel):
    """Opção de categoria para montar o select da tela."""

    valor: str
    rotulo: str
    operacional_padrao: bool


class DespesaPagamento(BaseModel):
    """Corpo do endpoint que marca a despesa como paga."""

    data_pagamento: date | None = None


class EscopoRecorrencia(str, Enum):
    """A quais lançamentos de uma despesa fixa a alteração se aplica."""

    esta = "esta"
    esta_e_proximas = "esta_e_proximas"


class DespesaLoteOut(BaseModel):
    """Resposta do lançamento: uma despesa avulsa ou os meses de uma fixa."""

    quantidade: int
    grupo_recorrencia: str | None
    despesas: list[DespesaOut]


class DespesaRemocaoOut(BaseModel):
    """Quantos lançamentos a remoção alcançou."""

    removidas: int
