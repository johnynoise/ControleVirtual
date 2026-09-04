"""Geração do recibo de venda em PDF.

Reproduz, em PDF, o mesmo recibo que o frontend exibe/imprime (ver
``frontend/src/components/Recibo.tsx``). Usa fpdf2 (puro Python), então não
depende de nada instalado no sistema operacional.
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from fpdf import FPDF

from app.config import settings
from app.schemas.venda import VendaOut

# Rótulos das formas de pagamento (espelha o PAGAMENTO_LABEL do frontend).
PAGAMENTO_LABEL: dict[str, str] = {
    "dinheiro": "Dinheiro",
    "pix": "PIX",
    "cartao_credito": "Cartao de credito",
    "cartao_debito": "Cartao de debito",
    "fiado": "Fiado (a prazo)",
    "outro": "Outro",
}

# Largura útil do recibo (estilo cupom estreito), em milímetros.
LARGURA_MM = 80
MARGEM_MM = 6
CONTEUDO_MM = LARGURA_MM - 2 * MARGEM_MM


def _brl(valor: Decimal | float | int | None) -> str:
    """Formata um valor como moeda brasileira (R$ 1.234,56)."""
    n = Decimal(str(valor or 0))
    inteiro, _, dec = f"{n:.2f}".partition(".")
    negativo = inteiro.startswith("-")
    inteiro = inteiro.lstrip("-")
    # Agrupa milhares com ponto.
    partes = []
    while len(inteiro) > 3:
        partes.insert(0, inteiro[-3:])
        inteiro = inteiro[:-3]
    partes.insert(0, inteiro)
    milhar = ".".join(partes)
    sinal = "-" if negativo else ""
    return f"R$ {sinal}{milhar},{dec}"


def _data_hora(iso: datetime | str) -> str:
    dt = iso if isinstance(iso, datetime) else datetime.fromisoformat(str(iso))
    return dt.strftime("%d/%m/%Y %H:%M")


def _latin1(texto: str) -> str:
    """Garante que o texto seja representável pelas fontes core (latin-1).

    Substitui caracteres fora do latin-1 (ex.: emoji, traços longos) para
    evitar erro de codificação ao gerar o PDF.
    """
    return texto.encode("latin-1", "replace").decode("latin-1")


class _ReciboPDF(FPDF):
    def linha_divisoria(self) -> None:
        y = self.get_y() + 1
        self.set_draw_color(180, 180, 180)
        self.set_dash_pattern(dash=0.6, gap=0.6)
        self.line(MARGEM_MM, y, MARGEM_MM + CONTEUDO_MM, y)
        self.set_dash_pattern()  # volta ao traço contínuo
        self.set_y(y + 2)

    def par(self, esquerda: str, direita: str, *, negrito: bool = False, tam: int = 9) -> None:
        """Escreve um par rótulo/valor: rótulo à esquerda, valor à direita."""
        self.set_font("Helvetica", "B" if negrito else "", tam)
        largura_dir = 34
        self.cell(CONTEUDO_MM - largura_dir, 5, _latin1(esquerda), align="L")
        self.cell(largura_dir, 5, _latin1(direita), align="R")
        self.ln(5)


def gerar_recibo_pdf(
    venda: VendaOut,
    loja_nome: str | None = None,
    rodape: str | None = None,
) -> bytes:
    """Gera o PDF do recibo de uma venda e devolve os bytes do arquivo.

    ``loja_nome`` e ``rodape`` vêm da configuração da loja; quando ausentes,
    caem para o padrão do ``.env``/texto fixo.
    """
    # Altura generosa; o cupom cresce conforme os itens. Estimativa simples:
    # cabeçalho/rodapé fixos + uma linha por item.
    altura = 90 + len(venda.itens) * 8
    pdf = _ReciboPDF(orientation="P", unit="mm", format=(LARGURA_MM, altura))
    pdf.set_auto_page_break(auto=False)
    pdf.set_margins(MARGEM_MM, MARGEM_MM, MARGEM_MM)
    pdf.add_page()

    # Cabeçalho
    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(CONTEUDO_MM, 6, _latin1(loja_nome or settings.loja_nome), align="C")
    pdf.ln(6)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(CONTEUDO_MM, 5, "Recibo de venda", align="C")
    pdf.ln(6)

    # Informações da venda
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(CONTEUDO_MM, 5, _latin1(f"Venda no {venda.id}"), align="L")
    pdf.ln(5)
    pdf.cell(CONTEUDO_MM, 5, _latin1(_data_hora(venda.criado_em)), align="L")
    pdf.ln(5)
    if venda.cliente_nome:
        pdf.cell(CONTEUDO_MM, 5, _latin1(f"Cliente: {venda.cliente_nome}"), align="L")
        pdf.ln(5)

    if venda.cancelada_em is not None:
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(200, 0, 0)
        pdf.cell(CONTEUDO_MM, 5, "*** VENDA CANCELADA ***", align="C")
        pdf.set_text_color(0, 0, 0)
        pdf.ln(5)

    pdf.linha_divisoria()

    # Itens
    pdf.set_font("Helvetica", "", 9)
    for it in venda.itens:
        # Linha 1: quantidade x nome ......... subtotal
        nome = f"{it.quantidade}x {it.produto_nome}"
        pdf.cell(CONTEUDO_MM - 22, 5, _latin1(nome), align="L")
        pdf.cell(22, 5, _latin1(_brl(it.subtotal)), align="R")
        pdf.ln(4.5)
        # Linha 2: preço unitário (menor, cinza)
        pdf.set_font("Helvetica", "", 7)
        pdf.set_text_color(120, 120, 120)
        pdf.cell(CONTEUDO_MM, 4, _latin1(f"{_brl(it.preco_unitario)} un."), align="L")
        pdf.set_text_color(0, 0, 0)
        pdf.set_font("Helvetica", "", 9)
        pdf.ln(4.5)

    pdf.linha_divisoria()

    # Totais
    pdf.par("Subtotal", _brl(venda.total_bruto))
    if Decimal(str(venda.desconto)) > 0:
        pdf.par("Desconto", f"- {_brl(venda.desconto)}")
    pdf.par("Total", _brl(venda.total_liquido), negrito=True, tam=10)
    forma = (
        PAGAMENTO_LABEL.get(venda.forma_pagamento, venda.forma_pagamento)
        if venda.forma_pagamento
        else "-"
    )
    pdf.par("Pagamento", forma)

    if venda.a_prazo and venda.cancelada_em is None:
        if Decimal(str(venda.total_pago)) > 0:
            pdf.par("Ja pago", _brl(venda.total_pago))
        if venda.quitada:
            pdf.par("Quitado", "OK", negrito=True)
        else:
            pdf.par("Saldo devedor", _brl(venda.saldo_devedor), negrito=True)

    pdf.linha_divisoria()

    pdf.set_font("Helvetica", "", 9)
    pdf.cell(CONTEUDO_MM, 5, _latin1(rodape or "Obrigado pela preferencia!"), align="C")

    saida = pdf.output()
    return bytes(saida)
