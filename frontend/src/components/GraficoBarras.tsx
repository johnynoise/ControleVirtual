import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface BarraDado {
  rotulo: string;
  valor: number;
  detalhe?: string;
}

interface Props {
  dados: BarraDado[];
  cor?: string;
  altura?: number;
  /** Mostra o valor em R$ no topo de cada barra (bom quando há poucas barras). */
  mostrarValorNoTopo?: boolean;
}

const COR_PADRAO = "#2f6bff"; // --azul

function brl(valor: number): string {
  return (valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Formato compacto para o eixo Y e rótulos: R$ 1,2 mil / R$ 300. */
function brlEixo(n: number): string {
  if (Math.abs(n) >= 1000) {
    const v = n / 1000;
    return `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  }
  return `R$ ${Math.round(n)}`;
}

interface TooltipProps {
  active?: boolean;
  payload?: { payload: BarraDado }[];
}

function ConteudoTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0].payload;
  return (
    <div className="grafico-tooltip">
      <strong>{p.rotulo}</strong>
      <span>{brl(p.valor)}</span>
      {p.detalhe && <span>{p.detalhe}</span>}
    </div>
  );
}

/**
 * Gráfico de barras verticais com Recharts, reutilizável nos relatórios.
 * Afina os rótulos do eixo X automaticamente quando há muitas barras.
 */
export default function GraficoBarras({
  dados,
  cor = COR_PADRAO,
  altura = 260,
  mostrarValorNoTopo = false,
}: Props) {
  if (dados.length === 0) {
    return <p className="vazio">Sem dados no período.</p>;
  }

  return (
    <div className="grafico-linha">
      <ResponsiveContainer width="100%" height={altura}>
        <BarChart data={dados} margin={{ top: 20, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid strokeDasharray="3 4" stroke="#e7eaf0" vertical={false} />
          <XAxis
            dataKey="rotulo"
            interval="preserveStartEnd"
            minTickGap={4}
            tick={{ fontSize: 12, fill: "#6b7684" }}
            tickLine={false}
            axisLine={{ stroke: "#e7eaf0" }}
          />
          <YAxis
            tickFormatter={brlEixo}
            tick={{ fontSize: 12, fill: "#6b7684" }}
            tickLine={false}
            axisLine={false}
            width={72}
          />
          <Tooltip content={<ConteudoTooltip />} cursor={{ fill: "rgba(47,107,255,0.06)" }} />
          <Bar dataKey="valor" name="Faturamento" fill={cor} radius={[4, 4, 0, 0]}>
            {mostrarValorNoTopo && (
              <LabelList
                dataKey="valor"
                position="top"
                formatter={(v) => {
                  const n = Number(v) || 0;
                  return n > 0 ? brlEixo(n) : "";
                }}
                style={{ fontSize: 11, fill: "#6b7684" }}
              />
            )}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
