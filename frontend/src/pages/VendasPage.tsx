import { useMemo, useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
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
import { criarVenda } from "../services/vendas";
import ReciboModal from "../components/ReciboModal";
import { useToast } from "../components/Feedback";
import { brl, corAvatar, extrairErro, iniciais } from "../lib/ui";

const PAGAMENTOS: { valor: FormaPagamento; rotulo: string; icone: string }[] = [
  { valor: "dinheiro", rotulo: "Dinheiro", icone: "💵" },
  { valor: "pix", rotulo: "PIX", icone: "⚡" },
  { valor: "cartao_credito", rotulo: "Crédito", icone: "💳" },
  { valor: "cartao_debito", rotulo: "Débito", icone: "🏦" },
  { valor: "fiado", rotulo: "Fiado", icone: "📓" },
  { valor: "outro", rotulo: "Outro", icone: "•" },
];

interface ItemCarrinho {
  produto_id: number;
  produto_nome: string;
  quantidade: number;
  preco_unitario: number;
  estoque: number;
}

export default function VendasPage() {
  const toast = useToast();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Busca de produtos no catálogo.
  const [busca, setBusca] = useState("");
  const buscaRef = useRef<HTMLInputElement>(null);

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

  // Venda exibida no recibo após finalizar.
  const [vendaRecibo, setVendaRecibo] = useState<Venda | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const [prods, clis] = await Promise.all([
        listarProdutos({ apenas_ativos: true }),
        listarClientes({ apenas_ativos: true }),
      ]);
      setProdutos(prods);
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

  // Foco automático na busca ao abrir (fluxo rápido de balcão).
  useEffect(() => {
    if (!carregando) buscaRef.current?.focus();
  }, [carregando]);

  // Atalhos de teclado (estilo PDV): teclas de função não conflitam com a
  // digitação, então funcionam mesmo com o cursor em um campo de texto.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (vendaRecibo) setVendaRecibo(null);
        else if (novoCliente) cancelarNovoCliente();
        return;
      }
      // Com o recibo aberto, ignora os demais atalhos.
      if (vendaRecibo) return;

      if (e.key === "F2") {
        e.preventDefault();
        finalizar();
      } else if (e.key === "F3") {
        e.preventDefault(); // evita abrir a busca do navegador
        buscaRef.current?.focus();
        buscaRef.current?.select();
      } else if (e.key === "F4") {
        e.preventDefault();
        setNovoCliente(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendaRecibo, novoCliente, carrinho, salvando, clienteId, formaPagamento, desconto]);

  const produtosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return produtos;
    return produtos.filter(
      (p) =>
        p.nome.toLowerCase().includes(termo) ||
        (p.sku ?? "").toLowerCase().includes(termo) ||
        (p.codigo_barras ?? "").toLowerCase().includes(termo)
    );
  }, [produtos, busca]);

  const totalBruto = useMemo(
    () => carrinho.reduce((acc, i) => acc + i.preco_unitario * i.quantidade, 0),
    [carrinho]
  );
  const totalItens = useMemo(
    () => carrinho.reduce((acc, i) => acc + i.quantidade, 0),
    [carrinho]
  );
  const descontoNum = parseFloat(desconto) || 0;
  const totalLiquido = Math.max(0, totalBruto - descontoNum);

  // Adiciona um produto ao carrinho (ou incrementa se já estiver lá),
  // respeitando o estoque disponível.
  function adicionarProduto(p: Produto) {
    setErro(null);
    if (p.estoque <= 0) {
      toast.erro(`${p.nome} está sem estoque.`);
      return;
    }
    const noCarrinho = carrinho.find((i) => i.produto_id === p.id);
    if (noCarrinho && noCarrinho.quantidade >= p.estoque) {
      toast.erro(`Estoque máximo de ${p.nome} atingido (${p.estoque}).`);
      return;
    }
    setCarrinho((atual) => {
      const existe = atual.find((i) => i.produto_id === p.id);
      if (existe) {
        return atual.map((i) =>
          i.produto_id === p.id ? { ...i, quantidade: i.quantidade + 1 } : i
        );
      }
      return [
        ...atual,
        {
          produto_id: p.id,
          produto_nome: p.nome,
          quantidade: 1,
          preco_unitario: parseFloat(p.preco_venda) || 0,
          estoque: p.estoque,
        },
      ];
    });
  }

  function alterarQuantidade(produto_id: number, delta: number) {
    setCarrinho((atual) =>
      atual
        .map((i) => {
          if (i.produto_id !== produto_id) return i;
          const nova = i.quantidade + delta;
          if (delta > 0 && nova > i.estoque) {
            toast.erro(`Estoque máximo de ${i.produto_nome} atingido (${i.estoque}).`);
            return i;
          }
          return { ...i, quantidade: nova };
        })
        .filter((i) => i.quantidade > 0)
    );
  }

  function definirQuantidade(produto_id: number, valor: string) {
    const q = parseInt(valor, 10);
    setCarrinho((atual) =>
      atual.map((i) => {
        if (i.produto_id !== produto_id) return i;
        if (Number.isNaN(q)) return i;
        const limitada = Math.min(Math.max(1, q), i.estoque);
        if (q > i.estoque) {
          toast.erro(`${i.produto_nome} tem apenas ${i.estoque} em estoque.`);
        }
        return { ...i, quantidade: limitada };
      })
    );
  }

  function definirPreco(produto_id: number, valor: string) {
    const preco = parseFloat(valor);
    setCarrinho((atual) =>
      atual.map((i) =>
        i.produto_id === produto_id
          ? { ...i, preco_unitario: Number.isNaN(preco) ? 0 : Math.max(0, preco) }
          : i
      )
    );
  }

  function removerDoCarrinho(produto_id: number) {
    setCarrinho((atual) => atual.filter((i) => i.produto_id !== produto_id));
  }

  // Enter na busca adiciona o primeiro produto filtrado (leitor de código
  // de barras ou digitação rápida).
  function onBuscaKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && produtosFiltrados.length > 0) {
      adicionarProduto(produtosFiltrados[0]);
      setBusca("");
    }
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
      setClientes(await listarClientes({ apenas_ativos: true }));
      setClienteId(criado.id);
      cancelarNovoCliente();
      toast.sucesso(`Cliente ${criado.nome} cadastrado.`);
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
    setBusca("");
  }

  async function finalizar() {
    if (carrinho.length === 0) {
      setErro("Adicione pelo menos um item à venda.");
      return;
    }
    if (formaPagamento === "fiado" && clienteId === "") {
      setErro("Venda no fiado exige um cliente. Selecione ou cadastre um.");
      toast.erro("Selecione um cliente para vender no fiado.");
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
      setVendaRecibo(venda);
      toast.sucesso(`Venda #${venda.id} finalizada · ${brl(venda.total_liquido)}`);
      buscaRef.current?.focus();
    } catch (err) {
      setErro(extrairErro(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="page">
      <div className="pdv-topbar">
        <div className="page-title">
          <span className="title-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="20" r="1.5" />
              <circle cx="18" cy="20" r="1.5" />
              <path d="M2 3h3l2.4 12.2a1.5 1.5 0 0 0 1.5 1.2h8.2a1.5 1.5 0 0 0 1.5-1.2L22 7H6" />
            </svg>
          </span>
          <div>
            <h1>Ponto de venda</h1>
            <p className="pdv-sub">Toque nos produtos para montar a venda.</p>
          </div>
        </div>
        <Link to="/vendas/historico" className="btn secundario">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v5h5" />
            <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
            <path d="M12 7v5l4 2" />
          </svg>
          Histórico
        </Link>
      </div>

      <div className="pdv-atalhos">
        <span><kbd>F2</kbd> Finalizar</span>
        <span><kbd>F3</kbd> Buscar</span>
        <span><kbd>F4</kbd> Novo cliente</span>
        <span><kbd>Enter</kbd> Adicionar 1º resultado</span>
        <span><kbd>Esc</kbd> Fechar</span>
      </div>

      {erro && <div className="alert erro">{erro}</div>}

      {produtos.length === 0 && !carregando && (
        <div className="alert aviso">
          Nenhum produto cadastrado. Cadastre produtos antes de vender.
        </div>
      )}

      <div className="pdv-layout">
        {/* ----------------------- Catálogo ----------------------- */}
        <section className="pdv-catalogo card">
          <div className="busca pdv-busca">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              ref={buscaRef}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={onBuscaKeyDown}
              placeholder="Buscar por nome, SKU ou código de barras..."
            />
          </div>

          {carregando ? (
            <p className="vazio">Carregando produtos...</p>
          ) : produtosFiltrados.length === 0 ? (
            <p className="vazio">Nenhum produto encontrado.</p>
          ) : (
            <div className="pdv-grid">
              {produtosFiltrados.map((p) => {
                const semEstoque = p.estoque <= 0;
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`pdv-produto${semEstoque ? " sem-estoque" : ""}`}
                    onClick={() => adicionarProduto(p)}
                    title={semEstoque ? "Sem estoque" : `Adicionar ${p.nome}`}
                  >
                    <span
                      className="pdv-produto-avatar"
                      style={{ background: corAvatar(p.nome) }}
                    >
                      {iniciais(p.nome)}
                    </span>
                    <span className="pdv-produto-nome">{p.nome}</span>
                    <span className="pdv-produto-rodape">
                      <strong>{brl(p.preco_venda)}</strong>
                      <span
                        className={`pdv-estoque${semEstoque ? " zero" : p.estoque <= p.estoque_minimo ? " baixo" : ""}`}
                      >
                        {semEstoque ? "esgotado" : `${p.estoque} un`}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* ----------------------- Carrinho ----------------------- */}
        <aside className="pdv-carrinho card">
          <div className="pdv-carrinho-head">
            <h2>
              Carrinho
              {totalItens > 0 && <span className="pdv-badge">{totalItens}</span>}
            </h2>
            {carrinho.length > 0 && (
              <button
                type="button"
                className="btn perigo pequeno"
                onClick={limparVenda}
              >
                Limpar
              </button>
            )}
          </div>

          {carrinho.length === 0 ? (
            <div className="pdv-carrinho-vazio">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="20" r="1.5" />
                <circle cx="18" cy="20" r="1.5" />
                <path d="M2 3h3l2.4 12.2a1.5 1.5 0 0 0 1.5 1.2h8.2a1.5 1.5 0 0 0 1.5-1.2L22 7H6" />
              </svg>
              <p>Nenhum item ainda.</p>
              <span>Selecione produtos ao lado para começar.</span>
            </div>
          ) : (
            <>
              <ul className="pdv-itens">
                {carrinho.map((i) => (
                  <li key={i.produto_id} className="pdv-item">
                    <div className="pdv-item-topo">
                      <span className="pdv-item-nome">{i.produto_nome}</span>
                      <button
                        type="button"
                        className="pdv-item-remover"
                        onClick={() => removerDoCarrinho(i.produto_id)}
                        title="Remover"
                      >
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="pdv-item-baixo">
                      <div className="pdv-stepper">
                        <button
                          type="button"
                          onClick={() => alterarQuantidade(i.produto_id, -1)}
                          aria-label="Diminuir"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={i.quantidade}
                          onChange={(e) =>
                            definirQuantidade(i.produto_id, e.target.value)
                          }
                        />
                        <button
                          type="button"
                          onClick={() => alterarQuantidade(i.produto_id, 1)}
                          aria-label="Aumentar"
                        >
                          +
                        </button>
                      </div>
                      <label className="pdv-item-preco">
                        <span>R$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={i.preco_unitario}
                          onChange={(e) =>
                            definirPreco(i.produto_id, e.target.value)
                          }
                        />
                      </label>
                      <span className="pdv-item-subtotal">
                        {brl(i.preco_unitario * i.quantidade)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="pdv-cliente">
                <label>
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

                {novoCliente && (
                  <div className="pdv-novo-cliente">
                    <input
                      value={ncNome}
                      onChange={(e) => setNcNome(e.target.value)}
                      placeholder="Nome do cliente"
                    />
                    <input
                      value={ncTelefone}
                      onChange={(e) => setNcTelefone(e.target.value)}
                      placeholder="Telefone (opcional)"
                    />
                    <input
                      type="email"
                      value={ncEmail}
                      onChange={(e) => setNcEmail(e.target.value)}
                      placeholder="E-mail (opcional)"
                    />
                    <div className="form-acoes" style={{ marginTop: 0 }}>
                      <button
                        type="button"
                        className="btn primario pequeno"
                        onClick={salvarNovoCliente}
                        disabled={salvandoCliente}
                      >
                        {salvandoCliente ? "Salvando..." : "Salvar"}
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
              </div>

              <div className="pdv-pagamento">
                <span className="pdv-label">Forma de pagamento</span>
                <div className="pdv-pgto-pills">
                  {PAGAMENTOS.map((p) => (
                    <button
                      key={p.valor}
                      type="button"
                      className={`pdv-pill${formaPagamento === p.valor ? " ativo" : ""}`}
                      onClick={() => setFormaPagamento(p.valor)}
                    >
                      <span className="pdv-pill-icone">{p.icone}</span>
                      {p.rotulo}
                    </button>
                  ))}
                </div>
                {formaPagamento === "fiado" && (
                  <p
                    className={`pdv-fiado-aviso${clienteId === "" ? " alerta" : ""}`}
                  >
                    {clienteId === ""
                      ? "⚠ Selecione um cliente acima: o fiado fica no nome dele."
                      : "📓 Esta venda entra como saldo devedor do cliente."}
                  </p>
                )}
              </div>

              <div className="pdv-totais">
                <div className="pdv-linha-desc">
                  <span>Subtotal</span>
                  <span>{brl(totalBruto)}</span>
                </div>
                <div className="pdv-linha-desc">
                  <label htmlFor="pdv-desconto">Desconto (R$)</label>
                  <input
                    id="pdv-desconto"
                    type="number"
                    step="0.01"
                    min="0"
                    value={desconto}
                    onChange={(e) => setDesconto(e.target.value)}
                  />
                </div>
                <div className="pdv-total">
                  <span>Total</span>
                  <strong>{brl(totalLiquido)}</strong>
                </div>
              </div>

              <button
                className="btn primario pdv-finalizar"
                onClick={finalizar}
                disabled={salvando || carrinho.length === 0}
              >
                {salvando
                  ? "Finalizando..."
                  : `${formaPagamento === "fiado" ? "Fiar" : "Finalizar"} · ${brl(totalLiquido)}`}
                {!salvando && <kbd className="pdv-kbd-btn">F2</kbd>}
              </button>
            </>
          )}
        </aside>
      </div>

      {vendaRecibo && (
        <ReciboModal venda={vendaRecibo} onFechar={() => setVendaRecibo(null)} />
      )}
    </div>
  );
}
