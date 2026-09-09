import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type {
  MaisVendidos,
  ResumoEstoque,
  ResumoPeriodo,
  VendaDia,
} from "../types";
import {
  obterClientesInativos,
  obterMaisVendidos,
  obterResumo,
  obterResumoEstoque,
  obterVendasPorDia,
} from "../services/relatorios";
import { listarContasReceber } from "../services/vendas";
import GraficoVendas from "../components/GraficoVendas";
import EstadoErro from "../components/EstadoErro";
import { Skeleton } from "../components/Skeleton";
import { brl, extrairErro } from "../lib/ui";

const PERIODOS: { valor: number; rotulo: string }[] = [
  { valor: 1, rotulo: "Hoje" },
  { valor: 7, rotulo: "7 dias" },
  { valor: 30, rotulo: "30 dias" },
];

// Nº de dias sem comprar para um cliente entrar no alerta "sumidos".
const DIAS_INATIVO = 30;

function num(valor: string | number | null | undefined): number {
  const n = typeof valor === "string" ? parseFloat(valor) : valor ?? 0;
  return n || 0;
}

// Valores do período imediatamente anterior (mesma duração), usados para o
// cálculo de variação (delta) de cada KPI.
interface ResumoAnterior {
  faturamento: number;
  lucro: number;
  num_vendas: number;
  ticket_medio: number;
}

interface Alerta {
  chave: string;
  tom: "perigo" | "aviso" | "info";
  titulo: string;
  sub: string;
  para: string;
  icone: ReactNode;
}

