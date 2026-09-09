import { useEffect, useRef, useState } from "react";
import { useConfiguracao } from "../components/ConfiguracaoContext";
import { PALETA } from "../lib/personalizacao";
import { useToast } from "../components/Feedback";
import {
  extrairErro,
  formatarCep,
  formatarDocumento,
  formatarTelefone,
  iniciais,
} from "../lib/ui";
import { obterOpcoesConfiguracao } from "../services/configuracao";
import type { ConfiguracaoUpdate, OpcoesConfiguracao } from "../types";

// Limite de tamanho do logo (base64 é ~33% maior que o binário).
const LOGO_MAX_BYTES = 400 * 1024; // ~400 KB de arquivo

// Campos do cadastro do negócio. Todos opcionais: são guardados como texto e
// enviados como null quando ficam vazios.
type CamposNegocio = {
  tipo_pessoa: string;
  documento: string;
  razao_social: string;
  regime_tributario: string;
  inscricao_estadual: string;
  inscricao_municipal: string;
  cnae: string;
  data_abertura: string;
  telefone: string;
  email: string;
  endereco: string;
  cep: string;
  cidade: string;
  estado: string;
  contador_nome: string;
  contador_contato: string;
  recibo_rodape: string;
};

function negocioVazio(): CamposNegocio {
  return {
    tipo_pessoa: "",
    documento: "",
    razao_social: "",
    regime_tributario: "",
    inscricao_estadual: "",
    inscricao_municipal: "",
    cnae: "",
    data_abertura: "",
    telefone: "",
    email: "",
    endereco: "",
    cep: "",
    cidade: "",
    estado: "",
    contador_nome: "",
    contador_contato: "",
    recibo_rodape: "",
  };
}

/** Campo vazio vira null no backend (limpa o valor guardado). */
function ouNulo(valor: string): string | null {
  const limpo = valor.trim();
  return limpo === "" ? null : limpo;
}

