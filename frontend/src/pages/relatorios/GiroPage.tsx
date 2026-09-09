import { useEffect, useState } from "react";
import type { PeriodoRelatorio, RelatorioGiro } from "../../types";
import { obterGiro } from "../../services/relatorios";
import { extrairErro, PeriodoSeletor, RelatorioHeader } from "./lib";

const icone = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-3-6.7" />
    <path d="M21 4v5h-5" />
  </svg>
);

/** Cor do chip de cobertura conforme urgência. */
function classeCobertura(dias: number | null): string {
  if (dias == null) return "";
  if (dias <= 7) return "mov-saida";
  if (dias <= 30) return "mov-ajuste";
  return "mov-entrada";
}

export default function GiroPage() {
  const [periodo, setPeriodo] = useState<PeriodoRelatorio>({ dias: 30 });
  const [dados, setDados] = useState<RelatorioGiro | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    obterGiro(periodo)
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
        titulo="Giro e cobertura"
        icone={icone}
        acoes={<PeriodoSeletor periodo={periodo} onChange={setPeriodo} />}
      />

      {erro && <div className="alert erro">{erro}</div>}

      <p className="subtitle">
        Cobertura é quantos dias o estoque atual dura no ritmo de venda do
        período. Os itens que vão acabar antes aparecem no topo.
      </p>

      <div className="kpis">
        <div className="kpi">
          <span className="kpi-label">Produtos analisados</span>
          <span className="kpi-valor">{dados?.qtd_produtos ?? 0}</span>
        </div>
      </div>

      <div className="card">
        <h2>Cobertura por produto</h2>
        {carregando ? (
          <p className="vazio">Carregando...</p>
        ) : linhas.length === 0 ? (
          <p className="vazio">Nenhum produto ativo.</p>
        ) : (
          <table className="tabela">
            <thead>
              <tr>
                <th>Produto</th>
                <th className="num">Estoque</th>
                <th className="num">Vendido (período)</th>
                <th className="num">Venda média/dia</th>
                <th className="num">Cobertura</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.produto_id}>
                  <td>{l.produto_nome}</td>
                  <td className="num">{l.estoque}</td>
                  <td className="num">{l.qtd_vendida}</td>
                  <td className="num">{l.venda_media_diaria}</td>
                  <td className="num">
                    {l.cobertura_dias == null ? (
                      <span className="muted">sem giro</span>
                    ) : (
                      <span className={`chip ${classeCobertura(l.cobertura_dias)}`}>
                        {l.cobertura_dias} dias
                      </span>
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
