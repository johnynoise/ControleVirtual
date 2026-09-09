import { useEffect, useState } from "react";
import type { PeriodoRelatorio, RelatorioProdutosFaturamento } from "../../types";
import { obterProdutosFaturamento } from "../../services/relatorios";
import { brl, extrairErro, num, PeriodoSeletor, pct, RelatorioHeader } from "./lib";
import { DonutChart, ParetoChart } from "./Charts";

const icone = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v18h18" />
    <rect x="7" y="10" width="3" height="8" rx="1" />
    <rect x="12" y="6" width="3" height="12" rx="1" />
    <rect x="17" y="13" width="3" height="5" rx="1" />
  </svg>
);

type Grao = "produto" | "categoria";

const ABAS: { chave: Grao; rotulo: string }[] = [
  { chave: "produto", rotulo: "Por produto" },
  { chave: "categoria", rotulo: "Por categoria" },
];

export default function ProdutosFaturamentoPage() {
  const [periodo, setPeriodo] = useState<PeriodoRelatorio>({ dias: 30 });
  const [grao, setGrao] = useState<Grao>("produto");
  const [dados, setDados] = useState<RelatorioProdutosFaturamento | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    obterProdutosFaturamento(periodo)
      .then((d) => ativo && setDados(d))
      .catch((e) => ativo && setErro(extrairErro(e)))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [periodo]);

  const produtos = dados?.por_produto ?? [];
  const categorias = dados?.por_categoria ?? [];
  const vazio = grao === "produto" ? produtos.length === 0 : categorias.length === 0;

  return (
    <div className="page">
      <RelatorioHeader
        titulo="De onde vem o faturamento"
        icone={icone}
        acoes={<PeriodoSeletor periodo={periodo} onChange={setPeriodo} />}
      />

      {erro && <div className="alert erro">{erro}</div>}

      <p className="subtitle">
        Quais produtos e categorias sustentam a sua receita. Olhe o lucro junto
        do faturamento: vender muito com margem baixa não é o mesmo que vender
        muito com margem boa.
      </p>

      <div className="kpis">
        <div className="kpi">
          <span className="kpi-label">Faturamento</span>
          <span className="kpi-valor">{brl(dados?.faturamento_total ?? 0)}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Lucro</span>
          <span className="kpi-valor verde">{brl(dados?.lucro_total ?? 0)}</span>
          <span className="kpi-sub">
            margem{" "}
            {pct(
              dados && num(dados.faturamento_total) > 0
                ? (num(dados.lucro_total) / num(dados.faturamento_total)) * 100
                : 0
            )}
          </span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Classe A</span>
          <span className="kpi-valor">{dados?.qtd_classe_a ?? 0}</span>
          <span className="kpi-sub">até 80% do faturamento</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Classes B e C</span>
          <span className="kpi-valor">
            {(dados?.qtd_classe_b ?? 0) + (dados?.qtd_classe_c ?? 0)}
          </span>
          <span className="kpi-sub">os outros 20%</span>
        </div>
      </div>

      <div className="card">
        <div className="periodo-tabs" style={{ marginBottom: "1rem" }}>
          {ABAS.map((a) => (
            <button
              key={a.chave}
              className={`btn ${grao === a.chave ? "primario" : "secundario"} pequeno`}
              onClick={() => setGrao(a.chave)}
            >
              {a.rotulo}
            </button>
          ))}
        </div>

        {carregando ? (
          <p className="vazio">Carregando...</p>
        ) : vazio ? (
          <p className="vazio">Sem vendas no período.</p>
        ) : grao === "produto" ? (
          <>
            <p className="muted" style={{ marginBottom: "1rem" }}>
              Barras = faturamento de cada produto. Linha = % acumulado. As
              tracejadas marcam 80% (classe A) e 95% (classe B). Priorize a
              classe A: são os produtos que não podem faltar.
            </p>
            <ParetoChart
              itens={produtos.slice(0, 15).map((l) => ({
                label: l.produto_nome,
                valor: num(l.faturamento),
                acumulado: num(l.percentual_acumulado),
              }))}
              formatar={brl}
            />
            <table className="tabela" style={{ marginTop: "1.5rem" }}>
              <thead>
                <tr>
                  <th>Classe</th>
                  <th>Produto</th>
                  <th>Categoria</th>
                  <th className="num">Qtd.</th>
                  <th className="num">Faturamento</th>
                  <th className="num">Lucro</th>
                  <th className="num">Margem</th>
                  <th className="num">% acum.</th>
                </tr>
              </thead>
              <tbody>
                {produtos.map((l) => (
                  <tr key={`${l.produto_id}-${l.produto_nome}`}>
                    <td>
                      <span className={`chip classe-${l.classe.toLowerCase()}`}>
                        {l.classe}
                      </span>
                    </td>
                    <td>{l.produto_nome}</td>
                    <td className="muted">{l.categoria_nome}</td>
                    <td className="num">{l.quantidade}</td>
                    <td className="num">{brl(l.faturamento)}</td>
                    <td className="num verde">{brl(l.lucro)}</td>
                    <td className="num">{pct(l.margem_percentual)}</td>
                    <td className="num muted">{pct(l.percentual_acumulado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <>
            <DonutChart
              fatias={categorias.map((l) => ({
                label: l.categoria_nome,
                valor: num(l.faturamento),
              }))}
              formatar={brl}
            />
            <table className="tabela" style={{ marginTop: "1.5rem" }}>
              <thead>
                <tr>
                  <th>Categoria</th>
                  <th className="num">Qtd.</th>
                  <th className="num">Faturamento</th>
                  <th className="num">Lucro</th>
                  <th className="num">Margem</th>
                  <th className="num">Participação</th>
                  <th style={{ width: "18%" }}></th>
                </tr>
              </thead>
              <tbody>
                {categorias.map((l, i) => (
                  <tr key={`${l.categoria_id ?? "sem"}-${i}`}>
                    <td>{l.categoria_nome}</td>
                    <td className="num">{l.quantidade}</td>
                    <td className="num">{brl(l.faturamento)}</td>
                    <td className="num verde">{brl(l.lucro)}</td>
                    <td className="num">{pct(l.margem_percentual)}</td>
                    <td className="num">{pct(l.percentual)}</td>
                    <td>
                      <div className="barra-prop">
                        <span style={{ width: `${num(l.percentual)}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
