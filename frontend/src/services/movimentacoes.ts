import { api } from "./api";
import type { Movimentacao, MovimentacaoCreate, TipoMovimentacao } from "../types";

export async function listarMovimentacoes(params?: {
  produto_id?: number;
  tipo?: TipoMovimentacao;
  skip?: number;
  limit?: number;
}): Promise<Movimentacao[]> {
  const { data } = await api.get<Movimentacao[]>("/movimentacoes", { params });
  return data;
}

export async function criarMovimentacao(
  dados: MovimentacaoCreate
): Promise<Movimentacao> {
  const { data } = await api.post<Movimentacao>("/movimentacoes", dados);
  return data;
}
