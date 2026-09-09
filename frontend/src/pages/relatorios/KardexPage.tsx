import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { PeriodoRelatorio, Produto, RelatorioKardex } from "../../types";
import { obterKardex } from "../../services/relatorios";
import { listarProdutos } from "../../services/produtos";
import {
  brl,
  dataHoraBR,
  extrairErro,
  PeriodoSeletor,
  RelatorioHeader,
} from "./lib";
import { LinhaSaldo } from "./Charts";

function diaMes(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

const icone = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16v16H4z" />
    <path d="M4 9h16" />
    <path d="M9 4v16" />
  </svg>
);

const rotuloTipo: Record<string, { texto: string; classe: string }> = {
  entrada: { texto: "Entrada", classe: "mov-entrada" },
  saida: { texto: "Saída", classe: "mov-saida" },
  ajuste: { texto: "Ajuste", classe: "mov-ajuste" },
};

export default function KardexPage() {
  // O caminho normal de entrada é pela lista de produtos, que manda o produto
  // no link. O seletor abaixo existe para quem chega direto na tela.
  const [searchParams, setSearchParams] = useSearchParams();
  const idDaUrl = Number(searchParams.get("produto_id")) || null;

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [produtoId, setProdutoId] = useState<number | null>(idDaUrl);
  const [periodo, setPeriodo] = useState<PeriodoRelatorio>({ dias: 90 });
  const [dados, setDados] = useState<RelatorioKardex | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Carrega a lista de produtos para o seletor. Só escolhe um por conta
  // própria quando a URL não disse qual.
  useEffect(() => {
    listarProdutos()
      .then((lista) => {
        setProdutos(lista);
        if (idDaUrl == null && lista.length > 0) setProdutoId(lista[0].id);
      })
      .catch((e) => setErro(extrairErro(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Troca de produto reflete na URL, então o extrato fica compartilhável.
  function trocarProduto(id: number) {
    setProdutoId(id);
    setSearchParams({ produto_id: String(id) }, { replace: true });
  }

  // Carrega o kardex sempre que produto ou período mudam.
  useEffect(() => {
    if (produtoId == null) return;
    let ativo = true;
    setCarregando(true);
    setErro(null);
    obterKardex(produtoId, periodo)
      .then((d) => ativo && setDados(d))
      .catch((e) => ativo && setErro(extrairErro(e)))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [produtoId, periodo]);

  const linhas = dados?.linhas ?? [];

  return (
    <div className="page">
      <RelatorioHeader
        titulo={dados ? `Extrato de ${dados.produto_nome}` : "Extrato do produto"}
        icone={icone}
        acoes={<PeriodoSeletor periodo={periodo} onChange={setPeriodo} />}
      />

      {erro && <div className="alert erro">{erro}</div>}

      <p className="subtitle">
        Toda entrada, saída e ajuste do produto, com o saldo depois de cada
        movimentação. Serve para entender como o estoque chegou onde está.
      </p>

      <div className="filtros-linha">
        <label>
          Produto
          <select
            value={produtoId ?? ""}
            onChange={(e) => trocarProduto(Number(e.target.value))}
          >
            {produtos.length === 0 && <option value="">Nenhum produto</option>}
            {produtos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>
      </div>

      {dados && (
        <div className="kpis">
          <div className="kpi">
            <span className="kpi-label">Estoque atual</span>
            <span className="kpi-valor">{dados.estoque_atual ?? "—"}</span>
          </div>
          <div className="kpi">
            <span className="kpi-label">Entradas no período</span>
            <span className="kpi-valor verde">{dados.total_entradas}</span>
          </div>
          <div className="kpi">
            <span className="kpi-label">Saídas no período</span>
            <span className="kpi-valor vermelho">{dados.total_saidas}</span>
          </div>
          <div className="kpi">
            <span className="kpi-label">Movimentações</span>
            <span className="kpi-valor">{dados.num_movimentacoes}</span>
          </div>
        </div>
      )}

      {!carregando && linhas.length >= 2 && (
        <div className="card">
          <h2>Evolução do saldo</h2>
          <LinhaSaldo
            pontos={linhas.map((l) => ({
              rotulo: diaMes(l.criado_em),
              valor: l.estoque_resultante,
            }))}
            formatar={(v) => `${v} un`}
          />
        </div>
      )}

      <div className="card">
        <h2>Extrato de movimentações</h2>
        {carregando ? (
          <p className="vazio">Carregando...</p>
        ) : produtoId == null ? (
          <p className="vazio">Selecione um produto.</p>
        ) : linhas.length === 0 ? (
          <p className="vazio">Nenhuma movimentação no período.</p>
        ) : (
          <table className="tabela">
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th className="num">Quantidade</th>
                <th className="num">Saldo</th>
                <th>Motivo</th>
                <th>Fornecedor</th>
                <th className="num">Custo unit.</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const t = rotuloTipo[l.tipo] ?? { texto: l.tipo, classe: "" };
                return (
                  <tr key={l.id}>
                    <td>{dataHoraBR(l.criado_em)}</td>
                    <td>
                      <span className={`chip ${t.classe}`}>{t.texto}</span>
                    </td>
                    <td className="num">
                      {l.tipo === "saida" ? "-" : l.tipo === "entrada" ? "+" : ""}
                      {l.quantidade}
                    </td>
                    <td className="num">{l.estoque_resultante}</td>
                    <td className="muted">{l.motivo ?? "—"}</td>
                    <td>{l.fornecedor_nome ?? "—"}</td>
                    <td className="num">
                      {l.custo_unitario != null ? brl(l.custo_unitario) : "—"}
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
