import { api } from "./api";
import type {
  CategoriaDespesaOpcao,
  Despesa,
  DespesaCreate,
  DespesaLoteCriada,
  EscopoRecorrencia,
  FiltrosDespesa,
  ResumoDespesas,
} from "../types";

export async function listarDespesas(filtros?: FiltrosDespesa): Promise<Despesa[]> {
  const { data } = await api.get<Despesa[]>("/despesas", { params: filtros });
  return data;
}

export async function obterResumoDespesas(
  filtros?: FiltrosDespesa
): Promise<ResumoDespesas> {
  const { data } = await api.get<ResumoDespesas>("/despesas/resumo", { params: filtros });
  return data;
}

export async function listarCategoriasDespesa(): Promise<CategoriaDespesaOpcao[]> {
  const { data } = await api.get<CategoriaDespesaOpcao[]>("/despesas/categorias");
  return data;
}

/**
 * Lança a despesa. Avulsa devolve um lançamento; fixa mensal devolve um por
 * mês, do mês da competência até o limite da repetição.
 */
export async function criarDespesa(dados: DespesaCreate): Promise<DespesaLoteCriada> {
  const { data } = await api.post<DespesaLoteCriada>("/despesas", dados);
  return data;
}

/** Edita a despesa. Com escopo "esta_e_proximas", alcança os meses seguintes. */
export async function atualizarDespesa(
  id: number,
  dados: DespesaCreate,
  escopo: EscopoRecorrencia = "esta"
): Promise<Despesa> {
  const { data } = await api.put<Despesa>(`/despesas/${id}`, dados, {
    params: { escopo },
  });
  return data;
}

/** Marca a despesa como paga. Sem data, o backend usa hoje. */
export async function pagarDespesa(
  id: number,
  data_pagamento?: string | null
): Promise<Despesa> {
  const { data } = await api.post<Despesa>(`/despesas/${id}/pagar`, {
    data_pagamento: data_pagamento ?? null,
  });
  return data;
}

/**
 * Remove a despesa e devolve quantos lançamentos foram apagados. Com escopo
 * "esta_e_proximas", leva também os meses seguintes do mesmo grupo.
 */
export async function removerDespesa(
  id: number,
  escopo: EscopoRecorrencia = "esta"
): Promise<number> {
  const { data } = await api.delete<{ removidas: number }>(`/despesas/${id}`, {
    params: { escopo },
  });
  return data.removidas;
}
