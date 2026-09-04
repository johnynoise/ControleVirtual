import { useEffect, useMemo, useState } from "react";
import type { Fornecedor, FornecedorCreate } from "../types";
import {
  atualizarFornecedor,
  criarFornecedor,
  listarFornecedores,
  removerFornecedor,
} from "../services/fornecedores";
import { corAvatar, extrairErro, formatarTelefone, iniciais, linkWhatsapp, WHATSAPP_PATH } from "../lib/ui";
import Paginacao from "../components/Paginacao";
import EstadoVazio from "../components/EstadoVazio";
import EstadoErro from "../components/EstadoErro";
import ThOrdenavel from "../components/ThOrdenavel";
import { ordenar, proximaOrdenacao, type EstadoOrdenacao } from "../lib/ordenacao";
import { SkeletonTabela } from "../components/Skeleton";
import { useConfirm, useToast } from "../components/Feedback";

const POR_PAGINA = 10;

type CampoFornecedor = "nome" | "cidade" | "status";

function formVazio(): FornecedorCreate {
  return {
    nome: "",
    nome_fantasia: "",
    documento: "",
    email: "",
    telefone: "",
    contato: "",
    endereco: "",
    cidade: "",
    estado: "",
    observacao: "",
    ativo: true,
  };
}

type FiltroStatus = "todos" | "ativos" | "inativos";

