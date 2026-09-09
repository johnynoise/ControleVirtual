import { api } from "./api";
import type { Defeito, DefeitoResumo, FiltroDefeito } from "../types";

/** Trocas com defeito. Por padrão só as pendentes com o fornecedor. */
export async function listarDefeitos(
  filtro: FiltroDefeito = "pendente"
): Promise<Defeito[]> {
  const { data } = await api.get<Defeito[]>("/defeitos", { params: { filtro } });
  return data;
}

/** Peças e custo parado na fila, mais o total já resolvido. */
export async function obterResumoDefeitos(): Promise<DefeitoResumo> {
  const { data } = await api.get<DefeitoResumo>("/defeitos/resumo");
  return data;
}

/** Dá baixa no acerto com o fornecedor (troca, crédito, recusa...). */
export async function resolverDefeito(
  devolucaoId: number,
  observacao?: string | null
): Promise<Defeito> {
  const { data } = await api.post<Defeito>(`/defeitos/${devolucaoId}/resolver`, {
    observacao: observacao ?? null,
  });
  return data;
}

/** Devolve o defeito para a fila de pendentes (desfaz uma baixa errada). */
export async function reabrirDefeito(devolucaoId: number): Promise<Defeito> {
  const { data } = await api.post<Defeito>(`/defeitos/${devolucaoId}/reabrir`);
  return data;
}
