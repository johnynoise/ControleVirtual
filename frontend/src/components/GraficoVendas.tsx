import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { VendaDia } from "../types";

interface Props {
  dados: VendaDia[];
}

const COR_FATURAMENTO = "#2f6bff"; // --azul
const COR_LUCRO = "#12a150"; // --verde

function brl(valor: number): string {
  return (valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Formato compacto para o eixo Y: R$ 1,2 mil / R$ 300. */
function brlEixo(n: number): string {
  if (Math.abs(n) >= 1000) {
    const v = n / 1000;
    return `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  }
  return `R$ ${Math.round(n)}`;
}

function diaCurto(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

interface Ponto {
  dia: string;
  rotulo: string;
  faturamento: number;
  lucro: number;
  num_vendas: number;
}

interface TooltipProps {
  active?: boolean;
  payload?: { payload: Ponto }[];
}

function ConteudoTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0].payload;
  return (
    <div className="grafico-tooltip">
      <strong>{p.rotulo}</strong>
      <span>Faturamento: {brl(p.faturamento)}</span>
      <span>Lucro: {brl(p.lucro)}</span>
      <span>{p.num_vendas} venda(s)</span>
    </div>
  );
}

/**
 * Gráfico de faturamento (área) e lucro (linha) por dia, usando Recharts.
 * Escala bem de 1 a 30+ dias: os rótulos do eixo X são afinados
 * automaticamente e o tooltip mostra os detalhes de cada dia.
 */
export default function GraficoVendas({ dados }: Props) {
  const pontos = useMemo<Ponto[]>(
    () =>
      dados.map((d) => ({
        dia: d.dia,
        rotulo: diaCurto(d.dia),
        faturamento: parseFloat(d.faturamento) || 0,
        lucro: parseFloat(d.lucro) || 0,
        num_vendas: d.num_vendas,
      })),
    [dados]
  );

  if (pontos.length === 0) {
    return <p className="vazio">Sem dados no período.</p>;
  }

  // Afina os rótulos do eixo X para não amontoar em períodos longos.
  const intervalo = pontos.length > 10 ? Math.ceil(pontos.length / 8) - 1 : 0;

  return (
    <div className="grafico-linha">
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={pontos} margin={{ top: 12, right: 16, bottom: 4, left: 4 }}>
          <defs>
            <linearGradient id="gradFaturamento" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COR_FATURAMENTO} stopOpacity={0.35} />
              <stop offset="100%" stopColor={COR_FATURAMENTO} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 4" stroke="#e7eaf0" vertical={false} />
          <XAxis
            dataKey="rotulo"
            interval={intervalo}
            tick={{ fontSize: 12, fill: "#6b7684" }}
            tickLine={false}
            axisLine={{ stroke: "#e7eaf0" }}
            minTickGap={8}
          />
          <YAxis
            tickFormatter={brlEixo}
            tick={{ fontSize: 12, fill: "#6b7684" }}
            tickLine={false}
            axisLine={false}
            width={72}
          />
          <Tooltip content={<ConteudoTooltip />} />
          <Legend
            verticalAlign="top"
            height={28}
            iconType="plainline"
            wrapperStyle={{ fontSize: "0.8rem" }}
          />

          <Area
            type="monotone"
            dataKey="faturamento"
            name="Faturamento"
            stroke={COR_FATURAMENTO}
            strokeWidth={2.5}
            fill="url(#gradFaturamento)"
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="lucro"
            name="Lucro"
            stroke={COR_LUCRO}
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            activeDot={{ r: 4 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