export default function FornecedoresPage() {
  const toast = useToast();
  const confirmar = useConfirm();
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [form, setForm] = useState<FornecedorCreate>(formVazio());
  const [salvando, setSalvando] = useState(false);

  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroStatus>("todos");
  const [pagina, setPagina] = useState(1);
  const [ord, setOrd] = useState<EstadoOrdenacao<CampoFornecedor>>({
    campo: "nome",
    direcao: "asc",
  });
  const ordenarPor = (campo: CampoFornecedor) =>
    setOrd((o) => proximaOrdenacao(o, campo));

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      setFornecedores(await listarFornecedores());
    } catch (err) {
      setErro(extrairErro(err));
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  const fornecedoresFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return fornecedores.filter((f) => {
      if (filtro === "ativos" && !f.ativo) return false;
      if (filtro === "inativos" && f.ativo) return false;
      if (!termo) return true;
      return [
        f.nome,
        f.nome_fantasia,
        f.documento,
        f.email,
        f.telefone,
        f.contato,
        f.cidade,
      ]
        .filter(Boolean)
        .some((campo) => (campo as string).toLowerCase().includes(termo));
    });
  }, [fornecedores, busca, filtro]);

  const fornecedoresOrdenados = useMemo(
    () =>
      ordenar(fornecedoresFiltrados, ord, (f, campo) => {
        if (campo === "cidade") return f.cidade ?? "";
        if (campo === "status") return f.ativo ? 1 : 0;
        return f.nome;
      }),
    [fornecedoresFiltrados, ord]
  );

  const totalPaginas = Math.max(
    1,
    Math.ceil(fornecedoresOrdenados.length / POR_PAGINA)
  );
  const paginaAtual = Math.min(pagina, totalPaginas);
  const fornecedoresVisiveis = fornecedoresOrdenados.slice(
    (paginaAtual - 1) * POR_PAGINA,
    paginaAtual * POR_PAGINA
  );

  // Ao mudar filtro/busca, volta para a primeira página.
  useEffect(() => {
    setPagina(1);
  }, [busca, filtro]);

  function abrirNovo() {
    setEditandoId(null);
    setForm(formVazio());
    setErro(null);
    setModalAberto(true);
  }

  function abrirEditar(f: Fornecedor) {
    setEditandoId(f.id);
    setForm({
      nome: f.nome,
      nome_fantasia: f.nome_fantasia ?? "",
      documento: f.documento ?? "",
      email: f.email ?? "",
      telefone: f.telefone ?? "",
      contato: f.contato ?? "",
      endereco: f.endereco ?? "",
      cidade: f.cidade ?? "",
      estado: f.estado ?? "",
      observacao: f.observacao ?? "",
      ativo: f.ativo,
    });
    setErro(null);
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setEditandoId(null);
    setForm(formVazio());
  }

  function setCampo<K extends keyof FornecedorCreate>(chave: K, valor: FornecedorCreate[K]) {
    setForm((f) => ({ ...f, [chave]: valor }));
  }

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault();
    setSalvando(true);
    setErro(null);

    const payload: FornecedorCreate = {
      ...form,
      nome: form.nome.trim(),
      nome_fantasia: form.nome_fantasia?.trim() || null,
      documento: form.documento?.trim() || null,
      email: form.email?.trim() || null,
      telefone: form.telefone?.trim() || null,
      contato: form.contato?.trim() || null,
      endereco: form.endereco?.trim() || null,
      cidade: form.cidade?.trim() || null,
      estado: form.estado?.trim().toUpperCase() || null,
      observacao: form.observacao?.trim() || null,
    };

    try {
      const edicao = editandoId !== null;
      if (editandoId === null) {
        await criarFornecedor(payload);
      } else {
        await atualizarFornecedor(editandoId, payload);
      }
      fecharModal();
      await carregar();
      toast.sucesso(edicao ? "Fornecedor salvo." : "Fornecedor criado.");
    } catch (err) {
      setErro(extrairErro(err));
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(f: Fornecedor) {
    const ok = await confirmar({
      titulo: "Remover fornecedor",
      mensagem: `Tem certeza que deseja remover "${f.nome}"?`,
      confirmar: "Remover",
      perigo: true,
    });
    if (!ok) return;
    setErro(null);
    try {
      await removerFornecedor(f.id);
      await carregar();
      toast.sucesso("Fornecedor removido.");
    } catch (err) {
      const msg = extrairErro(err);
      setErro(msg);
      toast.erro(msg);
    }
  }

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
              <path d="M3 9l1.5-4.5A1.5 1.5 0 0 1 6 3.5h12a1.5 1.5 0 0 1 1.5 1L21 9" />
              <path d="M3 9h18v3a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z" />
              <path d="M4 12v8h16v-8" />
            </svg>
          </span>
          <h1>Fornecedores</h1>
        </div>
        <button className="btn primario" onClick={abrirNovo}>
          + Novo fornecedor
        </button>
      </div>

      {erro && !modalAberto && fornecedores.length > 0 && (
        <div className="alert erro">{erro}</div>
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
            placeholder="Buscar por nome, documento, cidade, contato..."
          />
        </div>
        <div className="periodo-tabs">
          {filtros.map((f) => (
            <button
              key={f.valor}
              className={`btn ${filtro === f.valor ? "primario" : "secundario"} pequeno`}
              onClick={() => setFiltro(f.valor)}
            >
              {f.rotulo}
            </button>
          ))}
        </div>
        <span className="contagem">
          {fornecedoresFiltrados.length}{" "}
          {fornecedoresFiltrados.length === 1 ? "fornecedor" : "fornecedores"}
        </span>
      </div>

      <div className="card">
        {carregando ? (
          <SkeletonTabela />
        ) : erro && fornecedores.length === 0 ? (
          <EstadoErro mensagem={erro} onTentarNovamente={carregar} />
        ) : fornecedores.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum fornecedor cadastrado"
            descricao="Cadastre seus fornecedores para registrar entradas de estoque e acompanhar as compras."
            acao={{ rotulo: "Cadastrar primeiro fornecedor", onClick: abrirNovo }}
          />
        ) : fornecedoresFiltrados.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum fornecedor encontrado"
            descricao="Tente outro termo de busca ou ajuste o filtro de status."
          />
        ) : (
          <table className="tabela">
            <thead>
              <tr>
                <ThOrdenavel campo="nome" estado={ord} onOrdenar={ordenarPor}>
                  Fornecedor
                </ThOrdenavel>
                <th>Documento</th>
                <th>Contato</th>
                <ThOrdenavel campo="cidade" estado={ord} onOrdenar={ordenarPor}>
                  Cidade/UF
                </ThOrdenavel>
                <ThOrdenavel campo="status" estado={ord} onOrdenar={ordenarPor}>
                  Status
                </ThOrdenavel>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {fornecedoresVisiveis.map((f) => {
                const wpp = linkWhatsapp(f.telefone);
                return (
                  <tr key={f.id} className={f.ativo ? "" : "inativo"}>
                    <td>
                      <div className="cliente-cell">
                        <span className="avatar" style={{ background: corAvatar(f.nome) }}>
                          {iniciais(f.nome_fantasia || f.nome)}
                        </span>
                        <div className="contato-linha">
                          <strong>{f.nome}</strong>
                          {f.nome_fantasia && (
                            <span className="muted">{f.nome_fantasia}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>{f.documento ?? <span className="muted">—</span>}</td>
                    <td>
                      {f.telefone || f.email ? (
                        <div className="contato-linha">
                          {f.telefone && <span>{f.telefone}</span>}
                          {f.email && <span className="muted">{f.email}</span>}
                        </div>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      {f.cidade || f.estado ? (
                        `${f.cidade ?? ""}${f.cidade && f.estado ? " / " : ""}${f.estado ?? ""}`
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <span className={`chip ${f.ativo ? "status-ativo" : "status-inativo"}`}>
                        {f.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="acoes">
                      {wpp && (
                        <a
                          className="icone-acao"
                          href={wpp}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Chamar no WhatsApp"
                        >
                          <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d={WHATSAPP_PATH} />
                          </svg>
                        </a>
                      )}
                      <button className="btn secundario pequeno" onClick={() => abrirEditar(f)}>
                        Editar
                      </button>
                      <button className="btn perigo pequeno" onClick={() => excluir(f)}>
                        Excluir
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {!carregando && fornecedoresFiltrados.length > 0 && (
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
            className="modal-box form"
            onClick={(e) => e.stopPropagation()}
            onSubmit={salvar}
          >
            <h2>{editandoId === null ? "Novo fornecedor" : "Editar fornecedor"}</h2>

            {erro && <div className="alert erro">{erro}</div>}

            <label style={{ marginBottom: "1rem" }}>
              Nome / Razão social
              <input
                value={form.nome}
                onChange={(e) => setCampo("nome", e.target.value)}
                placeholder="Ex.: Distribuidora ABC Ltda"
                required
                autoFocus
              />
            </label>

            <div className="grid-2">
              <label>
                Telefone
                <input
                  type="tel"
                  inputMode="tel"
                  value={form.telefone ?? ""}
                  onChange={(e) => setCampo("telefone", formatarTelefone(e.target.value))}
                  placeholder="(11) 90000-0000"
                />
              </label>
              <label>
                E-mail
                <input
                  type="email"
                  value={form.email ?? ""}
                  onChange={(e) => setCampo("email", e.target.value)}
                  placeholder="Opcional"
                />
              </label>
            </div>

            <label className="check">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(e) => setCampo("ativo", e.target.checked)}
              />
              Fornecedor ativo
            </label>

            <div className="form-acoes">
              <button className="btn primario" type="submit" disabled={salvando}>
                {salvando
                  ? "Salvando..."
                  : editandoId === null
                    ? "Criar fornecedor"
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
