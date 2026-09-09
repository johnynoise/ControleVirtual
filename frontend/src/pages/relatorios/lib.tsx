import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { PeriodoRelatorio } from "../../types";

// Períodos padrão oferecidos nos relatórios.
export const PERIODOS: { valor: number; rotulo: string }[] = [
  { valor: 7, rotulo: "7 dias" },
  { valor: 30, rotulo: "30 dias" },
  { valor: 90, rotulo: "90 dias" },
];

/** Converte para número os valores decimais que a API manda como string. */
export function num(valor: number | string | null | undefined): number {
  const n = typeof valor === "string" ? parseFloat(valor) : valor ?? 0;
  return n || 0;
}

export function brl(valor: number | string | null | undefined): string {
  return num(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function pct(valor: number | string | null | undefined): string {
  return `${num(valor).toLocaleString("pt-BR", {
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

/** Monta YYYY-MM-DD a partir de ano/mês (base 0)/dia. */
function iso(ano: number, mesBase0: number, dia: number): string {
  return `${ano}-${String(mesBase0 + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** Data de hoje como YYYY-MM-DD (formato do input date e da API). */
function hojeISO(): string {
  const d = new Date();
  return iso(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Primeiro dia do mês corrente como YYYY-MM-DD. */
function inicioDoMesISO(): string {
  const d = new Date();
  return iso(d.getFullYear(), d.getMonth(), 1);
}

/**
 * Atalho de período que resolve para um intervalo de datas (e não para
 * "últimos N dias"). É o que permite fechar um mês-calendário.
 */
export interface AtalhoIntervalo {
  chave: string;
  rotulo: string;
  intervalo: () => { inicio: string; fim: string };
}

/**
 * Atalhos de mês. "Este mês" vai do dia 1º até hoje (mês em andamento) e
 * "Mês passado" é o mês anterior fechado — os dois recortes que o backend
 * sabe comparar com o mesmo trecho do mês anterior.
 */
export const ATALHOS_MES: AtalhoIntervalo[] = [
  {
    chave: "mes-atual",
    rotulo: "Este mês",
    intervalo: () => ({ inicio: inicioDoMesISO(), fim: hojeISO() }),
  },
  {
    chave: "mes-passado",
    rotulo: "Mês passado",
    intervalo: () => {
      const hoje = new Date();
      const ano = hoje.getMonth() === 0 ? hoje.getFullYear() - 1 : hoje.getFullYear();
      const mes = hoje.getMonth() === 0 ? 11 : hoje.getMonth() - 1;
      // Dia 0 do mês seguinte = último dia do mês desejado.
      const ultimoDia = new Date(ano, mes + 1, 0).getDate();
      return { inicio: iso(ano, mes, 1), fim: iso(ano, mes, ultimoDia) };
    },
  },
];

/** Chave do atalho que corresponde ao período atual, se houver. */
function atalhoDoPeriodo(
  periodo: PeriodoRelatorio,
  atalhos: AtalhoIntervalo[]
): string | null {
  if ("dias" in periodo) return null;
  for (const a of atalhos) {
    const i = a.intervalo();
    if (i.inicio === periodo.inicio && i.fim === periodo.fim) return a.chave;
  }
  return null;
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
  atalhos = [],
}: {
  periodo: PeriodoRelatorio;
  onChange: (periodo: PeriodoRelatorio) => void;
  opcoes?: { valor: number; rotulo: string }[];
  /** Atalhos de intervalo (ex.: mês), mostrados antes dos "últimos N dias". */
  atalhos?: AtalhoIntervalo[];
}) {
  const atalhoAtivo = atalhoDoPeriodo(periodo, atalhos);
  // O modo personalizado é explícito (e não inferido do período), senão um
  // intervalo que coincide com um atalho fecharia os campos de data sozinho.
  const [personalizado, setPersonalizado] = useState(
    !("dias" in periodo) && atalhoAtivo === null
  );
  // Guarda o intervalo em edição, para o relatório só recarregar quando as
  // duas datas estiverem preenchidas e coerentes.
  const [inicio, setInicio] = useState(
    "dias" in periodo ? inicioDoMesISO() : periodo.inicio
  );
  const [fim, setFim] = useState("dias" in periodo ? hojeISO() : periodo.fim);

  function aplicar(novoInicio: string, novoFim: string) {
    setInicio(novoInicio);
    setFim(novoFim);
    setPersonalizado(true);
    if (novoInicio && novoFim && novoInicio <= novoFim) {
      onChange({ inicio: novoInicio, fim: novoFim });
    }
  }

  function selecionar(novo: PeriodoRelatorio) {
    setPersonalizado(false);
    onChange(novo);
  }

  const intervaloInvalido = Boolean(inicio && fim && inicio > fim);

  return (
    <div className="periodo-seletor">
      <div className="periodo-tabs">
        {atalhos.map((a) => (
          <button
            key={a.chave}
            className={`btn ${
              !personalizado && atalhoAtivo === a.chave ? "primario" : "secundario"
            } pequeno`}
            onClick={() => selecionar(a.intervalo())}
          >
            {a.rotulo}
          </button>
        ))}
        {opcoes.map((p) => (
          <button
            key={p.valor}
            className={`btn ${
              !personalizado && "dias" in periodo && periodo.dias === p.valor
                ? "primario"
                : "secundario"
            } pequeno`}
            onClick={() => selecionar({ dias: p.valor })}
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

/**
 * Variação de um número contra o período de comparação.
 *
 * Por padrão subir é bom (verde). Em métricas onde subir é ruim — despesas,
 * perdas, custo — passe `inverso`: a seta continua apontando o movimento real,
 * só a cor inverte.
 */
export function DeltaValor({
  atual,
  anterior,
  inverso = false,
}: {
  atual: number | string | null | undefined;
  anterior: number | string | null | undefined;
  inverso?: boolean;
}) {
  const a = num(atual);
  const b = num(anterior);

  // Sem base de comparação não há percentual que faça sentido.
  if (b === 0) {
    return <span className="kpi-delta neutro">{a === 0 ? "—" : "novo"}</span>;
  }

  const variacao = ((a - b) / Math.abs(b)) * 100;
  const subiu = variacao >= 0;
  const bom = inverso ? !subiu : subiu;
  return (
    <span className={`kpi-delta ${bom ? "sobe" : "cai"}`}>
      {subiu ? "▲" : "▼"} {Math.abs(variacao).toFixed(0)}%
    </span>
  );
}
