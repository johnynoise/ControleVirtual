"""Endpoints de relatórios (dashboard).

Todo relatório de período aceita duas formas de recorte, resolvidas pela
dependência ``periodo_param``:

* ``?dias=30`` — os últimos 30 dias, terminando hoje (forma original).
* ``?inicio=2025-01-01&fim=2025-12-31`` — um intervalo de datas fechado, que é
  o que permite fechar um mês ou um ano-calendário.
"""
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.crud import relatorio as crud_relatorio
from app.crud.relatorio import Periodo, periodo_de_dias, periodo_entre
from app.database import get_db
from app.schemas.relatorio import (
    MaisVendidos,
    RelatorioClientesInativos,
    RelatorioComprasFornecedor,
    RelatorioDescontos,
    RelatorioFormaPagamento,
    RelatorioKardex,
    RelatorioPerdas,
    RelatorioProdutosFaturamento,
    RelatorioRankingClientes,
    RelatorioResultado,
    RelatorioSaudeEstoque,
    RelatorioVendasDiaHorario,
    ResumoEstoque,
    ResumoPeriodo,
    VendaDia,
)

router = APIRouter(prefix="/relatorios", tags=["Relatórios"])

# Teto do intervalo explícito (~10 anos). Existe só para evitar que um erro de
# digitação na data peça uma agregação absurda.
_MAX_DIAS_INTERVALO = 3660


def periodo_param(
    dias: int = Query(
        default=30,
        ge=1,
        le=1830,
        description="Últimos N dias (ignorado quando início e fim são informados).",
    ),
    inicio: date | None = Query(
        default=None, description="Primeiro dia do intervalo (YYYY-MM-DD)."
    ),
    fim: date | None = Query(
        default=None, description="Último dia do intervalo, incluído (YYYY-MM-DD)."
    ),
) -> Periodo:
    """Resolve o recorte de tempo do relatório.

    Com ``inicio`` e ``fim``, usa o intervalo. Só ``inicio`` vale como "desta
    data até hoje"; só ``fim`` vale como "os ``dias`` dias que terminam nesta
    data". Sem nenhum dos dois, usa os últimos ``dias`` dias.
    """
    if inicio is None and fim is None:
        return periodo_de_dias(dias)

    if inicio is not None and fim is None:
        fim = date.today()
    elif inicio is None and fim is not None:
        inicio = fim - timedelta(days=max(1, dias) - 1)

    assert inicio is not None and fim is not None  # garantido pelos ramos acima

    if fim < inicio:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "A data final do período não pode ser anterior à inicial.",
        )
    periodo = periodo_entre(inicio, fim)
    if periodo.dias > _MAX_DIAS_INTERVALO:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"O intervalo é muito longo (máximo de {_MAX_DIAS_INTERVALO} dias).",
        )
    return periodo


@router.get("/resumo", response_model=ResumoPeriodo)
def resumo_periodo(
    periodo: Periodo = Depends(periodo_param), db: Session = Depends(get_db)
):
    return crud_relatorio.resumo(db, periodo)


@router.get("/resultado", response_model=RelatorioResultado)
def relatorio_resultado(
    periodo: Periodo = Depends(periodo_param), db: Session = Depends(get_db)
):
    """Apuração do resultado do período, comparada com o período anterior.

    O recorte de comparação é escolhido no ``crud``: mês anterior quando o
    período começa no dia 1º, senão a janela anterior de mesma duração.
    """
    return crud_relatorio.resultado(db, periodo)


@router.get("/vendas-por-dia", response_model=list[VendaDia])
def vendas_por_dia(
    periodo: Periodo = Depends(periodo_param), db: Session = Depends(get_db)
):
    return crud_relatorio.vendas_por_dia(db, periodo)


@router.get("/mais-vendidos", response_model=MaisVendidos)
def mais_vendidos(
    periodo: Periodo = Depends(periodo_param),
    limite: int = Query(default=5, ge=1, le=50),
    db: Session = Depends(get_db),
):
    return crud_relatorio.mais_vendidos(db, periodo, limite=limite)


@router.get("/estoque", response_model=ResumoEstoque)
def resumo_estoque(db: Session = Depends(get_db)):
    return crud_relatorio.estoque(db)


@router.get("/forma-pagamento", response_model=RelatorioFormaPagamento)
def relatorio_forma_pagamento(
    periodo: Periodo = Depends(periodo_param), db: Session = Depends(get_db)
):
    return crud_relatorio.vendas_por_forma_pagamento(db, periodo)


@router.get("/produtos-faturamento", response_model=RelatorioProdutosFaturamento)
def relatorio_produtos_faturamento(
    periodo: Periodo = Depends(periodo_param), db: Session = Depends(get_db)
):
    """De onde vem o faturamento, por produto (com curva ABC) e por categoria.

    Substitui os antigos ``/curva-abc`` e ``/vendas-categoria``: eram a mesma
    medida em dois grãos, e só um deles trazia o lucro.
    """
    return crud_relatorio.produtos_faturamento(db, periodo)


@router.get("/saude-estoque", response_model=RelatorioSaudeEstoque)
def relatorio_saude_estoque(
    periodo: Periodo = Depends(periodo_param), db: Session = Depends(get_db)
):
    """O que vai faltar e o que está parado, num só relatório.

    Substitui os antigos ``/sem-giro`` e ``/giro``: as duas perguntas saíam do
    mesmo cálculo e listavam os mesmos produtos.
    """
    return crud_relatorio.saude_estoque(db, periodo)


@router.get("/kardex", response_model=RelatorioKardex)
def relatorio_kardex(
    produto_id: int = Query(..., ge=1),
    periodo: Periodo = Depends(periodo_param),
    db: Session = Depends(get_db),
):
    return crud_relatorio.kardex(db, produto_id, periodo)


@router.get("/ranking-clientes", response_model=RelatorioRankingClientes)
def relatorio_ranking_clientes(
    periodo: Periodo = Depends(periodo_param),
    limite: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return crud_relatorio.ranking_clientes(db, periodo, limite=limite)


@router.get("/compras-fornecedor", response_model=RelatorioComprasFornecedor)
def relatorio_compras_fornecedor(
    periodo: Periodo = Depends(periodo_param), db: Session = Depends(get_db)
):
    return crud_relatorio.compras_por_fornecedor(db, periodo)


@router.get("/vendas-dia-horario", response_model=RelatorioVendasDiaHorario)
def relatorio_vendas_dia_horario(
    periodo: Periodo = Depends(periodo_param), db: Session = Depends(get_db)
):
    return crud_relatorio.vendas_por_dia_semana_horario(db, periodo)


@router.get("/descontos", response_model=RelatorioDescontos)
def relatorio_descontos(
    periodo: Periodo = Depends(periodo_param), db: Session = Depends(get_db)
):
    return crud_relatorio.descontos(db, periodo)


@router.get("/perdas", response_model=RelatorioPerdas)
def relatorio_perdas(
    periodo: Periodo = Depends(periodo_param), db: Session = Depends(get_db)
):
    return crud_relatorio.perdas_e_ajustes(db, periodo)


@router.get("/clientes-inativos", response_model=RelatorioClientesInativos)
def relatorio_clientes_inativos(
    dias: int = Query(default=60, ge=1, le=365), db: Session = Depends(get_db)
):
    """Aqui ``dias`` é a janela de inatividade, não um recorte de período."""
    return crud_relatorio.clientes_inativos(db, dias)
