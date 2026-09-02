import { useEffect, useState } from "react";
import type { RelatorioFormaPagamento } from "../../types";
import { obterFormaPagamento } from "../../services/relatorios";
import {
  brl,
  extrairErro,
  PeriodoTabs,
  pct,
  RelatorioHeader,
} from "./lib";
import { DonutChart } from "./Charts";

const icone = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2.5" />
    <path d="M2 10h20" />
  </svg>
);

export default function FormaPagamentoPage() {
  const [dias, setDias] = useState(30);
  const [dados, setDados] = useState<RelatorioFormaPagamento | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    obterFormaPagamento(dias)
      .then((d) => ativo && setDados(d))
      .catch((e) => ativo && setErro(extrairErro(e)))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [dias]);

  const linhas = dados?.linhas ?? [];

  return (
    <div className="page">
      <RelatorioHeader
        titulo="Formas de pagamento"
        icone={icone}
        acoes={<PeriodoTabs dias={dias} onChange={setDias} />}
      />

      {erro && <div className="alert erro">{erro}</div>}

      <div className="kpis">
        <div className="kpi">
          <span className="kpi-label">Faturamento total</span>
          <span className="kpi-valor">{brl(dados?.faturamento_total ?? 0)}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Formas usadas</span>
          <span className="kpi-valor">{linhas.length}</span>
        </div>
      </div>

      {!carregando && linhas.length > 0 && (
        <div className="card">
          <h2>Participação por forma de pagamento</h2>
          <DonutChart
            fatias={linhas.map((l) => ({
              label: l.forma_rotulo,
              valor: parseFloat(l.faturamento) || 0,
            }))}
            formatar={brl}
          />
        </div>
      )}

      <div className="card">
        <h2>Distribuição por forma de pagamento</h2>
        {carregando ? (
          <p className="vazio">Carregando...</p>
        ) : linhas.length === 0 ? (
          <p className="vazio">Sem vendas no período.</p>
        ) : (
          <table className="tabela">
            <thead>
              <tr>
                <th>Forma</th>
                <th className="num">Vendas</th>
                <th className="num">Faturamento</th>
                <th className="num">Participação</th>
                <th style={{ width: "22%" }}></th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.forma}>
                  <td>{l.forma_rotulo}</td>
                  <td className="num">{l.num_vendas}</td>
                  <td className="num">{brl(l.faturamento)}</td>
                  <td className="num">{pct(l.percentual)}</td>
                  <td>
                    <div className="barra-prop">
                      <span style={{ width: `${parseFloat(l.percentual) || 0}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
