import { useEffect, useState } from "react";
import type { PeriodoRelatorio, RelatorioDescontos } from "../../types";
import { obterDescontos } from "../../services/relatorios";
import {
  brl,
  dataHoraBR,
  extrairErro,
  PeriodoSeletor,
  pct,
  RelatorioHeader,
} from "./lib";

const icone = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 9h.01" />
    <path d="M15 15h.01" />
    <path d="M16 8L8 16" />
    <rect x="3" y="3" width="18" height="18" rx="3" />
  </svg>
);

export default function DescontosPage() {
  const [periodo, setPeriodo] = useState<PeriodoRelatorio>({ dias: 30 });
  const [dados, setDados] = useState<RelatorioDescontos | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    obterDescontos(periodo)
      .then((d) => ativo && setDados(d))
      .catch((e) => ativo && setErro(extrairErro(e)))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [periodo]);

  const linhas = dados?.linhas ?? [];

  return (
    <div className="page">
      <RelatorioHeader
        titulo="Descontos concedidos"
        icone={icone}
        acoes={<PeriodoSeletor periodo={periodo} onChange={setPeriodo} />}
      />

      {erro && <div className="alert erro">{erro}</div>}

      <div className="kpis">
        <div className="kpi">
          <span className="kpi-label">Total em descontos</span>
          <span className="kpi-valor vermelho">{brl(dados?.total_desconto ?? 0)}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">% médio sobre bruto</span>
          <span className="kpi-valor">{pct(dados?.percentual_medio ?? 0)}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Vendas com desconto</span>
          <span className="kpi-valor">
            {dados?.num_vendas_com_desconto ?? 0}
            <span className="kpi-sub"> de {dados?.num_vendas ?? 0}</span>
          </span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Faturamento bruto</span>
          <span className="kpi-valor">{brl(dados?.total_bruto ?? 0)}</span>
        </div>
      </div>

      <div className="card">
        <h2>Vendas com desconto</h2>
        {carregando ? (
          <p className="vazio">Carregando...</p>
        ) : linhas.length === 0 ? (
          <p className="vazio">Nenhum desconto concedido no período.</p>
        ) : (
          <table className="tabela">
            <thead>
              <tr>
                <th>Data</th>
                <th>Cliente</th>
                <th className="num">Total bruto</th>
                <th className="num">Desconto</th>
                <th className="num">%</th>
                <th className="num">Total líquido</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.venda_id}>
                  <td>{dataHoraBR(l.criado_em)}</td>
                  <td>{l.cliente_nome}</td>
                  <td className="num">{brl(l.total_bruto)}</td>
                  <td className="num vermelho">-{brl(l.desconto)}</td>
                  <td className="num">{pct(l.percentual)}</td>
                  <td className="num">{brl(l.total_liquido)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
