import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Configuracao, ConfiguracaoUpdate } from "../types";
import { obterConfiguracao, atualizarConfiguracao } from "../services/configuracao";
import { aplicarCor, COR_PADRAO } from "../lib/personalizacao";

interface ConfigContextValor {
  config: Configuracao | null;
  carregando: boolean;
  salvar: (dados: ConfiguracaoUpdate) => Promise<Configuracao>;
  recarregar: () => Promise<void>;
}

const ConfigContext = createContext<ConfigContextValor | null>(null);

// Aplica os efeitos visíveis da configuração (cor de destaque, título da aba)
// e faz cache dos valores leves para aplicação instantânea na próxima abertura.
function aplicar(config: Configuracao) {
  aplicarCor(config.cor || COR_PADRAO);
  document.title = config.nome_loja || "ControleVirtual";
  try {
    localStorage.setItem("config_cor", config.cor || COR_PADRAO);
    localStorage.setItem("config_nome", config.nome_loja || "");
  } catch {
    /* localStorage indisponível: ignora o cache. */
  }
}

export function ConfiguracaoProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<Configuracao | null>(null);
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    try {
      const c = await obterConfiguracao();
      setConfig(c);
      aplicar(c);
    } catch {
      /* Sem config: mantém os padrões do design system. */
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  const salvar = useCallback(async (dados: ConfiguracaoUpdate) => {
    const c = await atualizarConfiguracao(dados);
    setConfig(c);
    aplicar(c);
    return c;
  }, []);

  return (
    <ConfigContext.Provider value={{ config, carregando, salvar, recarregar }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfiguracao(): ConfigContextValor {
  const ctx = useContext(ConfigContext);
  if (!ctx) {
    throw new Error("useConfiguracao deve ser usado dentro de ConfiguracaoProvider");
  }
  return ctx;
}
