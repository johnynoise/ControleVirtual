"""Endpoints de relatórios (dashboard)."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.crud import relatorio as crud_relatorio
from app.database import get_db
from app.schemas.relatorio import (
    MaisVendidos,
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
