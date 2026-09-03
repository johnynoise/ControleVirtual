import { useEffect, useMemo, useRef, useState } from "react";
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
import Paginacao from "../components/Paginacao";
import { useToast } from "../components/Feedback";
import { brl, dataHora, extrairErro } from "../lib/ui";

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

// Quantidade de registros por página no histórico.
const POR_PAGINA = 10;

const TIPOS: { valor: TipoMovimentacao; rotulo: string; sinal: string }[] = [
  { valor: "entrada", rotulo: "Entrada", sinal: "+" },
  { valor: "saida", rotulo: "Saída", sinal: "−" },
  { valor: "ajuste", rotulo: "Ajuste", sinal: "=" },
];

export default function MovimentacoesPage() {
  const toast = useToast();
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

  // Filtros e paginação do histórico.
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<TipoMovimentacao | "">("");
  const [pagina, setPagina] = useState(1);

  const formRef = useRef<HTMLFormElement>(null);
  const qtdRef = useRef<HTMLInputElement>(null);

  const produtoSelecionado = produtos.find((p) => p.id === produtoId) ?? null;

  // Busca as movimentações do backend já filtradas por tipo (quando houver),
  // com limite alto para não cortar entradas antigas. As saídas de venda são
  // muito mais frequentes, então filtrar no servidor garante que as entradas
  // (com fornecedor e custo) apareçam.
  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const [movs, prods, forns] = await Promise.all([
        listarMovimentacoes({ tipo: filtroTipo || undefined, limit: 500 }),
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

  // Recarrega ao trocar o filtro de tipo (o filtro passa a ser do servidor).
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroTipo]);

  // ------------------------- Indicadores -------------------------
  const kpis = useMemo(() => {
    const ativos = produtos.filter((p) => p.ativo);
    const valorEstoque = ativos.reduce(
      (acc, p) => acc + (parseFloat(p.preco_custo) || 0) * p.estoque,
      0
    );
    const baixo = ativos.filter(
      (p) => p.estoque <= p.estoque_minimo && p.estoque > 0
    ).length;
    const ruptura = ativos.filter((p) => p.estoque <= 0).length;
    return { produtos: ativos.length, valorEstoque, baixo, ruptura };
  }, [produtos]);

  // Itens que precisam de reposição (abaixo ou no mínimo), mais críticos primeiro.
  const estoqueBaixo = useMemo(
    () =>
      produtos
        .filter((p) => p.ativo && p.estoque <= p.estoque_minimo)
        .sort((a, b) => a.estoque - b.estoque),
    [produtos]
  );

  const movsFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return movimentacoes.filter((m) => {
      if (filtroTipo && m.tipo !== filtroTipo) return false;
      if (termo && !m.produto_nome.toLowerCase().includes(termo)) return false;
      return true;
    });
  }, [movimentacoes, busca, filtroTipo]);

  // Paginação (mais recentes primeiro).
  const totalPaginas = Math.max(1, Math.ceil(movsFiltradas.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const movsVisiveis = movsFiltradas.slice(
    (paginaAtual - 1) * POR_PAGINA,
    paginaAtual * POR_PAGINA
  );

  // Ao mudar filtro/busca, volta para a primeira página.
  useEffect(() => {
    setPagina(1);
  }, [busca, filtroTipo]);

  function trocarTipo(novo: TipoMovimentacao) {
    setTipo(novo);
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

  // Pré-preenche o formulário para repor um item em falta.
  function repor(p: Produto) {
    setProdutoId(p.id);
    setTipo("entrada");
    setMotivo("compra");
    const sugestao = Math.max(1, p.estoque_minimo - p.estoque || 1);
    setQuantidade(String(sugestao));
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => qtdRef.current?.focus(), 300);
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
      const nomeProduto = produtoSelecionado?.nome ?? "produto";
      limpar();
      await carregar();
      toast.sucesso(`Movimentação de ${nomeProduto} registrada.`);
    } catch (err) {
      setErro(extrairErro(err));
    } finally {
      setSalvando(false);
    }
  }

  const labelQuantidade =
    tipo === "ajuste" ? "Novo estoque (valor final)" : "Quantidade";

  // Estoque resultante previsto conforme o tipo.
  const estoquePrevisto = (() => {
    if (!produtoSelecionado) return null;
    const q = parseInt(quantidade, 10) || 0;
    if (tipo === "entrada") return produtoSelecionado.estoque + q;
    if (tipo === "saida") return produtoSelecionado.estoque - q;
    return q;
  })();

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

      {/* ----------------------- Indicadores ----------------------- */}
      <div className="kpis">
        <div className="kpi">
          <span className="kpi-label">Produtos ativos</span>
          <span className="kpi-valor">{kpis.produtos}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Valor em estoque (custo)</span>
          <span className="kpi-valor">{brl(kpis.valorEstoque)}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Estoque baixo</span>
          <span className={`kpi-valor${kpis.baixo > 0 ? " ambar" : ""}`}>
            {kpis.baixo}
          </span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Ruptura (zerados)</span>
          <span className={`kpi-valor${kpis.ruptura > 0 ? " vermelho" : ""}`}>
            {kpis.ruptura}
          </span>
        </div>
      </div>

      {/* --------------- Formulário + Estoque baixo --------------- */}
      <div className="mov-layout">
        <form className="card form mov-form" onSubmit={salvar} ref={formRef}>
          <h2>Nova movimentação</h2>

          <div className="rotulo-campo">Tipo de movimentação</div>
          <div className="tipo-seg">
            {TIPOS.map((t) => (
              <button
                key={t.valor}
                type="button"
                className={`tipo-seg-btn ${t.valor}${tipo === t.valor ? " ativo" : ""}`}
                onClick={() => trocarTipo(t.valor)}
              >
                <span className="tipo-sinal">{t.sinal}</span>
                {t.rotulo}
              </button>
            ))}
          </div>

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
              {labelQuantidade}
              <input
                ref={qtdRef}
                type="number"
                min={tipo === "ajuste" ? "0" : "1"}
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                required
              />
            </label>
          </div>

          <div className="grid-2">
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
            {tipo === "entrada" ? (
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
            ) : (
              <label>
                Observação
                <input
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Opcional"
                />
              </label>
            )}
          </div>

          {tipo === "entrada" && (
            <div className="grid-2">
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
              <label>
                Observação
                <input
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Opcional"
                />
              </label>
            </div>
          )}

          {produtoSelecionado && (
            <div className="mov-preview">
              <div className="mov-preview-de">
                <span className="rotulo-campo">Estoque atual</span>
                <strong>{produtoSelecionado.estoque}</strong>
              </div>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m13 6 6 6-6 6" />
              </svg>
              <div className="mov-preview-para">
                <span className="rotulo-campo">Ficará</span>
                <strong
                  className={
                    (estoquePrevisto ?? 0) < 0
                      ? "texto-vermelho"
                      : (estoquePrevisto ?? 0) <= produtoSelecionado.estoque_minimo
                        ? "texto-ambar"
                        : "texto-verde"
                  }
                >
                  {estoquePrevisto}
                </strong>
              </div>
            </div>
          )}

          <div className="form-acoes">
            <button className="btn primario" type="submit" disabled={salvando}>
              {salvando ? "Registrando..." : "Registrar movimentação"}
            </button>
            {produtoId !== "" && (
              <button type="button" className="btn secundario" onClick={limpar}>
                Limpar
              </button>
            )}
          </div>
        </form>

        {/* --------------------- Estoque baixo --------------------- */}
        <aside className="card estoque-baixo">
          <div className="eb-head">
            <h2>Estoque baixo</h2>
            {estoqueBaixo.length > 0 && (
              <span className="pdv-badge">{estoqueBaixo.length}</span>
            )}
          </div>

          {carregando ? (
            <p className="vazio">Carregando...</p>
          ) : estoqueBaixo.length === 0 ? (
            <div className="eb-ok">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              <p>Tudo certo!</p>
              <span>Nenhum item abaixo do mínimo.</span>
            </div>
          ) : (
            <ul className="eb-lista">
              {estoqueBaixo.map((p) => {
                const zerado = p.estoque <= 0;
                return (
                  <li key={p.id} className="eb-item">
                    <span className={`eb-dot${zerado ? " zero" : ""}`} />
                    <div className="eb-info">
                      <span className="eb-nome">{p.nome}</span>
                      <span className="muted">
                        {zerado ? "sem estoque" : `${p.estoque} un`} · mín {p.estoque_minimo}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn secundario pequeno"
                      onClick={() => repor(p)}
                    >
                      Repor
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>

      {/* ------------------------- Histórico ------------------------- */}
      <div className="card">
        <h2>Histórico</h2>

        <div className="toolbar">
          <div className="busca">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por produto..."
            />
          </div>
          <div className="pdv-pgto-pills">
            <button
              type="button"
              className={`pdv-pill${filtroTipo === "" ? " ativo" : ""}`}
              onClick={() => setFiltroTipo("")}
            >
              Todos
            </button>
            {TIPOS.map((t) => (
              <button
                key={t.valor}
                type="button"
                className={`pdv-pill${filtroTipo === t.valor ? " ativo" : ""}`}
                onClick={() => setFiltroTipo(t.valor)}
              >
                {t.rotulo}
              </button>
            ))}
          </div>
          <span className="contagem">
            {movsFiltradas.length}{" "}
            {movsFiltradas.length === 1 ? "registro" : "registros"}
          </span>
        </div>

        {carregando ? (
          <p className="vazio">Carregando...</p>
        ) : movsFiltradas.length === 0 ? (
          <p className="vazio">
            {movimentacoes.length === 0
              ? "Nenhuma movimentação ainda."
              : "Nenhum registro para esse filtro."}
          </p>
        ) : (
          <table className="tabela">
            <thead>
              <tr>
                <th>Data</th>
                <th>Produto</th>
                <th>Tipo</th>
                <th className="num">Qtd.</th>
                <th className="num">Estoque após</th>
                <th>Motivo</th>
                <th className="num">Custo un.</th>
                <th>Fornecedor</th>
              </tr>
            </thead>
            <tbody>
              {movsVisiveis.map((m) => (
                <tr key={m.id}>
                  <td className="muted">{dataHora(m.criado_em)}</td>
                  <td>{m.produto_nome}</td>
                  <td>
                    <span className={`chip mov-${m.tipo}`}>{ROTULO_TIPO[m.tipo]}</span>
                  </td>
                  <td className="num">
                    <span
                      className={
                        m.tipo === "entrada"
                          ? "texto-verde"
                          : m.tipo === "saida"
                            ? "texto-vermelho"
                            : undefined
                      }
                    >
                      {m.tipo === "entrada" ? "+" : m.tipo === "saida" ? "−" : ""}
                      {m.quantidade}
                    </span>
                  </td>
                  <td className="num">{m.estoque_resultante}</td>
                  <td className="muted">{m.motivo ?? "—"}</td>
                  <td className="num">{m.custo_unitario ? brl(m.custo_unitario) : "—"}</td>
                  <td className="muted">{m.fornecedor_nome ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <Paginacao
          pagina={paginaAtual}
          totalPaginas={totalPaginas}
          onChange={setPagina}
        />
      </div>
    </div>
  );
}
