import { useMemo, useState, useEffect } from "react";
import type {
  Cliente,
  FormaPagamento,
  ItemVendaCreate,
  Produto,
  Venda,
  VendaCreate,
} from "../types";
import { listarProdutos } from "../services/produtos";
import { criarCliente, listarClientes } from "../services/clientes";
import { criarVenda, listarVendas } from "../services/vendas";
import Recibo from "../components/Recibo";

const PAGAMENTOS: { valor: FormaPagamento; rotulo: string }[] = [
  { valor: "dinheiro", rotulo: "Dinheiro" },
  { valor: "pix", rotulo: "PIX" },
  { valor: "cartao_credito", rotulo: "Cartão crédito" },
  { valor: "cartao_debito", rotulo: "Cartão débito" },
  { valor: "outro", rotulo: "Outro" },
];

interface ItemCarrinho {
  produto_id: number;
  produto_nome: string;
  quantidade: number;
  preco_unitario: number;
}

function extrairErro(err: unknown): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data
    ?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    return detail.map((d: { msg?: string }) => d.msg ?? "").join("; ");
  }
  return "Não foi possível concluir a operação.";
}

function brl(valor: number | string): string {
  const n = typeof valor === "string" ? parseFloat(valor) : valor;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function VendasPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Item em edição antes de adicionar ao carrinho.
  const [produtoId, setProdutoId] = useState<number | "">("");
  const [quantidade, setQuantidade] = useState("1");
  const [preco, setPreco] = useState("");

  // Carrinho e dados da venda.
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [clienteId, setClienteId] = useState<number | "">("");
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>("dinheiro");
  const [desconto, setDesconto] = useState("0");

  // Cadastro rápido de cliente direto na tela de venda.
  const [novoCliente, setNovoCliente] = useState(false);
  const [ncNome, setNcNome] = useState("");
  const [ncTelefone, setNcTelefone] = useState("");
  const [ncEmail, setNcEmail] = useState("");
  const [salvandoCliente, setSalvandoCliente] = useState(false);

  // Venda exibida no recibo (após finalizar ou ao reimprimir do histórico).
  const [vendaRecibo, setVendaRecibo] = useState<Venda | null>(null);

  const produtoSelecionado = produtos.find((p) => p.id === produtoId) ?? null;

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const [prods, vnds, clis] = await Promise.all([
        listarProdutos(),
        listarVendas(),
        listarClientes({ apenas_ativos: true }),
      ]);
      setProdutos(prods);
      setVendas(vnds);
      setClientes(clis);
    } catch (err) {
      setErro(extrairErro(err));
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  // Ao escolher o produto, pré-preenche o preço com o preço de venda dele.
  function escolherProduto(id: number | "") {
    setProdutoId(id);
    const p = produtos.find((x) => x.id === id);
    setPreco(p ? p.preco_venda : "");
  }

  const totalBruto = useMemo(
    () => carrinho.reduce((acc, i) => acc + i.preco_unitario * i.quantidade, 0),
    [carrinho]
  );
  const descontoNum = parseFloat(desconto) || 0;
  const totalLiquido = Math.max(0, totalBruto - descontoNum);

  function adicionarAoCarrinho() {
    if (produtoId === "") {
      setErro("Selecione um produto para adicionar.");
      return;
    }
    const qtd = parseInt(quantidade, 10) || 0;
    if (qtd <= 0) {
      setErro("A quantidade deve ser maior que zero.");
      return;
    }
    const p = produtos.find((x) => x.id === produtoId);
    if (!p) return;
    setErro(null);

    setCarrinho((atual) => {
      // Se o produto já está no carrinho, soma a quantidade.
      const existe = atual.find((i) => i.produto_id === produtoId);
      if (existe) {
        return atual.map((i) =>
          i.produto_id === produtoId ? { ...i, quantidade: i.quantidade + qtd } : i
        );
      }
      return [
        ...atual,
        {
          produto_id: p.id,
          produto_nome: p.nome,
          quantidade: qtd,
          preco_unitario: parseFloat(preco) || parseFloat(p.preco_venda) || 0,
        },
      ];
    });

    setProdutoId("");
    setQuantidade("1");
    setPreco("");
  }

  function removerDoCarrinho(produto_id: number) {
    setCarrinho((atual) => atual.filter((i) => i.produto_id !== produto_id));
  }

  function cancelarNovoCliente() {
    setNovoCliente(false);
    setNcNome("");
    setNcTelefone("");
    setNcEmail("");
  }

  async function salvarNovoCliente() {
    if (ncNome.trim() === "") {
      setErro("Informe o nome do cliente.");
      return;
    }
    setSalvandoCliente(true);
    setErro(null);
    try {
      const criado = await criarCliente({
        nome: ncNome.trim(),
        telefone: ncTelefone.trim() || null,
        email: ncEmail.trim() || null,
        ativo: true,
      });
      // Atualiza a lista e já seleciona o cliente recém-criado.
      setClientes(await listarClientes({ apenas_ativos: true }));
      setClienteId(criado.id);
      cancelarNovoCliente();
    } catch (err) {
      setErro(extrairErro(err));
    } finally {
      setSalvandoCliente(false);
    }
  }

  function limparVenda() {
    setCarrinho([]);
    setClienteId("");
    cancelarNovoCliente();
    setFormaPagamento("dinheiro");
    setDesconto("0");
    setProdutoId("");
    setQuantidade("1");
    setPreco("");
  }

  async function finalizar() {
    if (carrinho.length === 0) {
      setErro("Adicione pelo menos um item à venda.");
      return;
    }
    setSalvando(true);
    setErro(null);

    const itens: ItemVendaCreate[] = carrinho.map((i) => ({
      produto_id: i.produto_id,
      quantidade: i.quantidade,
      preco_unitario: i.preco_unitario,
    }));

    const payload: VendaCreate = {
      cliente_id: clienteId === "" ? null : clienteId,
      forma_pagamento: formaPagamento,
      desconto: descontoNum,
      itens,
    };

    try {
      const venda = await criarVenda(payload);
      limparVenda();
      await carregar();
      // Abre o recibo da venda recém-finalizada.
      setVendaRecibo(venda);
    } catch (err) {
      setErro(extrairErro(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="page">
      <div className="page-title">
        <span className="title-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="20" r="1.5" />
            <circle cx="18" cy="20" r="1.5" />
            <path d="M2 3h3l2.4 12.2a1.5 1.5 0 0 0 1.5 1.2h8.2a1.5 1.5 0 0 0 1.5-1.2L22 7H6" />
          </svg>
        </span>
        <h1>Nova venda</h1>
      </div>
      <p className="subtitle">
        Escolha os produtos, veja o total e finalize. O estoque é atualizado sozinho.
      </p>

      {erro && <div className="alert erro">{erro}</div>}

      {produtos.length === 0 && !carregando && (
        <div className="alert aviso">
          Nenhum produto cadastrado. Cadastre produtos antes de vender.
        </div>
      )}

      <div className="card form">
        <h2>1. Adicione os produtos</h2>

        <div className="grid-4">
          <label style={{ gridColumn: "span 2" }}>
            Produto
            <select
              value={produtoId}
              onChange={(e) =>
                escolherProduto(e.target.value === "" ? "" : Number(e.target.value))
              }
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
            Quantidade
            <input
              type="number"
              min="1"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
            />
          </label>
          <label>
            Preço unitário
            <input
              type="number"
              step="0.01"
              min="0"
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
              placeholder={produtoSelecionado?.preco_venda ?? "0,00"}
            />
          </label>
        </div>

        <div className="form-acoes">
          <button type="button" className="btn primario" onClick={adicionarAoCarrinho}>
            + Adicionar ao carrinho
          </button>
        </div>

        {carrinho.length > 0 && (
          <table className="tabela">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Qtd.</th>
                <th>Preço un.</th>
                <th>Subtotal</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {carrinho.map((i) => (
                <tr key={i.produto_id}>
                  <td>{i.produto_nome}</td>
                  <td>{i.quantidade}</td>
                  <td>{brl(i.preco_unitario)}</td>
                  <td>{brl(i.preco_unitario * i.quantidade)}</td>
                  <td className="acoes">
                    <button
                      className="btn perigo pequeno"
                      onClick={() => removerDoCarrinho(i.produto_id)}
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h3>2. Cliente e pagamento (opcional)</h3>
        <div className="grid-4">
          <label style={{ gridColumn: "span 2" }}>
            Cliente
            <div className="linha-inline">
              <select
                value={clienteId}
                onChange={(e) =>
                  setClienteId(e.target.value === "" ? "" : Number(e.target.value))
                }
                disabled={novoCliente}
              >
                <option value="">Sem cliente</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
              {!novoCliente && (
                <button
                  type="button"
                  className="btn secundario pequeno"
                  onClick={() => setNovoCliente(true)}
                >
                  + Novo
                </button>
              )}
            </div>
          </label>
          <label>
            Pagamento
            <select
              value={formaPagamento}
              onChange={(e) => setFormaPagamento(e.target.value as FormaPagamento)}
            >
              {PAGAMENTOS.map((p) => (
                <option key={p.valor} value={p.valor}>
                  {p.rotulo}
                </option>
              ))}
            </select>
          </label>
          <label>
            Desconto (R$)
            <input
              type="number"
              step="0.01"
              min="0"
              value={desconto}
              onChange={(e) => setDesconto(e.target.value)}
            />
          </label>
        </div>

        {novoCliente && (
          <div className="novo-cliente">
            <h3>Cadastrar novo cliente</h3>
            <div className="grid-4">
              <label style={{ gridColumn: "span 2" }}>
                Nome
                <input
                  value={ncNome}
                  onChange={(e) => setNcNome(e.target.value)}
                  placeholder="Ex.: Maria Silva"
                />
              </label>
              <label>
                Telefone
                <input
                  value={ncTelefone}
                  onChange={(e) => setNcTelefone(e.target.value)}
                  placeholder="Opcional"
                />
              </label>
              <label>
                E-mail
                <input
                  type="email"
                  value={ncEmail}
                  onChange={(e) => setNcEmail(e.target.value)}
                  placeholder="Opcional"
                />
              </label>
            </div>
            <div className="form-acoes">
              <button
                type="button"
                className="btn primario pequeno"
                onClick={salvarNovoCliente}
                disabled={salvandoCliente}
              >
                {salvandoCliente ? "Salvando..." : "Salvar cliente"}
              </button>
              <button
                type="button"
                className="btn secundario pequeno"
                onClick={cancelarNovoCliente}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="margem-preview">
          <span>
            Total bruto: <strong>{brl(totalBruto)}</strong>
          </span>
          <span>
            Desconto: <strong>{brl(descontoNum)}</strong>
          </span>
          <span>
            Total a pagar: <strong>{brl(totalLiquido)}</strong>
          </span>
        </div>

        <div className="form-acoes">
          <button
            className="btn primario grande"
            onClick={finalizar}
            disabled={salvando || carrinho.length === 0}
          >
            {salvando ? "Finalizando..." : `Finalizar venda · ${brl(totalLiquido)}`}
          </button>
          {carrinho.length > 0 && (
            <button type="button" className="btn secundario" onClick={limparVenda}>
              Cancelar
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Vendas realizadas</h2>
        {carregando ? (
          <p className="vazio">Carregando...</p>
        ) : vendas.length === 0 ? (
          <p className="vazio">Nenhuma venda ainda.</p>
        ) : (
          <table className="tabela">
            <thead>
              <tr>
                <th>Data</th>
                <th>Cliente</th>
                <th>Itens</th>
                <th>Pagamento</th>
                <th>Total</th>
                <th>Lucro</th>
                <th>Margem</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {vendas.map((v) => (
                <tr key={v.id}>
                  <td className="muted">{formatarData(v.criado_em)}</td>
                  <td>{v.cliente_nome ?? <span className="muted">—</span>}</td>
                  <td className="muted">
                    {v.itens.reduce((acc, i) => acc + i.quantidade, 0)} un
                    {" · "}
                    {v.itens.length} {v.itens.length === 1 ? "item" : "itens"}
                  </td>
                  <td className="muted">{v.forma_pagamento ?? "—"}</td>
                  <td>
                    <strong>{brl(v.total_liquido)}</strong>
                    {parseFloat(v.desconto) > 0 && (
                      <div className="muted">desc. {brl(v.desconto)}</div>
                    )}
                  </td>
                  <td>{brl(v.lucro)}</td>
                  <td>{v.margem_percentual}%</td>
                  <td className="acoes">
                    <button
                      className="btn secundario pequeno"
                      onClick={() => setVendaRecibo(v)}
                    >
                      Recibo
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {vendaRecibo && (
        <div className="recibo-overlay" onClick={() => setVendaRecibo(null)}>
          <div className="recibo-modal" onClick={(e) => e.stopPropagation()}>
            <div className="recibo-area">
              <Recibo venda={vendaRecibo} />
            </div>
            <div className="recibo-acoes no-print">
              <button className="btn primario" onClick={() => window.print()}>
                Imprimir
              </button>
              <button className="btn secundario" onClick={() => setVendaRecibo(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
