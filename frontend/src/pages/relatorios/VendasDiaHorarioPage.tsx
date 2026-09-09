import { useEffect, useMemo, useState } from "react";
import type { PeriodoRelatorio, RelatorioVendasDiaHorario } from "../../types";
import { obterVendasDiaHorario } from "../../services/relatorios";
import { extrairErro, PeriodoSeletor, RelatorioHeader } from "./lib";
import GraficoBarras, { type BarraDado } from "../../components/GraficoBarras";

const icone = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="17" rx="2" />
    <path d="M3 9h18" />
    <path d="M8 2v4" />
    <path d="M16 2v4" />
  </svg>
);

export default function VendasDiaHorarioPage() {
  const [periodo, setPeriodo] = useState<PeriodoRelatorio>({ dias: 30 });
  const [dados, setDados] = useState<RelatorioVendasDiaHorario | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    obterVendasDiaHorario(periodo)
      .then((d) => ativo && setDados(d))
      .catch((e) => ativo && setErro(extrairErro(e)))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [periodo]);

  const porDia = dados?.por_dia_semana ?? [];
  const porHora = dados?.por_hora ?? [];

  const dadosDia = useMemo<BarraDado[]>(
    () =>
      porDia.map((d) => ({
        rotulo: d.rotulo.slice(0, 3),
        valor: parseFloat(d.faturamento) || 0,
        detalhe: `${d.num_vendas} venda(s)`,
      })),
    [porDia]
  );
  const dadosHora = useMemo<BarraDado[]>(
    () =>
      porHora.map((h) => ({
        rotulo: `${String(h.hora).padStart(2, "0")}h`,
        valor: parseFloat(h.faturamento) || 0,
        detalhe: `${h.num_vendas} venda(s)`,
      })),
    [porHora]
  );

  return (
    <div className="page">
      <RelatorioHeader
        titulo="Vendas por dia e horário"
        icone={icone}
        acoes={<PeriodoSeletor periodo={periodo} onChange={setPeriodo} />}
      />

      {erro && <div className="alert erro">{erro}</div>}

      <div className="kpis">
        <div className="kpi">
          <span className="kpi-label">Melhor dia</span>
          <span className="kpi-valor">{dados?.melhor_dia ?? "—"}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Melhor horário</span>
          <span className="kpi-valor">
            {dados?.melhor_hora != null ? `${String(dados.melhor_hora).padStart(2, "0")}h` : "—"}
          </span>
        </div>
      </div>

      <div className="card">
        <h2>Faturamento por dia da semana</h2>
        {carregando ? (
          <p className="vazio">Carregando...</p>
        ) : (
          <GraficoBarras dados={dadosDia} mostrarValorNoTopo />
        )}
      </div>

      <div className="card">
        <h2>Faturamento por hora do dia</h2>
        {carregando ? (
          <p className="vazio">Carregando...</p>
        ) : (
          <GraficoBarras dados={dadosHora} />
        )}
      </div>
    </div>
  );
}
