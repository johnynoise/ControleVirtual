"""Schemas Pydantic de Venda e Item de Venda."""
from datetime import date, datetime
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, ConfigDict, EmailStr, Field, computed_field


class FormaPagamento(str, Enum):
    dinheiro = "dinheiro"
    cartao_credito = "cartao_credito"
    cartao_debito = "cartao_debito"
    pix = "pix"
    fiado = "fiado"
    outro = "outro"


class FormaPagamentoRecebimento(str, Enum):
    """Formas aceitas ao receber (quitar) uma venda a prazo — sem "fiado"."""

    dinheiro = "dinheiro"
    cartao_credito = "cartao_credito"
    cartao_debito = "cartao_debito"
    pix = "pix"
    outro = "outro"


# --------------------------------------------------------------------------- #
# Itens
# --------------------------------------------------------------------------- #
class ItemVendaCreate(BaseModel):
    produto_id: int
    quantidade: int = Field(..., gt=0)
    # Se não informado, usa o preço de venda atual do produto.
    preco_unitario: Decimal | None = Field(default=None, ge=0)


class ItemVendaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    produto_id: int | None
    produto_nome: str
    quantidade: int
    preco_unitario: Decimal
    custo_unitario: Decimal
    subtotal: Decimal

    @computed_field
    @property
    def lucro(self) -> Decimal:
        """Lucro do item: (preço - custo) * quantidade."""
        return (self.preco_unitario - self.custo_unitario) * self.quantidade


# --------------------------------------------------------------------------- #
# Venda
# --------------------------------------------------------------------------- #
class ParcelaCreate(BaseModel):
    """Uma parcela do plano de parcelamento de uma venda a prazo (fiado)."""

    numero: int = Field(..., ge=1, le=3)
    valor: Decimal = Field(..., gt=0)
    vencimento: date


class VendaCreate(BaseModel):
    cliente_id: int | None = None
    cliente_nome: str | None = Field(default=None, max_length=200)
    forma_pagamento: FormaPagamento | None = None
    desconto: Decimal = Field(default=Decimal("0"), ge=0)
    observacao: str | None = None
    itens: list[ItemVendaCreate] = Field(..., min_length=1)
    # Plano de parcelamento (apenas para vendas a prazo/fiado). Máximo de 3
    # parcelas. Se omitido em uma venda fiada, assume pagamento em parcela única.
    parcelas: list[ParcelaCreate] = Field(default_factory=list, max_length=3)
    # Delivery: quando True, a venda entra como pedido pendente de entrega (não
    # baixa estoque nem conta em relatórios até a entrega ser confirmada).
    entrega: bool = False
    endereco_entrega: str | None = Field(default=None, max_length=300)


class EstornoRequest(BaseModel):
    """Corpo opcional do estorno, com o motivo do cancelamento."""

    motivo: str | None = Field(default=None, max_length=200)


class MotivoDevolucao(str, Enum):
    defeito = "defeito"
    nao_gostou = "nao_gostou"
    tamanho_errado = "tamanho_errado"
    produto_errado = "produto_errado"
    arrependimento = "arrependimento"
    outro = "outro"


class StatusFornecedor(str, Enum):
    """Situação da peça com defeito no acerto com o fornecedor."""

    pendente = "pendente"
    resolvido = "resolvido"


class ItemDevolucaoRequest(BaseModel):
    item_venda_id: int
    quantidade: int = Field(..., gt=0)


class DevolucaoRequest(BaseModel):
    motivo: MotivoDevolucao
    observacao: str | None = Field(default=None, max_length=300)
    # Peça com defeito: a troca fica registrada como pendente de acerto com o
    # fornecedor (ver ``StatusFornecedor``).
    defeito: bool = False
    itens: list[ItemDevolucaoRequest] = Field(..., min_length=1)


class ItemDevolucaoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    produto_id: int | None
    produto_nome: str
    quantidade: int
    preco_unitario: Decimal
    custo_unitario: Decimal
    subtotal: Decimal


class DevolucaoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    venda_id: int
    motivo: str
    observacao: str | None
    defeito: bool = False
    status_fornecedor: str | None = None
    valor_devolvido: Decimal
    criado_em: datetime
    itens: list[ItemDevolucaoOut] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# Pagamentos (quitações de vendas a prazo / fiado)
