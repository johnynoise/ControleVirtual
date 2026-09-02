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
  dias: number
): Promise<RelatorioFormaPagamento> {
  const { data } = await api.get<RelatorioFormaPagamento>(
    "/relatorios/forma-pagamento",
    { params: { dias } }
  );
  return data;
}

export async function obterCurvaAbc(dias: number): Promise<RelatorioCurvaAbc> {
  const { data } = await api.get<RelatorioCurvaAbc>("/relatorios/curva-abc", {
    params: { dias },
  });
  return data;
}

export async function obterSemGiro(dias: number): Promise<RelatorioSemGiro> {
  const { data } = await api.get<RelatorioSemGiro>("/relatorios/sem-giro", {
    params: { dias },
  });
  return data;
}

export async function obterKardex(
  produtoId: number,
  dias: number
): Promise<RelatorioKardex> {
  const { data } = await api.get<RelatorioKardex>("/relatorios/kardex", {
    params: { produto_id: produtoId, dias },
  });
  return data;
}

export async function obterRankingClientes(
  dias: number,
  limite = 20
): Promise<RelatorioRankingClientes> {
  const { data } = await api.get<RelatorioRankingClientes>(
    "/relatorios/ranking-clientes",
    { params: { dias, limite } }
  );
  return data;
}

export async function obterComprasFornecedor(
  dias: number
): Promise<RelatorioComprasFornecedor> {
  const { data } = await api.get<RelatorioComprasFornecedor>(
    "/relatorios/compras-fornecedor",
    { params: { dias } }
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
  dias: number
): Promise<RelatorioVendasDiaHorario> {
  const { data } = await api.get<RelatorioVendasDiaHorario>(
    "/relatorios/vendas-dia-horario",
    { params: { dias } }
  );
  return data;
}

export async function obterDescontos(
  dias: number
): Promise<RelatorioDescontos> {
  const { data } = await api.get<RelatorioDescontos>("/relatorios/descontos", {
    params: { dias },
  });
  return data;
}

export async function obterVendasCategoria(
  dias: number
): Promise<RelatorioVendasCategoria> {
  const { data } = await api.get<RelatorioVendasCategoria>(
    "/relatorios/vendas-categoria",
    { params: { dias } }
  );
  return data;
}

export async function obterPerdas(dias: number): Promise<RelatorioPerdas> {
  const { data } = await api.get<RelatorioPerdas>("/relatorios/perdas", {
    params: { dias },
  });
  return data;
}

export async function obterGiro(dias: number): Promise<RelatorioGiro> {
  const { data } = await api.get<RelatorioGiro>("/relatorios/giro", {
    params: { dias },
  });
  return data;
}

export async function obterClientesInativos(
  dias: number
): Promise<RelatorioClientesInativos> {
  const { data } = await api.get<RelatorioClientesInativos>(
    "/relatorios/clientes-inativos",
    { params: { dias } }
  );
  return data;
}
