import { api } from "./api";
import type { Cliente, ClienteCreate } from "../types";

export async function listarClientes(params?: {
  apenas_ativos?: boolean;
}): Promise<Cliente[]> {
  const { data } = await api.get<Cliente[]>("/clientes", { params });
  return data;
}

export async function criarCliente(dados: ClienteCreate): Promise<Cliente> {
  const { data } = await api.post<Cliente>("/clientes", dados);
  return data;
}

export async function atualizarCliente(
  id: number,
  dados: ClienteCreate
): Promise<Cliente> {
  const { data } = await api.put<Cliente>(`/clientes/${id}`, dados);
  return data;
}

export async function removerCliente(id: number): Promise<void> {
  await api.delete(`/clientes/${id}`);
}
