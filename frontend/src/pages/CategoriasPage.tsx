import { useEffect, useState } from "react";
import type { CampoSchema, Categoria, CategoriaCreate, TipoCampo } from "../types";
import {
  atualizarCategoria,
  criarCategoria,
  listarCategorias,
  removerCategoria,
} from "../services/categorias";
import Paginacao from "../components/Paginacao";
import EstadoVazio from "../components/EstadoVazio";
import EstadoErro from "../components/EstadoErro";
import { SkeletonTabela } from "../components/Skeleton";
import { useConfirm, useToast } from "../components/Feedback";
import { extrairErro } from "../lib/ui";

const POR_PAGINA = 10;

const TIPOS: { valor: TipoCampo; rotulo: string }[] = [
  { valor: "texto", rotulo: "Texto" },
  { valor: "numero", rotulo: "Número" },
  { valor: "lista", rotulo: "Lista de opções" },
  { valor: "booleano", rotulo: "Sim/Não" },
  { valor: "data", rotulo: "Data" },
];

function campoVazio(): CampoSchema {
  return { chave: "", rotulo: "", tipo: "texto", obrigatorio: false, opcoes: [] };
}

export default function CategoriasPage() {
  const toast = useToast();
  const confirmar = useConfirm();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [campos, setCampos] = useState<CampoSchema[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [pagina, setPagina] = useState(1);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      setCategorias(await listarCategorias());
    } catch (err) {
      setErro(extrairErro(err));
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  function limparFormulario() {
    setEditandoId(null);
    setNome("");
    setDescricao("");
    setCampos([]);
  }

  function editar(categoria: Categoria) {
    setEditandoId(categoria.id);
    setNome(categoria.nome);
    setDescricao(categoria.descricao ?? "");
    setCampos(categoria.campos_schema.map((c) => ({ ...c, opcoes: c.opcoes ?? [] })));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function atualizarCampo(indice: number, patch: Partial<CampoSchema>) {
    setCampos((atual) => atual.map((c, i) => (i === indice ? { ...c, ...patch } : c)));
  }

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault();
    setSalvando(true);
    setErro(null);

    const payload: CategoriaCreate = {
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      campos_schema: campos.map((c) => ({
        chave: c.chave.trim(),
        rotulo: c.rotulo.trim(),
        tipo: c.tipo,
        obrigatorio: c.obrigatorio,
        opcoes: c.tipo === "lista" ? (c.opcoes ?? []).filter(Boolean) : null,
      })),
    };

    try {
      if (editandoId === null) {
        await criarCategoria(payload);
      } else {
        await atualizarCategoria(editandoId, payload);
      }
      const edicao = editandoId !== null;
      limparFormulario();
      await carregar();
      toast.sucesso(edicao ? "Categoria salva." : "Categoria criada.");
    } catch (err) {
      setErro(extrairErro(err));
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(categoria: Categoria) {
    const ok = await confirmar({
      titulo: "Remover categoria",
      mensagem: `Tem certeza que deseja remover "${categoria.nome}"?`,
      confirmar: "Remover",
      perigo: true,
    });
    if (!ok) return;
    setErro(null);
    try {
      await removerCategoria(categoria.id);
      if (editandoId === categoria.id) limparFormulario();
      await carregar();
      toast.sucesso("Categoria removida.");
    } catch (err) {
      const msg = extrairErro(err);
      setErro(msg);
      toast.erro(msg);
    }
  }

  const totalPaginas = Math.max(1, Math.ceil(categorias.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const categoriasVisiveis = categorias.slice(
    (paginaAtual - 1) * POR_PAGINA,
    paginaAtual * POR_PAGINA
  );

  return (
    <div className="page">
      <div className="page-title">
        <span className="title-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
          </svg>
        </span>
        <h1>Categorias</h1>
      </div>
      <p className="subtitle">
        Cada categoria define os campos dos seus produtos e monta o formulário
        automaticamente.
      </p>

      {erro && categorias.length > 0 && <div className="alert erro">{erro}</div>}

      <form className="card form" onSubmit={salvar}>
        <h2>{editandoId === null ? "Nova categoria" : "Editar categoria"}</h2>

        <div className="grid-2">
          <label>
            Nome
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Roupas"
              required
            />
          </label>
          <label>
            Descrição
            <input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Opcional"
            />
          </label>
        </div>

        <div className="campos-header">
          <h3>Campos da categoria</h3>
          <button
            type="button"
            className="btn secundario"
            onClick={() => setCampos((a) => [...a, campoVazio()])}
          >
            + Adicionar campo
          </button>
        </div>

        {campos.length === 0 && (
          <p className="vazio">
            Nenhum campo. Produtos desta categoria terão apenas os dados padrão (nome, preços,
            estoque).
          </p>
        )}

        {campos.map((campo, i) => (
          <div className="campo-row" key={i}>
            <label>
              Chave
              <input
                value={campo.chave}
                onChange={(e) => atualizarCampo(i, { chave: e.target.value })}
                placeholder="tamanho"
                required
              />
            </label>
            <label>
              Rótulo
              <input
                value={campo.rotulo}
                onChange={(e) => atualizarCampo(i, { rotulo: e.target.value })}
                placeholder="Tamanho"
                required
              />
            </label>
            <label>
              Tipo
              <select
                value={campo.tipo}
                onChange={(e) => atualizarCampo(i, { tipo: e.target.value as TipoCampo })}
              >
                {TIPOS.map((t) => (
                  <option key={t.valor} value={t.valor}>
                    {t.rotulo}
                  </option>
                ))}
              </select>
            </label>
            {campo.tipo === "lista" && (
              <label>
                Opções (separadas por vírgula)
                <input
                  value={(campo.opcoes ?? []).join(", ")}
                  onChange={(e) =>
                    atualizarCampo(i, {
                      opcoes: e.target.value.split(",").map((s) => s.trim()),
                    })
                  }
                  placeholder="P, M, G, GG"
                />
              </label>
            )}
            <label className="check">
              <input
                type="checkbox"
                checked={campo.obrigatorio}
                onChange={(e) => atualizarCampo(i, { obrigatorio: e.target.checked })}
              />
              Obrigatório
            </label>
            <button
              type="button"
              className="btn perigo pequeno"
              onClick={() => setCampos((a) => a.filter((_, idx) => idx !== i))}
            >
              Remover
            </button>
          </div>
        ))}

        <div className="form-acoes">
          <button className="btn primario" type="submit" disabled={salvando}>
            {salvando ? "Salvando..." : editandoId === null ? "Criar categoria" : "Salvar"}
          </button>
          {editandoId !== null && (
            <button type="button" className="btn secundario" onClick={limparFormulario}>
              Cancelar
            </button>
          )}
        </div>
      </form>

      <div className="card">
        <h2>Categorias cadastradas</h2>
        {carregando ? (
          <SkeletonTabela />
        ) : erro && categorias.length === 0 ? (
          <EstadoErro mensagem={erro} onTentarNovamente={carregar} />
        ) : categorias.length === 0 ? (
          <EstadoVazio
            titulo="Nenhuma categoria ainda"
            descricao="As categorias definem os campos dos seus produtos. Crie a primeira no formulário acima para depois cadastrar produtos."
          />
        ) : (
          <table className="tabela">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Campos</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {categoriasVisiveis.map((cat) => (
                <tr key={cat.id}>
                  <td>
                    <strong>{cat.nome}</strong>
                    {cat.descricao && <div className="muted">{cat.descricao}</div>}
                  </td>
                  <td>
                    {cat.campos_schema.length === 0 ? (
                      <span className="muted">—</span>
                    ) : (
                      <div className="chips">
                        {cat.campos_schema.map((c) => (
                          <span className="chip" key={c.chave}>
                            {c.rotulo}
                            {c.obrigatorio ? " *" : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="acoes">
                    <button className="btn secundario pequeno" onClick={() => editar(cat)}>
                      Editar
                    </button>
                    <button className="btn perigo pequeno" onClick={() => excluir(cat)}>
                      Excluir
                    </button>
                  </td>
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
