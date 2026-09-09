import { useEffect, useMemo, useState } from "react";
import type {
  CategoriaDespesaOpcao,
  Despesa,
  DespesaCreate,
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

type CampoDespesa = "competencia" | "descricao" | "categoria" | "valor" | "situacao";

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
    setEditandoId(null);
    setForm(formVazio());
    setOperacionalTocado(false);
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
    setErroForm(null);
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setEditandoId(null);
    setForm(formVazio());
    setOperacionalTocado(false);
    setErroForm(null);
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

    const payload: DespesaCreate = {
      ...form,
      descricao: form.descricao.trim(),
      valor: Number(valorNumero.toFixed(2)),
      data_pagamento: form.data_pagamento || null,
      forma_pagamento: form.forma_pagamento || null,
      documento: form.documento?.trim() || null,
      observacao: form.observacao?.trim() || null,
      fornecedor_id: form.fornecedor_id ?? null,
    };

    setSalvando(true);
    try {
      const edicao = editandoId !== null;
      if (editandoId === null) {
        await criarDespesa(payload);
      } else {
        await atualizarDespesa(editandoId, payload);
      }
      fecharModal();
      await carregar(filtros);
      toast.sucesso(edicao ? "Despesa salva." : "Despesa lançada.");
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
    const ok = await confirmar({
      titulo: "Remover despesa",
      mensagem: `Tem certeza que deseja remover "${d.descricao}"?`,
      confirmar: "Remover",
      perigo: true,
    });
    if (!ok) return;
    try {
      await removerDespesa(d.id);
      await carregar(filtros);
      toast.sucesso("Despesa removida.");
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
                      {d.recorrente && <span className="muted">mensal</span>}
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
          <form
            className="modal-box form"
            onClick={(e) => e.stopPropagation()}
            onSubmit={salvar}
          >
            <h2>{editandoId === null ? "Nova despesa" : "Editar despesa"}</h2>

            {erroForm && <div className="alert erro">{erroForm}</div>}

            <label style={{ marginBottom: "1rem" }}>
              Descrição
              <input
                value={form.descricao}
                onChange={(e) => setCampo("descricao", e.target.value)}
                placeholder="Ex.: Aluguel da loja - janeiro"
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

            <div className="grid-2">
              <label>
                Competência (mês a que se refere)
                <input
                  type="date"
                  value={form.data_competencia}
                  onChange={(e) => setCampo("data_competencia", e.target.value)}
                  required
                />
              </label>
              <label>
                Data do pagamento
                <input
                  type="date"
                  value={form.data_pagamento ?? ""}
                  onChange={(e) => setCampo("data_pagamento", e.target.value)}
                />
              </label>
            </div>
            <p className="subtitle" style={{ marginBottom: "1rem" }}>
              Sem data de pagamento, a despesa fica como “em aberto”.
            </p>

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
                  setCampo("fornecedor_id", e.target.value ? Number(e.target.value) : null)
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

            <label className="check">
              <input
                type="checkbox"
                checked={form.operacional}
                onChange={(e) => {
                  setOperacionalTocado(true);
                  setCampo("operacional", e.target.checked);
                }}
              />
              Entra na apuração do resultado
            </label>
            <p className="subtitle" style={{ marginTop: "-0.5rem" }}>
              Desmarque para retirada do dono e compra de bem: são saídas de
              dinheiro, mas não despesa do período.
            </p>

            <label className="check">
              <input
                type="checkbox"
                checked={form.recorrente}
                onChange={(e) => setCampo("recorrente", e.target.checked)}
              />
              Despesa mensal (se repete todo mês)
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

            <div className="form-acoes">
              <button className="btn primario" type="submit" disabled={salvando}>
                {salvando
                  ? "Salvando..."
                  : editandoId === null
                    ? "Lançar despesa"
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
