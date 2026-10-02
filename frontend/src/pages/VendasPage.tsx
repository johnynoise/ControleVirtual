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
import FechamentoVendaModal from "../components/FechamentoVendaModal";
import EstadoVazio from "../components/EstadoVazio";
import { useToast } from "../components/Feedback";
import { brl, corAvatar, extrairErro, iniciais, parseNumero } from "../lib/ui";

interface ItemCarrinho {
  produto_id: number;
  produto_nome: string;
  quantidade: number;
  preco_unitario: number;
  estoque: number;
  // Marca itens cujo preço o operador digitou à mão. Esses não são
  // re-precificados quando a forma de pagamento muda.
  preco_editado: boolean;
  // Desconto em reais sobre a linha inteira (preço × quantidade), independente
  // do desconto total da venda.
  desconto: number;
}

// Preço de tabela do produto conforme a forma de pagamento: no fiado vale o
// preço a prazo do cadastro (o backend já resolve o fallback para o à vista
// quando o produto não tem um preço a prazo próprio).
function precoTabela(p: Produto, forma: FormaPagamento): number {
  const bruto =
    forma === "fiado" ? p.preco_venda_prazo_efetivo : p.preco_venda;
  return parseFloat(bruto) || 0;
}

// Preço em texto no padrão brasileiro (sem símbolo), para preencher o campo
// editável de preço do item. Ex.: 12.5 → "12,50" · 1234.5 → "1.234,50".
function precoParaTexto(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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
  // Trava síncrona contra finalização em dobro. O `salvando` do estado só vale
  // no próximo render, então dois F2 rápidos escapariam dele (o botão fica
  // desabilitado, mas o atalho de teclado não passa pelo botão).
  const salvandoRef = useRef(false);

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

  // Parcelamento (apenas fiado): quantidade de parcelas (1 a 5) e a data de
  // vencimento combinada para cada uma.
  const [numParcelas, setNumParcelas] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [vencimentos, setVencimentos] = useState<string[]>([]);

  // Delivery: quando ligado, a venda entra como pedido pendente de entrega.
  const [entrega, setEntrega] = useState(false);

  // Modal de fechamento: concentra cliente, entrega, pagamento, desconto e
  // troco numa etapa separada da montagem do carrinho — assim o painel
  // lateral fica só com os itens enquanto o vendedor monta a venda.
  const [mostrarFechamento, setMostrarFechamento] = useState(false);

  // Valor recebido em dinheiro (para cálculo de troco). Não vai ao backend.
  const [recebido, setRecebido] = useState("");

  // Preço travado por padrão: só é editável após desbloqueio explícito por item
  // (evita alteração acidental de preço no balcão).
  const [precosAbertos, setPrecosAbertos] = useState<number[]>([]);

  // Texto do campo de preço enquanto está sendo digitado, por produto. Precisa
  // ser string: guardar só o número faria a vírgula desaparecer no meio da
  // digitação ("12," → 12 → "12"), e "12,50" acabaria virando 1250.
  const [precoTexto, setPrecoTexto] = useState<Record<number, string>>({});

  // Desconto por item: mesmo padrão do editor de preço (campo travado por
  // padrão, com um botão para abrir/fechar o input de edição).
  const [descontosAbertos, setDescontosAbertos] = useState<number[]>([]);
  const [descontoTexto, setDescontoTexto] = useState<Record<number, string>>({});

  function alternarPreco(produto_id: number) {
    if (precosAbertos.includes(produto_id)) {
      setPrecosAbertos((atual) => atual.filter((id) => id !== produto_id));
      descartarPrecoTexto(produto_id);
      return;
    }
    const item = carrinho.find((i) => i.produto_id === produto_id);
    setPrecoTexto((atual) => ({
      ...atual,
      [produto_id]: item ? precoParaTexto(item.preco_unitario) : "",
    }));
    setPrecosAbertos((atual) => [...atual, produto_id]);
  }

  function descartarPrecoTexto(produto_id: number) {
    setPrecoTexto((atual) => {
      if (!(produto_id in atual)) return atual;
      const novo = { ...atual };
      delete novo[produto_id];
      return novo;
    });
  }

  // Trocar a forma de pagamento re-precifica o carrinho: o fiado usa o preço a
  // prazo do produto. Itens com preço digitado à mão ficam como estão.
  useEffect(() => {
    setCarrinho((atual) =>
      atual.map((i) => {
        if (i.preco_editado) {
          const brutoAtual = i.preco_unitario * i.quantidade;
          return i.desconto > brutoAtual ? { ...i, desconto: brutoAtual } : i;
        }
        const p = produtos.find((prod) => prod.id === i.produto_id);
        if (!p) return i;
        const novo = precoTabela(p, formaPagamento);
        if (novo === i.preco_unitario) return i;
        const novoBruto = novo * i.quantidade;
        return {
          ...i,
          preco_unitario: novo,
          desconto: Math.min(i.desconto, novoBruto),
        };
      })
    );
    // Os preços acabaram de ser re-derivados, então qualquer campo de preço
    // aberto está exibindo um valor velho. Trava os campos: o valor já digitado
    // continua no carrinho (preco_editado protege), só o editor fecha.
    setPrecosAbertos([]);
    setPrecoTexto({});
    setDescontosAbertos([]);
    setDescontoTexto({});
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

  // Erro de ação: o banner no topo da página pode estar fora da área visível
  // quando o operador está trabalhando no carrinho, então toda falha também
  // aparece como toast.
  function falhar(mensagem: string) {
    setErro(mensagem);
    toast.erro(mensagem);
  }

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

  // O balcão ocupa a viewport inteira e não rola: todo o scroll acontece dentro
  // do catálogo e do carrinho. A classe no <body> neutraliza o limite de largura
  // e o padding do container de página padrão, só enquanto esta tela está
  // aberta (em telas estreitas o layout empilha e volta a rolar normalmente).
  useEffect(() => {
    document.body.classList.add("pdv-ativo");
    return () => document.body.classList.remove("pdv-ativo");
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
        else if (mostrarFechamento) setMostrarFechamento(false);
        else if (novoCliente) cancelarNovoCliente();
        return;
      }
      // Com o recibo aberto, ignora os demais atalhos.
      if (vendaRecibo) return;

      if (e.key === "F2") {
        e.preventDefault();
        // Primeiro F2 abre o fechamento (pagamento/cliente/desconto); com o
        // modal já aberto, o segundo F2 confirma a venda.
        if (mostrarFechamento) finalizar();
        else if (carrinho.length > 0) setMostrarFechamento(true);
      } else if (e.key === "F3") {
        e.preventDefault(); // evita abrir a busca do navegador
        buscaRef.current?.focus();
        buscaRef.current?.select();
      } else if (e.key === "F4") {
        e.preventDefault();
        setMostrarFechamento(true);
        setNovoCliente(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendaRecibo, mostrarFechamento, novoCliente, carrinho, salvando, clienteId, formaPagamento, desconto, descontoTipo, recebido]);

  // Só mostra abas de categorias que de fato têm produtos no catálogo.
  const categoriasComProdutos = useMemo(() => {
    const ids = new Set(produtos.map((p) => p.categoria_id));
    return categorias.filter((c) => ids.has(c.id));
  }, [categorias, produtos]);

  const produtosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    // Busca tem prioridade sobre a categoria: ao digitar (ou ler um código de
    // barras), procura no catálogo inteiro, independentemente da aba ativa.
    const base = termo
      ? produtos.filter(
          (p) =>
            p.nome.toLowerCase().includes(termo) ||
            (p.sku ?? "").toLowerCase().includes(termo) ||
            (p.codigo_barras ?? "").toLowerCase().includes(termo)
        )
      : catFiltro === "todas"
        ? produtos
        : produtos.filter((p) => p.categoria_id === catFiltro);
    // Esgotados vão para o fim: não são vendáveis, então não ocupam as
    // primeiras posições da grade nem o alvo do Enter na busca. O sort é
    // estável, logo a ordem original é preservada dentro de cada grupo.
    return [...base].sort(
      (a, b) => Number(a.estoque <= 0) - Number(b.estoque <= 0)
    );
  }, [produtos, busca, catFiltro]);

  // Bruto de fato: soma de preço × quantidade, sem nenhum desconto.
  const totalBruto = useMemo(
    () => carrinho.reduce((acc, i) => acc + i.preco_unitario * i.quantidade, 0),
    [carrinho]
  );
  // Soma dos descontos aplicados linha a linha (antes do desconto total).
  const totalDescontoItens = useMemo(
    () => carrinho.reduce((acc, i) => acc + i.desconto, 0),
    [carrinho]
  );
  // Total já líquido dos descontos de item, mas antes do desconto total da
  // venda — é a base sobre a qual o desconto total (reais/percentual) incide.
  const totalAposItens = totalBruto - totalDescontoItens;
  const totalItens = useMemo(
    () => carrinho.reduce((acc, i) => acc + i.quantidade, 0),
    [carrinho]
  );
  // O desconto pode ser informado em reais ou em percentual do subtotal (já
  // líquido dos descontos de item). O backend sempre recebe o valor em reais
  // (descontoValor).
  const descontoDigitado = parseNumero(desconto);
  // Valor pedido pelo operador, antes de qualquer limite.
  const descontoPedido =
    descontoTipo === "percent"
      ? totalAposItens * (Math.max(0, descontoDigitado) / 100)
      : Math.max(0, descontoDigitado);
  // O desconto nunca passa do total já líquido dos descontos de item. Antes o
  // excesso era absorvido em silêncio pelo Math.max(0, ...) do total, então um
  // erro de digitação (R$ 500 num total de R$ 50) fechava a venda por R$ 0,00
  // sem nenhum aviso.
  const descontoValor = Math.min(descontoPedido, totalAposItens);
  const descontoExcedido = totalAposItens > 0 && descontoPedido - totalAposItens > 0.005;
  const totalLiquido = totalAposItens - descontoValor;
  // Percentual efetivo, para o operador conferir a ordem de grandeza.
  const descontoPercentual =
    totalAposItens > 0 ? (descontoValor / totalAposItens) * 100 : 0;
  const vendaZerada = totalBruto > 0 && totalLiquido < 0.005;

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
          desconto: 0,
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
          // O desconto da linha não pode passar do novo valor bruto.
          const novoBruto = i.preco_unitario * nova;
          return { ...i, quantidade: nova, desconto: Math.min(i.desconto, novoBruto) };
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
        const novoBruto = i.preco_unitario * limitada;
        return { ...i, quantidade: limitada, desconto: Math.min(i.desconto, novoBruto) };
      })
    );
  }

  function definirPreco(produto_id: number, valor: string) {
    // Aceita apenas dígitos e separadores decimais, preservando o texto como
    // digitado (inclusive a vírgula solta em "12,") para não atropelar o
    // operador no meio do número.
    const texto = valor.replace(/[^\d.,]/g, "");
    setPrecoTexto((atual) => ({ ...atual, [produto_id]: texto }));
    const preco = Math.max(0, parseNumero(texto));
    setCarrinho((atual) =>
      atual.map((i) => {
        if (i.produto_id !== produto_id) return i;
        const novoBruto = preco * i.quantidade;
        return {
          ...i,
          preco_unitario: preco,
          preco_editado: true,
          desconto: Math.min(i.desconto, novoBruto),
        };
      })
    );
  }

  // Ao sair do campo, reescreve o texto no formato canônico ("12,5" → "12,50").
  function normalizarPreco(produto_id: number) {
    const item = carrinho.find((i) => i.produto_id === produto_id);
    if (!item) return;
    setPrecoTexto((atual) =>
      // Se o campo já foi travado (Enter/botão), não recria o rascunho.
      produto_id in atual
        ? { ...atual, [produto_id]: precoParaTexto(item.preco_unitario) }
        : atual
    );
  }

  function removerDoCarrinho(produto_id: number) {
    setCarrinho((atual) => atual.filter((i) => i.produto_id !== produto_id));
    setPrecosAbertos((atual) => atual.filter((id) => id !== produto_id));
    descartarPrecoTexto(produto_id);
    setDescontosAbertos((atual) => atual.filter((id) => id !== produto_id));
    descartarDescontoTexto(produto_id);
  }

  function descartarDescontoTexto(produto_id: number) {
    setDescontoTexto((atual) => {
      if (!(produto_id in atual)) return atual;
      const novo = { ...atual };
      delete novo[produto_id];
      return novo;
    });
  }

  function alternarDesconto(produto_id: number) {
    if (descontosAbertos.includes(produto_id)) {
      setDescontosAbertos((atual) => atual.filter((id) => id !== produto_id));
      descartarDescontoTexto(produto_id);
      return;
    }
    const item = carrinho.find((i) => i.produto_id === produto_id);
    setDescontoTexto((atual) => ({
      ...atual,
      [produto_id]: item && item.desconto > 0 ? precoParaTexto(item.desconto) : "",
    }));
    setDescontosAbertos((atual) => [...atual, produto_id]);
  }

  function definirDesconto(produto_id: number, valor: string) {
    const texto = valor.replace(/[^\d.,]/g, "");
    setDescontoTexto((atual) => ({ ...atual, [produto_id]: texto }));
    const desconto = Math.max(0, parseNumero(texto));
    setCarrinho((atual) =>
      atual.map((i) => {
        if (i.produto_id !== produto_id) return i;
        // O desconto não pode passar do valor bruto da linha.
        const bruto = i.preco_unitario * i.quantidade;
        return { ...i, desconto: Math.min(desconto, bruto) };
      })
    );
  }

  // Ao sair do campo, reescreve o texto no formato canônico ("12,5" → "12,50").
  function normalizarDesconto(produto_id: number) {
    const item = carrinho.find((i) => i.produto_id === produto_id);
    if (!item) return;
    setDescontoTexto((atual) =>
      produto_id in atual
        ? { ...atual, [produto_id]: precoParaTexto(item.desconto) }
        : atual
    );
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
      falhar("Informe o nome do cliente.");
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
      falhar(extrairErro(err));
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
    setPrecoTexto({});
    setDescontosAbertos([]);
    setDescontoTexto({});
    setBusca("");
    setNumParcelas(1);
    setVencimentos([]);
    setEntrega(false);
    setMostrarFechamento(false);
  }

  async function finalizar() {
    // Trava de reentrada: protege contra F2 repetido durante a requisição, que
    // gravaria a mesma venda duas vezes (o carrinho só é limpo no retorno).
    if (salvandoRef.current) return;
    if (carrinho.length === 0) {
      falhar("Adicione pelo menos um item à venda.");
      return;
    }
    if (formaPagamento === "fiado" && clienteId === "") {
      falhar("Venda a prazo exige um cliente. Selecione ou cadastre um.");
      return;
    }
    // Delivery: a entrega vai para o endereço cadastrado do cliente.
    let enderecoDelivery: string | undefined;
    if (entrega) {
      if (clienteId === "") {
        falhar("Delivery exige um cliente selecionado (com endereço).");
        return;
      }
      const cli = clientes.find((c) => c.id === clienteId);
      const end = (cli?.endereco ?? "").trim();
      if (!end) {
        falhar(
          "O cliente selecionado não tem endereço cadastrado. Edite o cliente para adicionar."
        );
        return;
      }
      enderecoDelivery = end;
    }

    // Monta o plano de parcelas quando a venda é a prazo (fiado).
    let parcelas: ParcelaCreate[] | undefined;
    if (formaPagamento === "fiado") {
      if (vencimentos.slice(0, numParcelas).some((d) => !d)) {
        falhar("Informe a data de vencimento de cada parcela.");
        return;
      }
      parcelas = valoresParcelas.map((valor, k) => ({
        numero: k + 1,
        valor: Number(valor.toFixed(2)),
        vencimento: vencimentos[k],
      }));
    }

    salvandoRef.current = true;
    setSalvando(true);
    setErro(null);

    const itens: ItemVendaCreate[] = carrinho.map((i) => ({
      produto_id: i.produto_id,
      quantidade: i.quantidade,
      preco_unitario: i.preco_unitario,
      ...(i.desconto > 0 ? { desconto: Number(i.desconto.toFixed(2)) } : {}),
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
      falhar(extrairErro(err));
    } finally {
      salvandoRef.current = false;
      setSalvando(false);
    }
  }

  return (
    <div className="page pdv-page">
      {/* Uma única faixa compacta: no balcão, cada pixel de altura vale mais
          como produto visível do que como cabeçalho. */}
      <header className="pdv-topbar">
        <div className="page-title">
          <span className="title-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="20" r="1.5" />
              <circle cx="18" cy="20" r="1.5" />
              <path d="M2 3h3l2.4 12.2a1.5 1.5 0 0 0 1.5 1.2h8.2a1.5 1.5 0 0 0 1.5-1.2L22 7H6" />
            </svg>
          </span>
          <h1>Ponto de venda</h1>
        </div>

        <div className="pdv-topbar-dir">
          <div className="pdv-atalhos">
            <span><kbd>F2</kbd> Finalizar</span>
            <span><kbd>F3</kbd> Buscar</span>
            <span><kbd>F4</kbd> Cliente</span>
            <span><kbd>Esc</kbd> Fechar</span>
          </div>
          <Link
            to="/vendas/historico"
            className="btn secundario pequeno"
            title="Histórico de vendas"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v5h5" />
              <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
              <path d="M12 7v5l4 2" />
            </svg>
            Histórico
          </Link>
        </div>
      </header>

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
                    disabled={semEstoque}
                    title={
                      semEstoque
                        ? `${p.nome} está sem estoque`
                        : `Adicionar ${p.nome}`
                    }
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
                            value={precoTexto[i.produto_id] ?? ""}
                            onChange={(e) =>
                              definirPreco(i.produto_id, e.target.value)
                            }
                            onBlur={() => normalizarPreco(i.produto_id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                alternarPreco(i.produto_id);
                              }
                            }}
                            aria-label={`Preço unitário de ${i.produto_nome}`}
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
                      <div className="pdv-item-subtotal-col">
                        {i.desconto > 0 && !descontosAbertos.includes(i.produto_id) && (
                          <span className="pdv-item-desconto-tag">
                            − {brl(i.desconto)}
                          </span>
                        )}
                        <span className="pdv-item-subtotal">
                          {brl(i.preco_unitario * i.quantidade - i.desconto)}
                        </span>
                      </div>
                    </div>
                    <div className="pdv-item-desconto-linha">
                      {descontosAbertos.includes(i.produto_id) ? (
                        <label className="pdv-item-preco pdv-item-desconto">
                          <span>desc. R$</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={descontoTexto[i.produto_id] ?? ""}
                            onChange={(e) =>
                              definirDesconto(i.produto_id, e.target.value)
                            }
                            onBlur={() => normalizarDesconto(i.produto_id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                alternarDesconto(i.produto_id);
                              }
                            }}
                            aria-label={`Desconto do item ${i.produto_nome}`}
                            autoFocus
                          />
                        </label>
                      ) : null}
                      <button
                        type="button"
                        className={`pdv-item-desconto-btn${descontosAbertos.includes(i.produto_id) ? " ativo" : ""}`}
                        onClick={() => alternarDesconto(i.produto_id)}
                      >
                        {descontosAbertos.includes(i.produto_id)
                          ? "Concluir desconto"
                          : i.desconto > 0
                            ? "Editar desconto"
                            : "Dar desconto no item"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              </div>
              {/* ↑ fim do corpo rolável (só os itens agora) */}

              {/* Resumo compacto sempre visível: total corrente + atalho para
                  abrir o fechamento. Cliente, pagamento, desconto e troco
                  moraram para o modal — não competem por altura com os itens. */}
              <div className="pdv-resumo-fixo">
                <div className="pdv-resumo-linha">
                  <span>{totalItens} {totalItens === 1 ? "item" : "itens"}</span>
                  <strong>{brl(totalLiquido)}</strong>
                </div>
                <button
                  className="btn primario pdv-finalizar"
                  onClick={() => setMostrarFechamento(true)}
                  disabled={carrinho.length === 0}
                >
                  Finalizar venda
                  <kbd className="pdv-kbd-btn">F2</kbd>
                </button>
              </div>
            </>
          )}
        </aside>
      </div>

      {mostrarFechamento && (
        <FechamentoVendaModal
          onFechar={() => setMostrarFechamento(false)}
          onConfirmar={finalizar}
          salvando={salvando}
          totalBruto={totalBruto}
          totalDescontoItens={totalDescontoItens}
          descontoValor={descontoValor}
          descontoPercentual={descontoPercentual}
          descontoExcedido={descontoExcedido}
          descontoPedido={descontoPedido}
          totalAposItens={totalAposItens}
          totalLiquido={totalLiquido}
          vendaZerada={vendaZerada}
          clientes={clientes}
          clienteId={clienteId}
          setClienteId={setClienteId}
          clienteSelecionado={clienteSelecionado}
          novoCliente={novoCliente}
          setNovoCliente={setNovoCliente}
          ncNome={ncNome}
          setNcNome={setNcNome}
          ncTelefone={ncTelefone}
          setNcTelefone={setNcTelefone}
          ncEmail={ncEmail}
          setNcEmail={setNcEmail}
          ncEndereco={ncEndereco}
          setNcEndereco={setNcEndereco}
          salvandoCliente={salvandoCliente}
          salvarNovoCliente={salvarNovoCliente}
          cancelarNovoCliente={cancelarNovoCliente}
          entrega={entrega}
          setEntrega={setEntrega}
          formaPagamento={formaPagamento}
          setFormaPagamento={setFormaPagamento}
          desconto={desconto}
          setDesconto={setDesconto}
          descontoTipo={descontoTipo}
          setDescontoTipo={setDescontoTipo}
          numParcelas={numParcelas}
          setNumParcelas={setNumParcelas}
          valoresParcelas={valoresParcelas}
          vencimentos={vencimentos}
          definirVencimento={definirVencimento}
          recebido={recebido}
          setRecebido={setRecebido}
          recebidoNum={recebidoNum}
          troco={troco}
          sugestoesRecebido={sugestoesRecebido}
        />
      )}

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
