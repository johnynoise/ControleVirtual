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

export interface EnviarReciboResposta {
  enviado: boolean;
  destinatario: string;
}

/**
 * Envia o recibo da venda (PDF) por email. Se `email` for omitido, o backend
 * usa o email cadastrado do cliente vinculado à venda.
 */
export async function enviarReciboEmail(
  id: number,
  email?: string
): Promise<EnviarReciboResposta> {
  const { data } = await api.post<EnviarReciboResposta>(
    `/vendas/${id}/enviar-recibo`,
    { email: email ?? null }
  );
  return data;
}
