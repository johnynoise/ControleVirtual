// Gráficos leves em SVG, sem biblioteca externa — mantêm o bundle enxuto e
// o visual alinhado ao restante do sistema.

// Paleta alinhada ao tema (azul é a cor principal).
export const PALETA = [
  "#2f6bff",
  "#12a150",
  "#c06a00",
  "#e02d3c",
  "#7c4dff",
  "#00b8d9",
  "#ff8b00",
  "#5b8bff",
  "#e8467c",
  "#0aa38b",
  "#8a94a6",
];

export function cor(i: number): string {
  return PALETA[i % PALETA.length];
}

// ---------------------------------------------------------------------------
// Donut (rosca) com legenda.
// ---------------------------------------------------------------------------
export interface FatiaDonut {
  label: string;
  valor: number;
}

export function DonutChart({
  fatias,
  formatar,
}: {
  fatias: FatiaDonut[];
  formatar: (v: number) => string;
}) {
  const total = fatias.reduce((s, f) => s + (f.valor || 0), 0);
  const size = 180;
  const stroke = 30;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const centro = size / 2;

  if (total <= 0) {
    return <p className="vazio">Sem dados para o gráfico.</p>;
  }

  let acumulado = 0;

  return (
    <div className="chart-donut">
      <svg viewBox={`0 0 ${size} ${size}`} className="donut-svg" role="img">
        <circle
          cx={centro}
          cy={centro}
          r={r}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={stroke}
        />
        {fatias.map((f, i) => {
          const fracao = (f.valor || 0) / total;
          const comprimento = fracao * circ;
          const offset = -acumulado * circ;
          acumulado += fracao;
          return (
            <circle
              key={f.label}
              cx={centro}
              cy={centro}
              r={r}
              fill="none"
              stroke={cor(i)}
              strokeWidth={stroke}
              strokeDasharray={`${comprimento} ${circ - comprimento}`}
              strokeDashoffset={offset}
              transform={`rotate(-90 ${centro} ${centro})`}
            >
              <title>{`${f.label}: ${formatar(f.valor)}`}</title>
            </circle>
          );
        })}
        <text
          x={centro}
          y={centro - 4}
          textAnchor="middle"
          className="donut-centro-label"
        >
          Total
        </text>
        <text
          x={centro}
          y={centro + 16}
          textAnchor="middle"
          className="donut-centro-valor"
        >
          {formatar(total)}
        </text>
      </svg>

      <ul className="chart-legenda">
        {fatias.map((f, i) => {
          const pctv = total > 0 ? ((f.valor || 0) / total) * 100 : 0;
          return (
            <li key={f.label}>
              <span className="legenda-cor" style={{ background: cor(i) }} />
              <span className="legenda-label">{f.label}</span>
              <span className="legenda-valor">
                {formatar(f.valor)}
                <span className="muted"> · {pctv.toFixed(1)}%</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Barras horizontais.
// ---------------------------------------------------------------------------
export interface BarraH {
  label: string;
  valor: number;
}

export function BarrasHorizontais({
  barras,
  formatar,
}: {
  barras: BarraH[];
  formatar: (v: number) => string;
}) {
  const max = Math.max(1, ...barras.map((b) => b.valor || 0));
  if (barras.length === 0) {
    return <p className="vazio">Sem dados para o gráfico.</p>;
  }
  return (
    <div className="barras-h">
      {barras.map((b, i) => (
        <div className="barra-h-row" key={`${b.label}-${i}`}>
          <span className="barra-h-label" title={b.label}>
            {b.label}
          </span>
          <div className="barra-h-track">
            <span
              className="barra-h-fill"
              style={{
                width: `${((b.valor || 0) / max) * 100}%`,
                background: cor(i),
              }}
            />
          </div>
          <span className="barra-h-valor">{formatar(b.valor)}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pareto (barras de valor + linha de % acumulado), ideal para a Curva ABC.
// ---------------------------------------------------------------------------
export interface ParetoItem {
  label: string;
  valor: number;
  acumulado: number; // percentual acumulado (0-100)
}

export function ParetoChart({
  itens,
  formatar,
}: {
  itens: ParetoItem[];
  formatar: (v: number) => string;
}) {
  if (itens.length === 0) {
    return <p className="vazio">Sem dados para o gráfico.</p>;
  }

  const padTop = 16;
  const padBottom = 28;
  const padLeft = 8;
  const padRight = 8;
  const alturaPlot = 200;
  const larguraCol = 46;
  const largura = Math.max(
    320,
    padLeft + padRight + itens.length * larguraCol
  );
  const altura = padTop + alturaPlot + padBottom;
  const maxValor = Math.max(1, ...itens.map((i) => i.valor || 0));

  const x = (i: number) => padLeft + i * larguraCol + larguraCol / 2;
  const yValor = (v: number) => padTop + alturaPlot * (1 - v / maxValor);
  const yPct = (p: number) => padTop + alturaPlot * (1 - p / 100);

  const linhaAcum = itens
    .map((it, i) => `${x(i)},${yPct(it.acumulado)}`)
    .join(" ");

  return (
    <div className="chart-scroll">
      <svg
        viewBox={`0 0 ${largura} ${altura}`}
        style={{ width: Math.max(largura, 320), maxWidth: "100%", height: altura }}
        preserveAspectRatio="xMinYMid meet"
        className="pareto-svg"
      >
        {/* Linhas de referência 80% e 95% (limites das classes ABC) */}
        {[80, 95].map((marca) => (
          <g key={marca}>
            <line
              x1={padLeft}
              x2={largura - padRight}
              y1={yPct(marca)}
              y2={yPct(marca)}
              stroke="var(--border)"
              strokeDasharray="4 4"
            />
            <text x={largura - padRight} y={yPct(marca) - 3} textAnchor="end" className="pareto-marca">
              {marca}%
            </text>
          </g>
        ))}

        {/* Barras de faturamento */}
        {itens.map((it, i) => {
          const topo = yValor(it.valor);
          return (
            <rect
              key={`b-${i}`}
              x={x(i) - larguraCol * 0.32}
              y={topo}
              width={larguraCol * 0.64}
              height={padTop + alturaPlot - topo}
              rx={3}
              fill="var(--azul)"
              opacity={0.85}
            >
              <title>{`${it.label}: ${formatar(it.valor)} (${it.acumulado.toFixed(1)}% acum.)`}</title>
            </rect>
          );
        })}

        {/* Linha de acumulado */}
        <polyline
          points={linhaAcum}
          fill="none"
          stroke="#e02d3c"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
        {itens.map((it, i) => (
          <circle key={`p-${i}`} cx={x(i)} cy={yPct(it.acumulado)} r={3} fill="#e02d3c">
            <title>{`${it.label}: ${it.acumulado.toFixed(1)}% acumulado`}</title>
          </circle>
        ))}

        {/* Rótulos do eixo X (índice do produto) */}
        {itens.map((_, i) => (
          <text key={`x-${i}`} x={x(i)} y={altura - 10} textAnchor="middle" className="pareto-xlabel">
            {i + 1}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Linha (evolução de um valor ao longo do tempo), usada no saldo do kardex.
// ---------------------------------------------------------------------------
export interface PontoLinha {
  rotulo: string;
  valor: number;
}

export function LinhaSaldo({
  pontos,
  formatar,
}: {
  pontos: PontoLinha[];
  formatar: (v: number) => string;
}) {
  if (pontos.length < 2) {
    return <p className="vazio">Poucos pontos para desenhar a evolução.</p>;
  }

  const padTop = 14;
  const padBottom = 24;
  const padX = 10;
  const alturaPlot = 180;
  const passo = 54;
  const largura = Math.max(320, padX * 2 + (pontos.length - 1) * passo);
  const altura = padTop + alturaPlot + padBottom;

  const valores = pontos.map((p) => p.valor);
  const maxV = Math.max(...valores, 1);
  const minV = Math.min(...valores, 0);
  const faixa = maxV - minV || 1;

  const x = (i: number) => padX + i * passo;
  const y = (v: number) => padTop + alturaPlot * (1 - (v - minV) / faixa);

  const linha = pontos.map((p, i) => `${x(i)},${y(p.valor)}`).join(" ");
  const area = `${x(0)},${padTop + alturaPlot} ${linha} ${x(pontos.length - 1)},${padTop + alturaPlot}`;

  return (
    <div className="chart-scroll">
      <svg
        viewBox={`0 0 ${largura} ${altura}`}
        style={{ width: Math.max(largura, 320), maxWidth: "100%", height: altura }}
        preserveAspectRatio="xMinYMid meet"
        className="linha-svg"
      >
        <polygon points={area} fill="var(--azul-suave)" />
        <polyline
          points={linha}
          fill="none"
          stroke="var(--azul)"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
        {pontos.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.valor)} r={3.5} fill="var(--azul)">
              <title>{`${p.rotulo}: ${formatar(p.valor)}`}</title>
            </circle>
            <text x={x(i)} y={altura - 8} textAnchor="middle" className="linha-xlabel">
              {p.rotulo}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
