import { useEffect, useState } from "react";
import type { RelatorioComprasFornecedor } from "../../types";
import { obterComprasFornecedor } from "../../services/relatorios";
import { brl, extrairErro, PeriodoTabs, RelatorioHeader } from "./lib";
import { DonutChart } from "./Charts";

const icone = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l1.5-4.5A1.5 1.5 0 0 1 6 3.5h12a1.5 1.5 0 0 1 1.5 1L21 9" />
    <path d="M3 9h18v3a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z" />
    <path d="M4 12v8h16v-8" />
  </svg>
);

export default function ComprasFornecedorPage() {
  const [dias, setDias] = useState(30);
  const [dados, setDados] = useState<RelatorioComprasFornecedor | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    obterComprasFornecedor(dias)
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
        titulo="Compras por fornecedor"
        icone={icone}
        acoes={<PeriodoTabs dias={dias} onChange={setDias} />}
      />

      {erro && <div className="alert erro">{erro}</div>}

      <p className="subtitle">
        Baseado nas entradas de estoque com custo informado no período.
      </p>

      <div className="kpis">
        <div className="kpi">
          <span className="kpi-label">Total comprado</span>
          <span className="kpi-valor">{brl(dados?.valor_total_geral ?? 0)}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Fornecedores</span>
          <span className="kpi-valor">{linhas.length}</span>
        </div>
      </div>

      {!carregando &&
        linhas.some((l) => (parseFloat(l.valor_total) || 0) > 0) && (
          <div className="card">
            <h2>Participação nas compras</h2>
            <DonutChart
              fatias={linhas
                .filter((l) => (parseFloat(l.valor_total) || 0) > 0)
                .map((l) => ({
                  label: l.fornecedor_nome,
                  valor: parseFloat(l.valor_total) || 0,
                }))}
              formatar={brl}
            />
          </div>
        )}

      <div className="card">
        <h2>Compras por fornecedor</h2>
        {carregando ? (
          <p className="vazio">Carregando...</p>
        ) : linhas.length === 0 ? (
          <p className="vazio">Nenhuma entrada de compra no período.</p>
        ) : (
          <table className="tabela">
            <thead>
              <tr>
                <th>Fornecedor</th>
                <th className="num">Entradas</th>
                <th className="num">Qtd. total</th>
                <th className="num">Valor comprado</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr key={`${l.fornecedor_id ?? "sem"}-${i}`}>
                  <td>{l.fornecedor_nome}</td>
                  <td className="num">{l.num_entradas}</td>
                  <td className="num">{l.quantidade_total}</td>
                  <td className="num">{brl(l.valor_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
