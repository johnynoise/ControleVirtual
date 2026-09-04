import { useEffect, useRef, useState } from "react";
import { useConfiguracao } from "../components/ConfiguracaoContext";
import { PALETA } from "../lib/personalizacao";
import { useToast } from "../components/Feedback";
import { extrairErro, iniciais } from "../lib/ui";

// Limite de tamanho do logo (base64 é ~33% maior que o binário).
const LOGO_MAX_BYTES = 400 * 1024; // ~400 KB de arquivo

export default function ConfiguracoesPage() {
  const { config, carregando, salvar } = useConfiguracao();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [nome, setNome] = useState("");
  const [cor, setCor] = useState(PALETA[0].cor);
  const [logo, setLogo] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Preenche o formulário quando a config chega.
  useEffect(() => {
    if (config) {
      setNome(config.nome_loja ?? "");
      setCor(config.cor ?? PALETA[0].cor);
      setLogo(config.logo ?? null);
    }
  }, [config]);

  function escolherLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    if (!arquivo.type.startsWith("image/")) {
      toast.erro("Selecione um arquivo de imagem (PNG, JPG ou SVG).");
      return;
    }
    if (arquivo.size > LOGO_MAX_BYTES) {
      toast.erro("Imagem muito grande. Use um logo de até 400 KB.");
      return;
    }
    const leitor = new FileReader();
    leitor.onload = () => setLogo(String(leitor.result));
    leitor.onerror = () => toast.erro("Não foi possível ler a imagem.");
    leitor.readAsDataURL(arquivo);
  }

  function removerLogo() {
    setLogo(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onSalvar(e: React.FormEvent) {
    e.preventDefault();
    if (nome.trim() === "") {
      setErro("Informe o nome da loja.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await salvar({ nome_loja: nome.trim(), cor, logo });
      toast.sucesso("Personalização salva.");
    } catch (err) {
      const msg = extrairErro(err);
      setErro(msg);
      toast.erro(msg);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="page">
      <div className="page-title">
        <span className="title-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H10a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V10a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
          </svg>
        </span>
        <h1>Configurações</h1>
      </div>
      <p className="subtitle">
        Personalize a identidade da loja. As mudanças aparecem no menu, no título
        da aba e nos recibos.
      </p>

      {erro && <div className="alert erro">{erro}</div>}

      <form className="card form" onSubmit={onSalvar}>
        <h2>Identidade da loja</h2>

        {/* Prévia de como fica no menu lateral. */}
        <div className="config-preview">
          <span className="rotulo-campo">Prévia</span>
          <div className="config-preview-brand">
            {logo ? (
              <img src={logo} alt="Logo" className="config-preview-logo" />
            ) : (
              <span
                className="config-preview-mark"
                style={{ background: cor }}
              >
                {iniciais(nome || "Controle Virtual")}
              </span>
            )}
            <span className="config-preview-nome">{nome || "Nome da loja"}</span>
          </div>
        </div>

        <label style={{ marginBottom: "1.25rem" }}>
          Nome da loja
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Mercearia da Ana"
            maxLength={120}
            required
          />
        </label>

        <span className="rotulo-campo">Logo</span>
        <div className="config-logo">
          <div className="config-logo-thumb">
            {logo ? (
              <img src={logo} alt="Logo atual" />
            ) : (
              <span className="config-logo-vazio">Sem logo</span>
            )}
          </div>
          <div className="config-logo-acoes">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={escolherLogo}
              style={{ display: "none" }}
            />
            <button
              type="button"
              className="btn secundario"
              onClick={() => fileRef.current?.click()}
            >
              {logo ? "Trocar logo" : "Enviar logo"}
            </button>
            {logo && (
              <button type="button" className="btn perigo" onClick={removerLogo}>
                Remover
              </button>
            )}
            <p className="muted">PNG, JPG ou SVG, até 400 KB.</p>
          </div>
        </div>

        <span className="rotulo-campo" style={{ marginTop: "1.5rem" }}>
          Cor de destaque
        </span>
        <div className="config-cores">
          {PALETA.map((p) => (
            <button
              key={p.cor}
              type="button"
              className={`config-cor${cor === p.cor ? " ativa" : ""}`}
              style={{ background: p.cor }}
              onClick={() => setCor(p.cor)}
              title={p.nome}
              aria-label={p.nome}
              aria-pressed={cor === p.cor}
            >
              {cor === p.cor && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </button>
          ))}
        </div>

        <div className="form-acoes">
          <button className="btn primario" type="submit" disabled={salvando || carregando}>
            {salvando ? "Salvando..." : "Salvar personalização"}
          </button>
        </div>
      </form>
    </div>
  );
}
