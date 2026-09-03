"""Endpoints de Vendas (PDV).

A venda é registrada de forma transacional e imutável: ao criar, o estoque é
baixado e movimentações de saída são geradas. Não há edição/exclusão; para
corrigir, registre um ajuste de estoque ou uma nova operação.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.crud import venda as crud_venda
from app.crud.venda import ErroVenda
from app.database import get_db
from app.schemas.venda import (
    ContaReceberLinha,
    DevolucaoRequest,
    EstornoRequest,
    PagamentoCreate,
    VendaCreate,
    VendaOut,
)

router = APIRouter(prefix="/vendas", tags=["Vendas"])


@router.get("", response_model=list[VendaOut])
def listar_vendas(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud_venda.listar(db, skip=skip, limit=limit)


@router.get("/contas-a-receber", response_model=list[ContaReceberLinha])
def listar_contas_a_receber(db: Session = Depends(get_db)):
    """Saldo devedor em aberto por cliente (vendas a prazo/fiado)."""
    return crud_venda.contas_a_receber(db)


@router.get("/{venda_id}", response_model=VendaOut)
def obter_venda(venda_id: int, db: Session = Depends(get_db)):
    venda = crud_venda.obter(db, venda_id)
    if venda is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Venda não encontrada.")
    return venda


@router.post("", response_model=VendaOut, status_code=status.HTTP_201_CREATED)
def criar_venda(dados: VendaCreate, db: Session = Depends(get_db)):
    try:
        return crud_venda.criar(db, dados)
    except ErroVenda as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc


@router.post("/{venda_id}/estornar", response_model=VendaOut)
def estornar_venda(
    venda_id: int,
    dados: EstornoRequest | None = None,
    db: Session = Depends(get_db),
):
    """Estorna uma venda: devolve o estoque e a marca como cancelada."""
    try:
        venda = crud_venda.estornar(db, venda_id, dados.motivo if dados else None)
    except ErroVenda as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    if venda is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Venda não encontrada.")
    return venda


@router.post("/{venda_id}/devolver", response_model=VendaOut)
def devolver_venda(
    venda_id: int,
    dados: DevolucaoRequest,
    db: Session = Depends(get_db),
):
    """Devolve itens de uma venda (parcial ou total), ajustando estoque e totais."""
    try:
        venda = crud_venda.devolver(db, venda_id, dados)
    except ErroVenda as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    if venda is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Venda não encontrada.")
    return venda


@router.post("/{venda_id}/pagamentos", response_model=VendaOut, status_code=status.HTTP_201_CREATED)
def registrar_pagamento(
    venda_id: int,
    dados: PagamentoCreate,
    db: Session = Depends(get_db),
):
    """Registra o recebimento (quitação parcial ou total) de uma venda a prazo."""
    try:
        venda = crud_venda.registrar_pagamento(db, venda_id, dados)
    except ErroVenda as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    if venda is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Venda não encontrada.")
    return venda
