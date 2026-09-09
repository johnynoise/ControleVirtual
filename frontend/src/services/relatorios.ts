import { api } from "./api";
import type {
  MaisVendidos,
  PeriodoRelatorio,
  RelatorioResultado,
  ResumoEstoque,
  ResumoPeriodo,
  VendaDia,
} from "../types";

/**
 * Traduz o período em query params da API: `{ dias }` vira `?dias=`,
 * `{ inicio, fim }` vira `?inicio=&fim=`.
 */
function params(periodo: PeriodoRelatorio): Record<string, string | number> {
  return "dias" in periodo
    ? { dias: periodo.dias }
    : { inicio: periodo.inicio, fim: periodo.fim };
}

export async function obterResumo(periodo: PeriodoRelatorio): Promise<ResumoPeriodo> {
  const { data } = await api.get<ResumoPeriodo>("/relatorios/resumo", {
    params: params(periodo),
  });
  return data;
}

export async function obterResultado(
  periodo: PeriodoRelatorio
): Promise<RelatorioResultado> {
  const { data } = await api.get<RelatorioResultado>("/relatorios/resultado", {
    params: params(periodo),
  });
  return data;
}

export async function obterVendasPorDia(
  periodo: PeriodoRelatorio
): Promise<VendaDia[]> {
  const { data } = await api.get<VendaDia[]>("/relatorios/vendas-por-dia", {
    params: params(periodo),
  });
  return data;
}

export async function obterMaisVendidos(
  periodo: PeriodoRelatorio,
  limite = 5
): Promise<MaisVendidos> {
  const { data } = await api.get<MaisVendidos>("/relatorios/mais-vendidos", {
    params: { ...params(periodo), limite },
  });
  return data;
}

export async function obterResumoEstoque(): Promise<ResumoEstoque> {
  const { data } = await api.get<ResumoEstoque>("/relatorios/estoque");
  return data;
}

// --- Seção "Relatórios" ---
import type {
  RelatorioComprasFornecedor,
  RelatorioCurvaAbc,
  RelatorioFormaPagamento,
  RelatorioKardex,
  RelatorioRankingClientes,
  RelatorioSemGiro,
} from "../types";

export async function obterFormaPagamento(
  periodo: PeriodoRelatorio
): Promise<RelatorioFormaPagamento> {
  const { data } = await api.get<RelatorioFormaPagamento>(
    "/relatorios/forma-pagamento",
    { params: params(periodo) }
  );
  return data;
}

export async function obterCurvaAbc(
  periodo: PeriodoRelatorio
): Promise<RelatorioCurvaAbc> {
  const { data } = await api.get<RelatorioCurvaAbc>("/relatorios/curva-abc", {
    params: params(periodo),
  });
  return data;
}

export async function obterSemGiro(
  periodo: PeriodoRelatorio
): Promise<RelatorioSemGiro> {
  const { data } = await api.get<RelatorioSemGiro>("/relatorios/sem-giro", {
    params: params(periodo),
  });
  return data;
}

export async function obterKardex(
  produtoId: number,
  periodo: PeriodoRelatorio
): Promise<RelatorioKardex> {
  const { data } = await api.get<RelatorioKardex>("/relatorios/kardex", {
    params: { produto_id: produtoId, ...params(periodo) },
  });
  return data;
}

export async function obterRankingClientes(
  periodo: PeriodoRelatorio,
  limite = 20
): Promise<RelatorioRankingClientes> {
  const { data } = await api.get<RelatorioRankingClientes>(
    "/relatorios/ranking-clientes",
    { params: { ...params(periodo), limite } }
  );
  return data;
}

export async function obterComprasFornecedor(
  periodo: PeriodoRelatorio
): Promise<RelatorioComprasFornecedor> {
  const { data } = await api.get<RelatorioComprasFornecedor>(
    "/relatorios/compras-fornecedor",
    { params: params(periodo) }
  );
  return data;
}

// --- Segunda leva de relatórios ---
import type {
  RelatorioClientesInativos,
  RelatorioDescontos,
  RelatorioGiro,
  RelatorioPerdas,
  RelatorioVendasCategoria,
  RelatorioVendasDiaHorario,
} from "../types";

export async function obterVendasDiaHorario(
  periodo: PeriodoRelatorio
): Promise<RelatorioVendasDiaHorario> {
  const { data } = await api.get<RelatorioVendasDiaHorario>(
    "/relatorios/vendas-dia-horario",
    { params: params(periodo) }
  );
  return data;
}

export async function obterDescontos(
  periodo: PeriodoRelatorio
): Promise<RelatorioDescontos> {
  const { data } = await api.get<RelatorioDescontos>("/relatorios/descontos", {
    params: params(periodo),
  });
  return data;
}

export async function obterVendasCategoria(
  periodo: PeriodoRelatorio
): Promise<RelatorioVendasCategoria> {
  const { data } = await api.get<RelatorioVendasCategoria>(
    "/relatorios/vendas-categoria",
    { params: params(periodo) }
  );
  return data;
}

export async function obterPerdas(
  periodo: PeriodoRelatorio
): Promise<RelatorioPerdas> {
  const { data } = await api.get<RelatorioPerdas>("/relatorios/perdas", {
    params: params(periodo),
  });
  return data;
}

export async function obterGiro(
  periodo: PeriodoRelatorio
): Promise<RelatorioGiro> {
  const { data } = await api.get<RelatorioGiro>("/relatorios/giro", {
    params: params(periodo),
  });
  return data;
}

/**
 * Clientes inativos. Aqui `dias` é a janela de inatividade contada de hoje,
 * não um recorte de período — por isso não usa `PeriodoRelatorio`.
 */
export async function obterClientesInativos(
  dias: number
): Promise<RelatorioClientesInativos> {
  const { data } = await api.get<RelatorioClientesInativos>(
    "/relatorios/clientes-inativos",
    { params: { dias } }
  );
  return data;
}
