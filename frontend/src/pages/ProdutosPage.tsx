import { useEffect, useMemo, useState } from "react";
import type { Categoria, Produto, ProdutoCreate } from "../types";
import { listarCategorias } from "../services/categorias";
import {
  atualizarProduto,
  criarProduto,
  listarProdutos,
  removerProduto,
} from "../services/produtos";

function extrairErro(err: unknown): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data
    ?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    return detail.map((d: { msg?: string }) => d.msg ?? "").join("; ");
  }
  return "Não foi possível concluir a operação.";
}

interface FormState {
  nome: string;
  sku: string;
  codigo_barras: string;
  categoria_id: number | "";
  preco_custo: string;
  preco_venda: string;
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
    estoque: "0",
    estoque_minimo: "0",
    ativo: true,
    atributos: {},
  };
}

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(formVazio());
  const [salvando, setSalvando] = useState(false);

  const categoriaSelecionada = useMemo(
    () => categorias.find((c) => c.id === form.categoria_id) ?? null,
    [categorias, form.categoria_id]
  );

  // Prévia da margem calculada localmente (o backend também calcula).
  const margem = useMemo(() => {
    const custo = parseFloat(form.preco_custo) || 0;
    const venda = parseFloat(form.preco_venda) || 0;
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

  function limpar() {
    setEditandoId(null);
    setForm(formVazio());
  }

  function editar(p: Produto) {
    setEditandoId(p.id);
    setForm({
      nome: p.nome,
      sku: p.sku ?? "",
      codigo_barras: p.codigo_barras ?? "",
      categoria_id: p.categoria_id,
      preco_custo: p.preco_custo,
      preco_venda: p.preco_venda,
      estoque: String(p.estoque),
      estoque_minimo: String(p.estoque_minimo),
      ativo: p.ativo,
      atributos: { ...p.atributos },
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
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
      preco_custo: parseFloat(form.preco_custo) || 0,
      preco_venda: parseFloat(form.preco_venda) || 0,
      estoque: parseInt(form.estoque, 10) || 0,
      estoque_minimo: parseInt(form.estoque_minimo, 10) || 0,
      ativo: form.ativo,
      atributos: form.atributos,
      variacoes: [],
    };

    try {
      if (editandoId === null) {
        await criarProduto(payload);
      } else {
        await atualizarProduto(editandoId, payload);
      }
      limpar();
      await carregar();
    } catch (err) {
      setErro(extrairErro(err));
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(p: Produto) {
    if (!confirm(`Remover o produto "${p.nome}"?`)) return;
    setErro(null);
    try {
      await removerProduto(p.id);
      if (editandoId === p.id) limpar();
      await carregar();
    } catch (err) {
      setErro(extrairErro(err));
    }
  }

  const nomeCategoria = (id: number) =>
    categorias.find((c) => c.id === id)?.nome ?? `#${id}`;

  return (
    <div className="page">
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
      <p className="subtitle">
        Cadastre o que você vende. A margem de lucro é calculada automaticamente.
      </p>

      {erro && <div className="alert erro">{erro}</div>}

      {categorias.length === 0 && !carregando && (
        <div className="alert aviso">
          Nenhuma categoria cadastrada ainda. Crie uma categoria antes de cadastrar produtos.
        </div>
      )}

      <form className="card form" onSubmit={salvar}>
        <h2>{editandoId === null ? "Novo produto" : "Editar produto"}</h2>

        <div className="grid-2">
          <label>
            Nome
            <input
              value={form.nome}
              onChange={(e) => setCampo("nome", e.target.value)}
              placeholder="Ex.: Camiseta básica"
              required
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

        <div className="grid-4">
          <label>
            Preço de custo
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.preco_custo}
              onChange={(e) => setCampo("preco_custo", e.target.value)}
            />
          </label>
          <label>
            Preço de venda
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.preco_venda}
              onChange={(e) => setCampo("preco_venda", e.target.value)}
            />
          </label>
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
                        onChange={(e) => setAtributo(campo.chave, e.target.value || undefined)}
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
            {salvando ? "Salvando..." : editandoId === null ? "Criar produto" : "Salvar"}
          </button>
          {editandoId !== null && (
            <button type="button" className="btn secundario" onClick={limpar}>
              Cancelar
            </button>
          )}
        </div>
      </form>

      <div className="card">
        <h2>Produtos cadastrados</h2>
        {carregando ? (
          <p className="vazio">Carregando...</p>
        ) : produtos.length === 0 ? (
          <p className="vazio">Nenhum produto ainda.</p>
        ) : (
          <table className="tabela">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Categoria</th>
                <th>Custo</th>
                <th>Venda</th>
                <th>Margem</th>
                <th>Estoque</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {produtos.map((p) => (
                <tr key={p.id} className={p.ativo ? "" : "inativo"}>
                  <td>
                    <strong>{p.nome}</strong>
                    {p.sku && <div className="muted">SKU: {p.sku}</div>}
                  </td>
                  <td>{nomeCategoria(p.categoria_id)}</td>
                  <td>R$ {p.preco_custo}</td>
                  <td>R$ {p.preco_venda}</td>
                  <td>{p.margem_percentual}%</td>
                  <td>
                    {p.estoque_total}
                    {p.estoque_total <= p.estoque_minimo && (
                      <span className="chip alerta"> baixo</span>
                    )}
                  </td>
                  <td className="acoes">
                    <button className="btn secundario pequeno" onClick={() => editar(p)}>
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
      </div>
    </div>
  );
}
