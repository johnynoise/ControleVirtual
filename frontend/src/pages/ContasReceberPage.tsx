import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { ContaReceber, Venda } from "../types";
import { listarContasReceber, listarFiadoDoCliente } from "../services/vendas";
import EstadoVazio from "../components/EstadoVazio";
import EstadoErro from "../components/EstadoErro";
import ReceberPagamentoModal from "../components/ReceberPagamentoModal";
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

export default function ContasReceberPage() {
  const [contas, setContas] = useState<ContaReceber[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [apenasAtrasados, setApenasAtrasados] = useState(false);

  // Detalhamento das compras fiado por cliente (expande a linha).
  const [expandido, setExpandido] = useState<number | null>(null);
  const [detalhes, setDetalhes] = useState<Record<number, Venda[]>>({});
  const [carregandoDetalhe, setCarregandoDetalhe] = useState<number | null>(null);
  const [erroDetalhe, setErroDetalhe] = useState<string | null>(null);

  // Venda selecionada para registrar recebimento.
  const [vendaReceber, setVendaReceber] = useState<Venda | null>(null);

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

  function carregar() {
    setCarregando(true);
    setErro(null);
    listarContasReceber()
      .then((c) => setContas(c))
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
    const clientesVencidos = contas.filter((c) => c.parcelas_vencidas > 0).length;
    return { total, vendas, clientes: contas.length, vencido, clientesVencidos };
  }, [contas]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return contas.filter((c) => {
      if (apenasAtrasados && c.parcelas_vencidas <= 0) return false;
      if (termo && !c.cliente_nome.toLowerCase().includes(termo)) return false;
      return true;
    });
  }, [contas, busca, apenasAtrasados]);

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
            <p className="pdv-sub">Saldos de vendas no fiado, por cliente.</p>
          </div>
        </div>
      </div>

      {erro && contas.length > 0 && <div className="alert erro">{erro}</div>}

      <div className="kpis" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="kpi">
          <span className="kpi-label">Total a receber</span>
          <span className="kpi-valor ambar">{brl(totais.total)}</span>
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
              className={`cr-filtro-btn${!apenasAtrasados ? " ativo" : ""}`}
              onClick={() => setApenasAtrasados(false)}
              aria-pressed={!apenasAtrasados}
            >
              Todos
            </button>
            <button
              type="button"
              className={`cr-filtro-btn${apenasAtrasados ? " ativo" : ""}`}
              onClick={() => setApenasAtrasados(true)}
              aria-pressed={apenasAtrasados}
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
            descricao="Nenhum cliente com saldo em aberto. As vendas no fiado aparecem aqui até serem quitadas."
          />
        ) : filtradas.length === 0 ? (
          <EstadoVazio
            tom={apenasAtrasados && !busca.trim() ? "sucesso" : undefined}
            titulo={
              apenasAtrasados && !busca.trim()
                ? "Ninguém em atraso"
                : "Nenhum cliente encontrado"
            }
            descricao={
              apenasAtrasados && !busca.trim()
                ? "Nenhum cliente com parcela vencida. Tudo dentro do prazo."
                : "Tente outro termo de busca ou remova o filtro de atraso."
            }
          />
        ) : (
          <table className="tabela">
            <thead>
              <tr>
                <th>Cliente</th>
                <th className="num">Vendas em aberto</th>
                <th>Fiado mais antigo</th>
                <th className="num">Saldo devedor</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((c) => {
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
                      </td>
                      <td className="num">{c.num_vendas}</td>
                      <td>
                        {dataBR(c.venda_mais_antiga)}
                        {dias != null && (
                          <span className="fiado-antiga"> · há {dias} dias</span>
                        )}
                      </td>
                      <td className="num texto-ambar">{brl(c.total_devido)}</td>
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
                      </td>
                    </tr>
                    {aberto && (
                      <tr className="fiado-detalhe-linha">
                        <td colSpan={5}>
                          {carregandoDetalhe === c.cliente_id ? (
                            <p className="vazio">Carregando compras...</p>
                          ) : erroDetalhe ? (
                            <p className="alert erro">{erroDetalhe}</p>
                          ) : !vendas || vendas.length === 0 ? (
                            <p className="vazio">Nenhuma compra fiado.</p>
                          ) : (
                            <div className="fiado-compras">
                              {vendas.map((v) => {
                                const saldo = parseFloat(v.saldo_devedor) || 0;
                                const quitada = saldo <= 0;
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
                                        {quitada ? (
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
                                            className={`fiado-parcela-chip${p.status === "paga" ? " paga" : ""}${p.vencida ? " vencida" : ""}`}
                                          >
                                            {p.numero}ª · {brl(p.valorNum)} ·{" "}
                                            {p.status === "paga" && p.pagoEm
                                              ? `paga em ${dataBR(p.pagoEm)}`
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
      </div>

      {vendaReceber && (
        <ReceberPagamentoModal
          venda={vendaReceber}
          onFechar={() => setVendaReceber(null)}
          onSucesso={aoReceber}
        />
      )}
    </div>
  );
}
