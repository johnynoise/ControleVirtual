import { useEffect, useState } from "react";
import type { Fornecedor, FornecedorCreate } from "../types";
import {
  atualizarFornecedor,
  criarFornecedor,
  listarFornecedores,
  removerFornecedor,
} from "../services/fornecedores";

function extrairErro(err: unknown): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data
    ?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    return detail.map((d: { msg?: string }) => d.msg ?? "").join("; ");
  }
  return "Não foi possível concluir a operação.";
}

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

export default function FornecedoresPage() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [form, setForm] = useState<FornecedorCreate>(formVazio());
  const [salvando, setSalvando] = useState(false);

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

  function limpar() {
    setEditandoId(null);
    setForm(formVazio());
  }

  function editar(f: Fornecedor) {
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
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setCampo<K extends keyof FornecedorCreate>(chave: K, valor: FornecedorCreate[K]) {
    setForm((f) => ({ ...f, [chave]: valor }));
  }

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault();
    setSalvando(true);
    setErro(null);

    // Normaliza strings vazias para null.
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
      if (editandoId === null) {
        await criarFornecedor(payload);
      } else {
        await atualizarFornecedor(editandoId, payload);
      }
      limpar();
      await carregar();
    } catch (err) {
      setErro(extrairErro(err));
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(f: Fornecedor) {
    if (!confirm(`Remover o fornecedor "${f.nome}"?`)) return;
    setErro(null);
    try {
      await removerFornecedor(f.id);
      if (editandoId === f.id) limpar();
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
            <path d="M3 9l1.5-4.5A1.5 1.5 0 0 1 6 3.5h12a1.5 1.5 0 0 1 1.5 1L21 9" />
            <path d="M3 9h18v3a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z" />
            <path d="M4 12v8h16v-8" />
          </svg>
        </span>
        <h1>Fornecedores</h1>
      </div>
      <p className="subtitle">
        Quem fornece seus produtos. Você pode vinculá-los às entradas de compra no estoque.
      </p>

      {erro && <div className="alert erro">{erro}</div>}

      <form className="card form" onSubmit={salvar}>
        <h2>{editandoId === null ? "Novo fornecedor" : "Editar fornecedor"}</h2>

        <div className="grid-2">
          <label>
            Nome / Razão social
            <input
              value={form.nome}
              onChange={(e) => setCampo("nome", e.target.value)}
              placeholder="Ex.: Distribuidora ABC Ltda"
              required
            />
          </label>
          <label>
            Nome fantasia
            <input
              value={form.nome_fantasia ?? ""}
              onChange={(e) => setCampo("nome_fantasia", e.target.value)}
              placeholder="Opcional"
            />
          </label>
        </div>

        <div className="grid-4">
          <label>
            CNPJ / CPF
            <input
              value={form.documento ?? ""}
              onChange={(e) => setCampo("documento", e.target.value)}
              placeholder="Opcional"
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
          <label>
            Contato
            <input
              value={form.contato ?? ""}
              onChange={(e) => setCampo("contato", e.target.value)}
              placeholder="Nome do responsável"
            />
          </label>
        </div>

        <div className="grid-4">
          <label style={{ gridColumn: "span 2" }}>
            Endereço
            <input
              value={form.endereco ?? ""}
              onChange={(e) => setCampo("endereco", e.target.value)}
              placeholder="Opcional"
            />
          </label>
          <label>
            Cidade
            <input
              value={form.cidade ?? ""}
              onChange={(e) => setCampo("cidade", e.target.value)}
              placeholder="Opcional"
            />
          </label>
          <label>
            UF
            <input
              value={form.estado ?? ""}
              onChange={(e) => setCampo("estado", e.target.value)}
              maxLength={2}
              placeholder="SP"
            />
          </label>
        </div>

        <label>
          Observação
          <input
            value={form.observacao ?? ""}
            onChange={(e) => setCampo("observacao", e.target.value)}
            placeholder="Opcional"
          />
        </label>

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
            {salvando ? "Salvando..." : editandoId === null ? "Criar fornecedor" : "Salvar"}
          </button>
          {editandoId !== null && (
            <button type="button" className="btn secundario" onClick={limpar}>
              Cancelar
            </button>
          )}
        </div>
      </form>

      <div className="card">
        <h2>Fornecedores cadastrados</h2>
        {carregando ? (
          <p className="vazio">Carregando...</p>
        ) : fornecedores.length === 0 ? (
          <p className="vazio">Nenhum fornecedor ainda.</p>
        ) : (
          <table className="tabela">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Documento</th>
                <th>Contato</th>
                <th>Cidade/UF</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {fornecedores.map((f) => (
                <tr key={f.id} className={f.ativo ? "" : "inativo"}>
                  <td>
                    <strong>{f.nome}</strong>
                    {f.nome_fantasia && <div className="muted">{f.nome_fantasia}</div>}
                  </td>
                  <td>{f.documento ?? <span className="muted">—</span>}</td>
                  <td>
                    {f.telefone || f.email ? (
                      <>
                        {f.telefone && <div>{f.telefone}</div>}
                        {f.email && <div className="muted">{f.email}</div>}
                      </>
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
                  <td className="acoes">
                    <button className="btn secundario pequeno" onClick={() => editar(f)}>
                      Editar
                    </button>
                    <button className="btn perigo pequeno" onClick={() => excluir(f)}>
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
