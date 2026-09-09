import { api } from "./api";
import type {
  Configuracao,
  ConfiguracaoUpdate,
  OpcoesConfiguracao,
} from "../types";

export async function obterConfiguracao(): Promise<Configuracao> {
  const { data } = await api.get<Configuracao>("/configuracao");
  return data;
}

/** Listas do cadastro fiscal (tipo de pessoa e regime), com rótulos prontos. */
export async function obterOpcoesConfiguracao(): Promise<OpcoesConfiguracao> {
  const { data } = await api.get<OpcoesConfiguracao>("/configuracao/opcoes");
  return data;
}

export async function atualizarConfiguracao(
  dados: ConfiguracaoUpdate
): Promise<Configuracao> {
  const { data } = await api.put<Configuracao>("/configuracao", dados);
  return data;
}
