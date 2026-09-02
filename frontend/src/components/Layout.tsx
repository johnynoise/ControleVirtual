import { useEffect, useState, type ReactNode } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { api } from "../services/api";

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
};

const LINKS: { to: string; rotulo: string; icone: keyof typeof icones }[] = [
  { to: "/dashboard", rotulo: "Início", icone: "dashboard" },
  { to: "/vendas", rotulo: "Vender", icone: "vendas" },
  { to: "/produtos", rotulo: "Produtos", icone: "produtos" },
  { to: "/movimentacoes", rotulo: "Estoque", icone: "movimentacoes" },
  { to: "/fornecedores", rotulo: "Fornecedores", icone: "fornecedores" },
  { to: "/clientes", rotulo: "Clientes", icone: "clientes" },
  { to: "/categorias", rotulo: "Categorias", icone: "categorias" },
];

export default function Layout() {
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    api
      .get("/health")
      .then((res) => setOnline((res.data.status ?? "ok") === "ok"))
      .catch(() => setOnline(false));
  }, []);

  const statusClasse =
    online === null ? "" : online ? "ok" : "off";
  const statusTexto =
    online === null ? "Conectando..." : online ? "Conectado" : "Sem conexão";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark">CV</span>
          <span className="brand-text">ControleVirtual</span>
        </div>

        <nav className="sidebar-nav">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} title={l.rotulo}>
              {icones[l.icone]}
              <span>{l.rotulo}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
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
    </div>
  );
}
