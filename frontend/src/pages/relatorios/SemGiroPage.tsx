import { useEffect, useState } from "react";
import type { PeriodoRelatorio, RelatorioSemGiro } from "../../types";
import { obterSemGiro } from "../../services/relatorios";
import { brl, dataBR, extrairErro, PeriodoSeletor, RelatorioHeader } from "./lib";

const icone = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export default function SemGiroPage() {
  const [periodo, setPeriodo] = useState<PeriodoRelatorio>({ dias: 30 });
  const [dados, setDados] = useState<RelatorioSemGiro | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    obterSemGiro(periodo)
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
        titulo="Produtos sem giro"
        icone={icone}
        acoes={<PeriodoSeletor periodo={periodo} onChange={setPeriodo} />}
      />

      {erro && <div className="alert erro">{erro}</div>}

      <p className="subtitle">
        Produtos ativos que não venderam nenhuma unidade no período. É capital
        parado em estoque — candidatos a promoção ou liquidação.
      </p>

      <div className="kpis">
        <div className="kpi">
          <span className="kpi-label">Produtos sem giro</span>
          <span className="kpi-valor">{dados?.qtd_produtos ?? 0}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Capital parado</span>
          <span className="kpi-valor vermelho">
            {brl(dados?.valor_parado_total ?? 0)}
          </span>
          <span className="kpi-sub">estoque × custo</span>
        </div>
      </div>

      <div className="card">
        <h2>Itens parados</h2>
        {carregando ? (
          <p className="vazio">Carregando...</p>
        ) : linhas.length === 0 ? (
          <p className="vazio">Todos os produtos ativos tiveram venda no período. 🎉</p>
        ) : (
          <table className="tabela">
            <thead>
              <tr>
                <th>Produto</th>
                <th className="num">Estoque</th>
                <th className="num">Capital parado</th>
                <th>Última venda</th>
                <th className="num">Dias sem vender</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.produto_id}>
                  <td>{l.produto_nome}</td>
                  <td className="num">{l.estoque}</td>
                  <td className="num">{brl(l.valor_parado)}</td>
                  <td>{dataBR(l.ultima_venda)}</td>
                  <td className="num">
                    {l.dias_sem_venda == null ? (
                      <span className="muted">nunca vendeu</span>
                    ) : (
                      l.dias_sem_venda
                    )}
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
