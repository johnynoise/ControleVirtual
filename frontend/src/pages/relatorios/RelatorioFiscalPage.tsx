import { useEffect, useMemo, useState } from "react";
import type { RelatorioFiscal } from "../../types";
import {
  listarAnosFiscais,
  obterRelatorioFiscal,
  type PeriodoFiscal,
} from "../../services/fiscal";
import { baixarCsvFiscal } from "../../lib/fiscalCsv";
import { brl, dataBR, extrairErro, pct, RelatorioHeader } from "./lib";

const icone = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2h9l4 4v16H6z" />
    <path d="M14 2v5h5" />
    <path d="M9 12h7" />
    <path d="M9 16h7" />
    <path d="M9 8h3" />
  </svg>
);

/** Data e hora curtas, para o rodapé "gerado em". */
function dataHoraBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/**
 * Recorte do relatório. O mês é o padrão porque é o fechamento que o contador
 * usa mês a mês (apuração do Simples, carnê-leão, relatório do MEI); o ano
 * serve para a declaração e o trimestre para quem apura por trimestre.
 */
type Recorte = "mes" | "trimestre" | "ano" | "intervalo";

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/** YYYY-MM-DD a partir de ano / mês (1-12) / dia. */
function isoData(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** Último dia do mês (dia 0 do mês seguinte). */
function ultimoDia(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate();
}

/** Intervalo fechado de um mês-calendário. */
function intervaloMes(ano: number, mes: number) {
  return {
    inicio: isoData(ano, mes, 1),
    fim: isoData(ano, mes, ultimoDia(ano, mes)),
  };
}

/** Intervalo fechado de um trimestre (1 a 4). */
function intervaloTrimestre(ano: number, trimestre: number) {
  const primeiro = (trimestre - 1) * 3 + 1;
  const ultimo = primeiro + 2;
  return {
    inicio: isoData(ano, primeiro, 1),
    fim: isoData(ano, ultimo, ultimoDia(ano, ultimo)),
  };
}

export default function RelatorioFiscalPage() {
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth() + 1;
  const [anos, setAnos] = useState<number[]>([anoAtual]);
  const [recorte, setRecorte] = useState<Recorte>("mes");
  const [ano, setAno] = useState(anoAtual);
  const [mes, setMes] = useState(mesAtual);
  const [trimestre, setTrimestre] = useState(Math.floor(hoje.getMonth() / 3) + 1);
  const [inicio, setInicio] = useState(isoData(anoAtual, mesAtual, 1));
  const [fim, setFim] = useState(isoData(anoAtual, mesAtual, hoje.getDate()));
  const [dados, setDados] = useState<RelatorioFiscal | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const intervaloInvalido =
    recorte === "intervalo" && Boolean(inicio && fim && inicio > fim);

  // Nulo enquanto o intervalo digitado está incompleto ou invertido: aí o
  // relatório não recarrega e a tela avisa, em vez de bater na API para receber
  // um erro de validação.
  const periodo = useMemo<PeriodoFiscal | null>(() => {
    switch (recorte) {
      case "mes":
        return intervaloMes(ano, mes);
      case "trimestre":
        return intervaloTrimestre(ano, trimestre);
      case "ano":
        return { ano };
      case "intervalo":
        return !inicio || !fim || inicio > fim ? null : { inicio, fim };
    }
  }, [recorte, ano, mes, trimestre, inicio, fim]);

  useEffect(() => {
    listarAnosFiscais()
      .then((lista) => {
        if (lista.length > 0) setAnos(lista);
      })
      .catch(() => {
        /* sem a lista, o seletor fica só com o ano corrente */
      });
  }, []);

  useEffect(() => {
    if (periodo === null) return;
    let ativo = true;
    setCarregando(true);
    setErro(null);
    obterRelatorioFiscal(periodo)
      .then((d) => ativo && setDados(d))
      .catch((e) => ativo && setErro(extrairErro(e)))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [periodo]);

  const r = dados;
  // Num recorte de um mês só, a tabela mensal repetiria o total; o título muda
  // para não prometer uma série que não existe.
  const variosMeses = (r?.receita.por_mes.length ?? 0) > 1;

  return (
    <div className="page">
      <div className="no-print">
        <RelatorioHeader
          titulo="Relatório fiscal"
          icone={icone}
          acoes={
            <div className="fiscal-acoes">
              <select
                className="filtro-select"
                value={recorte}
                onChange={(e) => setRecorte(e.target.value as Recorte)}
                aria-label="Recorte do período"
              >
                <option value="mes">Mês</option>
                <option value="trimestre">Trimestre</option>
                <option value="ano">Ano inteiro</option>
                <option value="intervalo">Intervalo</option>
              </select>

              {recorte === "mes" && (
                <select
                  className="filtro-select"
                  value={mes}
                  onChange={(e) => setMes(Number(e.target.value))}
                  aria-label="Mês"
                >
                  {MESES.map((nome, i) => (
                    <option key={nome} value={i + 1}>
                      {nome}
                    </option>
                  ))}
                </select>
              )}

              {recorte === "trimestre" && (
                <select
                  className="filtro-select"
                  value={trimestre}
                  onChange={(e) => setTrimestre(Number(e.target.value))}
                  aria-label="Trimestre"
                >
                  <option value={1}>1º tri (jan-mar)</option>
                  <option value={2}>2º tri (abr-jun)</option>
                  <option value={3}>3º tri (jul-set)</option>
                  <option value={4}>4º tri (out-dez)</option>
                </select>
              )}

              {recorte !== "intervalo" && (
                <select
                  className="filtro-select"
                  value={ano}
                  onChange={(e) => setAno(Number(e.target.value))}
                  aria-label="Ano-calendário"
                >
                  {anos.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              )}

              {recorte === "intervalo" && (
                <div className="periodo-intervalo">
                  <label>
                    De
                    <input
                      type="date"
                      value={inicio}
                      max={fim || undefined}
                      onChange={(e) => setInicio(e.target.value)}
                    />
                  </label>
                  <label>
                    até
                    <input
                      type="date"
                      value={fim}
                      min={inicio || undefined}
                      onChange={(e) => setFim(e.target.value)}
                    />
                  </label>
                </div>
              )}

              <button
                className="btn secundario pequeno"
                onClick={() => r && baixarCsvFiscal(r)}
                disabled={!r}
              >
                Baixar CSV
              </button>
              <button
                className="btn primario pequeno"
                onClick={() => window.print()}
                disabled={!r}
              >
                Imprimir
              </button>
            </div>
          }
        />

        {erro && <div className="alert erro">{erro}</div>}
        {intervaloInvalido && (
          <div className="alert erro">
            A data final do período não pode ser anterior à inicial.
          </div>
        )}

        <p className="subtitle">
          Consolidado do período para levar ao contador: receita, custo da
          mercadoria, compras, despesas, estoque e contas a receber. O mês
          fechado é o recorte que o contador usa na apuração; o ano serve para a
          declaração. Não calcula imposto — o enquadramento e a apuração
          dependem do seu regime tributário.
        </p>
      </div>

      {carregando && !r ? (
        <p className="vazio">Carregando...</p>
      ) : !r ? (
        !erro && <p className="vazio">Sem dados para o período.</p>
      ) : (
        <div className="recibo-area fiscal-folha">
          {/* 1. Identificação */}
          <div className="card fiscal-cabecalho">
            <div>
              <h2>{r.loja.razao_social || r.loja.nome}</h2>
              {r.loja.razao_social && r.loja.razao_social !== r.loja.nome && (
                <p className="muted">{r.loja.nome}</p>
              )}
              <dl className="fiscal-identificacao">
                {r.loja.documento && (
                  <div>
                    <dt>{r.loja.documento_rotulo}</dt>
                    <dd>{r.loja.documento}</dd>
                  </div>
                )}
                {r.loja.regime_rotulo && (
                  <div>
                    <dt>Regime</dt>
                    <dd>{r.loja.regime_rotulo}</dd>
                  </div>
                )}
                {r.loja.inscricao_estadual && (
                  <div>
                    <dt>Inscr. estadual</dt>
                    <dd>{r.loja.inscricao_estadual}</dd>
                  </div>
                )}
                {r.loja.inscricao_municipal && (
                  <div>
                    <dt>Inscr. municipal</dt>
                    <dd>{r.loja.inscricao_municipal}</dd>
                  </div>
                )}
                {r.loja.cnae && (
                  <div>
                    <dt>CNAE</dt>
                    <dd>{r.loja.cnae}</dd>
                  </div>
                )}
                {r.loja.data_abertura && (
                  <div>
                    <dt>Abertura</dt>
                    <dd>{dataBR(r.loja.data_abertura)}</dd>
                  </div>
                )}
              </dl>
              {(r.loja.endereco || r.loja.cidade || r.loja.telefone || r.loja.email) && (
                <p className="muted fiscal-contato">
                  {[
                    [r.loja.endereco, r.loja.cep].filter(Boolean).join(" · "),
                    [r.loja.cidade, r.loja.estado].filter(Boolean).join("/"),
                    r.loja.telefone,
                    r.loja.email,
                  ]
                    .filter((p) => p)
                    .join(" · ")}
                </p>
              )}
              {r.loja.contador_nome && (
                <p className="muted">
                  Contador: {r.loja.contador_nome}
                  {r.loja.contador_contato ? ` · ${r.loja.contador_contato}` : ""}
                </p>
              )}
              {r.loja.cadastro_incompleto && (
                <p className="muted no-print">
                  Complete o documento e o regime tributário em Configurações →
                  Dados do negócio.
                </p>
              )}
            </div>
            <div className="fiscal-cabecalho-periodo">
              <strong>Relatório fiscal</strong>
              <span>
                {dataBR(r.inicio)} a {dataBR(r.fim)}
              </span>
              <span className="muted">Gerado em {dataHoraBR(r.gerado_em)}</span>
            </div>
          </div>

          {/* 6. Resultado — vem antes por ser a leitura principal */}
          <div className="card">
            <h2>Apuração do resultado</h2>
            <p className="subtitle">
              Pelo regime de competência (data da venda). Os valores abaixo se
              encadeiam de cima para baixo.
            </p>
            <table className="tabela fiscal-dre">
              <tbody>
                <tr>
                  <td>Receita do período</td>
                  <td className="num">{brl(r.resultado.receita_competencia)}</td>
                </tr>
                <tr>
                  <td className="muted">(−) Custo da mercadoria vendida</td>
                  <td className="num">{brl(r.resultado.cmv)}</td>
                </tr>
                <tr className="fiscal-dre-subtotal">
                  <td>= Lucro bruto</td>
                  <td className="num">{brl(r.resultado.lucro_bruto)}</td>
                </tr>
                <tr>
                  <td className="muted">(−) Perdas e quebras</td>
                  <td className="num">{brl(r.resultado.perdas)}</td>
                </tr>
                <tr>
                  <td className="muted">(−) Despesas operacionais</td>
                  <td className="num">{brl(r.resultado.despesas_operacionais)}</td>
                </tr>
                <tr className="fiscal-dre-total">
                  <td>= Resultado operacional</td>
                  <td className="num">{brl(r.resultado.resultado_operacional)}</td>
                </tr>
              </tbody>
            </table>
            <div className="kpis fiscal-kpis">
              <div className="kpi">
                <span className="kpi-label">Margem bruta</span>
                <span className="kpi-valor">{pct(r.resultado.margem_bruta_percentual)}</span>
              </div>
              <div className="kpi">
                <span className="kpi-label">Margem líquida</span>
                <span className="kpi-valor">{pct(r.resultado.margem_liquida_percentual)}</span>
              </div>
            </div>
          </div>

          {/* 2. Receita */}
          <div className="card">
            <h2>{variosMeses ? "Receita mês a mês" : "Receita do período"}</h2>
            <p className="subtitle">
              <strong>Competência</strong> é a data da venda; <strong>caixa</strong>{" "}
              é a data em que o dinheiro entrou. Numa venda à vista as duas
              coincidem; no fiado, a competência é a venda e o caixa são os
              pagamentos, que podem cair em outro mês.
            </p>
            <table className="tabela">
              <thead>
                <tr>
                  <th>Mês</th>
                  <th className="num">Vendas</th>
                  <th className="num">Competência</th>
                  <th className="num">Caixa</th>
                </tr>
              </thead>
              <tbody>
                {r.receita.por_mes.map((m) => (
                  <tr key={`${m.ano}-${m.mes}`}>
                    <td>{m.rotulo}</td>
                    <td className="num">{m.num_vendas}</td>
                    <td className="num">{brl(m.competencia)}</td>
                    <td className="num">{brl(m.caixa)}</td>
                  </tr>
                ))}
              </tbody>
              {/* Com um mês só, o total repetiria a única linha. */}
              {variosMeses && (
                <tfoot>
                  <tr>
                    <td>
                      <strong>Total</strong>
                    </td>
                    <td className="num">
                      <strong>{r.receita.num_vendas}</strong>
                    </td>
                    <td className="num">
                      <strong>{brl(r.receita.total_competencia)}</strong>
                    </td>
                    <td className="num">
                      <strong>{brl(r.receita.total_caixa)}</strong>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>

            <div className="kpis fiscal-kpis">
              <div className="kpi">
                <span className="kpi-label">Total bruto</span>
                <span className="kpi-valor">{brl(r.receita.total_bruto)}</span>
                <span className="kpi-sub">antes dos descontos</span>
              </div>
              <div className="kpi">
                <span className="kpi-label">Descontos</span>
                <span className="kpi-valor">{brl(r.receita.desconto_total)}</span>
              </div>
              <div className="kpi">
                <span className="kpi-label">Ticket médio</span>
                <span className="kpi-valor">{brl(r.receita.ticket_medio)}</span>
              </div>
              <div className="kpi">
                <span className="kpi-label">Devoluções</span>
                <span className="kpi-valor">{brl(r.receita.devolucoes_valor)}</span>
                <span className="kpi-sub">
                  {r.receita.devolucoes_qtd} no período · já descontadas da receita
                </span>
              </div>
            </div>
          </div>

          {/* 3. Formas de pagamento */}
          <div className="card">
            <h2>Recebimentos por forma de pagamento</h2>
            {r.formas_pagamento.length === 0 ? (
              <p className="vazio">Nenhuma venda no período.</p>
            ) : (
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Forma</th>
                    <th className="num">Vendas</th>
                    <th className="num">Valor</th>
                    <th className="num">%</th>
                  </tr>
                </thead>
                <tbody>
                  {r.formas_pagamento.map((f) => (
                    <tr key={f.forma}>
                      <td>{f.forma_rotulo}</td>
                      <td className="num">{f.num_vendas}</td>
                      <td className="num">{brl(f.faturamento)}</td>
                      <td className="num muted">{pct(f.percentual)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* 4. CMV, compras e estoque */}
          <div className="card">
            <h2>Custo da mercadoria e compras</h2>
            <div className="kpis fiscal-kpis">
              <div className="kpi">
                <span className="kpi-label">CMV</span>
                <span className="kpi-valor">{brl(r.custos.cmv)}</span>
                <span className="kpi-sub">custo do que foi vendido</span>
              </div>
              <div className="kpi">
                <span className="kpi-label">Compras no período</span>
                <span className="kpi-valor">{brl(r.custos.compras_total)}</span>
                <span className="kpi-sub">
                  {r.custos.compras_quantidade_itens} itens que entraram
                </span>
              </div>
              <div className="kpi">
                <span className="kpi-label">Perdas e quebras</span>
                <span className="kpi-valor">{brl(r.custos.perdas_valor)}</span>
                <span className="kpi-sub">
                  {r.custos.perdas_quantidade} movimentações
                </span>
              </div>
              <div className="kpi">
                <span className="kpi-label">Estoque a custo</span>
                <span className="kpi-valor">{brl(r.estoque.valor_custo)}</span>
                <span className="kpi-sub">
                  {r.estoque.num_produtos} produtos ·{" "}
                  {r.estoque.posicao_atual ? "posição atual" : "posição de hoje"}
                </span>
              </div>
            </div>

            <h3>Compras por fornecedor</h3>
            {r.custos.por_fornecedor.length === 0 ? (
              <p className="vazio">Nenhuma entrada de mercadoria no período.</p>
            ) : (
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Fornecedor</th>
                    <th>CNPJ / CPF</th>
                    <th className="num">Entradas</th>
                    <th className="num">Itens</th>
                    <th className="num">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {r.custos.por_fornecedor.map((f) => (
                    <tr key={f.fornecedor_id ?? f.fornecedor_nome}>
                      <td>{f.fornecedor_nome}</td>
                      <td className="muted">{f.documento ?? "—"}</td>
                      <td className="num">{f.num_entradas}</td>
                      <td className="num">{f.quantidade}</td>
                      <td className="num">{brl(f.valor)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4}>
                      <strong>Total</strong>
                    </td>
                    <td className="num">
                      <strong>{brl(r.custos.compras_total)}</strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          {/* 5. Despesas */}
          <div className="card">
            <h2>Despesas</h2>
            {r.despesas.quantidade === 0 ? (
              <p className="vazio">
                Nenhuma despesa lançada no período. Sem elas o resultado fica
                superestimado.
              </p>
            ) : (
              <>
                <div className="kpis fiscal-kpis">
                  <div className="kpi">
                    <span className="kpi-label">Total</span>
                    <span className="kpi-valor">{brl(r.despesas.total)}</span>
                    <span className="kpi-sub">
                      {r.despesas.quantidade} lançamentos
                    </span>
                  </div>
                  <div className="kpi">
                    <span className="kpi-label">Operacional</span>
                    <span className="kpi-valor">{brl(r.despesas.operacional)}</span>
                    <span className="kpi-sub">entra no resultado</span>
                  </div>
                  <div className="kpi">
                    <span className="kpi-label">Não operacional</span>
                    <span className="kpi-valor">{brl(r.despesas.nao_operacional)}</span>
                    <span className="kpi-sub">retirada do dono, compra de bem</span>
                  </div>
                  <div className="kpi">
                    <span className="kpi-label">Em aberto</span>
                    <span className="kpi-valor">{brl(r.despesas.total_em_aberto)}</span>
                    <span className="kpi-sub">
                      pago: {brl(r.despesas.total_pago)}
                    </span>
                  </div>
                </div>

                <div className="grid-2">
                  <div>
                    <h3>Por categoria</h3>
                    <table className="tabela">
                      <thead>
                        <tr>
                          <th>Categoria</th>
                          <th className="num">Total</th>
                          <th className="num">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.despesas.por_categoria.map((c) => (
                          <tr key={c.categoria}>
                            <td>{c.categoria_rotulo}</td>
                            <td className="num">{brl(c.total)}</td>
                            <td className="num muted">{pct(c.percentual)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div>
                    <h3>Mês a mês</h3>
                    <table className="tabela">
                      <thead>
                        <tr>
                          <th>Mês</th>
                          <th className="num">Total</th>
                          <th className="num">Operacional</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.despesas.por_mes.map((m) => (
                          <tr key={`${m.ano}-${m.mes}`}>
                            <td>{m.rotulo}</td>
                            <td className="num">{brl(m.total)}</td>
                            <td className="num">{brl(m.total_operacional)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 7. Contas a receber */}
          <div className="card">
            <h2>Contas a receber em aberto</h2>
            <p className="subtitle">
              Posição do fiado em {dataBR(r.fim)}: vendas a prazo feitas até essa
              data, menos os pagamentos recebidos até ela.
            </p>
            <div className="kpis fiscal-kpis">
              <div className="kpi">
                <span className="kpi-label">Saldo em aberto</span>
                <span className="kpi-valor ambar">
                  {brl(r.contas_a_receber.total_em_aberto)}
                </span>
                <span className="kpi-sub">
                  {r.contas_a_receber.qtd_vendas} vendas ·{" "}
                  {r.contas_a_receber.qtd_clientes} clientes
                </span>
              </div>
              <div className="kpi">
                <span className="kpi-label">Vendido a prazo</span>
                <span className="kpi-valor">
                  {brl(r.contas_a_receber.total_vendido)}
                </span>
              </div>
              <div className="kpi">
                <span className="kpi-label">Já recebido</span>
                <span className="kpi-valor">
                  {brl(r.contas_a_receber.total_recebido)}
                </span>
              </div>
            </div>
          </div>

          {/* Ressalvas de método */}
          {r.avisos.length > 0 && (
            <div className="card fiscal-avisos">
              <h2>Como ler estes números</h2>
              <ul>
                {r.avisos.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
