import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import type { MotivoDevolucao, Venda } from "../types";
import { devolverVenda, listarVendas } from "../services/vendas";
import ReciboModal from "../components/ReciboModal";
import ReceberPagamentoModal from "../components/ReceberPagamentoModal";
import DetalhesVendaModal from "../components/DetalhesVendaModal";
import Paginacao from "../components/Paginacao";
import EstadoVazio from "../components/EstadoVazio";
import EstadoErro from "../components/EstadoErro";
import { SkeletonTabela } from "../components/Skeleton";
import { useToast } from "../components/Feedback";
import { brl, corAvatar, dataHora, extrairErro, iniciais } from "../lib/ui";
import { MOTIVOS_TROCA, PAGAMENTOS } from "../lib/vendas";

const POR_PAGINA = 10;


type FiltroStatus = "todas" | "fiado" | "delivery" | "estornadas";

const FILTROS: { valor: FiltroStatus; rotulo: string }[] = [
  { valor: "todas", rotulo: "Todas" },
  { valor: "fiado", rotulo: "A prazo" },
  { valor: "delivery", rotulo: "Delivery" },
  { valor: "estornadas", rotulo: "Estornadas" },
];

export default function HistoricoVendasPage() {
  const toast = useToast();
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroStatus>("todas");
  const [pagina, setPagina] = useState(1);

  // Recibo em exibição (reimpressão).
  const [vendaRecibo, setVendaRecibo] = useState<Venda | null>(null);

  // Recebimento de fiado (venda selecionada para registrar pagamento).
  const [vendaReceber, setVendaReceber] = useState<Venda | null>(null);

  // Detalhes da venda (delivery, trocas, fiado, estorno...).
  const [vendaDetalhes, setVendaDetalhes] = useState<Venda | null>(null);

  // Devolução: venda selecionada, quantidades por item, motivo e observação.
  const [vendaDevolucao, setVendaDevolucao] = useState<Venda | null>(null);
  const [devQtd, setDevQtd] = useState<Record<number, string>>({});
  const [devMotivo, setDevMotivo] = useState<MotivoDevolucao>("defeito");
  // Peça com defeito: fica registrada como pendente de troca com o fornecedor.
  const [devDefeito, setDevDefeito] = useState(true);
  const [devObs, setDevObs] = useState("");
  const [devErro, setDevErro] = useState<string | null>(null);
  const [salvandoDev, setSalvandoDev] = useState(false);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      setVendas(await listarVendas());
    } catch (err) {
      setErro(extrairErro(err));
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  const vendasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return vendas.filter((v) => {
      // Filtro de status.
      if (filtro === "fiado" && !(v.a_prazo && !v.cancelada_em && !v.quitada))
        return false;
      if (filtro === "delivery" && !v.is_delivery) return false;
      if (filtro === "estornadas" && !v.cancelada_em) return false;
      // Busca por texto.
      if (!termo) return true;
      return (
        (v.cliente_nome ?? "").toLowerCase().includes(termo) ||
        String(v.id).includes(termo) ||
        v.itens.some((i) => i.produto_nome.toLowerCase().includes(termo))
      );
    });
  }, [vendas, busca, filtro]);

  const totalPaginas = Math.max(1, Math.ceil(vendasFiltradas.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const vendasVisiveis = vendasFiltradas.slice(
    (paginaAtual - 1) * POR_PAGINA,
    paginaAtual * POR_PAGINA
  );

  // Ao mudar a busca ou o filtro, volta para a primeira página.
  useEffect(() => {
    setPagina(1);
  }, [busca, filtro]);

  // Resumo do topo (apenas vendas não estornadas).
  const resumo = useMemo(() => {
    const validas = vendas.filter((v) => !v.cancelada_em);
    const faturamento = validas.reduce(
      (acc, v) => acc + (parseFloat(v.total_liquido) || 0),
      0
    );
    const lucro = validas.reduce((acc, v) => acc + (parseFloat(v.lucro) || 0), 0);
    return { num: validas.length, faturamento, lucro };
  }, [vendas]);

  function abrirDevolucao(v: Venda) {
    setVendaDevolucao(v);
    setDevQtd({});
    setDevMotivo("defeito");
    setDevDefeito(true);
    setDevObs("");
    setDevErro(null);
  }

  /** Ao trocar o motivo, sugere a flag de defeito (o usuário pode ajustar). */
  function alterarMotivo(motivo: MotivoDevolucao) {
    setDevMotivo(motivo);
    setDevDefeito(motivo === "defeito");
  }

  function fecharDevolucao() {
    setVendaDevolucao(null);
  }

  const itensDevolviveis = useMemo(
    () => (vendaDevolucao?.itens ?? []).filter((i) => i.quantidade > 0),
    [vendaDevolucao]
  );

  const totalDevolucao = useMemo(
    () =>
      itensDevolviveis.reduce((acc, i) => {
        const q = parseInt(devQtd[i.id] ?? "", 10) || 0;
        return acc + q * (parseFloat(i.preco_unitario) || 0);
      }, 0),
    [itensDevolviveis, devQtd]
  );

  function preencherTudo() {
    const tudo: Record<number, string> = {};
    itensDevolviveis.forEach((i) => {
      tudo[i.id] = String(i.quantidade);
    });
    setDevQtd(tudo);
  }

  async function confirmarDevolucao() {
    if (!vendaDevolucao) return;
    const itens = itensDevolviveis
      .map((i) => ({
        item_venda_id: i.id,
        quantidade: parseInt(devQtd[i.id] ?? "", 10) || 0,
      }))
      .filter((i) => i.quantidade > 0);

    if (itens.length === 0) {
      setDevErro("Informe a quantidade de pelo menos um item.");
      return;
    }
    setSalvandoDev(true);
    setDevErro(null);
    try {
      await devolverVenda(vendaDevolucao.id, {
        motivo: devMotivo,
        observacao: devObs.trim() || null,
        defeito: devDefeito,
        itens,
      });
      const idVenda = vendaDevolucao.id;
      const eraDefeito = devDefeito;
      fecharDevolucao();
      await carregar();
      toast.sucesso(
        eraDefeito
          ? `Troca da venda #${idVenda} registrada como defeito, pendente com o fornecedor.`
          : `Troca da venda #${idVenda} registrada.`
      );
    } catch (err) {
      setDevErro(extrairErro(err));
    } finally {
      setSalvandoDev(false);
    }
  }

  return (
    <div className="page">
      <div className="pdv-topbar">
        <div className="page-title">
          <span className="title-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v5h5" />
              <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
              <path d="M12 7v5l4 2" />
            </svg>
          </span>
          <div>
            <h1>Histórico de vendas</h1>
            <p className="pdv-sub">Consulte, reimprima recibos e registre trocas.</p>
          </div>
        </div>
        <Link to="/vendas" className="btn primario">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nova venda
        </Link>
      </div>

      {erro && vendas.length > 0 && <div className="alert erro">{erro}</div>}

      <div className="kpis" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="kpi">
          <span className="kpi-label">Vendas</span>
          <span className="kpi-valor">{resumo.num}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Faturamento</span>
          <span className="kpi-valor">{brl(resumo.faturamento)}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Lucro</span>
          <span className="kpi-valor verde">{brl(resumo.lucro)}</span>
        </div>
      </div>

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
              placeholder="Buscar por cliente, nº da venda ou produto..."
            />
          </div>
          <div className="cr-filtro" role="group" aria-label="Filtrar vendas">
            {FILTROS.map((f) => (
              <button
                key={f.valor}
                type="button"
                className={`cr-filtro-btn${filtro === f.valor ? " ativo" : ""}`}
                onClick={() => setFiltro(f.valor)}
                aria-pressed={filtro === f.valor}
              >
                {f.rotulo}
              </button>
            ))}
          </div>
          <span className="contagem">
            {vendasFiltradas.length}{" "}
            {vendasFiltradas.length === 1 ? "venda" : "vendas"}
          </span>
        </div>

        {carregando ? (
          <SkeletonTabela />
        ) : erro && vendas.length === 0 ? (
          <EstadoErro mensagem={erro} onTentarNovamente={carregar} />
        ) : vendasFiltradas.length === 0 ? (
          busca || filtro !== "todas" ? (
            <EstadoVazio
              titulo="Nenhuma venda encontrada"
              descricao="Ajuste a busca ou troque o filtro de status."
            />
          ) : (
            <EstadoVazio
              titulo="Nenhuma venda ainda"
              descricao="As vendas que você finalizar no PDV aparecem aqui, com recibo e opção de troca."
              acao={{ rotulo: "Ir para o PDV", to: "/vendas" }}
            />
          )
        ) : (
          <table className="tabela tabela-cards historico-tabela">
            <thead>
              <tr>
                <th>Data</th>
                <th>Cliente</th>
                <th>Itens</th>
                <th>Pagamento</th>
                <th className="num">Total</th>
                <th className="num">Lucro</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {vendasVisiveis.map((v) => {
                const estornada = Boolean(v.cancelada_em);
                const pgto = v.forma_pagamento
                  ? PAGAMENTOS[v.forma_pagamento]
                  : undefined;
                const nomeCliente = v.cliente_nome ?? "Sem cliente";
                return (
                  <tr
                    key={v.id}
                    className={`linha-clicavel${estornada ? " inativo" : ""}`}
                    onClick={() => setVendaRecibo(v)}
                    title="Ver recibo"
                  >
                    <td data-label="Data" className="muted historico-data">
                      {dataHora(v.criado_em)}
                    </td>
                    <td data-label="Cliente">
                      <div className="historico-cliente">
                        <span
                          className="avatar avatar-sm"
                          style={{ background: corAvatar(nomeCliente) }}
                        >
                          {iniciais(nomeCliente)}
                        </span>
                        <div className="historico-cliente-info">
                          <span className="historico-cliente-nome">
                            {v.cliente_nome ?? (
                              <span className="muted">Sem cliente</span>
                            )}
                          </span>
                          <div className="historico-chips">
                            {estornada && (
                              <span
                                className="chip mov-saida"
                                title={v.motivo_cancelamento ?? undefined}
                              >
                                Estornada
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td data-label="Itens" className="muted">
                      {v.itens.reduce((acc, i) => acc + i.quantidade, 0)} un ·{" "}
                      {v.itens.length} {v.itens.length === 1 ? "item" : "itens"}
                    </td>
                    <td data-label="Pagamento">
                      {pgto ? (
                        <span className="chip pgto">
                          <span aria-hidden="true">{pgto.icone}</span>
                          {pgto.rotulo}
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td data-label="Total" className="num">
                      <strong>{brl(v.total_liquido)}</strong>
                      {parseFloat(v.desconto) > 0 && (
                        <div className="muted historico-desc">
                          desc. {brl(v.desconto)}
                        </div>
                      )}
                    </td>
                    <td data-label="Lucro" className="num">
                      <span className="historico-lucro">{brl(v.lucro)}</span>
                      <div className="muted historico-margem">
                        {v.margem_percentual}%
                      </div>
                    </td>
                    <td
                      className="acoes historico-acoes"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {!estornada && v.a_prazo && !v.quitada && (
                        <button
                          className="btn primario pequeno"
                          onClick={() => setVendaReceber(v)}
                        >
                          Receber
                        </button>
                      )}
                      <button
                        className="acao-icone"
                        title="Ver recibo"
                        aria-label="Ver recibo"
                        onClick={() => setVendaRecibo(v)}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 2v20l2-1.5L8 22l2-1.5L12 22l2-1.5L16 22l2-1.5L20 22V2l-2 1.5L16 2l-2 1.5L12 2l-2 1.5L8 2 6 3.5 4 2Z" />
                          <path d="M8 7h8M8 11h8M8 15h5" />
                        </svg>
                      </button>
                      <button
                        className="acao-icone"
                        title="Ver detalhes da venda"
                        aria-label="Ver detalhes da venda"
                        onClick={() => setVendaDetalhes(v)}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="9" />
                          <path d="M12 11v5" />
                          <path d="M12 8h.01" />
                        </svg>
                      </button>
                      {!estornada && (
                        <button
                          className="acao-icone perigo"
                          title="Registrar troca"
                          aria-label="Registrar troca"
                          onClick={() => abrirDevolucao(v)}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 7v6h6" />
                            <path d="M3.51 13a9 9 0 1 0 2.13-9.36L3 7" />
                          </svg>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <Paginacao
          pagina={paginaAtual}
          totalPaginas={totalPaginas}
          onChange={setPagina}
        />
      </div>

      {vendaRecibo && (
        <ReciboModal venda={vendaRecibo} onFechar={() => setVendaRecibo(null)} />
      )}

      {vendaDetalhes && (
        <DetalhesVendaModal
          venda={vendaDetalhes}
          onFechar={() => setVendaDetalhes(null)}
          onVerRecibo={() => {
            const v = vendaDetalhes;
            setVendaDetalhes(null);
            setVendaRecibo(v);
          }}
        />
      )}

      {vendaReceber && (
        <ReceberPagamentoModal
          venda={vendaReceber}
          onFechar={() => setVendaReceber(null)}
          onSucesso={() => {
            setVendaReceber(null);
            carregar();
          }}
        />
      )}

      {vendaDevolucao && (
        <div className="recibo-overlay" onClick={fecharDevolucao}>
          <div className="modal-box form" onClick={(e) => e.stopPropagation()}>
            <h2>Registrar troca · venda #{vendaDevolucao.id}</h2>
            <p className="muted" style={{ marginBottom: "1rem" }}>
              Informe quanto de cada item está voltando para troca. O estoque é
              reposto e a venda é recalculada. Trocar tudo estorna a venda.
            </p>

            {devErro && <div className="alert erro">{devErro}</div>}

            <table className="tabela">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th className="num">Vendido</th>
                  <th className="num">Preço un.</th>
                  <th className="num">Trocar</th>
                </tr>
              </thead>
              <tbody>
                {itensDevolviveis.map((i) => (
                  <tr key={i.id}>
                    <td>{i.produto_nome}</td>
                    <td className="num">{i.quantidade}</td>
                    <td className="num">{brl(i.preco_unitario)}</td>
                    <td className="num">
                      <input
                        type="number"
                        min="0"
                        max={i.quantidade}
                        value={devQtd[i.id] ?? ""}
                        placeholder="0"
                        style={{ width: "5rem", textAlign: "right" }}
                        onChange={(e) =>
                          setDevQtd((atual) => ({ ...atual, [i.id]: e.target.value }))
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="form-acoes" style={{ marginTop: "0.75rem" }}>
              <button
                type="button"
                className="btn secundario pequeno"
                onClick={preencherTudo}
              >
                Trocar tudo
              </button>
            </div>

            <div className="grid-2" style={{ marginTop: "1rem" }}>
              <label>
                Motivo
                <select
                  value={devMotivo}
                  onChange={(e) => alterarMotivo(e.target.value as MotivoDevolucao)}
                >
                  {MOTIVOS_TROCA.map((m) => (
                    <option key={m.valor} value={m.valor}>
                      {m.rotulo}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Observação (opcional)
                <input
                  value={devObs}
                  onChange={(e) => setDevObs(e.target.value)}
                  placeholder="Ex.: costura solta"
                />
              </label>
            </div>

            <label className="check" style={{ marginTop: "1rem" }}>
              <input
                type="checkbox"
                checked={devDefeito}
                onChange={(e) => setDevDefeito(e.target.checked)}
              />
              A peça tem defeito
            </label>
            <p className="muted" style={{ margin: "0.35rem 0 0" }}>
              {devDefeito
                ? "A troca fica registrada como defeito pendente de acerto com o fornecedor."
                : "Sem defeito: a peça volta ao estoque e não gera acerto com o fornecedor."}
            </p>

            <div className="margem-preview" style={{ marginTop: "1rem" }}>
              <span>
                Total da troca: <strong>{brl(totalDevolucao)}</strong>
              </span>
            </div>

            <div className="form-acoes">
              <button
                className="btn perigo"
                onClick={confirmarDevolucao}
                disabled={salvandoDev || totalDevolucao <= 0}
              >
                {salvandoDev ? "Processando..." : "Confirmar troca"}
              </button>
              <button
                type="button"
                className="btn secundario"
                onClick={fecharDevolucao}
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
