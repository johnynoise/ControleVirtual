import { useEffect, useState } from "react";
import type { PeriodoRelatorio, RelatorioRankingClientes } from "../../types";
import { obterRankingClientes } from "../../services/relatorios";
import { brl, dataBR, extrairErro, PeriodoSeletor, pct, RelatorioHeader } from "./lib";
import { BarrasHorizontais } from "./Charts";

const icone = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M16 4.5a3.5 3.5 0 0 1 0 7" />
    <path d="M17.5 13.5a6.5 6.5 0 0 1 4 6.5" />
  </svg>
);

export default function RankingClientesPage() {
  const [periodo, setPeriodo] = useState<PeriodoRelatorio>({ dias: 30 });
  const [dados, setDados] = useState<RelatorioRankingClientes | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    obterRankingClientes(periodo)
      .then((d) => ativo && setDados(d))
      .catch((e) => ativo && setErro(extrairErro(e)))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [periodo]);

  const linhas = dados?.linhas ?? [];
  const maxFat = Math.max(1, ...linhas.map((l) => parseFloat(l.faturamento) || 0));

  return (
    <div className="page">
      <RelatorioHeader
        titulo="Ranking de clientes"
        icone={icone}
        acoes={<PeriodoSeletor periodo={periodo} onChange={setPeriodo} />}
      />

      {erro && <div className="alert erro">{erro}</div>}

      <div className="kpis">
        <div className="kpi">
          <span className="kpi-label">Clientes com compras</span>
          <span className="kpi-valor">{dados?.qtd_clientes ?? 0}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Faturamento com cliente</span>
          <span className="kpi-valor">{brl(dados?.faturamento_identificado ?? 0)}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Vendas de balcão</span>
          <span className="kpi-valor">{dados?.num_vendas_sem_cliente ?? 0}</span>
          <span className="kpi-sub">
            {brl(dados?.faturamento_sem_cliente ?? 0)} ·{" "}
            {pct(dados?.percentual_sem_cliente ?? 0)} do total
          </span>
        </div>
      </div>

      {dados && dados.num_vendas_sem_cliente > 0 && (
        <p className="subtitle">
          As {dados.num_vendas_sem_cliente} vendas sem cliente identificado
          ficam fora do ranking — somadas, elas apareceriam em primeiro lugar e
          esconderiam os clientes de verdade. Identificar o cliente na venda
          aumenta o alcance deste relatório.
        </p>
      )}

      {!carregando && linhas.length > 0 && (
        <div className="card">
          <h2>Top clientes por faturamento</h2>
          <BarrasHorizontais
            barras={linhas.slice(0, 8).map((l) => ({
              label: l.cliente_nome,
              valor: parseFloat(l.faturamento) || 0,
            }))}
            formatar={brl}
          />
        </div>
      )}

      <div className="card">
        <h2>Quem mais compra</h2>
        {carregando ? (
          <p className="vazio">Carregando...</p>
        ) : linhas.length === 0 ? (
          <p className="vazio">Sem vendas no período.</p>
        ) : (
          <table className="tabela">
            <thead>
              <tr>
                <th style={{ width: "3rem" }}>#</th>
                <th>Cliente</th>
                <th className="num">Compras</th>
                <th className="num">Faturamento</th>
                <th className="num">Ticket médio</th>
                <th>Última compra</th>
                <th style={{ width: "16%" }}></th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr key={`${l.cliente_id ?? "sem"}-${i}`}>
                  <td className="muted">{i + 1}</td>
                  <td>{l.cliente_nome}</td>
                  <td className="num">{l.num_compras}</td>
                  <td className="num">{brl(l.faturamento)}</td>
                  <td className="num">{brl(l.ticket_medio)}</td>
                  <td>{dataBR(l.ultima_compra)}</td>
                  <td>
                    <div className="barra-prop">
                      <span
                        style={{
                          width: `${((parseFloat(l.faturamento) || 0) / maxFat) * 100}%`,
                        }}
                      />
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
