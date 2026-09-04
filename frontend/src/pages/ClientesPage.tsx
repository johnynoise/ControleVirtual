import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Cliente, ClienteCreate } from "../types";
import {
  atualizarCliente,
  criarCliente,
  listarClientes,
  removerCliente,
} from "../services/clientes";
import { corAvatar, extrairErro, formatarTelefone, iniciais, linkWhatsapp, WHATSAPP_PATH } from "../lib/ui";
import Paginacao from "../components/Paginacao";
import EstadoVazio from "../components/EstadoVazio";
import EstadoErro from "../components/EstadoErro";
import ThOrdenavel from "../components/ThOrdenavel";
import { ordenar, proximaOrdenacao, type EstadoOrdenacao } from "../lib/ordenacao";
import { SkeletonTabela } from "../components/Skeleton";
import { useConfirm, useToast } from "../components/Feedback";

const POR_PAGINA = 10;

function formVazio(): ClienteCreate {
  return { nome: "", telefone: "", email: "", ativo: true };
}

type FiltroStatus = "todos" | "ativos" | "inativos";
type CampoCliente = "nome" | "status";

export default function ClientesPage() {
  const toast = useToast();
  const confirmar = useConfirm();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Modal de cadastro/edição.
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [form, setForm] = useState<ClienteCreate>(formVazio());
  const [salvando, setSalvando] = useState(false);

  // Busca e filtro.
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroStatus>("todos");
  const [pagina, setPagina] = useState(1);
  const [ord, setOrd] = useState<EstadoOrdenacao<CampoCliente>>({
    campo: "nome",
    direcao: "asc",
  });
  const ordenarPor = (campo: CampoCliente) =>
    setOrd((o) => proximaOrdenacao(o, campo));

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      setClientes(await listarClientes());
    } catch (err) {
      setErro(extrairErro(err));
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  const clientesFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return clientes.filter((c) => {
      if (filtro === "ativos" && !c.ativo) return false;
      if (filtro === "inativos" && c.ativo) return false;
      if (!termo) return true;
      return (
        c.nome.toLowerCase().includes(termo) ||
        (c.telefone ?? "").toLowerCase().includes(termo) ||
        (c.email ?? "").toLowerCase().includes(termo)
      );
    });
  }, [clientes, busca, filtro]);

  const clientesOrdenados = useMemo(
    () =>
      ordenar(clientesFiltrados, ord, (c, campo) =>
        campo === "status" ? (c.ativo ? 1 : 0) : c.nome
      ),
    [clientesFiltrados, ord]
  );

  const totalPaginas = Math.max(
    1,
    Math.ceil(clientesOrdenados.length / POR_PAGINA)
  );
  const paginaAtual = Math.min(pagina, totalPaginas);
  const clientesVisiveis = clientesOrdenados.slice(
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

  function abrirEditar(c: Cliente) {
    setEditandoId(c.id);
    setForm({
      nome: c.nome,
      telefone: c.telefone ?? "",
      email: c.email ?? "",
      ativo: c.ativo,
    });
    setErro(null);
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setEditandoId(null);
    setForm(formVazio());
  }

  function setCampo<K extends keyof ClienteCreate>(chave: K, valor: ClienteCreate[K]) {
    setForm((f) => ({ ...f, [chave]: valor }));
  }

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault();
    setSalvando(true);
    setErro(null);

    const payload: ClienteCreate = {
      nome: form.nome.trim(),
      telefone: form.telefone?.trim() || null,
      email: form.email?.trim() || null,
      ativo: form.ativo,
    };

    try {
      const edicao = editandoId !== null;
      if (editandoId === null) {
        await criarCliente(payload);
      } else {
        await atualizarCliente(editandoId, payload);
      }
      fecharModal();
      await carregar();
      toast.sucesso(edicao ? "Cliente salvo." : "Cliente criado.");
    } catch (err) {
      setErro(extrairErro(err));
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(c: Cliente) {
    const ok = await confirmar({
      titulo: "Remover cliente",
      mensagem: `Tem certeza que deseja remover "${c.nome}"?`,
      confirmar: "Remover",
      perigo: true,
    });
    if (!ok) return;
    setErro(null);
    try {
      await removerCliente(c.id);
      await carregar();
      toast.sucesso("Cliente removido.");
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
              <circle cx="9" cy="8" r="3.5" />
              <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
              <path d="M16 4.5a3.5 3.5 0 0 1 0 7" />
              <path d="M17.5 13.5a6.5 6.5 0 0 1 4 6.5" />
            </svg>
          </span>
          <h1>Clientes</h1>
        </div>
        <button className="btn primario" onClick={abrirNovo}>
          + Novo cliente
        </button>
      </div>

      {erro && !modalAberto && clientes.length > 0 && (
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
            placeholder="Buscar por nome, telefone ou e-mail..."
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
          {clientesFiltrados.length}{" "}
          {clientesFiltrados.length === 1 ? "cliente" : "clientes"}
        </span>
      </div>

      <div className="card">
        {carregando ? (
          <SkeletonTabela />
        ) : erro && clientes.length === 0 ? (
          <EstadoErro mensagem={erro} onTentarNovamente={carregar} />
        ) : clientes.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum cliente cadastrado"
            descricao="Cadastre seus clientes para acompanhar compras, vender no fiado e enviar recibos."
            acao={{ rotulo: "Cadastrar primeiro cliente", onClick: abrirNovo }}
          />
        ) : clientesFiltrados.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum cliente encontrado"
            descricao="Tente outro termo de busca ou ajuste o filtro de status."
          />
        ) : (
          <table className="tabela">
            <thead>
              <tr>
                <ThOrdenavel campo="nome" estado={ord} onOrdenar={ordenarPor}>
                  Cliente
                </ThOrdenavel>
                <th>Contato</th>
                <ThOrdenavel campo="status" estado={ord} onOrdenar={ordenarPor}>
                  Status
                </ThOrdenavel>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clientesVisiveis.map((c) => {
                const wpp = linkWhatsapp(c.telefone);
                return (
                  <tr key={c.id} className={c.ativo ? "" : "inativo"}>
                    <td>
                      <div className="cliente-cell">
                        <span
                          className="avatar"
                          style={{ background: corAvatar(c.nome) }}
                        >
                          {iniciais(c.nome)}
                        </span>
                        <Link to={`/clientes/${c.id}`} className="link-forte">
                          {c.nome}
                        </Link>
                      </div>
                    </td>
                    <td>
                      <div className="contato-linha">
                        <span>
                          {c.telefone ?? <span className="muted">Sem telefone</span>}
                        </span>
                        {c.email && <span className="muted">{c.email}</span>}
                      </div>
                    </td>
                    <td>
                      <span className={`chip ${c.ativo ? "status-ativo" : "status-inativo"}`}>
                        {c.ativo ? "Ativo" : "Inativo"}
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
                      <Link className="btn primario pequeno" to={`/clientes/${c.id}`}>
                        Ficha
                      </Link>
                      <button className="btn secundario pequeno" onClick={() => abrirEditar(c)}>
                        Editar
                      </button>
                      <button className="btn perigo pequeno" onClick={() => excluir(c)}>
                        Excluir
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {!carregando && clientesFiltrados.length > 0 && (
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
            <h2>{editandoId === null ? "Novo cliente" : "Editar cliente"}</h2>

            {erro && <div className="alert erro">{erro}</div>}

            <label style={{ marginBottom: "1rem" }}>
              Nome
              <input
                value={form.nome}
                onChange={(e) => setCampo("nome", e.target.value)}
                placeholder="Ex.: Maria Silva"
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
              Cliente ativo
            </label>

            <div className="form-acoes">
              <button className="btn primario" type="submit" disabled={salvando}>
                {salvando
                  ? "Salvando..."
                  : editandoId === null
                    ? "Criar cliente"
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
