import { useEffect, useState } from "react";
import type { RelatorioVendasCategoria } from "../../types";
import { obterVendasCategoria } from "../../services/relatorios";
import { brl, extrairErro, PeriodoTabs, pct, RelatorioHeader } from "./lib";
import { DonutChart } from "./Charts";

const icone = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

export default function VendasCategoriaPage() {
  const [dias, setDias] = useState(30);
  const [dados, setDados] = useState<RelatorioVendasCategoria | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    obterVendasCategoria(dias)
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
        titulo="Vendas por categoria"
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
          <span className="kpi-label">Categorias com venda</span>
          <span className="kpi-valor">{linhas.length}</span>
        </div>
      </div>

      {!carregando && linhas.length > 0 && (
        <div className="card">
          <h2>Participação no faturamento</h2>
          <DonutChart
            fatias={linhas.map((l) => ({
              label: l.categoria_nome,
              valor: parseFloat(l.faturamento) || 0,
            }))}
            formatar={brl}
          />
        </div>
      )}

      <div className="card">
        <h2>Desempenho por categoria</h2>
        {carregando ? (
          <p className="vazio">Carregando...</p>
        ) : linhas.length === 0 ? (
          <p className="vazio">Sem vendas no período.</p>
        ) : (
          <table className="tabela">
            <thead>
              <tr>
                <th>Categoria</th>
                <th className="num">Qtd.</th>
                <th className="num">Faturamento</th>
                <th className="num">Lucro</th>
                <th className="num">Participação</th>
                <th style={{ width: "20%" }}></th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr key={`${l.categoria_id ?? "sem"}-${i}`}>
                  <td>{l.categoria_nome}</td>
                  <td className="num">{l.quantidade}</td>
                  <td className="num">{brl(l.faturamento)}</td>
                  <td className="num verde">{brl(l.lucro)}</td>
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
