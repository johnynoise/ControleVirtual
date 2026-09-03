import { api } from "./api";
import type {
  ContaReceber,
  DevolucaoCreate,
  PagamentoCreate,
  Venda,
  VendaCreate,
} from "../types";

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

export async function estornarVenda(
  id: number,
  motivo?: string
): Promise<Venda> {
  const { data } = await api.post<Venda>(`/vendas/${id}/estornar`, {
    motivo: motivo ?? null,
  });
  return data;
}

export async function devolverVenda(
  id: number,
  dados: DevolucaoCreate
): Promise<Venda> {
  const { data } = await api.post<Venda>(`/vendas/${id}/devolver`, dados);
  return data;
}

export async function registrarPagamento(
  id: number,
  dados: PagamentoCreate
): Promise<Venda> {
  const { data } = await api.post<Venda>(`/vendas/${id}/pagamentos`, dados);
  return data;
}

export async function listarContasReceber(): Promise<ContaReceber[]> {
  const { data } = await api.get<ContaReceber[]>("/vendas/contas-a-receber");
  return data;
}
