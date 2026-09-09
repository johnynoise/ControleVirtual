import { api } from "./api";
import type {
  CategoriaDespesaOpcao,
  Despesa,
  DespesaCreate,
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

export async function criarDespesa(dados: DespesaCreate): Promise<Despesa> {
  const { data } = await api.post<Despesa>("/despesas", dados);
  return data;
}

export async function atualizarDespesa(
  id: number,
  dados: DespesaCreate
): Promise<Despesa> {
  const { data } = await api.put<Despesa>(`/despesas/${id}`, dados);
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

export async function removerDespesa(id: number): Promise<void> {
  await api.delete(`/despesas/${id}`);
}
