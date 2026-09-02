"""Endpoints de relatórios (dashboard)."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.crud import relatorio as crud_relatorio
from app.database import get_db
from app.schemas.relatorio import (
    MaisVendidos,
    RelatorioClientesInativos,
    RelatorioComprasFornecedor,
    RelatorioCurvaAbc,
    RelatorioDescontos,
    RelatorioFormaPagamento,
    RelatorioGiro,
    RelatorioKardex,
    RelatorioPerdas,
    RelatorioRankingClientes,
    RelatorioSemGiro,
    RelatorioVendasCategoria,
    RelatorioVendasDiaHorario,
    ResumoEstoque,
    ResumoPeriodo,
    VendaDia,
)

router = APIRouter(prefix="/relatorios", tags=["Relatórios"])


@router.get("/resumo", response_model=ResumoPeriodo)
def resumo_periodo(dias: int = Query(default=30, ge=1, le=365), db: Session = Depends(get_db)):
    return crud_relatorio.resumo(db, dias)


@router.get("/vendas-por-dia", response_model=list[VendaDia])
def vendas_por_dia(dias: int = Query(default=30, ge=1, le=365), db: Session = Depends(get_db)):
    return crud_relatorio.vendas_por_dia(db, dias)


@router.get("/mais-vendidos", response_model=MaisVendidos)
def mais_vendidos(
    dias: int = Query(default=30, ge=1, le=365),
    limite: int = Query(default=5, ge=1, le=50),
    db: Session = Depends(get_db),
):
    return crud_relatorio.mais_vendidos(db, dias, limite)


@router.get("/estoque", response_model=ResumoEstoque)
def resumo_estoque(db: Session = Depends(get_db)):
    return crud_relatorio.estoque(db)


@router.get("/forma-pagamento", response_model=RelatorioFormaPagamento)
def relatorio_forma_pagamento(
    dias: int = Query(default=30, ge=1, le=365), db: Session = Depends(get_db)
):
    return crud_relatorio.vendas_por_forma_pagamento(db, dias)


@router.get("/curva-abc", response_model=RelatorioCurvaAbc)
def relatorio_curva_abc(
    dias: int = Query(default=30, ge=1, le=365), db: Session = Depends(get_db)
):
    return crud_relatorio.curva_abc(db, dias)


@router.get("/sem-giro", response_model=RelatorioSemGiro)
def relatorio_sem_giro(
    dias: int = Query(default=30, ge=1, le=365), db: Session = Depends(get_db)
):
    return crud_relatorio.produtos_sem_giro(db, dias)


@router.get("/kardex", response_model=RelatorioKardex)
def relatorio_kardex(
    produto_id: int = Query(..., ge=1),
    dias: int = Query(default=90, ge=1, le=365),
    db: Session = Depends(get_db),
):
    return crud_relatorio.kardex(db, produto_id, dias)


@router.get("/ranking-clientes", response_model=RelatorioRankingClientes)
def relatorio_ranking_clientes(
    dias: int = Query(default=30, ge=1, le=365),
    limite: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return crud_relatorio.ranking_clientes(db, dias, limite)


@router.get("/compras-fornecedor", response_model=RelatorioComprasFornecedor)
def relatorio_compras_fornecedor(
    dias: int = Query(default=30, ge=1, le=365), db: Session = Depends(get_db)
):
    return crud_relatorio.compras_por_fornecedor(db, dias)


@router.get("/vendas-dia-horario", response_model=RelatorioVendasDiaHorario)
def relatorio_vendas_dia_horario(
    dias: int = Query(default=30, ge=1, le=365), db: Session = Depends(get_db)
):
    return crud_relatorio.vendas_por_dia_semana_horario(db, dias)


@router.get("/descontos", response_model=RelatorioDescontos)
def relatorio_descontos(
    dias: int = Query(default=30, ge=1, le=365), db: Session = Depends(get_db)
):
    return crud_relatorio.descontos(db, dias)


@router.get("/vendas-categoria", response_model=RelatorioVendasCategoria)
def relatorio_vendas_categoria(
    dias: int = Query(default=30, ge=1, le=365), db: Session = Depends(get_db)
):
    return crud_relatorio.vendas_por_categoria(db, dias)


@router.get("/perdas", response_model=RelatorioPerdas)
def relatorio_perdas(
    dias: int = Query(default=30, ge=1, le=365), db: Session = Depends(get_db)
):
    return crud_relatorio.perdas_e_ajustes(db, dias)


@router.get("/giro", response_model=RelatorioGiro)
def relatorio_giro(
    dias: int = Query(default=30, ge=1, le=365), db: Session = Depends(get_db)
):
    return crud_relatorio.giro_e_cobertura(db, dias)


@router.get("/clientes-inativos", response_model=RelatorioClientesInativos)
def relatorio_clientes_inativos(
    dias: int = Query(default=60, ge=1, le=365), db: Session = Depends(get_db)
):
    return crud_relatorio.clientes_inativos(db, dias)
