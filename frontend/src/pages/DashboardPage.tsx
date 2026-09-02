import { useEffect, useMemo, useState } from "react";
import type {
  MaisVendidos,
  ResumoEstoque,
  ResumoPeriodo,
  VendaDia,
} from "../types";
import {
  obterMaisVendidos,
  obterResumo,
  obterResumoEstoque,
  obterVendasPorDia,
} from "../services/relatorios";

const PERIODOS: { valor: number; rotulo: string }[] = [
  { valor: 1, rotulo: "Hoje" },
  { valor: 7, rotulo: "7 dias" },
  { valor: 30, rotulo: "30 dias" },
];

function brl(valor: number | string): string {
  const n = typeof valor === "string" ? parseFloat(valor) : valor;
  return (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function diaCurto(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function extrairErro(err: unknown): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data
    ?.detail;
  if (typeof detail === "string") return detail;
  return "Não foi possível carregar os relatórios.";
}

export default function DashboardPage() {
  const [dias, setDias] = useState(7);
  const [resumo, setResumo] = useState<ResumoPeriodo | null>(null);
  const [porDia, setPorDia] = useState<VendaDia[]>([]);
  const [maisVendidos, setMaisVendidos] = useState<MaisVendidos | null>(null);
  const [estoque, setEstoque] = useState<ResumoEstoque | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar(periodo: number) {
    setCarregando(true);
    setErro(null);
    try {
      const [r, d, mv, est] = await Promise.all([
        obterResumo(periodo),
        obterVendasPorDia(periodo),
        obterMaisVendidos(periodo, 5),
        obterResumoEstoque(),
      ]);
      setResumo(r);
      setPorDia(d);
      setMaisVendidos(mv);
      setEstoque(est);
    } catch (err) {
      setErro(extrairErro(err));
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar(dias);
  }, [dias]);

  const maxFaturamento = useMemo(
    () => Math.max(1, ...porDia.map((d) => parseFloat(d.faturamento) || 0)),
    [porDia]
  );

  return (
    <div className="page">
      <div className="page-header">
        <h1>Dashboard</h1>
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

      {erro && <div className="alert erro">{erro}</div>}

      {/* KPIs */}
      <div className="kpis">
        <div className="kpi">
          <span className="kpi-label">Faturamento</span>
          <span className="kpi-valor">{brl(resumo?.faturamento ?? 0)}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Lucro</span>
          <span className="kpi-valor verde">{brl(resumo?.lucro ?? 0)}</span>
          <span className="kpi-sub">margem {resumo?.margem_percentual ?? "0"}%</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Vendas</span>
          <span className="kpi-valor">{resumo?.num_vendas ?? 0}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Ticket médio</span>
          <span className="kpi-valor">{brl(resumo?.ticket_medio ?? 0)}</span>
        </div>
      </div>

      {/* Vendas por dia */}
      <div className="card">
        <h2>Vendas por dia</h2>
        {carregando ? (
          <p className="vazio">Carregando...</p>
        ) : (
          <div className="grafico-barras">
            {porDia.map((d) => {
              const valor = parseFloat(d.faturamento) || 0;
              const altura = Math.round((valor / maxFaturamento) * 100);
              return (
                <div className="barra-col" key={d.dia} title={`${diaCurto(d.dia)}: ${brl(valor)}`}>
                  <div className="barra-valor">{valor > 0 ? brl(valor) : ""}</div>
                  <div className="barra" style={{ height: `${altura}%` }} />
                  <div className="barra-label">{diaCurto(d.dia)}</div>
                </div>
              );
            })}
          </div>
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
    </div>
  );
}
