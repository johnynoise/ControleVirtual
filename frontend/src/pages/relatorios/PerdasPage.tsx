import { useEffect, useState } from "react";
import type { RelatorioPerdas } from "../../types";
import { obterPerdas } from "../../services/relatorios";
import {
  brl,
  dataHoraBR,
  extrairErro,
  PeriodoTabs,
  RelatorioHeader,
} from "./lib";

const icone = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </svg>
);

const rotuloTipo: Record<string, { texto: string; classe: string }> = {
  entrada: { texto: "Entrada", classe: "mov-entrada" },
  saida: { texto: "Saída", classe: "mov-saida" },
  ajuste: { texto: "Ajuste", classe: "mov-ajuste" },
};

export default function PerdasPage() {
  const [dias, setDias] = useState(30);
  const [dados, setDados] = useState<RelatorioPerdas | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    obterPerdas(dias)
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
        titulo="Perdas e ajustes"
        icone={icone}
        acoes={<PeriodoTabs dias={dias} onChange={setDias} />}
      />

      {erro && <div className="alert erro">{erro}</div>}

      <p className="subtitle">
        Movimentações de estoque fora de venda e compra: perdas, quebras,
        inventários e ajustes manuais.
      </p>

      <div className="kpis">
        <div className="kpi">
          <span className="kpi-label">Movimentações</span>
          <span className="kpi-valor">{dados?.num_movimentacoes ?? 0}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Perda estimada</span>
          <span className="kpi-valor vermelho">
            {brl(dados?.valor_perdas_estimado ?? 0)}
          </span>
          <span className="kpi-sub">saídas × custo</span>
        </div>
      </div>

      <div className="card">
        <h2>Movimentações</h2>
        {carregando ? (
          <p className="vazio">Carregando...</p>
        ) : linhas.length === 0 ? (
          <p className="vazio">Nenhuma perda ou ajuste no período.</p>
        ) : (
          <table className="tabela">
            <thead>
              <tr>
                <th>Data</th>
                <th>Produto</th>
                <th>Tipo</th>
                <th>Motivo</th>
                <th className="num">Qtd.</th>
                <th className="num">Saldo</th>
                <th className="num">Perda estimada</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const t = rotuloTipo[l.tipo] ?? { texto: l.tipo, classe: "" };
                return (
                  <tr key={l.id}>
                    <td>{dataHoraBR(l.criado_em)}</td>
                    <td>{l.produto_nome}</td>
                    <td>
                      <span className={`chip ${t.classe}`}>{t.texto}</span>
                    </td>
                    <td className="muted">{l.motivo ?? "—"}</td>
                    <td className="num">{l.quantidade}</td>
                    <td className="num">{l.estoque_resultante}</td>
                    <td className="num">
                      {l.valor_estimado != null ? brl(l.valor_estimado) : "—"}
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
