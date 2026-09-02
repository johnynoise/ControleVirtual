import { useEffect, useState } from "react";
import type { Cliente, ClienteCreate } from "../types";
import {
  atualizarCliente,
  criarCliente,
  listarClientes,
  removerCliente,
} from "../services/clientes";

function extrairErro(err: unknown): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data
    ?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    return detail.map((d: { msg?: string }) => d.msg ?? "").join("; ");
  }
  return "Não foi possível concluir a operação.";
}

function formVazio(): ClienteCreate {
  return { nome: "", telefone: "", email: "", ativo: true };
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [form, setForm] = useState<ClienteCreate>(formVazio());
  const [salvando, setSalvando] = useState(false);

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

  function limpar() {
    setEditandoId(null);
    setForm(formVazio());
  }

  function editar(c: Cliente) {
    setEditandoId(c.id);
    setForm({
      nome: c.nome,
      telefone: c.telefone ?? "",
      email: c.email ?? "",
      ativo: c.ativo,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
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
      if (editandoId === null) {
        await criarCliente(payload);
      } else {
        await atualizarCliente(editandoId, payload);
      }
      limpar();
      await carregar();
    } catch (err) {
      setErro(extrairErro(err));
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(c: Cliente) {
    if (!confirm(`Remover o cliente "${c.nome}"?`)) return;
    setErro(null);
    try {
      await removerCliente(c.id);
      if (editandoId === c.id) limpar();
      await carregar();
    } catch (err) {
      setErro(extrairErro(err));
    }
  }

  return (
    <div className="page">
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
      <p className="subtitle">
        Cadastro simples de clientes. Eles podem ser vinculados às vendas.
      </p>

      {erro && <div className="alert erro">{erro}</div>}

      <form className="card form" onSubmit={salvar}>
        <h2>{editandoId === null ? "Novo cliente" : "Editar cliente"}</h2>

        <div className="grid-4">
          <label style={{ gridColumn: "span 2" }}>
            Nome
            <input
              value={form.nome}
              onChange={(e) => setCampo("nome", e.target.value)}
              placeholder="Ex.: Maria Silva"
              required
            />
          </label>
          <label>
            Telefone
            <input
              value={form.telefone ?? ""}
              onChange={(e) => setCampo("telefone", e.target.value)}
              placeholder="Opcional"
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
            {salvando ? "Salvando..." : editandoId === null ? "Criar cliente" : "Salvar"}
          </button>
          {editandoId !== null && (
            <button type="button" className="btn secundario" onClick={limpar}>
              Cancelar
            </button>
          )}
        </div>
      </form>

      <div className="card">
        <h2>Clientes cadastrados</h2>
        {carregando ? (
          <p className="vazio">Carregando...</p>
        ) : clientes.length === 0 ? (
          <p className="vazio">Nenhum cliente ainda.</p>
        ) : (
          <table className="tabela">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Telefone</th>
                <th>E-mail</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id} className={c.ativo ? "" : "inativo"}>
                  <td>
                    <strong>{c.nome}</strong>
                  </td>
                  <td>{c.telefone ?? <span className="muted">—</span>}</td>
                  <td>{c.email ?? <span className="muted">—</span>}</td>
                  <td className="acoes">
                    <button className="btn secundario pequeno" onClick={() => editar(c)}>
                      Editar
                    </button>
                    <button className="btn perigo pequeno" onClick={() => excluir(c)}>
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
