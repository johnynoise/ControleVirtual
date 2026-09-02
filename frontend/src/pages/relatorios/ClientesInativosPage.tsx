import { useEffect, useState } from "react";
import type { RelatorioClientesInativos } from "../../types";
import { obterClientesInativos } from "../../services/relatorios";
import { brl, dataBR, extrairErro, PeriodoTabs, RelatorioHeader } from "./lib";

const icone = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M22 8l-4 4" />
    <path d="M18 8l4 4" />
  </svg>
);

const OPCOES = [
  { valor: 30, rotulo: "30+ dias" },
  { valor: 60, rotulo: "60+ dias" },
  { valor: 90, rotulo: "90+ dias" },
];

export default function ClientesInativosPage() {
  const [dias, setDias] = useState(60);
  const [dados, setDados] = useState<RelatorioClientesInativos | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    obterClientesInativos(dias)
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
        titulo="Clientes inativos"
        icone={icone}
        acoes={<PeriodoTabs dias={dias} onChange={setDias} opcoes={OPCOES} />}
      />

      {erro && <div className="alert erro">{erro}</div>}

      <p className="subtitle">
        Clientes ativos que não compram há mais de {dias} dias (inclui quem
        nunca comprou). Boa lista para uma ação de reativação.
      </p>

      <div className="kpis">
        <div className="kpi">
          <span className="kpi-label">Clientes inativos</span>
          <span className="kpi-valor">{dados?.qtd_clientes ?? 0}</span>
        </div>
      </div>

      <div className="card">
        <h2>Para reativar</h2>
        {carregando ? (
          <p className="vazio">Carregando...</p>
        ) : linhas.length === 0 ? (
          <p className="vazio">Nenhum cliente inativo nesse período. 🎉</p>
        ) : (
          <table className="tabela">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Telefone</th>
                <th>Última compra</th>
                <th className="num">Dias sem comprar</th>
                <th className="num">Compras</th>
                <th className="num">Total gasto</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.cliente_id}>
                  <td>{l.cliente_nome}</td>
                  <td className="muted">{l.telefone ?? "—"}</td>
                  <td>{dataBR(l.ultima_compra)}</td>
                  <td className="num">
                    {l.dias_sem_comprar == null ? (
                      <span className="muted">nunca comprou</span>
                    ) : (
                      l.dias_sem_comprar
                    )}
                  </td>
                  <td className="num">{l.num_compras}</td>
                  <td className="num">{brl(l.faturamento_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
