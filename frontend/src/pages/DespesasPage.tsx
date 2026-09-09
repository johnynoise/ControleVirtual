import { useEffect, useMemo, useState } from "react";
import type {
  CategoriaDespesaOpcao,
  Despesa,
  DespesaCreate,
  EscopoRecorrencia,
  FiltrosDespesa,
  Fornecedor,
  ResumoDespesas,
  SituacaoDespesa,
} from "../types";
import {
  atualizarDespesa,
  criarDespesa,
  listarCategoriasDespesa,
  listarDespesas,
  obterResumoDespesas,
  pagarDespesa,
  removerDespesa,
} from "../services/despesas";
import { listarFornecedores } from "../services/fornecedores";
import { brl, dataBR, extrairErro, parseNumero } from "../lib/ui";
import Paginacao from "../components/Paginacao";
import EstadoVazio from "../components/EstadoVazio";
import EstadoErro from "../components/EstadoErro";
import ThOrdenavel from "../components/ThOrdenavel";
import { ordenar, proximaOrdenacao, type EstadoOrdenacao } from "../lib/ordenacao";
import { SkeletonTabela } from "../components/Skeleton";
import { useConfirm, useToast } from "../components/Feedback";

const POR_PAGINA = 12;

// Teto de lançamentos gerados por uma despesa fixa (espelha o backend).
const MAX_RECORRENCIAS = 60;

type CampoDespesa = "competencia" | "descricao" | "categoria" | "valor" | "situacao";

/**
 * Os dois tipos de despesa do formulário. É a primeira e mais importante
 * escolha do lançamento: "avulsa" aconteceu uma vez, "fixa" repete todo mês e
 * gera um lançamento por mês.
 */
type TipoDespesa = "avulsa" | "fixa";

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

// Formas de pagamento oferecidas no lançamento (o campo é livre no backend).
const FORMAS_PAGAMENTO: { valor: string; rotulo: string }[] = [
  { valor: "dinheiro", rotulo: "Dinheiro" },
  { valor: "pix", rotulo: "Pix" },
  { valor: "cartao_debito", rotulo: "Cartão de débito" },
  { valor: "cartao_credito", rotulo: "Cartão de crédito" },
  { valor: "boleto", rotulo: "Boleto" },
  { valor: "transferencia", rotulo: "Transferência" },
  { valor: "outro", rotulo: "Outro" },
];

const SITUACOES: { valor: SituacaoDespesa; rotulo: string }[] = [
  { valor: "todas", rotulo: "Todas" },
  { valor: "paga", rotulo: "Pagas" },
  { valor: "aberta", rotulo: "Em aberto" },
];

const icone = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 3h11l3 3v15l-2.5-1.5L14 21l-2.5-1.5L9 21l-2.5-1.5L4 21V3z" />
    <path d="M8 8h7" />
    <path d="M8 12h7" />
    <path d="M8 16h4" />
  </svg>
);

