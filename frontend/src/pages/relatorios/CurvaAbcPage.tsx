import { useEffect, useState } from "react";
import type { PeriodoRelatorio, RelatorioCurvaAbc } from "../../types";
import { obterCurvaAbc } from "../../services/relatorios";
import { brl, extrairErro, PeriodoSeletor, pct, RelatorioHeader } from "./lib";
import { ParetoChart } from "./Charts";

const icone = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v18h18" />
    <rect x="7" y="10" width="3" height="8" rx="1" />
    <rect x="12" y="6" width="3" height="12" rx="1" />
    <rect x="17" y="13" width="3" height="5" rx="1" />
  </svg>
);

export default function CurvaAbcPage() {
  const [periodo, setPeriodo] = useState<PeriodoRelatorio>({ dias: 30 });
  const [dados, setDados] = useState<RelatorioCurvaAbc | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    obterCurvaAbc(periodo)
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
        titulo="Curva ABC"
        icone={icone}
        acoes={<PeriodoSeletor periodo={periodo} onChange={setPeriodo} />}
      />

      {erro && <div className="alert erro">{erro}</div>}

      <p className="subtitle">
        Classe A concentra até 80% do faturamento, B de 80% a 95% e C o
        restante. Priorize os produtos da classe A.
      </p>

      <div className="kpis">
        <div className="kpi">
          <span className="kpi-label">Faturamento total</span>
          <span className="kpi-valor">{brl(dados?.faturamento_total ?? 0)}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Classe A</span>
          <span className="kpi-valor verde">{dados?.qtd_classe_a ?? 0}</span>
          <span className="kpi-sub">produtos</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Classe B</span>
          <span className="kpi-valor">{dados?.qtd_classe_b ?? 0}</span>
          <span className="kpi-sub">produtos</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Classe C</span>
          <span className="kpi-valor">{dados?.qtd_classe_c ?? 0}</span>
          <span className="kpi-sub">produtos</span>
        </div>
      </div>

      {!carregando && linhas.length > 0 && (
        <div className="card">
          <h2>Pareto — top 15 por faturamento</h2>
          <p className="muted" style={{ marginBottom: "1rem" }}>
            Barras = faturamento de cada produto. Linha vermelha = % acumulado.
            As tracejadas marcam os limites 80% (classe A) e 95% (classe B).
          </p>
          <ParetoChart
            itens={linhas.slice(0, 15).map((l) => ({
              label: l.produto_nome,
              valor: parseFloat(l.faturamento) || 0,
              acumulado: parseFloat(l.percentual_acumulado) || 0,
            }))}
            formatar={brl}
          />
        </div>
      )}

      <div className="card">
        <h2>Produtos por faturamento</h2>
        {carregando ? (
          <p className="vazio">Carregando...</p>
        ) : linhas.length === 0 ? (
          <p className="vazio">Sem vendas no período.</p>
        ) : (
          <table className="tabela">
            <thead>
              <tr>
                <th>Classe</th>
                <th>Produto</th>
                <th className="num">Qtd.</th>
                <th className="num">Faturamento</th>
                <th className="num">%</th>
                <th className="num">% acum.</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={`${l.produto_id}-${l.produto_nome}`}>
                  <td>
                    <span className={`chip classe-${l.classe.toLowerCase()}`}>
                      {l.classe}
                    </span>
                  </td>
                  <td>{l.produto_nome}</td>
                  <td className="num">{l.quantidade}</td>
                  <td className="num">{brl(l.faturamento)}</td>
                  <td className="num">{pct(l.percentual)}</td>
                  <td className="num muted">{pct(l.percentual_acumulado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
