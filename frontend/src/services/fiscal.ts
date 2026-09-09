import { api } from "./api";
import type { RelatorioFiscal } from "../types";

/** Recorte do relatório fiscal: um ano-calendário ou um intervalo livre. */
export type PeriodoFiscal = { ano: number } | { inicio: string; fim: string };

export async function obterRelatorioFiscal(
  periodo: PeriodoFiscal
): Promise<RelatorioFiscal> {
  const { data } = await api.get<RelatorioFiscal>("/relatorios/fiscal", {
    params: "ano" in periodo ? { ano: periodo.ano } : periodo,
  });
  return data;
}

/** Anos que têm venda ou despesa lançada, para o seletor da tela. */
export async function listarAnosFiscais(): Promise<number[]> {
  const { data } = await api.get<number[]>("/relatorios/fiscal/anos");
  return data;
}
