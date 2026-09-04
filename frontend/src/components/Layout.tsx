import { useEffect, useState, type ReactNode } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { api } from "../services/api";
import BuscaGlobal from "./BuscaGlobal";
import { useConfiguracao } from "./ConfiguracaoContext";
import { iniciais } from "../lib/ui";

// Ícones em linha (traço simples) para reconhecimento rápido.
const icones: Record<string, ReactNode> = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  ),
  vendas: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
      <path d="M2 3h3l2.4 12.2a1.5 1.5 0 0 0 1.5 1.2h8.2a1.5 1.5 0 0 0 1.5-1.2L22 7H6" />
    </svg>
  ),
  produtos: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 3 7v10l9 5 9-5V7z" />
      <path d="M3 7l9 5 9-5" />
      <path d="M12 12v10" />
    </svg>
  ),
  movimentacoes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3l4 4-4 4" />
      <path d="M21 7H7" />
      <path d="M7 21l-4-4 4-4" />
      <path d="M3 17h14" />
    </svg>
  ),
  fornecedores: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l1.5-4.5A1.5 1.5 0 0 1 6 3.5h12a1.5 1.5 0 0 1 1.5 1L21 9" />
      <path d="M3 9h18v3a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z" />
      <path d="M4 12v8h16v-8" />
    </svg>
  ),
  clientes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7" />
      <path d="M17.5 13.5a6.5 6.5 0 0 1 4 6.5" />
    </svg>
  ),
  categorias: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  relatorios: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M7 15l4-4 3 3 5-6" />
    </svg>
  ),
  historico: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v5h5" />
      <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
      <path d="M12 7v5l4 2" />
    </svg>
  ),
  fiado: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
      <path d="M6 15h4" />
    </svg>
  ),
};

interface Link {
  to: string;
  rotulo: string;
  icone: keyof typeof icones;
  end?: boolean;
}

// Grupos da navegação, organizados por intenção de uso. "Início" e "Vender"
// ficam fora dos grupos: são os dois pontos de partida do dia a dia.
const GRUPOS: { titulo: string; itens: Link[] }[] = [
  {
    titulo: "Vendas",
    itens: [
      { to: "/vendas/historico", rotulo: "Histórico", icone: "historico" },
      { to: "/contas-a-receber", rotulo: "Fiado", icone: "fiado" },
    ],
  },
  {
    titulo: "Catálogo",
    itens: [
      { to: "/produtos", rotulo: "Produtos", icone: "produtos" },
      { to: "/movimentacoes", rotulo: "Estoque", icone: "movimentacoes" },
      { to: "/categorias", rotulo: "Categorias", icone: "categorias" },
    ],
  },
  {
    titulo: "Contatos",
    itens: [
      { to: "/clientes", rotulo: "Clientes", icone: "clientes" },
      { to: "/fornecedores", rotulo: "Fornecedores", icone: "fornecedores" },
    ],
  },
  {
    titulo: "Análise",
    itens: [{ to: "/relatorios", rotulo: "Relatórios", icone: "relatorios" }],
  },
];

type Tema = "claro" | "escuro";

const iconeSol = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

const iconeLua = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);

export default function Layout() {
  const { config } = useConfiguracao();
  const [online, setOnline] = useState<boolean | null>(null);
  const [buscaAberta, setBuscaAberta] = useState(false);

  const nomeLoja = config?.nome_loja || "ControleVirtual";
  const [tema, setTema] = useState<Tema>(
    () => (document.documentElement.dataset.tema as Tema) || "claro"
  );

  // Aplica o tema no <html> e persiste a escolha.
  useEffect(() => {
    document.documentElement.dataset.tema = tema;
    try {
      localStorage.setItem("tema", tema);
    } catch {
      /* localStorage indisponível: mantém só na sessão. */
    }
  }, [tema]);

  useEffect(() => {
    api
      .get("/health")
      .then((res) => setOnline((res.data.status ?? "ok") === "ok"))
      .catch(() => setOnline(false));
  }, []);

  // Atalho global: Ctrl+K (ou ⌘K no Mac) abre/fecha a busca.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setBuscaAberta((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const statusClasse =
    online === null ? "" : online ? "ok" : "off";
  const statusTexto =
    online === null ? "Conectando..." : online ? "Conectado" : "Sem conexão";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          {config?.logo ? (
            <img src={config.logo} alt={nomeLoja} className="brand-logo" />
          ) : (
            <span className="brand-mark">{iniciais(nomeLoja)}</span>
          )}
          <span className="brand-text">{nomeLoja}</span>
        </div>

        <button
          type="button"
          className="sidebar-busca"
          onClick={() => setBuscaAberta(true)}
          title="Buscar (Ctrl+K)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <span className="sidebar-busca-texto">Buscar</span>
          <kbd className="sidebar-busca-kbd">Ctrl K</kbd>
        </button>

        <nav className="sidebar-nav">
          <NavLink to="/dashboard" title="Início">
            {icones.dashboard}
            <span>Início</span>
          </NavLink>

          <NavLink to="/vendas" title="Vender" end className="nav-vender">
            {icones.vendas}
            <span>Vender</span>
          </NavLink>

          {GRUPOS.map((g) => (
            <div className="nav-grupo" key={g.titulo}>
              <span className="nav-grupo-titulo">{g.titulo}</span>
              {g.itens.map((l) => (
                <NavLink key={l.to} to={l.to} title={l.rotulo} end={l.end}>
                  {icones[l.icone]}
                  <span>{l.rotulo}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <NavLink to="/configuracoes" className="sidebar-config" title="Configurações">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H10a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V10a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
            </svg>
            <span>Configurações</span>
          </NavLink>

          <button
            type="button"
            className="tema-toggle"
            onClick={() => setTema((t) => (t === "escuro" ? "claro" : "escuro"))}
            title={tema === "escuro" ? "Mudar para modo claro" : "Mudar para modo escuro"}
          >
            {tema === "escuro" ? iconeSol : iconeLua}
            <span>{tema === "escuro" ? "Modo claro" : "Modo escuro"}</span>
          </button>

          <div className="status">
            <span className={`status-dot ${statusClasse}`} />
            <span>{statusTexto}</span>
          </div>
        </div>
      </aside>

      <div className="main">
        <main className="content">
          <Outlet />
        </main>
      </div>

      <BuscaGlobal aberto={buscaAberta} onFechar={() => setBuscaAberta(false)} />
    </div>
  );
}
