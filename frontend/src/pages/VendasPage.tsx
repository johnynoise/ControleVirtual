import { useMemo, useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import type {
  Categoria,
  Cliente,
  FormaPagamento,
  ItemVendaCreate,
  ParcelaCreate,
  Produto,
  Venda,
  VendaCreate,
} from "../types";
import { listarProdutos } from "../services/produtos";
import { listarCategorias } from "../services/categorias";
import { criarCliente, listarClientes } from "../services/clientes";
import { criarVenda } from "../services/vendas";
import ReciboModal from "../components/ReciboModal";
import EstadoVazio from "../components/EstadoVazio";
import { useToast } from "../components/Feedback";
import { brl, corAvatar, extrairErro, formatarTelefone, iniciais, parseNumero } from "../lib/ui";

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
  // Marca itens cujo preço o operador digitou à mão. Esses não são
  // re-precificados quando a forma de pagamento muda.
  preco_editado: boolean;
}

// Preço de tabela do produto conforme a forma de pagamento: no fiado vale o
// preço a prazo do cadastro (o backend já resolve o fallback para o à vista
// quando o produto não tem um preço a prazo próprio).
function precoTabela(p: Produto, forma: FormaPagamento): number {
  const bruto =
    forma === "fiado" ? p.preco_venda_prazo_efetivo : p.preco_venda;
  return parseFloat(bruto) || 0;
}

