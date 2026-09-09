import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type {
  PeriodoRelatorio,
  RelatorioSaudeEstoque,
  SituacaoEstoque,
} from "../../types";
import { obterSaudeEstoque } from "../../services/relatorios";
import { brl, dataBR, extrairErro, PeriodoSeletor, RelatorioHeader } from "./lib";

const icone = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2 3 7v10l9 5 9-5V7z" />
    <path d="M3 7l9 5 9-5" />
    <path d="M12 12v10" />
  </svg>
);

/** As duas perguntas de estoque, cada uma com o recorte que lhe interessa. */
const ABAS: { chave: SituacaoEstoque; rotulo: string }[] = [
  { chave: "repor", rotulo: "Vai faltar" },
  { chave: "parado", rotulo: "Está parado" },
];

/** Cor do chip de cobertura conforme a urgência. */
function classeCobertura(dias: number | null): string {
  if (dias == null) return "";
  if (dias <= 7) return "mov-saida";
  if (dias <= 30) return "mov-ajuste";
  return "mov-entrada";
}

export default function SaudeEstoquePage() {
  const [periodo, setPeriodo] = useState<PeriodoRelatorio>({ dias: 30 });
  const [aba, setAba] = useState<SituacaoEstoque>("repor");
  const [dados, setDados] = useState<RelatorioSaudeEstoque | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    obterSaudeEstoque(periodo)
      .then((d) => ativo && setDados(d))
      .catch((e) => ativo && setErro(extrairErro(e)))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [periodo]);

  // A lista vem ordenada servindo as duas abas; aqui só filtramos.
  const linhas = (dados?.linhas ?? []).filter((l) => l.situacao === aba);
  const limite = dados?.cobertura_curta_dias ?? 30;

  return (
    <div className="page">
      <RelatorioHeader
        titulo="Saúde do estoque"
        icone={icone}
        acoes={<PeriodoSeletor periodo={periodo} onChange={setPeriodo} />}
      />

      {erro && <div className="alert erro">{erro}</div>}

      <p className="subtitle">
        As duas pontas do estoque, calculadas do mesmo jeito: o que vai acabar
        no ritmo de venda do período e o que está encalhado prendendo dinheiro.
      </p>

      <div className="kpis">
        <div className="kpi">
          <span className="kpi-label">Vai faltar</span>
          <span className={`kpi-valor ${(dados?.qtd_repor ?? 0) > 0 ? "vermelho" : ""}`}>
            {dados?.qtd_repor ?? 0}
          </span>
          <span className="kpi-sub">dura {limite} dias ou menos</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Está parado</span>
          <span className="kpi-valor">{dados?.qtd_parado ?? 0}</span>
          <span className="kpi-sub">sem vender no período</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Capital parado</span>
          <span className="kpi-valor">{brl(dados?.valor_parado_total ?? 0)}</span>
          <span className="kpi-sub">
            de {brl(dados?.valor_estoque_total ?? 0)} em estoque
          </span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Produtos ativos</span>
          <span className="kpi-valor">{dados?.qtd_produtos ?? 0}</span>
          {dados != null && dados.qtd_sem_estoque > 0 && (
            <span className="kpi-sub">
              {dados.qtd_sem_estoque} sem estoque e sem venda
            </span>
          )}
        </div>
      </div>

      <div className="card">
        <div className="periodo-tabs" style={{ marginBottom: "1rem" }}>
          {ABAS.map((a) => (
            <button
              key={a.chave}
              className={`btn ${aba === a.chave ? "primario" : "secundario"} pequeno`}
              onClick={() => setAba(a.chave)}
            >
              {a.rotulo}
              {dados != null && (
                <> ({a.chave === "repor" ? dados.qtd_repor : dados.qtd_parado})</>
              )}
            </button>
          ))}
        </div>

        {aba === "repor" ? (
          <p className="muted" style={{ marginBottom: "1rem" }}>
            Cobertura é quantos dias o estoque atual dura no ritmo de venda do
            período. Quem acaba primeiro está no topo.
          </p>
        ) : (
          <p className="muted" style={{ marginBottom: "1rem" }}>
            Produtos com estoque que não venderam nada no período. Maior capital
            imobilizado primeiro — candidatos a promoção ou liquidação.
          </p>
        )}

        {carregando ? (
          <p className="vazio">Carregando...</p>
        ) : linhas.length === 0 ? (
          <p className="vazio">
            {aba === "repor"
              ? "Nenhum produto com risco de faltar. 🎉"
              : "Todos os produtos com estoque venderam no período. 🎉"}
          </p>
        ) : aba === "repor" ? (
          <table className="tabela">
            <thead>
              <tr>
                <th>Produto</th>
                <th className="num">Estoque</th>
                <th className="num">Mínimo</th>
                <th className="num">Vendido</th>
                <th className="num">Venda média/dia</th>
                <th className="num">Cobertura</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.produto_id}>
                  <td>
                    <Link to={`/relatorios/kardex?produto_id=${l.produto_id}`}>
                      {l.produto_nome}
                    </Link>
                  </td>
                  <td className="num">{l.estoque}</td>
                  <td className="num muted">{l.estoque_minimo}</td>
                  <td className="num">{l.qtd_vendida}</td>
                  <td className="num">{l.venda_media_diaria}</td>
                  <td className="num">
                    <span className={`chip ${classeCobertura(l.cobertura_dias)}`}>
                      {l.cobertura_dias} dias
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
                  <td>
                    <Link to={`/relatorios/kardex?produto_id=${l.produto_id}`}>
                      {l.produto_nome}
                    </Link>
                  </td>
                  <td className="num">{l.estoque}</td>
                  <td className="num">{brl(l.valor_em_estoque)}</td>
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
