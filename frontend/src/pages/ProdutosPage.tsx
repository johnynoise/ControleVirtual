import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { Categoria, Produto, ProdutoCreate } from "../types";
import { listarCategorias } from "../services/categorias";
import {
  atualizarProduto,
  criarProduto,
  listarProdutos,
  removerProduto,
} from "../services/produtos";
import { extrairErro, parseNumero } from "../lib/ui";
import Paginacao from "../components/Paginacao";
import EstadoVazio from "../components/EstadoVazio";
import EstadoErro from "../components/EstadoErro";
import ThOrdenavel from "../components/ThOrdenavel";
import { ordenar, proximaOrdenacao, type EstadoOrdenacao } from "../lib/ordenacao";
import { SkeletonTabela } from "../components/Skeleton";
import { useConfirm, useToast } from "../components/Feedback";

const POR_PAGINA = 10;

interface FormState {
  nome: string;
  sku: string;
  codigo_barras: string;
  categoria_id: number | "";
  preco_custo: string;
  preco_venda: string;
  // Vazio = sem preço a prazo próprio; a venda a prazo usa o preço à vista.
  preco_venda_prazo: string;
  estoque: string;
  estoque_minimo: string;
  ativo: boolean;
  atributos: Record<string, unknown>;
}

function formVazio(): FormState {
  return {
    nome: "",
    sku: "",
    codigo_barras: "",
    categoria_id: "",
    preco_custo: "0",
    preco_venda: "0",
    preco_venda_prazo: "",
    estoque: "0",
    estoque_minimo: "0",
    ativo: true,
    atributos: {},
  };
}

type FiltroStatus = "todos" | "ativos" | "inativos";
type FiltroEstoque = "todos" | "baixo" | "esgotado" | "com";

type CampoProduto =
  | "nome"
  | "categoria"
  | "preco_custo"
  | "preco_venda"
  | "preco_venda_prazo"
  | "margem_percentual"
  | "estoque_total";

