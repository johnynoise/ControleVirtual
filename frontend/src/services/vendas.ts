import { api } from "./api";
import type { Venda, VendaCreate } from "../types";

export async function listarVendas(): Promise<Venda[]> {
  const { data } = await api.get<Venda[]>("/vendas");
  return data;
}

export async function obterVenda(id: number): Promise<Venda> {
  const { data } = await api.get<Venda>(`/vendas/${id}`);
  return data;
}

export async function criarVenda(dados: VendaCreate): Promise<Venda> {
  const { data } = await api.post<Venda>("/vendas", dados);
  return data;
}
