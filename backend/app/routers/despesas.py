"""Endpoints de Despesas.

O período dos filtros é sempre por ``data_competencia`` (o mês a que a despesa
se refere), que é o recorte usado na apuração do resultado. Quando o período
não é informado, o padrão é o ano-calendário corrente.
"""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.crud import despesa as crud_despesa
from app.crud.despesa import ErroDespesa
from app.database import get_db
from app.schemas.despesa import (
    CATEGORIAS_NAO_OPERACIONAIS,
    ROTULOS_CATEGORIA,
    CategoriaDespesa,
    CategoriaDespesaOpcao,
    DespesaCreate,
    DespesaLoteOut,
    DespesaOut,
    DespesaPagamento,
    DespesaRemocaoOut,
    DespesaUpdate,
    EscopoRecorrencia,
    ResumoDespesas,
)

router = APIRouter(prefix="/despesas", tags=["Despesas"])

# Valores aceitos no filtro de situação.
_SITUACOES = ("paga", "aberta")


def _periodo(inicio: date | None, fim: date | None) -> tuple[date, date]:
    """Resolve o período, com o ano-calendário corrente como padrão."""
    hoje = date.today()
    inicio_final = inicio or date(hoje.year, 1, 1)
    fim_final = fim or date(hoje.year, 12, 31)
    if fim_final < inicio_final:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "A data final do período não pode ser anterior à inicial.",
        )
    return inicio_final, fim_final


def _validar_situacao(situacao: str | None) -> str | None:
    if situacao is None or situacao == "":
        return None
    if situacao not in _SITUACOES:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            'A situação deve ser "paga" ou "aberta".',
        )
    return situacao


@router.get("/categorias", response_model=list[CategoriaDespesaOpcao])
def listar_categorias():
    """Categorias disponíveis, com rótulo pronto para exibição.

    A tela usa isto para montar o select sem duplicar a lista no frontend.
    """
    return [
        {
            "valor": cat.value,
            "rotulo": ROTULOS_CATEGORIA[cat.value],
            "operacional_padrao": cat.value not in CATEGORIAS_NAO_OPERACIONAIS,
        }
        for cat in CategoriaDespesa
    ]


@router.get("/resumo", response_model=ResumoDespesas)
def resumo_despesas(
    inicio: date | None = None,
    fim: date | None = None,
    categoria: CategoriaDespesa | None = None,
    situacao: str | None = None,
    busca: str | None = None,
    db: Session = Depends(get_db),
):
    inicio_final, fim_final = _periodo(inicio, fim)
    return crud_despesa.resumo(
        db,
        inicio=inicio_final,
        fim=fim_final,
        categoria=categoria.value if categoria else None,
        situacao=_validar_situacao(situacao),
        busca=busca,
    )


@router.get("", response_model=list[DespesaOut])
def listar_despesas(
    skip: int = 0,
    limit: int = Query(default=500, ge=1, le=2000),
    inicio: date | None = None,
    fim: date | None = None,
    categoria: CategoriaDespesa | None = None,
    situacao: str | None = None,
    apenas_operacionais: bool = False,
    busca: str | None = None,
    db: Session = Depends(get_db),
):
    inicio_final, fim_final = _periodo(inicio, fim)
    return crud_despesa.listar(
        db,
        skip=skip,
        limit=limit,
        inicio=inicio_final,
        fim=fim_final,
        categoria=categoria.value if categoria else None,
        situacao=_validar_situacao(situacao),
        apenas_operacionais=apenas_operacionais,
        busca=busca,
    )


@router.get("/{despesa_id}", response_model=DespesaOut)
def obter_despesa(despesa_id: int, db: Session = Depends(get_db)):
    despesa = crud_despesa.obter(db, despesa_id)
    if despesa is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Despesa não encontrada.")
    return despesa


@router.post("", response_model=DespesaLoteOut, status_code=status.HTTP_201_CREATED)
def criar_despesa(dados: DespesaCreate, db: Session = Depends(get_db)):
    """Lança uma despesa avulsa ou os meses de uma despesa fixa.

    Com ``recorrente`` verdadeiro, a API cria um lançamento por mês do mês da
    competência até ``repetir_ate`` (padrão: dezembro do mesmo ano). A resposta
    sempre traz a lista, mesmo quando é uma linha só.
    """
    try:
        criadas = crud_despesa.criar(db, dados)
    except ErroDespesa as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return {
        "quantidade": len(criadas),
        "grupo_recorrencia": criadas[0].grupo_recorrencia if criadas else None,
        "despesas": criadas,
    }


@router.put("/{despesa_id}", response_model=DespesaOut)
def atualizar_despesa(
    despesa_id: int,
    dados: DespesaUpdate,
    escopo: EscopoRecorrencia = EscopoRecorrencia.esta,
    db: Session = Depends(get_db),
):
    """Edita a despesa. Com ``escopo=esta_e_proximas``, alcança os meses seguintes.

    A competência e o pagamento nunca são copiados para os outros meses: cada
    lançamento guarda os seus. Meses já passados também ficam intactos.
    """
    despesa = crud_despesa.obter(db, despesa_id)
    if despesa is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Despesa não encontrada.")
    try:
        return crud_despesa.atualizar(db, despesa, dados, escopo=escopo.value)
    except ErroDespesa as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.post("/{despesa_id}/pagar", response_model=DespesaOut)
def pagar_despesa(
    despesa_id: int, dados: DespesaPagamento, db: Session = Depends(get_db)
):
    despesa = crud_despesa.obter(db, despesa_id)
    if despesa is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Despesa não encontrada.")
    try:
        return crud_despesa.marcar_paga(db, despesa, dados.data_pagamento)
    except ErroDespesa as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc


@router.delete("/{despesa_id}", response_model=DespesaRemocaoOut)
def remover_despesa(
    despesa_id: int,
    escopo: EscopoRecorrencia = EscopoRecorrencia.esta,
    db: Session = Depends(get_db),
):
    """Remove a despesa. Com ``escopo=esta_e_proximas``, leva os meses seguintes."""
    despesa = crud_despesa.obter(db, despesa_id)
    if despesa is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Despesa não encontrada.")
    removidas = crud_despesa.remover(db, despesa, escopo=escopo.value)
    return {"removidas": removidas}