/** Data de hoje no formato aceito pelo input date e pela API (YYYY-MM-DD). */
function hojeISO(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** Ano e mês de uma data ISO, como par de números. */
function anoMes(iso: string): [number, number] {
  const [ano, mes] = iso.split("-").map(Number);
  return [ano || 0, mes || 0];
}

/** Rótulo de um mês/ano no formato "dezembro de 2026". */
function rotuloMesAno(ano: number, mes: number): string {
  return `${MESES[mes - 1].toLowerCase()} de ${ano}`;
}

/**
 * Mês final sugerido para a repetição: dezembro do ano da competência. Quando
 * sobram menos de três meses no ano, estica até dezembro do ano seguinte —
 * lançar uma despesa fixa em dezembro e gerar um mês só não ajuda ninguém.
 */
function padraoRepetirAte(competencia: string): string {
  const [ano, mes] = anoMes(competencia);
  return `${12 - mes < 2 ? ano + 1 : ano}-12`;
}

/** Quantos meses vão de uma competência até o mês final, inclusive. */
function contarMeses(competencia: string, ate: string): number {
  const [a1, m1] = anoMes(competencia);
  const [a2, m2] = anoMes(ate);
  if (!a1 || !a2) return 0;
  return Math.max(0, (a2 - a1) * 12 + (m2 - m1) + 1);
}

function formVazio(): DespesaCreate {
  return {
    descricao: "",
    categoria: "aluguel",
    valor: "",
    data_competencia: hojeISO(),
    data_pagamento: "",
    forma_pagamento: "",
    fornecedor_id: null,
    documento: "",
    operacional: true,
    recorrente: false,
    observacao: "",
  };
}

export default function DespesasPage() {
  const toast = useToast();
  const confirmar = useConfirm();

  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [resumo, setResumo] = useState<ResumoDespesas | null>(null);
  const [categorias, setCategorias] = useState<CategoriaDespesaOpcao[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Período: ano + mês (0 = ano inteiro). É o recorte por competência.
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(anoAtual);
  const [mes, setMes] = useState(0);

  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [situacao, setSituacao] = useState<SituacaoDespesa>("todas");
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");

  const [pagina, setPagina] = useState(1);
  const [ord, setOrd] = useState<EstadoOrdenacao<CampoDespesa>>({
    campo: "competencia",
    direcao: "desc",
  });
  const ordenarPor = (campo: CampoDespesa) => setOrd((o) => proximaOrdenacao(o, campo));

  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [form, setForm] = useState<DespesaCreate>(formVazio());
  const [operacionalTocado, setOperacionalTocado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  // Tipo escolhido no primeiro passo do modal. Nulo = ainda escolhendo.
  const [tipo, setTipo] = useState<TipoDespesa | null>(null);
  // Mês final da repetição, no formato "YYYY-MM".
  const [repetirAte, setRepetirAte] = useState("");
  const [repetirAteTocado, setRepetirAteTocado] = useState(false);
  // Campos opcionais, recolhidos por padrão.
  const [detalhes, setDetalhes] = useState(false);

  // Pedido de escopo ao mexer num lançamento de despesa fixa. Guarda a função
  // que resolve a Promise, no mesmo padrão do useConfirm global.
  const [pedidoEscopo, setPedidoEscopo] = useState<{
    acao: "salvar" | "excluir";
    resolve: (escopo: EscopoRecorrencia | null) => void;
  } | null>(null);

  const edicao = editandoId !== null;

  // Início e fim do período (o mês 0 cobre o ano inteiro).
  const { inicio, fim } = useMemo(() => {
    if (mes === 0) {
      return { inicio: `${ano}-01-01`, fim: `${ano}-12-31` };
    }
    const mm = String(mes).padStart(2, "0");
    const ultimoDia = new Date(ano, mes, 0).getDate();
    return { inicio: `${ano}-${mm}-01`, fim: `${ano}-${mm}-${ultimoDia}` };
  }, [ano, mes]);

  // Debounce da busca: evita uma requisição por tecla digitada.
  useEffect(() => {
    const t = setTimeout(() => setBuscaAplicada(busca.trim()), 300);
    return () => clearTimeout(t);
  }, [busca]);

  const filtros: FiltrosDespesa = useMemo(
    () => ({
      inicio,
      fim,
      categoria: categoriaFiltro || undefined,
      situacao: situacao === "todas" ? undefined : situacao,
      busca: buscaAplicada || undefined,
    }),
    [inicio, fim, categoriaFiltro, situacao, buscaAplicada]
  );

  // Listas auxiliares do formulário, carregadas uma vez.
  useEffect(() => {
    listarCategoriasDespesa()
      .then(setCategorias)
      .catch(() => setCategorias([]));
    listarFornecedores({ apenas_ativos: true })
      .then(setFornecedores)
      .catch(() => setFornecedores([]));
  }, []);

  async function carregar(filtrosAtuais: FiltrosDespesa) {
    setCarregando(true);
    setErro(null);
    try {
      const [lista, res] = await Promise.all([
        listarDespesas(filtrosAtuais),
        obterResumoDespesas(filtrosAtuais),
      ]);
      setDespesas(lista);
      setResumo(res);
    } catch (err) {
      setErro(extrairErro(err));
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar(filtros);
  }, [filtros]);

  // Ao mudar período, filtro ou busca, volta para a primeira página.
  useEffect(() => {
    setPagina(1);
  }, [filtros]);

  const despesasOrdenadas = useMemo(
    () =>
      ordenar(despesas, ord, (d, campo) => {
        if (campo === "descricao") return d.descricao;
        if (campo === "categoria") return d.categoria_rotulo;
        if (campo === "valor") return parseFloat(d.valor);
        if (campo === "situacao") return d.paga ? 1 : 0;
        return d.data_competencia;
      }),
    [despesas, ord]
  );

  const totalPaginas = Math.max(1, Math.ceil(despesasOrdenadas.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = despesasOrdenadas.slice(
    (paginaAtual - 1) * POR_PAGINA,
    paginaAtual * POR_PAGINA
  );

  const anos = useMemo(
    () => Array.from({ length: 6 }, (_, i) => anoAtual - i),
    [anoAtual]
  );

  function abrirNovo() {
    const vazio = formVazio();
    setEditandoId(null);
    setForm(vazio);
    setOperacionalTocado(false);
    setRepetirAte(padraoRepetirAte(vazio.data_competencia));
    setRepetirAteTocado(false);
    setDetalhes(false);
    // Sem tipo: o modal abre no passo da escolha.
    setTipo(null);
    setErroForm(null);
    setModalAberto(true);
  }

  function abrirEditar(d: Despesa) {
    setEditandoId(d.id);
    setForm({
      descricao: d.descricao,
      categoria: d.categoria,
      valor: d.valor,
      data_competencia: d.data_competencia,
      data_pagamento: d.data_pagamento ?? "",
      forma_pagamento: d.forma_pagamento ?? "",
      fornecedor_id: d.fornecedor_id ?? null,
      documento: d.documento ?? "",
      operacional: d.operacional,
      recorrente: d.recorrente,
      observacao: d.observacao ?? "",
    });
    // Na edição a marcação já é uma escolha feita: não sobrescreve.
    setOperacionalTocado(true);
    setTipo(d.recorrente ? "fixa" : "avulsa");
    setRepetirAte(padraoRepetirAte(d.data_competencia));
    setRepetirAteTocado(false);
    // Abre os opcionais já preenchidos, para a edição não parecer que os perdeu.
    setDetalhes(
      Boolean(d.forma_pagamento || d.documento || d.fornecedor_id || d.observacao)
    );
    setErroForm(null);
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setEditandoId(null);
    setForm(formVazio());
    setOperacionalTocado(false);
    setTipo(null);
    setRepetirAte("");
    setRepetirAteTocado(false);
    setDetalhes(false);
    setErroForm(null);
  }

  /** Volta ao primeiro passo para trocar o tipo, preservando o que foi digitado. */
  function trocarTipo() {
    setTipo(null);
    setErroForm(null);
  }

  /** Escolhe o tipo e segue para os campos. */
  function escolherTipo(novo: TipoDespesa) {
    setTipo(novo);
    if (novo === "fixa" && !repetirAteTocado) {
      setRepetirAte(padraoRepetirAte(form.data_competencia));
    }
  }

  /** Troca a competência e, se o usuário não mexeu, reajusta o fim da repetição. */
  function setCompetencia(valor: string) {
    setForm((f) => ({ ...f, data_competencia: valor }));
    if (!repetirAteTocado && valor) setRepetirAte(padraoRepetirAte(valor));
  }

  // Opções do "repetir até": dois anos de meses a partir da competência.
  const opcoesRepetirAte = useMemo(() => {
    const [ano, mes] = anoMes(form.data_competencia);
    if (!ano) return [];
    return Array.from({ length: 24 }, (_, i) => {
      const total = mes - 1 + i;
      const a = ano + Math.floor(total / 12);
      const m = (total % 12) + 1;
      return {
        valor: `${a}-${String(m).padStart(2, "0")}`,
        rotulo: rotuloMesAno(a, m),
      };
    });
  }, [form.data_competencia]);

  const mesesGerados = contarMeses(form.data_competencia, repetirAte);

  // Se a competência passar do mês final escolhido, volta para a sugestão.
  useEffect(() => {
    if (tipo !== "fixa") return;
    if (contarMeses(form.data_competencia, repetirAte) < 1) {
      setRepetirAte(padraoRepetirAte(form.data_competencia));
    }
  }, [tipo, form.data_competencia, repetirAte]);

  // Grupo de recorrência do lançamento em edição: define se cabe perguntar o
  // escopo (só esta ou esta e as próximas).
  const grupoEditado = useMemo(
    () => despesas.find((d) => d.id === editandoId)?.grupo_recorrencia ?? null,
    [despesas, editandoId]
  );

  /** Abre o modal de escopo e resolve com a escolha (nulo = cancelou). */
  function pedirEscopo(acao: "salvar" | "excluir") {
    return new Promise<EscopoRecorrencia | null>((resolve) =>
      setPedidoEscopo({ acao, resolve })
    );
  }

  function responderEscopo(escopo: EscopoRecorrencia | null) {
    pedidoEscopo?.resolve(escopo);
    setPedidoEscopo(null);
  }

  function setCampo<K extends keyof DespesaCreate>(chave: K, valor: DespesaCreate[K]) {
    setForm((f) => ({ ...f, [chave]: valor }));
  }

  /** Troca a categoria e, se o usuário não mexeu na marcação, segue o padrão. */
  function trocarCategoria(valor: string) {
    const opcao = categorias.find((c) => c.valor === valor);
    setForm((f) => ({
      ...f,
      categoria: valor,
      operacional: operacionalTocado ? f.operacional : opcao?.operacional_padrao ?? true,
    }));
  }

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault();
    setErroForm(null);

    const valorNumero = parseNumero(form.valor);
    if (valorNumero <= 0) {
      setErroForm("Informe um valor maior que zero.");
      return;
    }

    const fixa = tipo === "fixa";
    if (fixa && !edicao && (mesesGerados < 1 || mesesGerados > MAX_RECORRENCIAS)) {
      setErroForm("Escolha um mês final de repetição dentro dos próximos cinco anos.");
      return;
    }

    const payload: DespesaCreate = {
      ...form,
      descricao: form.descricao.trim(),
      valor: Number(valorNumero.toFixed(2)),
      // No lançamento de uma fixa todos os meses nascem em aberto: o pagamento
      // é registrado mês a mês pelo botão Pagar da lista.
      data_pagamento: (fixa && !edicao ? null : form.data_pagamento) || null,
      forma_pagamento: form.forma_pagamento || null,
      documento: form.documento?.trim() || null,
      observacao: form.observacao?.trim() || null,
      fornecedor_id: form.fornecedor_id ?? null,
      recorrente: fixa,
      repetir_ate: fixa && !edicao ? `${repetirAte}-01` : null,
    };

    // Mexer num mês de uma despesa fixa é ambíguo: pergunta o alcance antes.
    let escopo: EscopoRecorrencia = "esta";
    if (edicao && grupoEditado) {
      const escolha = await pedirEscopo("salvar");
      if (escolha === null) return;
      escopo = escolha;
    }

    setSalvando(true);
    try {
      if (editandoId === null) {
        const lote = await criarDespesa(payload);
        fecharModal();
        await carregar(filtros);
        toast.sucesso(
          lote.quantidade > 1
            ? `Despesa fixa lançada em ${lote.quantidade} meses.`
            : "Despesa lançada."
        );
        return;
      }

      await atualizarDespesa(editandoId, payload, escopo);
      fecharModal();
      await carregar(filtros);
      toast.sucesso(
        escopo === "esta_e_proximas"
          ? "Despesa salva neste mês e nos próximos."
          : "Despesa salva."
      );
    } catch (err) {
      setErroForm(extrairErro(err));
    } finally {
      setSalvando(false);
    }
  }

  async function marcarPaga(d: Despesa) {
    try {
      await pagarDespesa(d.id);
      await carregar(filtros);
      toast.sucesso("Despesa marcada como paga.");
    } catch (err) {
      toast.erro(extrairErro(err));
    }
  }

  async function excluir(d: Despesa) {
    let escopo: EscopoRecorrencia = "esta";

    if (d.grupo_recorrencia) {
      // Faz parte de uma despesa fixa: o escopo já é a própria confirmação.
      const escolha = await pedirEscopo("excluir");
      if (escolha === null) return;
      escopo = escolha;
    } else {
      const ok = await confirmar({
        titulo: "Remover despesa",
        mensagem: `Tem certeza que deseja remover "${d.descricao}"?`,
        confirmar: "Remover",
        perigo: true,
      });
      if (!ok) return;
    }

    try {
      const removidas = await removerDespesa(d.id, escopo);
      await carregar(filtros);
      toast.sucesso(
        removidas > 1 ? `${removidas} lançamentos removidos.` : "Despesa removida."
      );
    } catch (err) {
      toast.erro(extrairErro(err));
    }
  }

  const rotuloPeriodo = mes === 0 ? `ano de ${ano}` : `${MESES[mes - 1]} de ${ano}`;
  const temFiltroAtivo = Boolean(categoriaFiltro || buscaAplicada || situacao !== "todas");

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <span className="title-icon">{icone}</span>
          <h1>Despesas</h1>
        </div>
        <button className="btn primario" onClick={abrirNovo}>
          + Nova despesa
        </button>
      </div>

      <p className="subtitle">
        Tudo que sai de dinheiro e não é compra de mercadoria: aluguel, energia,
        embalagem, taxa de maquininha, imposto, retirada do dono. A compra de
        mercadoria continua sendo registrada como entrada de estoque.
      </p>

      {erro && despesas.length > 0 && <div className="alert erro">{erro}</div>}

      <div className="kpis">
        <div className="kpi">
          <span className="kpi-label">Total do período</span>
          <span className="kpi-valor">{brl(resumo?.total ?? 0)}</span>
          <span className="kpi-sub">
            {resumo?.quantidade ?? 0}{" "}
            {resumo?.quantidade === 1 ? "lançamento" : "lançamentos"} · {rotuloPeriodo}
          </span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Despesa operacional</span>
          <span className="kpi-valor vermelho">{brl(resumo?.total_operacional ?? 0)}</span>
          <span className="kpi-sub">entra na apuração do resultado</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Não operacional</span>
          <span className="kpi-valor">{brl(resumo?.total_nao_operacional ?? 0)}</span>
          <span className="kpi-sub">retirada do dono, compra de bem</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Em aberto</span>
          <span className="kpi-valor ambar">{brl(resumo?.total_em_aberto ?? 0)}</span>
          <span className="kpi-sub">pago: {brl(resumo?.total_pago ?? 0)}</span>
        </div>
      </div>

      <div className="toolbar">
        <div className="busca">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4-4" />
          </svg>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar pela descrição..."
          />
        </div>

        <select
          className="filtro-select"
          value={mes}
          onChange={(e) => setMes(Number(e.target.value))}
          aria-label="Mês de competência"
        >
          <option value={0}>Ano inteiro</option>
          {MESES.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>

        <select
          className="filtro-select"
          value={ano}
          onChange={(e) => setAno(Number(e.target.value))}
          aria-label="Ano de competência"
        >
          {anos.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>

        <select
          className="filtro-select"
          value={categoriaFiltro}
          onChange={(e) => setCategoriaFiltro(e.target.value)}
          aria-label="Categoria"
        >
          <option value="">Todas as categorias</option>
          {categorias.map((c) => (
            <option key={c.valor} value={c.valor}>
              {c.rotulo}
            </option>
          ))}
        </select>

        <div className="periodo-tabs">
          {SITUACOES.map((s) => (
            <button
              key={s.valor}
              className={`btn ${situacao === s.valor ? "primario" : "secundario"} pequeno`}
              onClick={() => setSituacao(s.valor)}
            >
              {s.rotulo}
            </button>
          ))}
        </div>

        <span className="contagem">
          {despesas.length} {despesas.length === 1 ? "despesa" : "despesas"}
        </span>
      </div>

      <div className="card">
        {carregando ? (
          <SkeletonTabela />
        ) : erro && despesas.length === 0 ? (
          <EstadoErro mensagem={erro} onTentarNovamente={() => carregar(filtros)} />
        ) : despesas.length === 0 ? (
          <EstadoVazio
            titulo={
              temFiltroAtivo
                ? "Nenhuma despesa encontrada"
                : `Nenhuma despesa lançada em ${rotuloPeriodo}`
            }
            descricao={
              temFiltroAtivo
                ? "Ajuste a busca, a categoria ou a situação para ver outros lançamentos."
                : "Lance aluguel, energia, embalagem e as outras saídas do período. É o que falta para apurar o resultado do negócio."
            }
            acao={
              temFiltroAtivo
                ? undefined
                : { rotulo: "Lançar primeira despesa", onClick: abrirNovo }
            }
          />
        ) : (
          <table className="tabela">
            <thead>
              <tr>
                <ThOrdenavel campo="competencia" estado={ord} onOrdenar={ordenarPor}>
                  Competência
                </ThOrdenavel>
                <ThOrdenavel campo="descricao" estado={ord} onOrdenar={ordenarPor}>
                  Descrição
                </ThOrdenavel>
                <ThOrdenavel campo="categoria" estado={ord} onOrdenar={ordenarPor}>
                  Categoria
                </ThOrdenavel>
                <th>Fornecedor / Documento</th>
                <ThOrdenavel campo="valor" estado={ord} onOrdenar={ordenarPor} className="num">
                  Valor
                </ThOrdenavel>
                <ThOrdenavel campo="situacao" estado={ord} onOrdenar={ordenarPor}>
                  Situação
                </ThOrdenavel>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((d) => (
                <tr key={d.id}>
                  <td>{dataBR(d.data_competencia)}</td>
                  <td>
                    <div className="contato-linha">
                      <strong>{d.descricao}</strong>
                      {d.recorrente && <span className="muted">fixa mensal</span>}
                    </div>
                  </td>
                  <td>
                    <div className="contato-linha">
                      <span>{d.categoria_rotulo}</span>
                      {!d.operacional && (
                        <span className="muted">não operacional</span>
                      )}
                    </div>
                  </td>
                  <td>
                    {d.fornecedor_nome || d.documento ? (
                      <div className="contato-linha">
                        {d.fornecedor_nome && <span>{d.fornecedor_nome}</span>}
                        {d.documento && <span className="muted">{d.documento}</span>}
                      </div>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="num">{brl(d.valor)}</td>
                  <td>
                    <span className={`chip ${d.paga ? "quitado" : "alerta"}`}>
                      {d.paga ? `Paga ${dataBR(d.data_pagamento)}` : "Em aberto"}
                    </span>
                  </td>
                  <td className="acoes">
                    {!d.paga && (
                      <button
                        className="btn secundario pequeno"
                        onClick={() => marcarPaga(d)}
                        title="Marcar como paga hoje"
                      >
                        Pagar
                      </button>
                    )}
                    <button className="btn secundario pequeno" onClick={() => abrirEditar(d)}>
                      Editar
                    </button>
                    <button className="btn perigo pequeno" onClick={() => excluir(d)}>
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!carregando && despesas.length > 0 && (
          <Paginacao pagina={paginaAtual} totalPaginas={totalPaginas} onChange={setPagina} />
        )}
      </div>

      {!carregando && resumo && resumo.por_categoria.length > 0 && (
        <div className="grid-2">
          <div className="card">
            <h2>Por categoria</h2>
            <table className="tabela">
              <thead>
                <tr>
                  <th>Categoria</th>
                  <th className="num">Lanç.</th>
                  <th className="num">Total</th>
                  <th className="num">%</th>
                </tr>
              </thead>
              <tbody>
                {resumo.por_categoria.map((l) => (
                  <tr key={l.categoria}>
                    <td>{l.categoria_rotulo}</td>
                    <td className="num">{l.quantidade}</td>
                    <td className="num">{brl(l.total)}</td>
                    <td className="num muted">{l.percentual}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h2>Mês a mês</h2>
            <p className="subtitle">
              Agrupado pela competência. É esta a base do relatório anual.
            </p>
            <table className="tabela">
              <thead>
                <tr>
                  <th>Mês</th>
                  <th className="num">Lanç.</th>
                  <th className="num">Total</th>
                  <th className="num">Operacional</th>
                </tr>
              </thead>
              <tbody>
                {resumo.por_mes.map((l) => (
                  <tr key={`${l.ano}-${l.mes}`}>
                    <td>{l.rotulo}</td>
                    <td className="num">{l.quantidade}</td>
                    <td className="num">{brl(l.total)}</td>
                    <td className="num">{brl(l.total_operacional)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalAberto && (
        <div className="recibo-overlay" onClick={fecharModal}>
          {tipo === null ? (
            // Passo 1: a escolha do tipo. Define tudo o que vem depois.
            <div className="modal-box form" onClick={(e) => e.stopPropagation()}>
              <h2>Nova despesa</h2>
              <p className="subtitle">
                Aconteceu uma vez ou se repete todo mês?
              </p>

              <div className="despesa-tipos">
                <button
                  type="button"
                  className="despesa-tipo"
                  onClick={() => escolherTipo("avulsa")}
                  autoFocus
                >
                  <span className="despesa-tipo-titulo">Despesa do mês</span>
                  <span className="despesa-tipo-desc">
                    Aconteceu uma vez: conserto, frete, compra de embalagem.
                  </span>
                </button>
                <button
                  type="button"
                  className="despesa-tipo"
                  onClick={() => escolherTipo("fixa")}
                >
                  <span className="despesa-tipo-titulo">Despesa fixa mensal</span>
                  <span className="despesa-tipo-desc">
                    Repete todo mês: aluguel, internet, contador. Lança os meses
                    de uma vez.
                  </span>
                </button>
              </div>

              <div className="form-acoes">
                <button type="button" className="btn secundario" onClick={fecharModal}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            // Passo 2: os campos, enxutos. O que é opcional fica recolhido.
            <form
              className="modal-box form"
              onClick={(e) => e.stopPropagation()}
              onSubmit={salvar}
            >
              <h2>
                {edicao
                  ? "Editar despesa"
                  : tipo === "fixa"
                    ? "Nova despesa fixa mensal"
                    : "Nova despesa do mês"}
              </h2>

              {!edicao && (
                <button type="button" className="trocar-tipo" onClick={trocarTipo}>
                  ← escolher outro tipo
                </button>
              )}
              {edicao && grupoEditado && (
                <p className="subtitle">
                  Este lançamento é um dos meses de uma despesa fixa.
                </p>
              )}

              {erroForm && <div className="alert erro">{erroForm}</div>}

              <label style={{ marginBottom: "1rem" }}>
                Descrição
                <input
                  value={form.descricao}
                  onChange={(e) => setCampo("descricao", e.target.value)}
                  placeholder={
                    tipo === "fixa" ? "Ex.: Aluguel da loja" : "Ex.: Conserto da vitrine"
                  }
                  required
                  autoFocus
                />
              </label>

              <div className="grid-2">
                <label>
                  Categoria
                  <select
                    value={form.categoria}
                    onChange={(e) => trocarCategoria(e.target.value)}
                    required
                  >
                    {categorias.map((c) => (
                      <option key={c.valor} value={c.valor}>
                        {c.rotulo}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Valor
                  <input
                    inputMode="decimal"
                    value={form.valor}
                    onChange={(e) => setCampo("valor", e.target.value)}
                    placeholder="0,00"
                    required
                  />
                </label>
              </div>

              {tipo === "fixa" && !edicao ? (
                <>
                  <div className="grid-2">
                    <label>
                      Primeiro vencimento
                      <input
                        type="date"
                        value={form.data_competencia}
                        onChange={(e) => setCompetencia(e.target.value)}
                        required
                      />
                    </label>
                    <label>
                      Repetir até
                      <select
                        value={repetirAte}
                        onChange={(e) => {
                          setRepetirAteTocado(true);
                          setRepetirAte(e.target.value);
                        }}
                      >
                        {opcoesRepetirAte.map((o) => (
                          <option key={o.valor} value={o.valor}>
                            {o.rotulo}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <p className="previa-fixa">
                    Cria <strong>{mesesGerados}</strong>{" "}
                    {mesesGerados === 1 ? "lançamento" : "lançamentos"} em aberto, um
                    por mês
                    {parseNumero(form.valor) > 0
                      ? `, de ${brl(parseNumero(form.valor))} cada`
                      : ""}
                    . Cada mês é pago e editado separadamente.
                  </p>
                </>
              ) : (
                <>
                  <div className="grid-2">
                    <label>
                      {tipo === "fixa" ? "Vencimento deste mês" : "Data"}
                      <input
                        type="date"
                        value={form.data_competencia}
                        onChange={(e) => setCompetencia(e.target.value)}
                        required
                      />
                    </label>
                    {form.data_pagamento ? (
                      <label>
                        Pago em
                        <input
                          type="date"
                          value={form.data_pagamento}
                          onChange={(e) => setCampo("data_pagamento", e.target.value)}
                        />
                      </label>
                    ) : null}
                  </div>

                  <label className="check">
                    <input
                      type="checkbox"
                      checked={Boolean(form.data_pagamento)}
                      onChange={(e) =>
                        setCampo(
                          "data_pagamento",
                          e.target.checked ? form.data_competencia : ""
                        )
                      }
                    />
                    Já foi paga
                  </label>
                  <p className="subtitle" style={{ marginTop: "-0.5rem" }}>
                    Sem marcar, fica em aberto e você usa o botão Pagar na lista.
                  </p>
                </>
              )}

              <button
                type="button"
                className="form-mais"
                onClick={() => setDetalhes((v) => !v)}
                aria-expanded={detalhes}
              >
                <span className="form-mais-sinal">{detalhes ? "−" : "+"}</span>
                Fornecedor, nota, forma de pagamento
              </button>

              {detalhes && (
                <div className="form-mais-conteudo">
                  <div className="grid-2">
                    <label>
                      Forma de pagamento
                      <select
                        value={form.forma_pagamento ?? ""}
                        onChange={(e) => setCampo("forma_pagamento", e.target.value)}
                      >
                        <option value="">Não informada</option>
                        {FORMAS_PAGAMENTO.map((f) => (
                          <option key={f.valor} value={f.valor}>
                            {f.rotulo}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Nota / recibo
                      <input
                        value={form.documento ?? ""}
                        onChange={(e) => setCampo("documento", e.target.value)}
                        placeholder="Opcional"
                      />
                    </label>
                  </div>

                  <label style={{ marginBottom: "1rem" }}>
                    Fornecedor / prestador
                    <select
                      value={form.fornecedor_id ?? ""}
                      onChange={(e) =>
                        setCampo(
                          "fornecedor_id",
                          e.target.value ? Number(e.target.value) : null
                        )
                      }
                    >
                      <option value="">Nenhum</option>
                      {fornecedores.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.nome}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={{ marginBottom: "1rem" }}>
                    Observação
                    <textarea
                      value={form.observacao ?? ""}
                      onChange={(e) => setCampo("observacao", e.target.value)}
                      rows={2}
                      placeholder="Opcional"
                    />
                  </label>

                  <label className="check">
                    <input
                      type="checkbox"
                      checked={form.operacional ?? true}
                      onChange={(e) => {
                        setOperacionalTocado(true);
                        setCampo("operacional", e.target.checked);
                      }}
                    />
                    Entra na apuração do resultado
                  </label>
                  <p className="subtitle" style={{ marginTop: "-0.5rem" }}>
                    A categoria já define isto. Desmarque só se for retirada do dono
                    ou compra de bem: saem dinheiro, mas não são despesa do período.
                  </p>
                </div>
              )}

              <div className="form-acoes">
                <button
                  className="btn primario"
                  type="submit"
                  disabled={salvando || (tipo === "fixa" && !edicao && mesesGerados < 1)}
                >
                  {salvando
                    ? "Salvando..."
                    : edicao
                      ? "Salvar"
                      : tipo === "fixa"
                        ? mesesGerados > 0
                          ? `Lançar ${mesesGerados} ${mesesGerados === 1 ? "mês" : "meses"}`
                          : "Lançar despesa fixa"
                        : "Lançar despesa"}
                </button>
                <button type="button" className="btn secundario" onClick={fecharModal}>
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {pedidoEscopo && (
        <div className="recibo-overlay" onClick={() => responderEscopo(null)}>
          <div
            className="modal-box modal-confirm"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h2>
              {pedidoEscopo.acao === "excluir"
                ? "Remover qual alcance?"
                : "Aplicar em qual alcance?"}
            </h2>
            <p className="muted" style={{ marginTop: "0.35rem" }}>
              Esta despesa é fixa mensal. Os meses já passados não são alterados.
            </p>
            <div className="escopo-acoes">
              <button
                type="button"
                className={`btn ${pedidoEscopo.acao === "excluir" ? "perigo" : "primario"}`}
                onClick={() => responderEscopo("esta")}
                autoFocus
              >
                Só este mês
              </button>
              <button
                type="button"
                className={`btn ${pedidoEscopo.acao === "excluir" ? "perigo" : "primario"}`}
                onClick={() => responderEscopo("esta_e_proximas")}
              >
                Este mês e os próximos
              </button>
              <button
                type="button"
                className="btn secundario"
                onClick={() => responderEscopo(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
