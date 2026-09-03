import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import type { MotivoDevolucao, Venda } from "../types";
import { devolverVenda, listarVendas } from "../services/vendas";
import ReciboModal from "../components/ReciboModal";
import ReceberPagamentoModal from "../components/ReceberPagamentoModal";
import Paginacao from "../components/Paginacao";
import { useToast } from "../components/Feedback";
import { brl, dataHora, extrairErro } from "../lib/ui";

const POR_PAGINA = 10;

const MOTIVOS_DEVOLUCAO: { valor: MotivoDevolucao; rotulo: string }[] = [
  { valor: "defeito", rotulo: "Defeito" },
  { valor: "nao_gostou", rotulo: "Cliente não gostou" },
  { valor: "tamanho_errado", rotulo: "Tamanho/modelo errado" },
  { valor: "produto_errado", rotulo: "Produto errado" },
  { valor: "arrependimento", rotulo: "Desistência/arrependimento" },
  { valor: "outro", rotulo: "Outro" },
];

const PAGAMENTO_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  cartao_credito: "Crédito",
  cartao_debito: "Débito",
  fiado: "Fiado",
  outro: "Outro",
};

export default function HistoricoVendasPage() {
  const toast = useToast();
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);

  // Recibo em exibição (reimpressão).
  const [vendaRecibo, setVendaRecibo] = useState<Venda | null>(null);

  // Recebimento de fiado (venda selecionada para registrar pagamento).
  const [vendaReceber, setVendaReceber] = useState<Venda | null>(null);

  // Devolução: venda selecionada, quantidades por item, motivo e observação.
  const [vendaDevolucao, setVendaDevolucao] = useState<Venda | null>(null);
  const [devQtd, setDevQtd] = useState<Record<number, string>>({});
  const [devMotivo, setDevMotivo] = useState<MotivoDevolucao>("defeito");
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
    if (!termo) return vendas;
    return vendas.filter(
      (v) =>
        (v.cliente_nome ?? "").toLowerCase().includes(termo) ||
        String(v.id).includes(termo) ||
        v.itens.some((i) => i.produto_nome.toLowerCase().includes(termo))
    );
  }, [vendas, busca]);

  const totalPaginas = Math.max(1, Math.ceil(vendasFiltradas.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const vendasVisiveis = vendasFiltradas.slice(
    (paginaAtual - 1) * POR_PAGINA,
    paginaAtual * POR_PAGINA
  );

  // Ao mudar a busca, volta para a primeira página.
  useEffect(() => {
    setPagina(1);
  }, [busca]);

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
    setDevObs("");
    setDevErro(null);
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
        itens,
      });
      const idVenda = vendaDevolucao.id;
      fecharDevolucao();
      await carregar();
      toast.sucesso(`Devolução da venda #${idVenda} registrada.`);
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
            <p className="pdv-sub">Consulte, reimprima recibos e registre devoluções.</p>
          </div>
        </div>
        <Link to="/vendas" className="btn primario">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nova venda
        </Link>
      </div>

      {erro && <div className="alert erro">{erro}</div>}

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
          <span className="contagem">
            {vendasFiltradas.length}{" "}
            {vendasFiltradas.length === 1 ? "venda" : "vendas"}
          </span>
        </div>

        {carregando ? (
          <p className="vazio">Carregando...</p>
        ) : vendasFiltradas.length === 0 ? (
          <p className="vazio">
            {busca ? "Nenhuma venda encontrada." : "Nenhuma venda ainda."}
          </p>
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
              {vendasVisiveis.map((v) => {
                const estornada = Boolean(v.cancelada_em);
                const temDevolucao = (v.devolucoes?.length ?? 0) > 0;
                return (
                  <tr key={v.id} className={estornada ? "inativo" : undefined}>
                    <td className="muted">{dataHora(v.criado_em)}</td>
                    <td>
                      {v.cliente_nome ?? <span className="muted">—</span>}
                      {estornada ? (
                        <span
                          className="chip mov-saida"
                          title={v.motivo_cancelamento ?? undefined}
                          style={{ marginLeft: "0.4rem" }}
                        >
                          Estornada
                        </span>
                      ) : (
                        temDevolucao && (
                          <span
                            className="chip mov-ajuste"
                            style={{ marginLeft: "0.4rem" }}
                          >
                            Devolução parcial
                          </span>
                        )
                      )}
                      {!estornada && v.a_prazo && (
                        <span
                          className={`chip ${v.quitada ? "quitado" : "fiado"}`}
                          style={{ marginLeft: "0.4rem" }}
                          title={
                            v.quitada
                              ? "Fiado quitado"
                              : `Falta receber ${brl(v.saldo_devedor)}`
                          }
                        >
                          {v.quitada ? "Fiado quitado" : `Fiado · falta ${brl(v.saldo_devedor)}`}
                        </span>
                      )}
                    </td>
                    <td className="muted">
                      {v.itens.reduce((acc, i) => acc + i.quantidade, 0)} un
                      {" · "}
                      {v.itens.length} {v.itens.length === 1 ? "item" : "itens"}
                    </td>
                    <td className="muted">
                      {v.forma_pagamento
                        ? PAGAMENTO_LABEL[v.forma_pagamento] ?? v.forma_pagamento
                        : "—"}
                    </td>
                    <td>
                      <strong>{brl(v.total_liquido)}</strong>
                      {parseFloat(v.desconto) > 0 && (
                        <div className="muted">desc. {brl(v.desconto)}</div>
                      )}
                    </td>
                    <td>{brl(v.lucro)}</td>
                    <td>{v.margem_percentual}%</td>
                    <td className="acoes">
                      {!estornada && v.a_prazo && !v.quitada && (
                        <button
                          className="btn primario pequeno"
                          onClick={() => setVendaReceber(v)}
                        >
                          Receber
                        </button>
                      )}
                      <button
                        className="btn secundario pequeno"
                        onClick={() => setVendaRecibo(v)}
                      >
                        Recibo
                      </button>
                      {!estornada && (
                        <button
                          className="btn perigo pequeno"
                          onClick={() => abrirDevolucao(v)}
                        >
                          Devolver
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
            <h2>Devolver itens · venda #{vendaDevolucao.id}</h2>
            <p className="muted" style={{ marginBottom: "1rem" }}>
              Informe quanto de cada item está voltando. O estoque é reposto e a
              venda é recalculada. Devolver tudo estorna a venda.
            </p>

            {devErro && <div className="alert erro">{devErro}</div>}

            <table className="tabela">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th className="num">Vendido</th>
                  <th className="num">Preço un.</th>
                  <th className="num">Devolver</th>
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
                Devolver tudo
              </button>
            </div>

            <div className="grid-2" style={{ marginTop: "1rem" }}>
              <label>
                Motivo
                <select
                  value={devMotivo}
                  onChange={(e) => setDevMotivo(e.target.value as MotivoDevolucao)}
                >
                  {MOTIVOS_DEVOLUCAO.map((m) => (
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

            <div className="margem-preview" style={{ marginTop: "1rem" }}>
              <span>
                Total a devolver: <strong>{brl(totalDevolucao)}</strong>
              </span>
            </div>

            <div className="form-acoes">
              <button
                className="btn perigo"
                onClick={confirmarDevolucao}
                disabled={salvandoDev || totalDevolucao <= 0}
              >
                {salvandoDev ? "Processando..." : "Confirmar devolução"}
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