# --------------------------------------------------------------------------- #
class PagamentoCreate(BaseModel):
    valor: Decimal = Field(..., gt=0)
    forma_pagamento: FormaPagamentoRecebimento = FormaPagamentoRecebimento.dinheiro
    observacao: str | None = Field(default=None, max_length=300)


class PagamentoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    venda_id: int
    valor: Decimal
    forma_pagamento: str | None
    observacao: str | None
    criado_em: datetime


class ParcelaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    venda_id: int
    numero: int
    valor: Decimal
    vencimento: date


class EnviarReciboRequest(BaseModel):
    """Pedido para enviar o recibo da venda por email.

    Se ``email`` não for informado, usa o email do cliente vinculado à venda.
    """

    email: EmailStr | None = None


class EnviarReciboResponse(BaseModel):
    enviado: bool
    destinatario: EmailStr


class ContaReceberLinha(BaseModel):
    """Saldo devedor em aberto de um cliente (agregado das vendas a prazo)."""

    cliente_id: int | None
    cliente_nome: str
    cliente_telefone: str | None = None
    num_vendas: int
    total_devido: Decimal
    venda_mais_antiga: datetime
    # Parcelas em atraso (vencimento já passou e ainda em aberto).
    parcelas_vencidas: int = 0
    valor_vencido: Decimal = Decimal("0.00")


class VendaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    cliente_id: int | None
    cliente_nome: str | None
    forma_pagamento: str | None
    total_bruto: Decimal
    desconto: Decimal
    total_liquido: Decimal
    custo_total: Decimal
    lucro: Decimal
    observacao: str | None
    criado_em: datetime
    cancelada_em: datetime | None = None
    motivo_cancelamento: str | None = None
    entrega_status: str | None = None
    entregue_em: datetime | None = None
    endereco_entrega: str | None = None
    itens: list[ItemVendaOut] = Field(default_factory=list)
    devolucoes: list["DevolucaoOut"] = Field(default_factory=list)
    pagamentos: list["PagamentoOut"] = Field(default_factory=list)
    parcelas: list["ParcelaOut"] = Field(default_factory=list)

    @computed_field
    @property
    def margem_percentual(self) -> Decimal:
        """Margem da venda: lucro / total_liquido * 100."""
        if self.total_liquido <= 0:
            return Decimal("0")
        return (self.lucro / self.total_liquido * 100).quantize(Decimal("0.01"))

    @computed_field
    @property
    def a_prazo(self) -> bool:
        """Indica se a venda foi feita no fiado (a prazo)."""
        return self.forma_pagamento == FormaPagamento.fiado.value

    @computed_field
    @property
    def is_delivery(self) -> bool:
        """Verdadeiro para vendas de delivery (com fluxo de entrega)."""
        return self.entrega_status is not None

    @computed_field
    @property
    def entrega_pendente(self) -> bool:
        """Pedido de delivery ainda não entregue (não realizado)."""
        return self.entrega_status == "pendente" and self.cancelada_em is None

    @computed_field
    @property
    def total_pago(self) -> Decimal:
        """Soma dos pagamentos (quitações) registrados para esta venda."""
        return sum((p.valor for p in self.pagamentos), Decimal("0")).quantize(
            Decimal("0.01")
        )

    @computed_field
    @property
    def saldo_devedor(self) -> Decimal:
        """Quanto ainda falta receber. Zero quando a venda não é a prazo.

        Vendas estornadas não têm saldo em aberto. Nunca fica negativo (se o
        cliente pagou mais do que o total após uma devolução, o saldo é zero).
        """
        if not self.a_prazo or self.cancelada_em is not None:
            return Decimal("0.00")
        saldo = Decimal(self.total_liquido) - self.total_pago
        return saldo.quantize(Decimal("0.01")) if saldo > 0 else Decimal("0.00")

    @computed_field
    @property
    def quitada(self) -> bool:
        """Verdadeiro quando a venda a prazo já foi totalmente paga."""
        return self.a_prazo and self.saldo_devedor <= 0