export default function ConfiguracoesPage() {
  const { config, carregando, salvar } = useConfiguracao();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [nome, setNome] = useState("");
  const [cor, setCor] = useState(PALETA[0].cor);
  const [logo, setLogo] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [negocio, setNegocio] = useState<CamposNegocio>(negocioVazio());
  const [opcoes, setOpcoes] = useState<OpcoesConfiguracao | null>(null);
  const [salvandoNegocio, setSalvandoNegocio] = useState(false);
  const [erroNegocio, setErroNegocio] = useState<string | null>(null);

  // Preenche o formulário quando a config chega.
  useEffect(() => {
    if (config) {
      setNome(config.nome_loja ?? "");
      setCor(config.cor ?? PALETA[0].cor);
      setLogo(config.logo ?? null);
      setNegocio({
        tipo_pessoa: config.tipo_pessoa ?? "",
        documento: config.documento ?? "",
        razao_social: config.razao_social ?? "",
        regime_tributario: config.regime_tributario ?? "",
        inscricao_estadual: config.inscricao_estadual ?? "",
        inscricao_municipal: config.inscricao_municipal ?? "",
        cnae: config.cnae ?? "",
        data_abertura: config.data_abertura ?? "",
        telefone: config.telefone ?? "",
        email: config.email ?? "",
        endereco: config.endereco ?? "",
        cep: config.cep ?? "",
        cidade: config.cidade ?? "",
        estado: config.estado ?? "",
        contador_nome: config.contador_nome ?? "",
        contador_contato: config.contador_contato ?? "",
        recibo_rodape: config.recibo_rodape ?? "",
      });
    }
  }, [config]);

  // Listas de tipo de pessoa e regime, carregadas uma vez.
  useEffect(() => {
    obterOpcoesConfiguracao()
      .then(setOpcoes)
      .catch(() => setOpcoes(null));
  }, []);

  function setNeg<K extends keyof CamposNegocio>(chave: K, valor: string) {
    setNegocio((n) => ({ ...n, [chave]: valor }));
  }

  // Rótulo do documento segue o tipo de pessoa escolhido na hora.
  const rotuloDocumento =
    negocio.tipo_pessoa === "fisica"
      ? "CPF"
      : negocio.tipo_pessoa === "juridica"
        ? "CNPJ"
        : "CPF / CNPJ";
  const pessoaFisica = negocio.tipo_pessoa === "fisica";

  async function onSalvarNegocio(e: React.FormEvent) {
    e.preventDefault();
    setSalvandoNegocio(true);
    setErroNegocio(null);

    // Nenhum campo é obrigatório: tudo que ficar em branco é enviado como null.
    const payload: ConfiguracaoUpdate = {
      tipo_pessoa: (ouNulo(negocio.tipo_pessoa) as ConfiguracaoUpdate["tipo_pessoa"]) ?? null,
      documento: ouNulo(negocio.documento),
      razao_social: ouNulo(negocio.razao_social),
      regime_tributario:
        (ouNulo(negocio.regime_tributario) as ConfiguracaoUpdate["regime_tributario"]) ?? null,
      inscricao_estadual: ouNulo(negocio.inscricao_estadual),
      inscricao_municipal: ouNulo(negocio.inscricao_municipal),
      cnae: ouNulo(negocio.cnae),
      data_abertura: ouNulo(negocio.data_abertura),
      telefone: ouNulo(negocio.telefone),
      email: ouNulo(negocio.email),
      endereco: ouNulo(negocio.endereco),
      cep: ouNulo(negocio.cep),
      cidade: ouNulo(negocio.cidade),
      estado: ouNulo(negocio.estado)?.toUpperCase() ?? null,
      contador_nome: ouNulo(negocio.contador_nome),
      contador_contato: ouNulo(negocio.contador_contato),
      recibo_rodape: ouNulo(negocio.recibo_rodape),
    };

    try {
      await salvar(payload);
      toast.sucesso("Dados do negócio salvos.");
    } catch (err) {
      const msg = extrairErro(err);
      setErroNegocio(msg);
      toast.erro(msg);
    } finally {
      setSalvandoNegocio(false);
    }
  }

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

      {erroNegocio && <div className="alert erro">{erroNegocio}</div>}

      <form className="card form" onSubmit={onSalvarNegocio}>
        <h2>Dados do negócio</h2>
        <p className="subtitle">
          Aparecem no recibo e no cabeçalho do relatório fiscal.{" "}
          <strong>Nenhum campo é obrigatório</strong> — se você vende como pessoa
          física, deixe em branco o que não se aplica (razão social, inscrições)
          e preencha só o que tiver.
        </p>

        <div className="grid-2">
          <label>
            Tipo de pessoa
            <select
              value={negocio.tipo_pessoa}
              onChange={(e) => setNeg("tipo_pessoa", e.target.value)}
            >
              <option value="">Não informado</option>
              {(opcoes?.tipos_pessoa ?? []).map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.rotulo}
                </option>
              ))}
            </select>
          </label>
          <label>
            {rotuloDocumento}
            <input
              value={negocio.documento}
              onChange={(e) => setNeg("documento", formatarDocumento(e.target.value))}
              placeholder={pessoaFisica ? "000.000.000-00" : "00.000.000/0000-00"}
              inputMode="numeric"
            />
          </label>
        </div>

        <div className="grid-2">
          <label>
            Razão social
            <input
              value={negocio.razao_social}
              onChange={(e) => setNeg("razao_social", e.target.value)}
              placeholder={pessoaFisica ? "Não se aplica a pessoa física" : "Nome registrado da empresa"}
              maxLength={200}
            />
          </label>
          <label>
            Regime tributário
            <select
              value={negocio.regime_tributario}
              onChange={(e) => setNeg("regime_tributario", e.target.value)}
            >
              <option value="">Não informado</option>
              {(opcoes?.regimes_tributarios ?? []).map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.rotulo}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid-2">
          <label>
            Inscrição estadual
            <input
              value={negocio.inscricao_estadual}
              onChange={(e) => setNeg("inscricao_estadual", e.target.value)}
              placeholder="Opcional"
              maxLength={30}
            />
          </label>
          <label>
            Inscrição municipal
            <input
              value={negocio.inscricao_municipal}
              onChange={(e) => setNeg("inscricao_municipal", e.target.value)}
              placeholder="Opcional"
              maxLength={30}
            />
          </label>
        </div>

        <div className="grid-2">
          <label>
            CNAE (atividade principal)
            <input
              value={negocio.cnae}
              onChange={(e) => setNeg("cnae", e.target.value)}
              placeholder="Ex.: 4781-4/00"
              maxLength={20}
            />
          </label>
          <label>
            Data de abertura
            <input
              type="date"
              value={negocio.data_abertura}
              onChange={(e) => setNeg("data_abertura", e.target.value)}
            />
          </label>
        </div>

        <span className="rotulo-campo" style={{ marginTop: "1.5rem" }}>
          Contato
        </span>
        <div className="grid-2">
          <label>
            Telefone
            <input
              type="tel"
              inputMode="tel"
              value={negocio.telefone}
              onChange={(e) => setNeg("telefone", formatarTelefone(e.target.value))}
              placeholder="(11) 90000-0000"
            />
          </label>
          <label>
            E-mail
            <input
              type="email"
              value={negocio.email}
              onChange={(e) => setNeg("email", e.target.value)}
              placeholder="Opcional"
              maxLength={120}
            />
          </label>
        </div>

        <label style={{ marginBottom: "1rem" }}>
          Endereço
          <input
            value={negocio.endereco}
            onChange={(e) => setNeg("endereco", e.target.value)}
            placeholder="Rua, número e complemento"
            maxLength={200}
          />
        </label>

        <div className="grid-3">
          <label>
            CEP
            <input
              value={negocio.cep}
              onChange={(e) => setNeg("cep", formatarCep(e.target.value))}
              placeholder="00000-000"
              inputMode="numeric"
            />
          </label>
          <label>
            Cidade
            <input
              value={negocio.cidade}
              onChange={(e) => setNeg("cidade", e.target.value)}
              placeholder="Opcional"
              maxLength={120}
            />
          </label>
          <label>
            UF
            <input
              value={negocio.estado}
              onChange={(e) => setNeg("estado", e.target.value.toUpperCase())}
              placeholder="SP"
              maxLength={2}
            />
          </label>
        </div>

        <span className="rotulo-campo" style={{ marginTop: "1.5rem" }}>
          Contador
        </span>
        <div className="grid-2">
          <label>
            Nome ou escritório
            <input
              value={negocio.contador_nome}
              onChange={(e) => setNeg("contador_nome", e.target.value)}
              placeholder="Opcional"
              maxLength={200}
            />
          </label>
          <label>
            Contato
            <input
              value={negocio.contador_contato}
              onChange={(e) => setNeg("contador_contato", e.target.value)}
              placeholder="Telefone ou e-mail"
              maxLength={200}
            />
          </label>
        </div>

        <label style={{ marginTop: "1.5rem" }}>
          Rodapé do recibo
          <input
            value={negocio.recibo_rodape}
            onChange={(e) => setNeg("recibo_rodape", e.target.value)}
            placeholder="Ex.: Obrigado pela preferência! Trocas em até 7 dias."
            maxLength={200}
          />
        </label>

        <div className="form-acoes">
          <button
            className="btn primario"
            type="submit"
            disabled={salvandoNegocio || carregando}
          >
            {salvandoNegocio ? "Salvando..." : "Salvar dados do negócio"}
          </button>
        </div>
      </form>
    </div>
  );
}
