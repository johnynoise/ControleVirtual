import { api } from "./api";
import type {
  MaisVendidos,
  ResumoEstoque,
  ResumoPeriodo,
  VendaDia,
} from "../types";

export async function obterResumo(dias: number): Promise<ResumoPeriodo> {
  const { data } = await api.get<ResumoPeriodo>("/relatorios/resumo", {
    params: { dias },
  });
  return data;
}

export async function obterVendasPorDia(dias: number): Promise<VendaDia[]> {
  const { data } = await api.get<VendaDia[]>("/relatorios/vendas-por-dia", {
    params: { dias },
  });
  return data;
}

export async function obterMaisVendidos(
  dias: number,
  limite = 5
): Promise<MaisVendidos> {
  const { data } = await api.get<MaisVendidos>("/relatorios/mais-vendidos", {
    params: { dias, limite },
  });
  return data;
}

export async function obterResumoEstoque(): Promise<ResumoEstoque> {
  const { data } = await api.get<ResumoEstoque>("/relatorios/estoque");
  return data;
}
