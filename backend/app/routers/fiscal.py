"""Endpoints do relatório fiscal consolidado.

O recorte padrão é o ano-calendário (``?ano=2025``), que é o que interessa para
a declaração. Também aceita um intervalo livre (``?inicio=&fim=``) para fechar
um trimestre ou um mês.
"""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.crud import fiscal as crud_fiscal
from app.crud.relatorio import Periodo, periodo_entre
from app.database import get_db
from app.schemas.fiscal import RelatorioFiscal

router = APIRouter(prefix="/relatorios/fiscal", tags=["Relatório fiscal"])

# Primeiro ano aceito. Só existe para barrar erro de digitação no ano.
_ANO_MINIMO = 2000


def periodo_fiscal(
    ano: int | None = Query(
        default=None,
        description="Ano-calendário do relatório. Padrão: ano corrente.",
    ),
    inicio: date | None = Query(
        default=None, description="Início de um intervalo livre (tem prioridade sobre o ano)."
    ),
    fim: date | None = Query(default=None, description="Fim do intervalo, incluído."),
) -> Periodo:
    """Resolve o período: intervalo livre quando informado, senão o ano inteiro."""
    if inicio is not None or fim is not None:
        if inicio is None or fim is None:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Para um intervalo, informe início e fim.",
            )
        if fim < inicio:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "A data final do período não pode ser anterior à inicial.",
            )
        return periodo_entre(inicio, fim)

    ano_final = ano if ano is not None else date.today().year
    if ano_final < _ANO_MINIMO or ano_final > date.today().year + 1:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Ano fora do intervalo aceito.")
    return periodo_entre(date(ano_final, 1, 1), date(ano_final, 12, 31))


@router.get("/anos", response_model=list[int])
def listar_anos(db: Session = Depends(get_db)):
    """Anos que têm venda ou despesa lançada (para o seletor da tela)."""
    return crud_fiscal.anos_com_dados(db)


@router.get("", response_model=RelatorioFiscal)
def relatorio_fiscal(
    periodo: Periodo = Depends(periodo_fiscal), db: Session = Depends(get_db)
):
    return crud_fiscal.relatorio_anual(db, periodo)
