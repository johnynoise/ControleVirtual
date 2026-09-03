import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { ContaReceber } from "../types";
import { listarContasReceber } from "../services/vendas";
import { brl, dataBR, extrairErro } from "../lib/ui";

function diasDesde(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

export default function ContasReceberPage() {
  const [contas, setContas] = useState<ContaReceber[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  function carregar() {
    setCarregando(true);
    setErro(null);
    listarContasReceber()
      .then((c) => setContas(c))
      .catch((e) => setErro(extrairErro(e)))
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    carregar();
  }, []);

  const totais = useMemo(() => {
    const total = contas.reduce((acc, c) => acc + (parseFloat(c.total_devido) || 0), 0);
    const vendas = contas.reduce((acc, c) => acc + c.num_vendas, 0);
    return { total, vendas, clientes: contas.length };
  }, [contas]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return contas;
    return contas.filter((c) => c.cliente_nome.toLowerCase().includes(termo));
  }, [contas, busca]);

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <span className="title-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <path d="M2 10h20" />
              <path d="M6 15h4" />
            </svg>
          </span>
          <div>
            <h1>Contas a receber</h1>
            <p className="pdv-sub">Saldos de vendas no fiado, por cliente.</p>
          </div>
        </div>
      </div>

      {erro && <div className="alert erro">{erro}</div>}

      <div className="kpis" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="kpi">
          <span className="kpi-label">Total a receber</span>
          <span className="kpi-valor ambar">{brl(totais.total)}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Clientes devendo</span>
          <span className="kpi-valor">{totais.clientes}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Vendas em aberto</span>
          <span className="kpi-valor">{totais.vendas}</span>
        </div>
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="busca">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar cliente..."
            />
          </div>
          <span className="contagem">
            {filtradas.length} {filtradas.length === 1 ? "cliente" : "clientes"}
          </span>
        </div>

        {carregando ? (
          <p className="vazio">Carregando...</p>
        ) : contas.length === 0 ? (
          <p className="vazio">Nenhum saldo em aberto. Tudo em dia! 🎉</p>
        ) : filtradas.length === 0 ? (
          <p className="vazio">Nenhum cliente encontrado.</p>
        ) : (
          <table className="tabela">
            <thead>
              <tr>
                <th>Cliente</th>
                <th className="num">Vendas em aberto</th>
                <th>Fiado mais antigo</th>
                <th className="num">Saldo devedor</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((c) => {
                const dias = diasDesde(c.venda_mais_antiga);
                return (
                  <tr key={c.cliente_id ?? c.cliente_nome}>
                    <td className="fiado-cliente-nome">{c.cliente_nome}</td>
                    <td className="num">{c.num_vendas}</td>
                    <td>
                      {dataBR(c.venda_mais_antiga)}
                      {dias != null && (
                        <span className="fiado-antiga"> · há {dias} dias</span>
                      )}
                    </td>
                    <td className="num texto-ambar">{brl(c.total_devido)}</td>
                    <td className="acoes">
                      {c.cliente_id != null && (
                        <Link
                          className="btn primario pequeno"
                          to={`/clientes/${c.cliente_id}`}
                        >
                          Ver / receber
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
