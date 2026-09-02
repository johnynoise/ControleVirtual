import type { ReactNode } from "react";
import { Link } from "react-router-dom";

// Períodos padrão oferecidos nos relatórios.
export const PERIODOS: { valor: number; rotulo: string }[] = [
  { valor: 7, rotulo: "7 dias" },
  { valor: 30, rotulo: "30 dias" },
  { valor: 90, rotulo: "90 dias" },
];

export function brl(valor: number | string | null | undefined): string {
  const n = typeof valor === "string" ? parseFloat(valor) : valor ?? 0;
  return (n || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function pct(valor: number | string | null | undefined): string {
  const n = typeof valor === "string" ? parseFloat(valor) : valor ?? 0;
  return `${(n || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

/** Formata data ISO (com ou sem hora) no padrão brasileiro. */
export function dataBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const base = iso.length <= 10 ? iso + "T00:00:00" : iso;
  const d = new Date(base);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

/** Data + hora curta (para o kardex). */
export function dataHoraBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function extrairErro(err: unknown): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response
    ?.data?.detail;
  if (typeof detail === "string") return detail;
  return "Não foi possível carregar o relatório.";
}

/** Abas de período reutilizáveis. */
export function PeriodoTabs({
  dias,
  onChange,
  opcoes = PERIODOS,
}: {
  dias: number;
  onChange: (valor: number) => void;
  opcoes?: { valor: number; rotulo: string }[];
}) {
  return (
    <div className="periodo-tabs">
      {opcoes.map((p) => (
        <button
          key={p.valor}
          className={`btn ${dias === p.valor ? "primario" : "secundario"} pequeno`}
          onClick={() => onChange(p.valor)}
        >
          {p.rotulo}
        </button>
      ))}
    </div>
  );
}

/** Cabeçalho padrão das páginas de relatório (com voltar + título + ações). */
export function RelatorioHeader({
  titulo,
  icone,
  acoes,
}: {
  titulo: string;
  icone: ReactNode;
  acoes?: ReactNode;
}) {
  return (
    <div>
      <Link to="/relatorios" className="voltar-link">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Relatórios
      </Link>
      <div className="page-header">
        <div className="page-title">
          <span className="title-icon">{icone}</span>
          <h1>{titulo}</h1>
        </div>
        {acoes}
      </div>
    </div>
  );
}
