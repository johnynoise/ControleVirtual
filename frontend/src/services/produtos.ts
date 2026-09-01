import { api } from "./api";
import type { Produto, ProdutoCreate } from "../types";

export async function listarProdutos(params?: {
  categoria_id?: number;
  apenas_ativos?: boolean;
}): Promise<Produto[]> {
  const { data } = await api.get<Produto[]>("/produtos", { params });
  return data;
}

export async function obterProduto(id: number): Promise<Produto> {
  const { data } = await api.get<Produto>(`/produtos/${id}`);
  return data;
}

export async function criarProduto(dados: ProdutoCreate): Promise<Produto> {
  const { data } = await api.post<Produto>("/produtos", dados);
  return data;
}

export async function atualizarProduto(
  id: number,
  dados: Partial<ProdutoCreate>
): Promise<Produto> {
  const { data } = await api.put<Produto>(`/produtos/${id}`, dados);
  return data;
}

export async function removerProduto(id: number): Promise<void> {
  await api.delete(`/produtos/${id}`);
}
