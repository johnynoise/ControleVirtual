import { useEffect, useState } from "react";
import type { PeriodoRelatorio, RelatorioResultado } from "../../types";
import { obterResultado } from "../../services/relatorios";
import {
  ATALHOS_MES,
  brl,
  dataBR,
  DeltaValor,
  extrairErro,
  num,
  PeriodoSeletor,
  pct,
  RelatorioHeader,
} from "./lib";

const icone = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v20" />
    <path d="M17 6.5c0-1.9-2.2-3-5-3s-5 1.1-5 3 2.2 2.8 5 3.2 5 1.3 5 3.3-2.2 3-5 3-5-1.1-5-3" />
  </svg>
);

// Neste relatório o mês é o recorte natural; os "últimos N dias" ficam como
// alternativa, sem o de 7 dias (período curto demais para uma apuração).
const OPCOES = [
  { valor: 30, rotulo: "30 dias" },
  { valor: 90, rotulo: "90 dias" },
];

export default function ResultadoPage() {
  const [periodo, setPeriodo] = useState<PeriodoRelatorio>(
    ATALHOS_MES[0].intervalo()
  );
  const [dados, setDados] = useState<RelatorioResultado | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    obterResultado(periodo)
      .then((d) => ativo && setDados(d))
      .catch((e) => ativo && setErro(extrairErro(e)))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [periodo]);

  const a = dados?.atual;
  const ant = dados?.anterior;
  const sobra = num(a?.resultado_operacional);
  const comparacao = dados
    ? `${dataBR(dados.anterior_inicio)} a ${dataBR(dados.anterior_fim)}`
    : "";

  return (
    <div className="page">
      <RelatorioHeader
        titulo="Resultado do período"
        icone={icone}
        acoes={
          <PeriodoSeletor
            periodo={periodo}
            onChange={setPeriodo}
            opcoes={OPCOES}
            atalhos={ATALHOS_MES}
          />
        }
      />

      {erro && <div className="alert erro">{erro}</div>}

      <p className="subtitle">
        Quanto sobrou depois de pagar a mercadoria e as despesas. As despesas
        entram pelo mês a que se referem (competência), pagas ou não — então a
        sobra aqui não é o dinheiro que está no caixa.
      </p>

      <div className="kpis">
        <div className="kpi">
          <span className="kpi-label">Faturamento</span>
          <span className="kpi-valor">{brl(a?.receita ?? 0)}</span>
          {ant && <DeltaValor atual={a?.receita} anterior={ant.receita} />}
        </div>
        <div className="kpi">
          <span className="kpi-label">Lucro bruto</span>
          <span className="kpi-valor">{brl(a?.lucro_bruto ?? 0)}</span>
          <span className="kpi-sub">
            margem {pct(a?.margem_bruta_percentual ?? 0)}
            {ant && <DeltaValor atual={a?.lucro_bruto} anterior={ant.lucro_bruto} />}
          </span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Despesas</span>
          <span className="kpi-valor">{brl(a?.despesas_operacionais ?? 0)}</span>
          {ant && (
            <DeltaValor
              atual={a?.despesas_operacionais}
              anterior={ant.despesas_operacionais}
              inverso
            />
          )}
        </div>
        <div className="kpi">
          <span className="kpi-label">Sobrou</span>
          <span className={`kpi-valor ${sobra < 0 ? "vermelho" : "verde"}`}>
            {brl(a?.resultado_operacional ?? 0)}
          </span>
          <span className="kpi-sub">
            margem {pct(a?.margem_liquida_percentual ?? 0)}
            {ant && (
              <DeltaValor
                atual={a?.resultado_operacional}
                anterior={ant.resultado_operacional}
              />
            )}
          </span>
        </div>
      </div>
      {dados && (
        <p className="kpis-legenda">Variação comparada a {comparacao}.</p>
      )}

      <div className="card">
        <h2>Como chegou nesse número</h2>
        <p className="subtitle">
          Os valores se encadeiam de cima para baixo. A coluna da direita é o
          período de comparação, para você ver o que mudou em cada linha.
        </p>
        {carregando || !a || !ant ? (
          <p className="vazio">Carregando...</p>
        ) : (
          <table className="tabela fiscal-dre">
            <thead>
              <tr>
                <th></th>
                <th className="num">
                  {dataBR(dados?.inicio)} a {dataBR(dados?.fim)}
                </th>
                <th className="num muted">{comparacao}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Faturamento</td>
                <td className="num">{brl(a.receita)}</td>
                <td className="num muted">{brl(ant.receita)}</td>
              </tr>
              <tr>
                <td className="muted">(−) Custo da mercadoria vendida</td>
                <td className="num">{brl(a.cmv)}</td>
                <td className="num muted">{brl(ant.cmv)}</td>
              </tr>
              <tr className="fiscal-dre-subtotal">
                <td>= Lucro bruto</td>
                <td className="num">{brl(a.lucro_bruto)}</td>
                <td className="num muted">{brl(ant.lucro_bruto)}</td>
              </tr>
              <tr>
                <td className="muted">(−) Perdas e quebras</td>
                <td className="num">{brl(a.perdas)}</td>
                <td className="num muted">{brl(ant.perdas)}</td>
              </tr>
              <tr>
                <td className="muted">(−) Despesas operacionais</td>
                <td className="num">{brl(a.despesas_operacionais)}</td>
                <td className="num muted">{brl(ant.despesas_operacionais)}</td>
              </tr>
              <tr className="fiscal-dre-total">
                <td>= Sobrou</td>
                <td className={`num ${sobra < 0 ? "vermelho" : ""}`}>
                  {brl(a.resultado_operacional)}
                </td>
                <td className="num muted">{brl(ant.resultado_operacional)}</td>
              </tr>
            </tbody>
          </table>
        )}

        {a && (
          <div className="kpis fiscal-kpis">
            <div className="kpi">
              <span className="kpi-label">Vendas</span>
              <span className="kpi-valor">{a.num_vendas}</span>
              {ant && <DeltaValor atual={a.num_vendas} anterior={ant.num_vendas} />}
            </div>
            <div className="kpi">
              <span className="kpi-label">Ticket médio</span>
              <span className="kpi-valor">{brl(a.ticket_medio)}</span>
              {ant && <DeltaValor atual={a.ticket_medio} anterior={ant.ticket_medio} />}
            </div>
            <div className="kpi">
              <span className="kpi-label">Descontos dados</span>
              <span className="kpi-valor">{brl(a.desconto_total)}</span>
              {ant && (
                <DeltaValor
                  atual={a.desconto_total}
                  anterior={ant.desconto_total}
                  inverso
                />
              )}
            </div>
            <div className="kpi">
              <span className="kpi-label">Margem líquida</span>
              <span className="kpi-valor">{pct(a.margem_liquida_percentual)}</span>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Despesas do período</h2>
        {carregando ? (
          <p className="vazio">Carregando...</p>
        ) : !dados || dados.despesas_quantidade === 0 ? (
          <p className="vazio">
            Nenhuma despesa lançada no período. Sem elas, a sobra acima está
            superestimada.
          </p>
        ) : (
          <>
            <div className="kpis fiscal-kpis">
              <div className="kpi">
                <span className="kpi-label">Total lançado</span>
                <span className="kpi-valor">{brl(dados.despesas_total)}</span>
                <span className="kpi-sub">{dados.despesas_quantidade} despesas</span>
              </div>
              <div className="kpi">
                <span className="kpi-label">Operacionais</span>
                <span className="kpi-valor">{brl(a?.despesas_operacionais ?? 0)}</span>
                <span className="kpi-sub">entram no resultado</span>
              </div>
              <div className="kpi">
                <span className="kpi-label">Não operacionais</span>
                <span className="kpi-valor">
                  {brl(dados.despesas_nao_operacionais)}
                </span>
                <span className="kpi-sub">retiradas, investimentos</span>
              </div>
              <div className="kpi">
                <span className="kpi-label">Ainda não pagas</span>
                <span className="kpi-valor">{brl(dados.despesas_em_aberto)}</span>
                <span className="kpi-sub">não saíram do caixa</span>
              </div>
            </div>

            {dados.despesas_por_categoria.length > 0 && (
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Categoria</th>
                    <th className="num">Lançamentos</th>
                    <th className="num">Total</th>
                    <th className="num">%</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.despesas_por_categoria.map((c) => (
                    <tr key={c.categoria}>
                      <td>{c.categoria_rotulo}</td>
                      <td className="num">{c.quantidade}</td>
                      <td className="num">{brl(c.total)}</td>
                      <td className="num muted">{pct(c.percentual)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

      {dados && dados.avisos.length > 0 && (
        <div className="card fiscal-avisos">
          <h2>Como ler estes números</h2>
          <ul>
            {dados.avisos.map((aviso, i) => (
              <li key={i}>{aviso}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