export default function ProdutosPage() {
  const toast = useToast();
  const confirmar = useConfirm();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(formVazio());
  const [salvando, setSalvando] = useState(false);

  // Semeia a busca a partir do parâmetro de URL (?busca=), usado pela busca
  // global para abrir a lista já filtrada em um produto.
  const [searchParams] = useSearchParams();
  const [busca, setBusca] = useState(() => searchParams.get("busca") ?? "");
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("todos");
  const [filtroCategoria, setFiltroCategoria] = useState<number | "">("");
  const [filtroEstoque, setFiltroEstoque] = useState<FiltroEstoque>("todos");
  const [pagina, setPagina] = useState(1);
  const [ord, setOrd] = useState<EstadoOrdenacao<CampoProduto>>({
    campo: "nome",
    direcao: "asc",
  });
  const ordenarPor = (campo: CampoProduto) =>
    setOrd((o) => proximaOrdenacao(o, campo));

  const categoriaSelecionada = useMemo(
    () => categorias.find((c) => c.id === form.categoria_id) ?? null,
    [categorias, form.categoria_id]
  );

  // Prévia da margem calculada localmente (o backend também calcula).
  const margem = useMemo(() => {
    const custo = parseNumero(form.preco_custo);
    const venda = parseNumero(form.preco_venda);
    const lucro = venda - custo;
    const margemPct = venda > 0 ? (lucro / venda) * 100 : 0;
    const markupPct = custo > 0 ? (lucro / custo) * 100 : 0;
    return { lucro, margemPct, markupPct };
  }, [form.preco_custo, form.preco_venda]);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const [prods, cats] = await Promise.all([listarProdutos(), listarCategorias()]);
      setProdutos(prods);
      setCategorias(cats);
    } catch (err) {
      setErro(extrairErro(err));
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  // Reaplica a busca quando o parâmetro de URL muda (navegação já estando na
  // página, ex.: busca global apontando para outro produto).
  useEffect(() => {
    const q = searchParams.get("busca");
    if (q !== null) setBusca(q);
  }, [searchParams]);

  const produtosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return produtos.filter((p) => {
      if (filtroStatus === "ativos" && !p.ativo) return false;
      if (filtroStatus === "inativos" && p.ativo) return false;
      if (filtroCategoria !== "" && p.categoria_id !== filtroCategoria) return false;
      if (filtroEstoque === "baixo" && p.estoque_total > p.estoque_minimo) return false;
      if (filtroEstoque === "esgotado" && p.estoque_total > 0) return false;
      if (filtroEstoque === "com" && p.estoque_total <= 0) return false;
      if (!termo) return true;
      return [p.nome, p.sku, p.codigo_barras]
        .filter(Boolean)
        .some((campo) => (campo as string).toLowerCase().includes(termo));
    });
  }, [produtos, busca, filtroStatus, filtroCategoria, filtroEstoque]);

  const produtosOrdenados = useMemo(
    () =>
      ordenar(produtosFiltrados, ord, (p, campo) => {
        switch (campo) {
          case "categoria":
            return categorias.find((c) => c.id === p.categoria_id)?.nome ?? "";
          case "preco_custo":
            return parseNumero(p.preco_custo);
          case "preco_venda":
            return parseNumero(p.preco_venda);
          case "preco_venda_prazo":
            return parseNumero(p.preco_venda_prazo_efetivo);
          case "margem_percentual":
            return parseNumero(p.margem_percentual);
          case "estoque_total":
            return p.estoque_total;
          default:
            return p.nome;
        }
      }),
    [produtosFiltrados, ord, categorias]
  );

  const totalPaginas = Math.max(
    1,
    Math.ceil(produtosOrdenados.length / POR_PAGINA)
  );
  const paginaAtual = Math.min(pagina, totalPaginas);
  const produtosVisiveis = produtosOrdenados.slice(
    (paginaAtual - 1) * POR_PAGINA,
    paginaAtual * POR_PAGINA
  );

  // Ao mudar filtros/busca, volta para a primeira página.
  useEffect(() => {
    setPagina(1);
  }, [busca, filtroStatus, filtroCategoria, filtroEstoque]);

  function abrirNovo() {
    setEditandoId(null);
    setForm(formVazio());
    setErro(null);
    setModalAberto(true);
  }

  function abrirEditar(p: Produto) {
    setEditandoId(p.id);
    setForm({
      nome: p.nome,
      sku: p.sku ?? "",
      codigo_barras: p.codigo_barras ?? "",
      categoria_id: p.categoria_id,
      preco_custo: p.preco_custo,
      preco_venda: p.preco_venda,
      preco_venda_prazo: p.preco_venda_prazo ?? "",
      estoque: String(p.estoque),
      estoque_minimo: String(p.estoque_minimo),
      ativo: p.ativo,
      atributos: { ...p.atributos },
    });
    setErro(null);
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setEditandoId(null);
    setForm(formVazio());
  }

  function setCampo<K extends keyof FormState>(chave: K, valor: FormState[K]) {
    setForm((f) => ({ ...f, [chave]: valor }));
  }

  function setAtributo(chave: string, valor: unknown) {
    setForm((f) => ({ ...f, atributos: { ...f.atributos, [chave]: valor } }));
  }

  // Ao trocar de categoria, mantém só os atributos que existem no novo esquema.
  function trocarCategoria(id: number | "") {
    const cat = categorias.find((c) => c.id === id) ?? null;
    setForm((f) => {
      const novos: Record<string, unknown> = {};
      cat?.campos_schema.forEach((campo) => {
        if (campo.chave in f.atributos) novos[campo.chave] = f.atributos[campo.chave];
      });
      return { ...f, categoria_id: id, atributos: novos };
    });
  }

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault();
    if (form.categoria_id === "") {
      setErro("Selecione uma categoria.");
      return;
    }
    setSalvando(true);
    setErro(null);

    const payload: ProdutoCreate = {
      nome: form.nome.trim(),
      sku: form.sku.trim() || null,
      codigo_barras: form.codigo_barras.trim() || null,
      categoria_id: form.categoria_id,
      preco_custo: parseNumero(form.preco_custo),
      preco_venda: parseNumero(form.preco_venda),
      // Campo vazio significa "não tem preço a prazo próprio" — manda null
      // para o backend cair no preço à vista.
      preco_venda_prazo:
        form.preco_venda_prazo.trim() === ""
          ? null
          : parseNumero(form.preco_venda_prazo),
      estoque: parseInt(form.estoque, 10) || 0,
      estoque_minimo: parseInt(form.estoque_minimo, 10) || 0,
      ativo: form.ativo,
      atributos: form.atributos,
      variacoes: [],
    };

    try {
      const edicao = editandoId !== null;
      if (editandoId === null) {
        await criarProduto(payload);
      } else {
        await atualizarProduto(editandoId, payload);
      }
      fecharModal();
      await carregar();
      toast.sucesso(edicao ? "Produto salvo." : "Produto criado.");
    } catch (err) {
      setErro(extrairErro(err));
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(p: Produto) {
    const ok = await confirmar({
      titulo: "Remover produto",
      mensagem: `Tem certeza que deseja remover "${p.nome}"?`,
      confirmar: "Remover",
      perigo: true,
    });
    if (!ok) return;
    setErro(null);
    try {
      await removerProduto(p.id);
      await carregar();
      toast.sucesso("Produto removido.");
    } catch (err) {
      const msg = extrairErro(err);
      setErro(msg);
      toast.erro(msg);
    }
  }

  const nomeCategoria = (id: number) =>
    categorias.find((c) => c.id === id)?.nome ?? `#${id}`;

  const filtros: { valor: FiltroStatus; rotulo: string }[] = [
    { valor: "todos", rotulo: "Todos" },
    { valor: "ativos", rotulo: "Ativos" },
    { valor: "inativos", rotulo: "Inativos" },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <span className="title-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2 3 7v10l9 5 9-5V7z" />
              <path d="M3 7l9 5 9-5" />
              <path d="M12 12v10" />
            </svg>
          </span>
          <h1>Produtos</h1>
        </div>
        <button className="btn primario" onClick={abrirNovo}>
          + Novo produto
        </button>
      </div>

      {erro && !modalAberto && produtos.length > 0 && (
        <div className="alert erro">{erro}</div>
      )}

      {categorias.length === 0 && !carregando && (
        <div className="alert aviso">
          Nenhuma categoria cadastrada ainda. Crie uma categoria antes de cadastrar produtos.
        </div>
      )}

      <div className="toolbar">
        <div className="busca">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4-4" />
          </svg>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, SKU ou código de barras..."
          />
        </div>
        <select
          value={filtroCategoria}
          onChange={(e) =>
            setFiltroCategoria(e.target.value === "" ? "" : Number(e.target.value))
          }
          style={{
            padding: "0.7rem 0.85rem",
            border: "1px solid var(--border)",
            borderRadius: "var(--raio-sm)",
            fontFamily: "inherit",
            fontSize: "1rem",
            background: "var(--surface)",
          }}
        >
          <option value="">Todas as categorias</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
        <select
          className="filtro-select"
          value={filtroEstoque}
          onChange={(e) => setFiltroEstoque(e.target.value as FiltroEstoque)}
          title="Filtrar por estoque"
        >
          <option value="todos">Todo estoque</option>
          <option value="baixo">Estoque baixo</option>
          <option value="esgotado">Esgotados</option>
          <option value="com">Com estoque</option>
        </select>
        <div className="periodo-tabs">
          {filtros.map((f) => (
            <button
              key={f.valor}
              className={`btn ${filtroStatus === f.valor ? "primario" : "secundario"} pequeno`}
              onClick={() => setFiltroStatus(f.valor)}
            >
              {f.rotulo}
            </button>
          ))}
        </div>
        <span className="contagem">
          {produtosFiltrados.length}{" "}
          {produtosFiltrados.length === 1 ? "produto" : "produtos"}
        </span>
      </div>

      <div className="card">
        {carregando ? (
          <SkeletonTabela />
        ) : erro && produtos.length === 0 ? (
          <EstadoErro mensagem={erro} onTentarNovamente={carregar} />
        ) : produtos.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum produto cadastrado"
            descricao="Os produtos são a base para vender no PDV e controlar o estoque. Cadastre o primeiro para começar."
            acao={
              categorias.length === 0
                ? { rotulo: "Criar categoria primeiro", to: "/categorias" }
                : { rotulo: "Cadastrar primeiro produto", onClick: abrirNovo }
            }
          />
        ) : produtosFiltrados.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum produto encontrado"
            descricao="Tente outro termo de busca ou ajuste os filtros de categoria, estoque e status."
          />
        ) : (
          <table className="tabela">
            <thead>
              <tr>
                <ThOrdenavel campo="nome" estado={ord} onOrdenar={ordenarPor}>
                  Produto
                </ThOrdenavel>
                <ThOrdenavel campo="categoria" estado={ord} onOrdenar={ordenarPor}>
                  Categoria
                </ThOrdenavel>
                <ThOrdenavel campo="preco_custo" estado={ord} onOrdenar={ordenarPor} className="num">
                  Custo
                </ThOrdenavel>
                <ThOrdenavel campo="preco_venda" estado={ord} onOrdenar={ordenarPor} className="num">
                  Venda
                </ThOrdenavel>
                <ThOrdenavel campo="preco_venda_prazo" estado={ord} onOrdenar={ordenarPor} className="num">
                  A prazo
                </ThOrdenavel>
                <ThOrdenavel campo="margem_percentual" estado={ord} onOrdenar={ordenarPor} className="num">
                  Margem
                </ThOrdenavel>
                <ThOrdenavel campo="estoque_total" estado={ord} onOrdenar={ordenarPor} className="num">
                  Estoque
                </ThOrdenavel>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {produtosVisiveis.map((p) => (
                <tr key={p.id} className={p.ativo ? "" : "inativo"}>
                  <td>
                    <strong>{p.nome}</strong>
                    {p.sku && <div className="muted">SKU: {p.sku}</div>}
                  </td>
                  <td>{nomeCategoria(p.categoria_id)}</td>
                  <td className="num">R$ {p.preco_custo}</td>
                  <td className="num">R$ {p.preco_venda}</td>
                  <td className="num">
                    R$ {p.preco_venda_prazo_efetivo}
                    {p.preco_venda_prazo == null && (
                      <div className="muted">mesmo à vista</div>
                    )}
                  </td>
                  <td className="num">{p.margem_percentual}%</td>
                  <td className="num">
                    {p.estoque_total}
                    {p.estoque_total <= p.estoque_minimo && (
                      <span className="chip alerta"> baixo</span>
                    )}
                  </td>
                  <td className="acoes">
                    {/* Extrato do produto: o lugar natural de entrada é aqui,
                        com o produto já escolhido. */}
                    <Link
                      className="btn secundario pequeno"
                      to={`/relatorios/kardex?produto_id=${p.id}`}
                    >
                      Extrato
                    </Link>
                    <button className="btn secundario pequeno" onClick={() => abrirEditar(p)}>
                      Editar
                    </button>
                    <button className="btn perigo pequeno" onClick={() => excluir(p)}>
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!carregando && produtosFiltrados.length > 0 && (
          <Paginacao
            pagina={paginaAtual}
            totalPaginas={totalPaginas}
            onChange={setPagina}
          />
        )}
      </div>

      {modalAberto && (
        <div className="recibo-overlay" onClick={fecharModal}>
          <form
            className="modal-box modal-lg form"
            onClick={(e) => e.stopPropagation()}
            onSubmit={salvar}
          >
            <h2>{editandoId === null ? "Novo produto" : "Editar produto"}</h2>

            {erro && <div className="alert erro">{erro}</div>}

            <div className="grid-2">
              <label>
                Nome
                <input
                  value={form.nome}
                  onChange={(e) => setCampo("nome", e.target.value)}
                  placeholder="Ex.: Camiseta básica"
                  required
                  autoFocus
                />
              </label>
              <label>
                Categoria
                <select
                  value={form.categoria_id}
                  onChange={(e) =>
                    trocarCategoria(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  required
                >
                  <option value="">Selecione...</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid-2">
              <label>
                SKU
                <input
                  value={form.sku}
                  onChange={(e) => setCampo("sku", e.target.value)}
                  placeholder="Opcional"
                />
              </label>
              <label>
                Código de barras
                <input
                  value={form.codigo_barras}
                  onChange={(e) => setCampo("codigo_barras", e.target.value)}
                  placeholder="Opcional"
                />
              </label>
            </div>

            <div className="grid-2">
              <label>
                Preço de custo
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.preco_custo}
                  onChange={(e) => setCampo("preco_custo", e.target.value)}
                />
              </label>
              <label>
                Preço de venda
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.preco_venda}
                  onChange={(e) => setCampo("preco_venda", e.target.value)}
                />
              </label>
            </div>

            <div className="grid-2">
              <label>
                Preço a prazo
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.preco_venda_prazo}
                  onChange={(e) => setCampo("preco_venda_prazo", e.target.value)}
                  placeholder={`Opcional — sem isso usa R$ ${form.preco_venda}`}
                />
                <small className="muted">
                  Usado quando a venda é a prazo. Deixe vazio para cobrar o
                  mesmo preço à vista.
                </small>
              </label>
              <div />
            </div>

            <div className="grid-2">
              <label>
                Estoque
                <input
                  type="number"
                  min="0"
                  value={form.estoque}
                  onChange={(e) => setCampo("estoque", e.target.value)}
                />
              </label>
              <label>
                Estoque mínimo
                <input
                  type="number"
                  min="0"
                  value={form.estoque_minimo}
                  onChange={(e) => setCampo("estoque_minimo", e.target.value)}
                />
              </label>
            </div>

            <div className="margem-preview">
              <span>
                Lucro un.: <strong>R$ {margem.lucro.toFixed(2)}</strong>
              </span>
              <span>
                Margem: <strong>{margem.margemPct.toFixed(2)}%</strong>
              </span>
              <span>
                Markup: <strong>{margem.markupPct.toFixed(2)}%</strong>
              </span>
            </div>

            {/* Campos dinâmicos vindos do esquema da categoria */}
            {categoriaSelecionada && categoriaSelecionada.campos_schema.length > 0 && (
              <>
                <h3>Atributos de {categoriaSelecionada.nome}</h3>
                <div className="grid-2">
                  {categoriaSelecionada.campos_schema.map((campo) => {
                    const valor = form.atributos[campo.chave];
                    const label = `${campo.rotulo}${campo.obrigatorio ? " *" : ""}`;

                    if (campo.tipo === "lista") {
                      return (
                        <label key={campo.chave}>
                          {label}
                          <select
                            value={(valor as string) ?? ""}
                            onChange={(e) =>
                              setAtributo(campo.chave, e.target.value || undefined)
                            }
                            required={campo.obrigatorio}
                          >
                            <option value="">Selecione...</option>
                            {(campo.opcoes ?? []).map((op) => (
                              <option key={op} value={op}>
                                {op}
                              </option>
                            ))}
                          </select>
                        </label>
                      );
                    }

                    if (campo.tipo === "booleano") {
                      return (
                        <label key={campo.chave} className="check">
                          <input
                            type="checkbox"
                            checked={Boolean(valor)}
                            onChange={(e) => setAtributo(campo.chave, e.target.checked)}
                          />
                          {label}
                        </label>
                      );
                    }

                    return (
                      <label key={campo.chave}>
                        {label}
                        <input
                          type={
                            campo.tipo === "numero"
                              ? "number"
                              : campo.tipo === "data"
                                ? "date"
                                : "text"
                          }
                          value={(valor as string | number) ?? ""}
                          onChange={(e) =>
                            setAtributo(
                              campo.chave,
                              campo.tipo === "numero"
                                ? e.target.value === ""
                                  ? undefined
                                  : Number(e.target.value)
                                : e.target.value || undefined
                            )
                          }
                          required={campo.obrigatorio}
                        />
                      </label>
                    );
                  })}
                </div>
              </>
            )}

            <label className="check">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(e) => setCampo("ativo", e.target.checked)}
              />
              Produto ativo
            </label>

            <div className="form-acoes">
              <button className="btn primario" type="submit" disabled={salvando}>
                {salvando
                  ? "Salvando..."
                  : editandoId === null
                    ? "Criar produto"
                    : "Salvar"}
              </button>
              <button type="button" className="btn secundario" onClick={fecharModal}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