// Variação percentual de um KPI vs. o período anterior. Para todos os KPIs do
// painel, subir é bom (verde) e cair é ruim (vermelho).
function Delta({ atual, anterior }: { atual: number; anterior: number }) {
  if (anterior <= 0) {
    if (atual > 0) return <span className="kpi-delta neutro">novo</span>;
    return <span className="kpi-delta neutro">—</span>;
  }
  const pct = ((atual - anterior) / anterior) * 100;
  const subiu = pct >= 0;
  return (
    <span className={`kpi-delta ${subiu ? "sobe" : "cai"}`}>
      {subiu ? "▲" : "▼"} {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

export default function DashboardPage() {
  const [dias, setDias] = useState(7);
  const [resumo, setResumo] = useState<ResumoPeriodo | null>(null);
  const [anterior, setAnterior] = useState<ResumoAnterior | null>(null);
  const [porDia, setPorDia] = useState<VendaDia[]>([]);
  const [maisVendidos, setMaisVendidos] = useState<MaisVendidos | null>(null);
  const [estoque, setEstoque] = useState<ResumoEstoque | null>(null);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const labelAnterior = dias === 1 ? "ontem" : `${dias} dias anteriores`;
  const primeiraCarga = carregando && !resumo;

  async function carregar(periodo: number) {
    setCarregando(true);
    setErro(null);
    try {
      // Núcleo do painel. resumoDobro cobre o dobro do período: subtraindo o
      // período atual, sobram exatamente os N dias anteriores (para o delta).
      const [r, rDobro, d, mv, est] = await Promise.all([
        obterResumo({ dias: periodo }),
        obterResumo({ dias: periodo * 2 }),
        obterVendasPorDia({ dias: periodo }),
        obterMaisVendidos({ dias: periodo }, 5),
        obterResumoEstoque(),
      ]);
      setResumo(r);
      setPorDia(d);
      setMaisVendidos(mv);
      setEstoque(est);

      const fatAnt = num(rDobro.faturamento) - num(r.faturamento);
      const lucroAnt = num(rDobro.lucro) - num(r.lucro);
      const vendasAnt = rDobro.num_vendas - r.num_vendas;
      setAnterior({
        faturamento: fatAnt,
        lucro: lucroAnt,
        num_vendas: vendasAnt,
        ticket_medio: vendasAnt > 0 ? fatAnt / vendasAnt : 0,
      });

      montarAlertas(est);
    } catch (err) {
      setErro(extrairErro(err));
    } finally {
      setCarregando(false);
    }
  }

  // Monta a faixa de alertas. As chamadas complementares (fiado e clientes
  // inativos) são resilientes: se falharem, o painel principal segue normal.
  async function montarAlertas(est: ResumoEstoque) {
    const lista: Alerta[] = [];

    if (est.qtd_estoque_baixo > 0) {
      lista.push({
        chave: "estoque",
        tom: est.itens_estoque_baixo.some((i) => i.estoque <= 0)
          ? "perigo"
          : "aviso",
        titulo: `${est.qtd_estoque_baixo} ${
          est.qtd_estoque_baixo === 1 ? "produto precisa" : "produtos precisam"
        } de reposição`,
        sub: "Repor estoque",
        para: "/movimentacoes",
        icone: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2 3 7v10l9 5 9-5V7z" />
            <path d="M3 7l9 5 9-5" />
            <path d="M12 12v10" />
          </svg>
        ),
      });
    }

    try {
      const [contas, inativos] = await Promise.all([
        listarContasReceber(),
        obterClientesInativos(DIAS_INATIVO),
      ]);

      const fiadoTotal = contas.reduce((acc, c) => acc + num(c.total_devido), 0);
      if (fiadoTotal > 0) {
        lista.push({
          chave: "fiado",
          tom: "aviso",
          titulo: `${brl(fiadoTotal)} em fiado a receber`,
          sub: `${contas.length} ${
            contas.length === 1 ? "cliente devendo" : "clientes devendo"
          }`,
          para: "/contas-a-receber",
          icone: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <path d="M2 10h20" />
              <path d="M6 15h4" />
            </svg>
          ),
        });
      }

      if (inativos.qtd_clientes > 0) {
        lista.push({
          chave: "inativos",
          tom: "info",
          titulo: `${inativos.qtd_clientes} ${
            inativos.qtd_clientes === 1 ? "cliente sumiu" : "clientes sumiram"
          }`,
          sub: `Sem comprar há ${DIAS_INATIVO}+ dias`,
          // Leva a janela no link: sem isso o relatório abre no padrão dele
          // (60 dias) e mostra um número diferente do que o alerta prometeu.
          para: `/relatorios/clientes-inativos?dias=${DIAS_INATIVO}`,
          icone: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="8" r="3.5" />
              <path d="M2.5 20a6.5 6.5 0 0 1 11 0" />
              <circle cx="18" cy="16" r="4.5" />
              <path d="M18 14v2l1.3 1" />
            </svg>
          ),
        });
      }
    } catch {
      // Alertas complementares indisponíveis: ignora sem quebrar o painel.
    }

    setAlertas(lista);
  }

  useEffect(() => {
    carregar(dias);
  }, [dias]);

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <span className="title-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="9" rx="1.5" />
              <rect x="14" y="3" width="7" height="5" rx="1.5" />
              <rect x="14" y="12" width="7" height="9" rx="1.5" />
              <rect x="3" y="16" width="7" height="5" rx="1.5" />
            </svg>
          </span>
          <h1>Início</h1>
        </div>
        <div className="periodo-tabs">
          {PERIODOS.map((p) => (
            <button
              key={p.valor}
              className={`btn ${dias === p.valor ? "primario" : "secundario"} pequeno`}
              onClick={() => setDias(p.valor)}
            >
              {p.rotulo}
            </button>
          ))}
        </div>
      </div>

      {erro ? (
        <EstadoErro mensagem={erro} onTentarNovamente={() => carregar(dias)} />
      ) : (
        <>

      {/* Faixa de alertas acionáveis */}
      {alertas.length > 0 && (
        <div className="alertas">
          {alertas.map((a) => (
            <Link key={a.chave} to={a.para} className={`alerta-item ${a.tom}`}>
              <span className="alerta-icone">{a.icone}</span>
              <span className="alerta-texto">
                <span className="alerta-titulo">{a.titulo}</span>
                <span className="alerta-sub">{a.sub}</span>
              </span>
              <svg className="alerta-seta" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </Link>
          ))}
        </div>
      )}

      {/* KPIs */}
      {primeiraCarga ? (
        <div className="kpis">
          {Array.from({ length: 4 }).map((_, i) => (
            <div className="kpi" key={i}>
              <Skeleton largura="55%" altura="0.85rem" />
              <Skeleton largura="80%" altura="1.7rem" />
            </div>
          ))}
        </div>
      ) : (
      <div className="kpis">
        <div className="kpi">
          <span className="kpi-label">Faturamento</span>
          <span className="kpi-valor">{brl(resumo?.faturamento ?? 0)}</span>
          {anterior && (
            <Delta atual={num(resumo?.faturamento)} anterior={anterior.faturamento} />
          )}
        </div>
        <div className="kpi">
          <span className="kpi-label">Lucro</span>
          <span className="kpi-valor verde">{brl(resumo?.lucro ?? 0)}</span>
          <span className="kpi-sub">
            margem {resumo?.margem_percentual ?? "0"}%
            {anterior && (
              <Delta atual={num(resumo?.lucro)} anterior={anterior.lucro} />
            )}
          </span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Vendas</span>
          <span className="kpi-valor">{resumo?.num_vendas ?? 0}</span>
          {anterior && (
            <Delta atual={resumo?.num_vendas ?? 0} anterior={anterior.num_vendas} />
          )}
        </div>
        <div className="kpi">
          <span className="kpi-label">Ticket médio</span>
          <span className="kpi-valor">{brl(resumo?.ticket_medio ?? 0)}</span>
          {anterior && (
            <Delta atual={num(resumo?.ticket_medio)} anterior={anterior.ticket_medio} />
          )}
        </div>
      </div>
      )}
      {!primeiraCarga && (
        <p className="kpis-legenda">Variação comparada a {labelAnterior}.</p>
      )}

      {/* Vendas por dia */}
      <div className="card">
        <h2>Vendas por dia</h2>
        {carregando ? (
          <Skeleton altura="240px" radius="12px" />
        ) : (
          <GraficoVendas dados={porDia} />
        )}
      </div>

      {/* Mais vendidos */}
      <div className="grid-cards">
        <div className="card">
          <h2>Mais vendidos (quantidade)</h2>
          {!maisVendidos || maisVendidos.por_quantidade.length === 0 ? (
            <p className="vazio">Sem vendas no período.</p>
          ) : (
            <table className="tabela">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Qtd.</th>
                  <th>Faturamento</th>
                </tr>
              </thead>
              <tbody>
                {maisVendidos.por_quantidade.map((p) => (
                  <tr key={`q-${p.produto_id}-${p.produto_nome}`}>
                    <td>{p.produto_nome}</td>
                    <td>{p.quantidade}</td>
                    <td>{brl(p.faturamento)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h2>Mais lucrativos</h2>
          {!maisVendidos || maisVendidos.por_lucro.length === 0 ? (
            <p className="vazio">Sem vendas no período.</p>
          ) : (
            <table className="tabela">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Lucro</th>
                  <th>Qtd.</th>
                </tr>
              </thead>
              <tbody>
                {maisVendidos.por_lucro.map((p) => (
                  <tr key={`l-${p.produto_id}-${p.produto_nome}`}>
                    <td>{p.produto_nome}</td>
                    <td className="verde">{brl(p.lucro)}</td>
                    <td>{p.quantidade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Estoque */}
      <div className="card">
        <h2>Estoque</h2>
        <div className="kpis">
          <div className="kpi">
            <span className="kpi-label">Valor em estoque (custo)</span>
            <span className="kpi-valor">{brl(estoque?.valor_custo_total ?? 0)}</span>
          </div>
          <div className="kpi">
            <span className="kpi-label">Potencial de venda</span>
            <span className="kpi-valor">{brl(estoque?.valor_venda_total ?? 0)}</span>
          </div>
          <div className="kpi">
            <span className="kpi-label">Produtos cadastrados</span>
            <span className="kpi-valor">{estoque?.num_produtos ?? 0}</span>
          </div>
          <div className="kpi">
            <span className="kpi-label">Estoque baixo</span>
            <span className={`kpi-valor ${(estoque?.qtd_estoque_baixo ?? 0) > 0 ? "vermelho" : ""}`}>
              {estoque?.qtd_estoque_baixo ?? 0}
            </span>
          </div>
        </div>

        {estoque && estoque.itens_estoque_baixo.length > 0 && (
          <>
            <h3>Produtos para repor</h3>
            <table className="tabela">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Estoque</th>
                  <th>Mínimo</th>
                </tr>
              </thead>
              <tbody>
                {estoque.itens_estoque_baixo.map((i) => (
                  <tr key={i.produto_id}>
                    <td>{i.nome}</td>
                    <td>
                      <span className="chip alerta">{i.estoque}</span>
                    </td>
                    <td className="muted">{i.estoque_minimo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
        </>
      )}
    </div>
  );
}
