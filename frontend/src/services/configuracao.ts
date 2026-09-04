import { api } from "./api";
import type { Configuracao, ConfiguracaoUpdate } from "../types";

export async function obterConfiguracao(): Promise<Configuracao> {
  const { data } = await api.get<Configuracao>("/configuracao");
  return data;
}

export async function atualizarConfiguracao(
  dados: ConfiguracaoUpdate
): Promise<Configuracao> {
  const { data } = await api.put<Configuracao>("/configuracao", dados);
  return data;
}
