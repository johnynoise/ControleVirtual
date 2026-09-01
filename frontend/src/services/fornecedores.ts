import { api } from "./api";
import type { Fornecedor, FornecedorCreate } from "../types";

export async function listarFornecedores(params?: {
  apenas_ativos?: boolean;
}): Promise<Fornecedor[]> {
  const { data } = await api.get<Fornecedor[]>("/fornecedores", { params });
  return data;
}

export async function criarFornecedor(dados: FornecedorCreate): Promise<Fornecedor> {
  const { data } = await api.post<Fornecedor>("/fornecedores", dados);
  return data;
}

export async function atualizarFornecedor(
  id: number,
  dados: FornecedorCreate
): Promise<Fornecedor> {
  const { data } = await api.put<Fornecedor>(`/fornecedores/${id}`, dados);
  return data;
}

export async function removerFornecedor(id: number): Promise<void> {
  await api.delete(`/fornecedores/${id}`);
}
