import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { PeriodoRelatorio } from "../../types";

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

/** Data de hoje como YYYY-MM-DD (formato do input date e da API). */
function hojeISO(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** Primeiro dia do mês corrente como YYYY-MM-DD. */
function inicioDoMesISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * Seletor de período dos relatórios: atalhos de "últimos N dias" mais um
 * intervalo de datas personalizado, que é o que permite fechar um mês ou um
 * ano-calendário.
 */
export function PeriodoSeletor({
  periodo,
  onChange,
  opcoes = PERIODOS,
}: {
  periodo: PeriodoRelatorio;
  onChange: (periodo: PeriodoRelatorio) => void;
  opcoes?: { valor: number; rotulo: string }[];
}) {
  const personalizado = !("dias" in periodo);
  // Guarda o intervalo em edição, para o relatório só recarregar quando as
  // duas datas estiverem preenchidas e coerentes.
  const [inicio, setInicio] = useState(
    personalizado ? periodo.inicio : inicioDoMesISO()
  );
  const [fim, setFim] = useState(personalizado ? periodo.fim : hojeISO());

  function aplicar(novoInicio: string, novoFim: string) {
    setInicio(novoInicio);
    setFim(novoFim);
    if (novoInicio && novoFim && novoInicio <= novoFim) {
      onChange({ inicio: novoInicio, fim: novoFim });
    }
  }

  const intervaloInvalido = Boolean(inicio && fim && inicio > fim);

  return (
    <div className="periodo-seletor">
      <div className="periodo-tabs">
        {opcoes.map((p) => (
          <button
            key={p.valor}
            className={`btn ${
              !personalizado && periodo.dias === p.valor ? "primario" : "secundario"
            } pequeno`}
            onClick={() => onChange({ dias: p.valor })}
          >
            {p.rotulo}
          </button>
        ))}
        <button
          className={`btn ${personalizado ? "primario" : "secundario"} pequeno`}
          onClick={() => aplicar(inicio, fim)}
        >
          Personalizado
        </button>
      </div>

      {personalizado && (
        <div className="periodo-intervalo">
          <label>
            De
            <input
              type="date"
              value={inicio}
              max={fim || undefined}
              onChange={(e) => aplicar(e.target.value, fim)}
            />
          </label>
          <label>
            até
            <input
              type="date"
              value={fim}
              min={inicio || undefined}
              onChange={(e) => aplicar(inicio, e.target.value)}
            />
          </label>
          {intervaloInvalido && (
            <span className="periodo-intervalo-erro">
              A data final não pode ser anterior à inicial.
            </span>
          )}
        </div>
      )}
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
