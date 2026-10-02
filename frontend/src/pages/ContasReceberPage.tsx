import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { ContaReceber, ParcelaAReceber, Venda } from "../types";
import {
  listarContasReceber,
  listarFiadoDoCliente,
  listarParcelasAReceber,
} from "../services/vendas";
import EstadoVazio from "../components/EstadoVazio";
import EstadoErro from "../components/EstadoErro";
import ReceberPagamentoModal from "../components/ReceberPagamentoModal";
import RenegociarDividaModal from "../components/RenegociarDividaModal";
import CalendarioRecebimentos from "../components/CalendarioRecebimentos";
import Paginacao from "../components/Paginacao";
import { SkeletonTabela } from "../components/Skeleton";
import {
  statusParcelas,
  dataQuitacaoVenda,
  montarMensagemCobranca,
} from "../lib/fiado";
import {
  brl,
  dataBR,
  dataHora,
  extrairErro,
  linkWhatsapp,
  WHATSAPP_PATH,
} from "../lib/ui";

function diasDesde(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

type FiltroPeriodo = "todos" | "hoje" | "atrasados" | "semana";

const POR_PAGINA = 10;

export default function ContasReceberPage() {
  const [contas, setContas] = useState<ContaReceber[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroPeriodo, setFiltroPeriodo] = useState<FiltroPeriodo>("todos");
  const [pagina, setPagina] = useState(1);

  // Parcelas em aberto (uma linha por parcela), para o calendário e para
  // saber o próximo vencimento de cada cliente e filtrar por período.
  const [parcelas, setParcelas] = useState<ParcelaAReceber[]>([]);
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);

  // Detalhamento das compras fiado por cliente (expande a linha).
  const [expandido, setExpandido] = useState<number | null>(null);
  const [detalhes, setDetalhes] = useState<Record<number, Venda[]>>({});
  const [carregandoDetalhe, setCarregandoDetalhe] = useState<number | null>(null);
  const [erroDetalhe, setErroDetalhe] = useState<string | null>(null);

  // Venda selecionada para registrar recebimento.
  const [vendaReceber, setVendaReceber] = useState<Venda | null>(null);

  // Cliente selecionado para renegociar a dívida (soma as vendas em aberto).
  const [renegociarCliente, setRenegociarCliente] = useState<ContaReceber | null>(
    null
  );

  // Busca as vendas fiado em aberto de um cliente (com cache no estado).
  async function buscarDetalhe(clienteId: number): Promise<Venda[] | null> {
    if (detalhes[clienteId]) return detalhes[clienteId];
    setCarregandoDetalhe(clienteId);
    setErroDetalhe(null);
    try {
      const vendas = await listarFiadoDoCliente(clienteId);
      setDetalhes((atual) => ({ ...atual, [clienteId]: vendas }));
      return vendas;
    } catch (e) {
      setErroDetalhe(extrairErro(e));
      return null;
    } finally {
      setCarregandoDetalhe(null);
    }
  }

  async function alternarDetalhe(clienteId: number) {
    if (expandido === clienteId) {
      setExpandido(null);
      return;
    }
    setExpandido(clienteId);
    await buscarDetalhe(clienteId);
  }

  // Botão "Receber" da linha do cliente: com uma única venda em aberto, abre o
  // modal direto; com várias, expande as compras para o usuário escolher qual.
  async function receberDoCliente(clienteId: number) {
    const vendas = await buscarDetalhe(clienteId);
    if (!vendas) return;
    const abertas = vendas.filter((v) => (parseFloat(v.saldo_devedor) || 0) > 0);
    if (abertas.length === 0) return;
    if (abertas.length === 1) {
      setVendaReceber(abertas[0]);
    } else {
      setExpandido(clienteId);
    }
  }

  // Abre o WhatsApp do cliente com a mensagem de cobrança de todas as compras
  // fiado em aberto (o que comprou, valor em aberto e datas de vencimento).
  async function cobrarWhatsapp(c: ContaReceber) {
    if (c.cliente_id == null) return;
    const base = linkWhatsapp(c.cliente_telefone);
    if (!base) {
      setErroDetalhe(`${c.cliente_nome} não tem telefone cadastrado.`);
      setExpandido(c.cliente_id);
      return;
    }
    const vendas = await buscarDetalhe(c.cliente_id);
    if (!vendas) return;
    const abertas = vendas.filter((v) => (parseFloat(v.saldo_devedor) || 0) > 0);
    if (abertas.length === 0) return;
    const texto = montarMensagemCobranca(c.cliente_nome, abertas);
    window.open(
      `${base}?text=${encodeURIComponent(texto)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  // Após um recebimento: atualiza os totais e o detalhe do cliente afetado.
  function aoReceber(atualizada: Venda) {
    const cid = atualizada.cliente_id;
    setVendaReceber(null);
    carregar();
    if (cid != null) {
      listarFiadoDoCliente(cid)
        .then((vendas) => setDetalhes((atual) => ({ ...atual, [cid]: vendas })))
        .catch(() => {});
    }
  }

  // Botão "Renegociar" da linha do cliente: carrega as compras em aberto e
  // abre o modal de renegociação com o total já consolidado.
  async function abrirRenegociacao(c: ContaReceber) {
    if (c.cliente_id == null) return;
    const vendas = await buscarDetalhe(c.cliente_id);
    if (!vendas) return;
    const abertas = vendas.filter((v) => (parseFloat(v.saldo_devedor) || 0) > 0);
    if (abertas.length === 0) return;
    setRenegociarCliente(c);
  }

  // Após renegociar: fecha o modal, atualiza a lista e o detalhe do cliente.
  function aoRenegociar() {
    const cid = renegociarCliente?.cliente_id;
    setRenegociarCliente(null);
    setExpandido(null);
    carregar();
    if (cid != null) {
      listarFiadoDoCliente(cid)
        .then((vendas) => setDetalhes((atual) => ({ ...atual, [cid]: vendas })))
        .catch(() => {});
    }
  }

  // Selecionar um dia no calendário sobrepõe o filtro de período (Todos /
  // Hoje / Atrasados / 7 dias) para não haver dois critérios ativos.
  function selecionarDia(iso: string | null) {
    setDiaSelecionado(iso);
    if (iso) setFiltroPeriodo("todos");
  }

  function selecionarFiltroPeriodo(f: FiltroPeriodo) {
    setFiltroPeriodo(f);
    setDiaSelecionado(null);
  }

  function carregar() {
    setCarregando(true);
    setErro(null);
    Promise.all([listarContasReceber(), listarParcelasAReceber()])
      .then(([c, p]) => {
        setContas(c);
        setParcelas(p);
      })
      .catch((e) => setErro(extrairErro(e)))
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    carregar();
  }, []);

  const totais = useMemo(() => {
    const total = contas.reduce((acc, c) => acc + (parseFloat(c.total_devido) || 0), 0);
    const vendas = contas.reduce((acc, c) => acc + c.num_vendas, 0);
    const vencido = contas.reduce((acc, c) => acc + (parseFloat(c.valor_vencido) || 0), 0);
    const lucro = contas.reduce((acc, c) => acc + (parseFloat(c.lucro_devido) || 0), 0);
    const clientesVencidos = contas.filter((c) => c.parcelas_vencidas > 0).length;
    return { total, vendas, clientes: contas.length, vencido, lucro, clientesVencidos };
  }, [contas]);

  // Data (YYYY-MM-DD local) de hoje e do limite dos "próximos 7 dias".
  const { hojeISO, em7DiasISO } = useMemo(() => {
    const d = new Date();
    const toISO = (x: Date) =>
      `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
    const em7 = new Date(d);
    em7.setDate(em7.getDate() + 7);
    return { hojeISO: toISO(d), em7DiasISO: toISO(em7) };
  }, []);

  // Por cliente: vencimento mais próximo (o mais antigo em aberto) entre as
  // parcelas pendentes, para mostrar "próximo pagamento" na tabela.
  const proximoVencimentoPorCliente = useMemo(() => {
    const mapa = new Map<number, ParcelaAReceber>();
    for (const p of parcelas) {
      if (p.cliente_id == null) continue;
      const atual = mapa.get(p.cliente_id);
      if (!atual || p.vencimento < atual.vencimento) mapa.set(p.cliente_id, p);
    }
    return mapa;
  }, [parcelas]);

  // Clientes com ao menos uma parcela vencendo no dia selecionado no
  // calendário (ou hoje / na semana, conforme o filtro de período ativo).
  const clientesNoPeriodo = useMemo(() => {
    if (!diaSelecionado && filtroPeriodo === "todos") return null;
    const ids = new Set<number>();
    for (const p of parcelas) {
      if (p.cliente_id == null) continue;
      if (diaSelecionado) {
        if (p.vencimento === diaSelecionado) ids.add(p.cliente_id);
        continue;
      }
      if (filtroPeriodo === "hoje" && p.vencimento === hojeISO) ids.add(p.cliente_id);
      else if (filtroPeriodo === "atrasados" && p.vencida) ids.add(p.cliente_id);
      else if (
        filtroPeriodo === "semana" &&
        p.vencimento >= hojeISO &&
        p.vencimento <= em7DiasISO
      )
        ids.add(p.cliente_id);
    }
    return ids;
  }, [parcelas, diaSelecionado, filtroPeriodo, hojeISO, em7DiasISO]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return contas.filter((c) => {
      if (clientesNoPeriodo && (c.cliente_id == null || !clientesNoPeriodo.has(c.cliente_id)))
        return false;
      if (termo && !c.cliente_nome.toLowerCase().includes(termo)) return false;
      return true;
    });
  }, [contas, busca, clientesNoPeriodo]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = filtradas.slice(
    (paginaAtual - 1) * POR_PAGINA,
    paginaAtual * POR_PAGINA
  );

  // Ao mudar busca ou filtro/dia selecionado, volta para a primeira página.
  useEffect(() => {
    setPagina(1);
  }, [busca, filtroPeriodo, diaSelecionado]);

  // Quantas parcelas vencem hoje ou nos próximos 7 dias (para os badges dos filtros).
  const contagemPeriodo = useMemo(() => {
    let hoje = 0;
    let semana = 0;
    for (const p of parcelas) {
      if (p.vencimento === hojeISO) hoje += 1;
      if (p.vencimento >= hojeISO && p.vencimento <= em7DiasISO) semana += 1;
    }
    return { hoje, semana };
  }, [parcelas, hojeISO, em7DiasISO]);

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <span className="title-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <path d="M2 10h20" />
              <path d="M6 15h4" />
            </svg>
          </span>
          <div>
            <h1>Contas a receber</h1>
            <p className="pdv-sub">Saldos de vendas a prazo, por cliente.</p>
          </div>
        </div>
      </div>

      {erro && contas.length > 0 && <div className="alert erro">{erro}</div>}

      <div className="kpis" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
        <div className="kpi">
          <span className="kpi-label">Total a receber</span>
          <span className="kpi-valor ambar">{brl(totais.total)}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Lucro a receber</span>
          <span className="kpi-valor verde">{brl(totais.lucro)}</span>
          <span className="kpi-sub">
            {totais.total > 0
              ? `${((totais.lucro / totais.total) * 100).toFixed(0)}% do saldo`
              : ""}
          </span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Clientes devendo</span>
          <span className="kpi-valor">{totais.clientes}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Vendas em aberto</span>
          <span className="kpi-valor">{totais.vendas}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Vencido</span>
          <span className={`kpi-valor ${totais.vencido > 0 ? "vermelho" : ""}`}>
            {brl(totais.vencido)}
          </span>
          {totais.clientesVencidos > 0 && (
            <span className="kpi-sub">
              {totais.clientesVencidos}{" "}
              {totais.clientesVencidos === 1 ? "cliente" : "clientes"} em atraso
            </span>
          )}
        </div>
      </div>

      {totais.clientesVencidos > 0 && (
        <div className="alert erro" role="alert">
          ⚠ {totais.clientesVencidos}{" "}
          {totais.clientesVencidos === 1
            ? "cliente está"
            : "clientes estão"}{" "}
          com parcela vencida, somando {brl(totais.vencido)} em atraso.
        </div>
      )}

      {!carregando && contas.length > 0 && (
        <CalendarioRecebimentos
          parcelas={parcelas}
          selecionado={diaSelecionado}
          onSelecionar={selecionarDia}
        />
      )}

      <div className="card">
        <div className="toolbar">
          <div className="busca">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar cliente..."
            />
          </div>
          <div className="cr-filtro" role="group" aria-label="Filtrar contas">
            <button
              type="button"
              className={`cr-filtro-btn${filtroPeriodo === "todos" && !diaSelecionado ? " ativo" : ""}`}
              onClick={() => selecionarFiltroPeriodo("todos")}
              aria-pressed={filtroPeriodo === "todos" && !diaSelecionado}
            >
              Todos
            </button>
            <button
              type="button"
              className={`cr-filtro-btn${filtroPeriodo === "hoje" ? " ativo" : ""}`}
              onClick={() => selecionarFiltroPeriodo("hoje")}
              aria-pressed={filtroPeriodo === "hoje"}
            >
              Vencem hoje
              {contagemPeriodo.hoje > 0 && (
                <span className="cr-filtro-badge">{contagemPeriodo.hoje}</span>
              )}
            </button>
            <button
              type="button"
              className={`cr-filtro-btn${filtroPeriodo === "semana" ? " ativo" : ""}`}
              onClick={() => selecionarFiltroPeriodo("semana")}
              aria-pressed={filtroPeriodo === "semana"}
            >
              Próx. 7 dias
              {contagemPeriodo.semana > 0 && (
                <span className="cr-filtro-badge">{contagemPeriodo.semana}</span>
              )}
            </button>
            <button
              type="button"
              className={`cr-filtro-btn${filtroPeriodo === "atrasados" ? " ativo" : ""}`}
              onClick={() => selecionarFiltroPeriodo("atrasados")}
              aria-pressed={filtroPeriodo === "atrasados"}
            >
              Em atraso
              {totais.clientesVencidos > 0 && (
                <span className="cr-filtro-badge">{totais.clientesVencidos}</span>
              )}
            </button>
          </div>
          <span className="contagem">
            {filtradas.length} {filtradas.length === 1 ? "cliente" : "clientes"}
          </span>
        </div>

        {carregando ? (
          <SkeletonTabela />
        ) : erro && contas.length === 0 ? (
          <EstadoErro mensagem={erro} onTentarNovamente={carregar} />
        ) : contas.length === 0 ? (
          <EstadoVazio
            tom="sucesso"
            titulo="Tudo em dia!"
            descricao="Nenhum cliente com saldo em aberto. As vendas a prazo aparecem aqui até serem quitadas."
          />
        ) : filtradas.length === 0 ? (
          <EstadoVazio
            tom={filtroPeriodo !== "todos" && !busca.trim() ? "sucesso" : undefined}
            titulo={
              !busca.trim() && filtroPeriodo === "atrasados"
                ? "Ninguém em atraso"
                : !busca.trim() && filtroPeriodo === "hoje"
                  ? "Nada vence hoje"
                  : !busca.trim() && filtroPeriodo === "semana"
                    ? "Nada vence nos próximos 7 dias"
                    : !busca.trim() && diaSelecionado
                      ? "Nenhuma parcela nesse dia"
                      : "Nenhum cliente encontrado"
            }
            descricao={
              filtroPeriodo !== "todos" || diaSelecionado
                ? "Tente outro filtro, outra data no calendário ou remova a busca."
                : "Tente outro termo de busca."
            }
          />
        ) : (
          <table className="tabela cr-tabela">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Próximo pagamento</th>
                <th className="num">Saldo devedor</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((c) => {
                const dias = diasDesde(c.venda_mais_antiga);
                const podeExpandir = c.cliente_id != null;
                const aberto = podeExpandir && expandido === c.cliente_id;
                const vendas = c.cliente_id != null ? detalhes[c.cliente_id] : undefined;
                const vencido = c.parcelas_vencidas > 0;
                return (
                  <Fragment key={c.cliente_id ?? c.cliente_nome}>
                    <tr
                      className={`${aberto ? "linha-expandida" : ""}${vencido ? " linha-vencida" : ""}`.trim() || undefined}
                    >
                      <td className="fiado-cliente-nome">
                        <div>
                          {c.cliente_nome}
                          {vencido && (
                            <span
                              className="chip vencido"
                              title={`${c.parcelas_vencidas} parcela(s) vencida(s)`}
                            >
                              ⚠ {c.parcelas_vencidas}{" "}
                              {c.parcelas_vencidas === 1 ? "vencida" : "vencidas"} ·{" "}
                              {brl(c.valor_vencido)}
                            </span>
                          )}
                        </div>
                        <span className="fiado-antiga">
                          {c.num_vendas} {c.num_vendas === 1 ? "compra" : "compras"} em
                          aberto · mais antiga {dataBR(c.venda_mais_antiga)}
                          {dias != null && ` · há ${dias}d`}
                        </span>
                      </td>
                      <td>
                        {c.cliente_id != null && proximoVencimentoPorCliente.has(c.cliente_id) ? (
                          (() => {
                            const prox = proximoVencimentoPorCliente.get(c.cliente_id as number)!;
                            return (
                              <>
                                {dataBR(prox.vencimento)}
                                <span className="muted"> · {brl(prox.valor_restante)}</span>
                                {prox.vencida && (
                                  <span className="chip vencido" title={`${prox.dias_atraso} dia(s) de atraso`}>
                                    {prox.dias_atraso}d atraso
                                  </span>
                                )}
                              </>
                            );
                          })()
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td className="num">
                        <span className="texto-ambar">{brl(c.total_devido)}</span>
                        <span className="fiado-antiga">lucro {brl(c.lucro_devido)}</span>
                      </td>
                      <td className="acoes">
                        {podeExpandir && (
                          <button
                            type="button"
                            className="btn secundario pequeno"
                            onClick={() => alternarDetalhe(c.cliente_id as number)}
                            aria-expanded={aberto}
                          >
                            {aberto ? "Ocultar compras" : "Ver compras"}
                          </button>
                        )}
                        {c.cliente_id != null && (
                          <button
                            type="button"
                            className="btn whatsapp pequeno"
                            onClick={() => cobrarWhatsapp(c)}
                            disabled={!linkWhatsapp(c.cliente_telefone)}
                            title={
                              linkWhatsapp(c.cliente_telefone)
                                ? "Cobrar pelo WhatsApp"
                                : "Cliente sem telefone cadastrado"
                            }
                          >
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                              <path d={WHATSAPP_PATH} />
                            </svg>
                            Cobrar
                          </button>
                        )}
                        {c.cliente_id != null && (
                          <Link
                            className="btn secundario pequeno"
                            to={`/clientes/${c.cliente_id}`}
                          >
                            Ver
                          </Link>
                        )}
                        {c.cliente_id != null && (
                          <button
                            type="button"
                            className="btn primario pequeno"
                            onClick={() => receberDoCliente(c.cliente_id as number)}
                          >
                            Receber
                          </button>
                        )}
                        {c.cliente_id != null && (
                          <button
                            type="button"
                            className="btn secundario pequeno"
                            onClick={() => abrirRenegociacao(c)}
                            title="Somar as compras em aberto e reparcelar a dívida"
                          >
                            Renegociar
                          </button>
                        )}
                      </td>
                    </tr>
                    {aberto && (
                      <tr className="fiado-detalhe-linha">
                        <td colSpan={4}>
                          {carregandoDetalhe === c.cliente_id ? (
                            <p className="vazio">Carregando compras...</p>
                          ) : erroDetalhe ? (
                            <p className="alert erro">{erroDetalhe}</p>
                          ) : !vendas || vendas.length === 0 ? (
                            <p className="vazio">Nenhuma compra a prazo.</p>
                          ) : (
                            <div className="fiado-compras">
                              {vendas.filter(
                                (v) => (parseFloat(v.saldo_devedor) || 0) > 0
                              ).length > 1 && (
                                <div className="fiado-renegociar-topo">
                                  <button
                                    type="button"
                                    className="btn secundario pequeno"
                                    onClick={() => abrirRenegociacao(c)}
                                  >
                                    Renegociar todas as compras em aberto
                                  </button>
                                </div>
                              )}
                              {vendas.map((v) => {
                                const saldo = parseFloat(v.saldo_devedor) || 0;
                                const renegociada = v.renegociada_em != null;
                                const quitada = saldo <= 0 && !renegociada;
                                const quitadaEm = quitada
                                  ? dataQuitacaoVenda(v)
                                  : null;
                                const parcelas = statusParcelas(v);
                                return (
                                  <div key={v.id} className="fiado-compra">
                                    <div className="fiado-compra-topo">
                                      <span className="fiado-compra-titulo">
                                        Venda #{v.id}
                                        <span className="muted">
                                          {" "}
                                          · {dataHora(v.criado_em)}
                                        </span>
                                      </span>
                                      <span className="fiado-compra-dir">
                                        {renegociada ? (
                                          <span className="fiado-compra-saldo">
                                            <span
                                              className="chip mov-ajuste"
                                              title="Dívida transferida para uma renegociação"
                                            >
                                              Renegociada
                                            </span>
                                            <span className="muted">
                                              {" "}
                                              {brl(v.total_liquido)}
                                            </span>
                                          </span>
                                        ) : quitada ? (
                                          <span className="fiado-compra-saldo">
                                            <span className="chip quitado">
                                              {quitadaEm
                                                ? `Quitada em ${dataBR(quitadaEm)}`
                                                : "Quitada"}
                                            </span>
                                            <span className="muted">
                                              {" "}
                                              {brl(v.total_liquido)}
                                            </span>
                                          </span>
                                        ) : (
                                          <>
                                            <span className="fiado-compra-saldo">
                                              Falta{" "}
                                              <strong className="texto-ambar">
                                                {brl(v.saldo_devedor)}
                                              </strong>
                                              <span className="muted">
                                                {" "}
                                                de {brl(v.total_liquido)}
                                              </span>
                                            </span>
                                            <button
                                              type="button"
                                              className="btn primario pequeno"
                                              onClick={() => setVendaReceber(v)}
                                            >
                                              Receber
                                            </button>
                                          </>
                                        )}
                                      </span>
                                    </div>
                                    <ul className="fiado-itens">
                                      {v.itens.map((it) => (
                                        <li key={it.id}>
                                          <span className="fiado-item-qtd">
                                            {it.quantidade}×
                                          </span>
                                          <span className="fiado-item-nome">
                                            {it.produto_nome}
                                          </span>
                                          <span className="fiado-item-subtotal">
                                            {brl(it.subtotal)}
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                    {parcelas.length > 0 && (
                                      <div className="fiado-parcelas">
                                        {parcelas.map((p) => (
                                          <span
                                            key={p.id}
                                            className={`fiado-parcela-chip${p.status === "paga" ? " paga" : ""}${p.status === "renegociada" ? " renegociada" : ""}${p.vencida ? " vencida" : ""}`}
                                          >
                                            {p.numero}ª · {brl(p.valorNum)} ·{" "}
                                            {p.status === "paga" && p.pagoEm
                                              ? `paga em ${dataBR(p.pagoEm)}`
                                              : p.status === "renegociada"
                                                ? "renegociada"
                                                : p.vencida
                                                  ? `venceu ${dataBR(p.vencimento)} (${p.diasAtraso}d)`
                                                  : p.status === "parcial"
                                                    ? `falta ${brl(p.restante)}`
                                                    : `vence ${dataBR(p.vencimento)}`}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}

        {!carregando && filtradas.length > 0 && (
          <Paginacao pagina={paginaAtual} totalPaginas={totalPaginas} onChange={setPagina} />
        )}
      </div>

      {vendaReceber && (
        <ReceberPagamentoModal
          venda={vendaReceber}
          onFechar={() => setVendaReceber(null)}
          onSucesso={aoReceber}
        />
      )}

      {renegociarCliente && renegociarCliente.cliente_id != null && (
        <RenegociarDividaModal
          clienteId={renegociarCliente.cliente_id}
          clienteNome={renegociarCliente.cliente_nome}
          vendasAbertas={(detalhes[renegociarCliente.cliente_id] ?? []).filter(
            (v) => (parseFloat(v.saldo_devedor) || 0) > 0
          )}
          onFechar={() => setRenegociarCliente(null)}
          onSucesso={aoRenegociar}
        />
      )}
    </div>
  );
}