// Data (YYYY-MM-DD, fuso local) daqui a `offsetDias` dias — usada como
// vencimento padrão sugerido para cada parcela.
function dataISO(offsetDias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDias);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export default function VendasPage() {
  const toast = useToast();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Busca de produtos no catálogo.
  const [busca, setBusca] = useState("");
  const buscaRef = useRef<HTMLInputElement>(null);

  // Filtro de categoria no catálogo ("todas" = sem filtro).
  const [catFiltro, setCatFiltro] = useState<number | "todas">("todas");

  // Carrinho e dados da venda.
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [clienteId, setClienteId] = useState<number | "">("");
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>("dinheiro");
  const [desconto, setDesconto] = useState("0");
  const [descontoTipo, setDescontoTipo] = useState<"reais" | "percent">("reais");

  // Parcelamento (apenas fiado): quantidade de parcelas (1 a 3) e a data de
  // vencimento combinada para cada uma.
  const [numParcelas, setNumParcelas] = useState<1 | 2 | 3>(1);
  const [vencimentos, setVencimentos] = useState<string[]>([]);

  // Delivery: quando ligado, a venda entra como pedido pendente de entrega.
  const [entrega, setEntrega] = useState(false);

  // Valor recebido em dinheiro (para cálculo de troco). Não vai ao backend.
  const [recebido, setRecebido] = useState("");

  // Preço travado por padrão: só é editável após desbloqueio explícito por item
  // (evita alteração acidental de preço no balcão).
  const [precosAbertos, setPrecosAbertos] = useState<number[]>([]);

  function alternarPreco(produto_id: number) {
    setPrecosAbertos((atual) =>
      atual.includes(produto_id)
        ? atual.filter((id) => id !== produto_id)
        : [...atual, produto_id]
    );
  }

  // Trocar a forma de pagamento re-precifica o carrinho: o fiado usa o preço a
  // prazo do produto. Itens com preço digitado à mão ficam como estão.
  useEffect(() => {
    setCarrinho((atual) =>
      atual.map((i) => {
        if (i.preco_editado) return i;
        const p = produtos.find((prod) => prod.id === i.produto_id);
        if (!p) return i;
        const novo = precoTabela(p, formaPagamento);
        return novo === i.preco_unitario ? i : { ...i, preco_unitario: novo };
      })
    );
  }, [formaPagamento, produtos]);

  // Cadastro rápido de cliente direto na tela de venda.
  const [novoCliente, setNovoCliente] = useState(false);
  const [ncNome, setNcNome] = useState("");
  const [ncTelefone, setNcTelefone] = useState("");
  const [ncEmail, setNcEmail] = useState("");
  const [ncEndereco, setNcEndereco] = useState("");
  const [salvandoCliente, setSalvandoCliente] = useState(false);

  // Venda exibida no recibo após finalizar.
  const [vendaRecibo, setVendaRecibo] = useState<Venda | null>(null);
  // Dinheiro recebido/troco da venda recém-finalizada (só para o recibo).
  const [reciboDinheiro, setReciboDinheiro] = useState<{
    recebido: number;
    troco: number;
  } | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const [prods, clis, cats] = await Promise.all([
        listarProdutos({ apenas_ativos: true }),
        listarClientes({ apenas_ativos: true }),
        listarCategorias(),
      ]);
      setProdutos(prods);
      setClientes(clis);
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
  }, [vendaRecibo, novoCliente, carrinho, salvando, clienteId, formaPagamento, desconto, descontoTipo, recebido]);

  // Só mostra abas de categorias que de fato têm produtos no catálogo.
  const categoriasComProdutos = useMemo(() => {
    const ids = new Set(produtos.map((p) => p.categoria_id));
    return categorias.filter((c) => ids.has(c.id));
  }, [categorias, produtos]);

  const produtosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    // Busca tem prioridade sobre a categoria: ao digitar (ou ler um código de
    // barras), procura no catálogo inteiro, independentemente da aba ativa.
    if (termo) {
      return produtos.filter(
        (p) =>
          p.nome.toLowerCase().includes(termo) ||
          (p.sku ?? "").toLowerCase().includes(termo) ||
          (p.codigo_barras ?? "").toLowerCase().includes(termo)
      );
    }
    if (catFiltro === "todas") return produtos;
    return produtos.filter((p) => p.categoria_id === catFiltro);
  }, [produtos, busca, catFiltro]);

  const totalBruto = useMemo(
    () => carrinho.reduce((acc, i) => acc + i.preco_unitario * i.quantidade, 0),
    [carrinho]
  );
  const totalItens = useMemo(
    () => carrinho.reduce((acc, i) => acc + i.quantidade, 0),
    [carrinho]
  );
  // O desconto pode ser informado em reais ou em percentual do subtotal.
  // O backend sempre recebe o valor em reais (descontoValor).
  const descontoDigitado = parseNumero(desconto);
  const descontoValor =
    descontoTipo === "percent"
      ? totalBruto * (Math.min(100, Math.max(0, descontoDigitado)) / 100)
      : Math.max(0, descontoDigitado);
  const totalLiquido = Math.max(0, totalBruto - descontoValor);

  // Valores de cada parcela: divide o total igualmente em centavos e joga a
  // sobra do arredondamento na última parcela (ex.: 100/3 → 33,33 · 33,33 · 33,34).
  const valoresParcelas = useMemo(() => {
    const n = numParcelas;
    if (n <= 0 || totalLiquido <= 0) return [];
    const centavos = Math.round(totalLiquido * 100);
    const base = Math.floor(centavos / n);
    const valores: number[] = [];
    for (let k = 0; k < n; k++) {
      const c = k === n - 1 ? centavos - base * (n - 1) : base;
      valores.push(c / 100);
    }
    return valores;
  }, [numParcelas, totalLiquido]);

  // Mantém a lista de vencimentos com uma entrada por parcela, preenchendo com
  // um padrão (30, 60, 90 dias) as datas ainda não informadas.
  useEffect(() => {
    setVencimentos((atual) => {
      const novo = atual.slice(0, numParcelas);
      for (let k = 0; k < numParcelas; k++) {
        if (!novo[k]) novo[k] = dataISO(30 * (k + 1));
      }
      return novo;
    });
  }, [numParcelas]);

  // Troco: só faz sentido no dinheiro. O valor recebido não é enviado ao
  // backend — serve para o operador conferir o troco no balcão.
  const recebidoNum = parseNumero(recebido);
  const troco = recebidoNum - totalLiquido;

  // Cliente selecionado (para o delivery usar o endereço cadastrado dele).
  const clienteSelecionado =
    clienteId === "" ? null : clientes.find((c) => c.id === clienteId) ?? null;

  // Sugestões de cédulas: valor exato + próximos múltiplos redondos acima do
  // total (ex.: total R$ 37 → 40, 50, 100).
  const sugestoesRecebido = useMemo(() => {
    if (totalLiquido <= 0) return [];
    const valores: number[] = [totalLiquido];
    for (const nota of [5, 10, 20, 50, 100]) {
      const arredondado = Math.ceil(totalLiquido / nota) * nota;
      if (arredondado > totalLiquido && !valores.includes(arredondado)) {
        valores.push(arredondado);
      }
    }
    return valores.slice(0, 4);
  }, [totalLiquido]);

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
          preco_unitario: precoTabela(p, formaPagamento),
          estoque: p.estoque,
          preco_editado: false,
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
    const preco = Math.max(0, parseNumero(valor));
    setCarrinho((atual) =>
      atual.map((i) =>
        i.produto_id === produto_id
          ? { ...i, preco_unitario: preco, preco_editado: true }
          : i
      )
    );
  }

  function removerDoCarrinho(produto_id: number) {
    setCarrinho((atual) => atual.filter((i) => i.produto_id !== produto_id));
    setPrecosAbertos((atual) => atual.filter((id) => id !== produto_id));
  }

  function definirVencimento(indice: number, valor: string) {
    setVencimentos((atual) => {
      const novo = [...atual];
      novo[indice] = valor;
      return novo;
    });
  }

  // Enter na busca adiciona um produto (leitor de código de barras ou
  // digitação rápida). Uma correspondência EXATA de código de barras ou SKU
  // tem prioridade sobre o primeiro resultado da lista — assim o leitor nunca
  // adiciona o produto errado por causa de um resultado parcial.
  function onBuscaKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const termo = busca.trim().toLowerCase();
    if (!termo) return;
    const exato = produtos.find(
      (p) =>
        (p.codigo_barras ?? "").toLowerCase() === termo ||
        (p.sku ?? "").toLowerCase() === termo
    );
    const alvo = exato ?? produtosFiltrados[0];
    if (alvo) {
      adicionarProduto(alvo);
      setBusca("");
    } else {
      toast.erro(`Nenhum produto encontrado para "${busca.trim()}".`);
    }
  }

  function cancelarNovoCliente() {
    setNovoCliente(false);
    setNcNome("");
    setNcTelefone("");
    setNcEmail("");
    setNcEndereco("");
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
        endereco: ncEndereco.trim() || null,
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
    setDescontoTipo("reais");
    setRecebido("");
    setPrecosAbertos([]);
    setBusca("");
    setNumParcelas(1);
    setVencimentos([]);
    setEntrega(false);
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
    // Delivery: a entrega vai para o endereço cadastrado do cliente.
    let enderecoDelivery: string | undefined;
    if (entrega) {
      if (clienteId === "") {
        setErro("Delivery exige um cliente selecionado (com endereço).");
        toast.erro("Selecione um cliente para a entrega.");
        return;
      }
      const cli = clientes.find((c) => c.id === clienteId);
      const end = (cli?.endereco ?? "").trim();
      if (!end) {
        setErro(
          "O cliente selecionado não tem endereço cadastrado. Edite o cliente para adicionar."
        );
        toast.erro("Cliente sem endereço cadastrado.");
        return;
      }
      enderecoDelivery = end;
    }

    // Monta o plano de parcelas quando a venda é a prazo (fiado).
    let parcelas: ParcelaCreate[] | undefined;
    if (formaPagamento === "fiado") {
      if (vencimentos.slice(0, numParcelas).some((d) => !d)) {
        setErro("Informe a data de vencimento de cada parcela.");
        toast.erro("Informe a data de vencimento de cada parcela.");
        return;
      }
      parcelas = valoresParcelas.map((valor, k) => ({
        numero: k + 1,
        valor: Number(valor.toFixed(2)),
        vencimento: vencimentos[k],
      }));
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
      desconto: Number(descontoValor.toFixed(2)),
      itens,
      ...(parcelas ? { parcelas } : {}),
      ...(entrega
        ? { entrega: true, endereco_entrega: enderecoDelivery }
        : {}),
    };

    // Captura o troco antes de limpar a venda (limparVenda zera o recebido).
    const dinheiro =
      formaPagamento === "dinheiro" && recebidoNum > 0
        ? { recebido: recebidoNum, troco }
        : null;

    const eraEntrega = entrega;

    try {
      const venda = await criarVenda(payload);
      limparVenda();
      await carregar();
      if (eraEntrega) {
        // Pedido de delivery: ainda não é uma venda realizada, então não abre
        // recibo. Fica pendente na tela de Delivery até a entrega ser confirmada.
        toast.sucesso(
          `Pedido de entrega #${venda.id} registrado · ${brl(venda.total_liquido)}`
        );
      } else {
        setReciboDinheiro(dinheiro);
        setVendaRecibo(venda);
        toast.sucesso(`Venda #${venda.id} finalizada · ${brl(venda.total_liquido)}`);
      }
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

          {!busca.trim() && categoriasComProdutos.length > 0 && (
            <div className="pdv-cats" role="tablist" aria-label="Categorias">
              <button
                type="button"
                role="tab"
                aria-selected={catFiltro === "todas"}
                className={`pdv-cat${catFiltro === "todas" ? " ativo" : ""}`}
                onClick={() => setCatFiltro("todas")}
              >
                Todos
              </button>
              {categoriasComProdutos.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  aria-selected={catFiltro === c.id}
                  className={`pdv-cat${catFiltro === c.id ? " ativo" : ""}`}
                  onClick={() => setCatFiltro(c.id)}
                >
                  {c.nome}
                </button>
              ))}
            </div>
          )}

          {carregando ? (
            <p className="vazio">Carregando produtos...</p>
          ) : produtos.length === 0 ? (
            <EstadoVazio
              titulo="Nenhum produto para vender"
              descricao="Cadastre seus produtos primeiro. Depois eles aparecem aqui para montar a venda."
              acao={{ rotulo: "Cadastrar produtos", to: "/produtos" }}
            />
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
                      <strong>{brl(precoTabela(p, formaPagamento))}</strong>
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
              <div className="pdv-carrinho-corpo">
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
                    <div className="pdv-item-preco-linha">
                      {precosAbertos.includes(i.produto_id) ? (
                        <label className="pdv-item-preco">
                          <span>R$</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={i.preco_unitario}
                            onChange={(e) =>
                              definirPreco(i.produto_id, e.target.value)
                            }
                            autoFocus
                          />
                        </label>
                      ) : (
                        <span className="pdv-item-preco-un">
                          {brl(i.preco_unitario)}{" "}
                          <span className="pdv-item-un">cada</span>
                        </span>
                      )}
                      <button
                        type="button"
                        className={`pdv-item-editar${precosAbertos.includes(i.produto_id) ? " ativo" : ""}`}
                        onClick={() => alternarPreco(i.produto_id)}
                        title={
                          precosAbertos.includes(i.produto_id)
                            ? "Travar preço"
                            : "Alterar preço"
                        }
                        aria-label={
                          precosAbertos.includes(i.produto_id)
                            ? "Travar preço"
                            : "Alterar preço"
                        }
                      >
                        {precosAbertos.includes(i.produto_id) ? (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="4" y="11" width="16" height="10" rx="2" />
                            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                          </svg>
                        )}
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
                      type="tel"
                      inputMode="tel"
                      value={ncTelefone}
                      onChange={(e) => setNcTelefone(formatarTelefone(e.target.value))}
                      placeholder="Telefone (opcional)"
                    />
                    <input
                      type="email"
                      value={ncEmail}
                      onChange={(e) => setNcEmail(e.target.value)}
                      placeholder="E-mail (opcional)"
                    />
                    <input
                      value={ncEndereco}
                      onChange={(e) => setNcEndereco(e.target.value)}
                      placeholder="Endereço (para delivery)"
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

              <div className="pdv-entrega">
                <label className="pdv-entrega-toggle">
                  <input
                    type="checkbox"
                    checked={entrega}
                    onChange={(e) => setEntrega(e.target.checked)}
                  />
                  <span className="pdv-entrega-texto">
                    <strong>🛵 Delivery (entrega)</strong>
                    <span className="muted">
                      Entra como pedido pendente. A venda só é concluída ao
                      confirmar a entrega.
                    </span>
                  </span>
                </label>
                {entrega &&
                  (clienteSelecionado == null ? (
                    <p className="pdv-entrega-aviso alerta">
                      ⚠ Selecione um cliente acima: a entrega vai para o endereço
                      cadastrado dele.
                    </p>
                  ) : (clienteSelecionado.endereco ?? "").trim() === "" ? (
                    <p className="pdv-entrega-aviso alerta">
                      ⚠ {clienteSelecionado.nome} não tem endereço cadastrado.
                      Edite o cliente para adicionar.
                    </p>
                  ) : (
                    <p className="pdv-entrega-aviso">
                      📍 Entregar em: {clienteSelecionado.endereco}
                    </p>
                  ))}
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

                {formaPagamento === "fiado" && totalLiquido > 0 && (
                  <div className="pdv-parcelamento">
                    <span className="pdv-label">Parcelar em</span>
                    <div
                      className="pdv-parcelas-opcoes"
                      role="group"
                      aria-label="Número de parcelas"
                    >
                      {[1, 2, 3].map((n) => (
                        <button
                          key={n}
                          type="button"
                          className={`pdv-parcela-opcao${numParcelas === n ? " ativo" : ""}`}
                          onClick={() => setNumParcelas(n as 1 | 2 | 3)}
                          aria-pressed={numParcelas === n}
                        >
                          {n}x
                        </button>
                      ))}
                    </div>

                    <ul className="pdv-parcelas-lista">
                      {valoresParcelas.map((valor, k) => (
                        <li key={k} className="pdv-parcela-linha">
                          <span className="pdv-parcela-rotulo">
                            {k + 1}ª parcela
                            <strong>{brl(valor)}</strong>
                          </span>
                          <label className="pdv-parcela-data">
                            <span>Vence em</span>
                            <input
                              type="date"
                              value={vencimentos[k] ?? ""}
                              onChange={(e) =>
                                definirVencimento(k, e.target.value)
                              }
                            />
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="pdv-totais">
                <div className="pdv-linha-desc">
                  <span>Subtotal</span>
                  <span>{brl(totalBruto)}</span>
                </div>
                <div className="pdv-linha-desc">
                  <label htmlFor="pdv-desconto">Desconto</label>
                  <div className="pdv-desc-campo">
                    <div className="pdv-desc-toggle" role="group" aria-label="Tipo de desconto">
                      <button
                        type="button"
                        className={descontoTipo === "reais" ? "ativo" : ""}
                        onClick={() => setDescontoTipo("reais")}
                        aria-pressed={descontoTipo === "reais"}
                      >
                        R$
                      </button>
                      <button
                        type="button"
                        className={descontoTipo === "percent" ? "ativo" : ""}
                        onClick={() => setDescontoTipo("percent")}
                        aria-pressed={descontoTipo === "percent"}
                      >
                        %
                      </button>
                    </div>
                    <input
                      id="pdv-desconto"
                      type="text"
                      inputMode="decimal"
                      value={desconto}
                      onChange={(e) => setDesconto(e.target.value)}
                    />
                  </div>
                </div>
                {descontoTipo === "percent" && descontoValor > 0 && (
                  <div className="pdv-linha-desc">
                    <span>Desconto aplicado</span>
                    <span>− {brl(descontoValor)}</span>
                  </div>
                )}
                <div className="pdv-total">
                  <span>Total</span>
                  <strong>{brl(totalLiquido)}</strong>
                </div>

                {formaPagamento === "dinheiro" && totalLiquido > 0 && !entrega && (
                  <div className="pdv-troco">
                    <label htmlFor="pdv-recebido" className="pdv-label">
                      Dinheiro recebido
                    </label>
                    {sugestoesRecebido.length > 0 && (
                      <div className="pdv-troco-chips">
                        {sugestoesRecebido.map((v) => (
                          <button
                            key={v}
                            type="button"
                            className="pdv-troco-chip"
                            onClick={() => setRecebido(String(v))}
                          >
                            {v === totalLiquido ? "Exato" : brl(v)}
                          </button>
                        ))}
                      </div>
                    )}
                    <input
                      id="pdv-recebido"
                      className="pdv-troco-input"
                      type="text"
                      inputMode="decimal"
                      value={recebido}
                      onChange={(e) => setRecebido(e.target.value)}
                      placeholder="0,00"
                    />
                    {recebidoNum > 0 && (
                      <div
                        className={`pdv-troco-linha ${troco >= 0 ? "ok" : "falta"}`}
                      >
                        <span>{troco >= 0 ? "Troco" : "Falta"}</span>
                        <strong>{brl(Math.abs(troco))}</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>
              </div>

              <button
                className="btn primario pdv-finalizar"
                onClick={finalizar}
                disabled={salvando || carrinho.length === 0}
              >
                {salvando
                  ? entrega
                    ? "Registrando..."
                    : "Finalizando..."
                  : `${entrega ? "Registrar entrega" : formaPagamento === "fiado" ? "Fiar" : "Finalizar"} · ${brl(totalLiquido)}`}
                {!salvando && <kbd className="pdv-kbd-btn">F2</kbd>}
              </button>
            </>
          )}
        </aside>
      </div>

      {vendaRecibo && (
        <ReciboModal
          venda={vendaRecibo}
          dinheiro={reciboDinheiro}
          emailPadrao={
            clientes.find((c) => c.id === vendaRecibo.cliente_id)?.email ?? undefined
          }
          onFechar={() => {
            setVendaRecibo(null);
            setReciboDinheiro(null);
          }}
        />
      )}
    </div>
  );
}
