import { useEffect, useState } from "react";
import type {
  Fornecedor,
  Movimentacao,
  MovimentacaoCreate,
  Produto,
  TipoMovimentacao,
} from "../types";
import { listarProdutos } from "../services/produtos";
import { listarFornecedores } from "../services/fornecedores";
import {
  criarMovimentacao,
  listarMovimentacoes,
} from "../services/movimentacoes";

const MOTIVOS: Record<TipoMovimentacao, string[]> = {
  entrada: ["compra", "devolucao", "inventario", "outro"],
  saida: ["venda", "perda", "uso_interno", "outro"],
  ajuste: ["inventario", "correcao", "outro"],
};

const ROTULO_TIPO: Record<TipoMovimentacao, string> = {
  entrada: "Entrada",
  saida: "Saída",
  ajuste: "Ajuste",
};

function extrairErro(err: unknown): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data
    ?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    return detail.map((d: { msg?: string }) => d.msg ?? "").join("; ");
  }
  return "Não foi possível concluir a operação.";
}

function formatarData(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function MovimentacoesPage() {
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [produtoId, setProdutoId] = useState<number | "">("");
  const [tipo, setTipo] = useState<TipoMovimentacao>("entrada");
  const [quantidade, setQuantidade] = useState("1");
  const [motivo, setMotivo] = useState("compra");
  const [custoUnitario, setCustoUnitario] = useState("");
  const [fornecedorId, setFornecedorId] = useState<number | "">("");
  const [observacao, setObservacao] = useState("");

  const produtoSelecionado = produtos.find((p) => p.id === produtoId) ?? null;

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const [movs, prods, forns] = await Promise.all([
        listarMovimentacoes(),
        listarProdutos(),
        listarFornecedores({ apenas_ativos: true }),
      ]);
      setMovimentacoes(movs);
      setProdutos(prods);
      setFornecedores(forns);
    } catch (err) {
      setErro(extrairErro(err));
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  function trocarTipo(novo: TipoMovimentacao) {
    setTipo(novo);
    // Ajusta o motivo padrão para um válido do novo tipo.
    setMotivo(MOTIVOS[novo][0]);
  }

  function limpar() {
    setProdutoId("");
    setTipo("entrada");
    setQuantidade("1");
    setMotivo("compra");
    setCustoUnitario("");
    setFornecedorId("");
    setObservacao("");
  }

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault();
    if (produtoId === "") {
      setErro("Selecione um produto.");
      return;
    }
    setSalvando(true);
    setErro(null);

    const payload: MovimentacaoCreate = {
      produto_id: produtoId,
      tipo,
      quantidade: parseInt(quantidade, 10) || 0,
      motivo: motivo || null,
      custo_unitario:
        tipo === "entrada" && custoUnitario !== "" ? parseFloat(custoUnitario) : null,
      fornecedor_id: tipo === "entrada" && fornecedorId !== "" ? fornecedorId : null,
      observacao: observacao.trim() || null,
    };

    try {
      await criarMovimentacao(payload);
      limpar();
      await carregar();
    } catch (err) {
      setErro(extrairErro(err));
    } finally {
      setSalvando(false);
    }
  }

  const labelQuantidade =
    tipo === "ajuste" ? "Novo estoque (valor final)" : "Quantidade";

  return (
    <div className="page">
      <div className="page-title">
        <span className="title-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3l4 4-4 4" />
            <path d="M21 7H7" />
            <path d="M7 21l-4-4 4-4" />
            <path d="M3 17h14" />
          </svg>
        </span>
        <h1>Estoque</h1>
      </div>
      <p className="subtitle">
        Registre o que entra e o que sai. O estoque é atualizado na hora e tudo fica no
        histórico.
      </p>

      {erro && <div className="alert erro">{erro}</div>}

      {produtos.length === 0 && !carregando && (
        <div className="alert aviso">
          Nenhum produto cadastrado. Cadastre um produto antes de movimentar o estoque.
        </div>
      )}

      <form className="card form" onSubmit={salvar}>
        <h2>Nova movimentação</h2>

        <div className="grid-2">
          <label>
            Produto
            <select
              value={produtoId}
              onChange={(e) =>
                setProdutoId(e.target.value === "" ? "" : Number(e.target.value))
              }
              required
            >
              <option value="">Selecione...</option>
              {produtos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome} (estoque: {p.estoque})
                </option>
              ))}
            </select>
          </label>
          <label>
            Tipo
            <select value={tipo} onChange={(e) => trocarTipo(e.target.value as TipoMovimentacao)}>
              <option value="entrada">Entrada (+)</option>
              <option value="saida">Saída (−)</option>
              <option value="ajuste">Ajuste (=)</option>
            </select>
          </label>
        </div>

        <div className="grid-4">
          <label>
            {labelQuantidade}
            <input
              type="number"
              min={tipo === "ajuste" ? "0" : "1"}
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              required
            />
          </label>
          <label>
            Motivo
            <select value={motivo} onChange={(e) => setMotivo(e.target.value)}>
              {MOTIVOS[tipo].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          {tipo === "entrada" && (
            <label>
              Custo unitário
              <input
                type="number"
                step="0.01"
                min="0"
                value={custoUnitario}
                onChange={(e) => setCustoUnitario(e.target.value)}
                placeholder="Opcional"
              />
            </label>
          )}
          <label>
            Observação
            <input
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Opcional"
            />
          </label>
        </div>

        {tipo === "entrada" && (
          <label>
            Fornecedor
            <select
              value={fornecedorId}
              onChange={(e) =>
                setFornecedorId(e.target.value === "" ? "" : Number(e.target.value))
              }
            >
              <option value="">Sem fornecedor</option>
              {fornecedores.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </label>
        )}

        {produtoSelecionado && (
          <div className="margem-preview">
            <span>
              Estoque atual: <strong>{produtoSelecionado.estoque}</strong>
            </span>
            {tipo === "entrada" && (
              <span>
                Ficará:{" "}
                <strong>{produtoSelecionado.estoque + (parseInt(quantidade, 10) || 0)}</strong>
              </span>
            )}
            {tipo === "saida" && (
              <span>
                Ficará:{" "}
                <strong>{produtoSelecionado.estoque - (parseInt(quantidade, 10) || 0)}</strong>
              </span>
            )}
            {tipo === "ajuste" && (
              <span>
                Ficará: <strong>{parseInt(quantidade, 10) || 0}</strong>
              </span>
            )}
          </div>
        )}

        <div className="form-acoes">
          <button className="btn primario" type="submit" disabled={salvando}>
            {salvando ? "Registrando..." : "Registrar movimentação"}
          </button>
        </div>
      </form>

      <div className="card">
        <h2>Histórico</h2>
        {carregando ? (
          <p className="vazio">Carregando...</p>
        ) : movimentacoes.length === 0 ? (
          <p className="vazio">Nenhuma movimentação ainda.</p>
        ) : (
          <table className="tabela">
            <thead>
              <tr>
                <th>Data</th>
                <th>Produto</th>
                <th>Tipo</th>
                <th>Qtd.</th>
                <th>Estoque após</th>
                <th>Motivo</th>
                <th>Custo un.</th>
                <th>Fornecedor</th>
              </tr>
            </thead>
            <tbody>
              {movimentacoes.map((m) => (
                <tr key={m.id}>
                  <td className="muted">{formatarData(m.criado_em)}</td>
                  <td>{m.produto_nome}</td>
                  <td>
                    <span className={`chip mov-${m.tipo}`}>{ROTULO_TIPO[m.tipo]}</span>
                  </td>
                  <td>{m.quantidade}</td>
                  <td>{m.estoque_resultante}</td>
                  <td className="muted">{m.motivo ?? "—"}</td>
                  <td>{m.custo_unitario ? `R$ ${m.custo_unitario}` : "—"}</td>
                  <td className="muted">{m.fornecedor_nome ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
