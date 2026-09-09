import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { FichaCliente, Venda } from "../types";
import { obterFichaCliente } from "../services/clientes";
import { obterVenda } from "../services/vendas";
import ReceberPagamentoModal from "../components/ReceberPagamentoModal";
import { useToast } from "../components/Feedback";
import { BarrasHorizontais, LinhaSaldo } from "./relatorios/Charts";
import { brl, dataBR, dataHora, extrairErro, linkWhatsapp } from "../lib/ui";

function diasDesde(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

export default function ClienteFichaPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [ficha, setFicha] = useState<FichaCliente | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Venda de fiado selecionada para registrar recebimento.
  const [vendaReceber, setVendaReceber] = useState<Venda | null>(null);

  function carregarFicha() {
    if (!id) return;
    setCarregando(true);
    setErro(null);
    obterFichaCliente(Number(id))
      .then((f) => setFicha(f))
      .catch((e) => setErro(extrairErro(e)))
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    carregarFicha();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function abrirReceber(vendaId: number) {
    try {
      const venda = await obterVenda(vendaId);
      setVendaReceber(venda);
    } catch (e) {
      toast.erro(extrairErro(e));
    }
  }

  // Gastos agregados por mês (só compras não estornadas), últimos 12 meses.
  const gastosPorMes = useMemo(() => {
    if (!ficha) return [] as { rotulo: string; valor: number }[];
    const mapa = new Map<string, number>();
    ficha.compras
      .filter((c) => !c.estornada)
      .forEach((c) => {
        const d = new Date(c.criado_em);
        if (Number.isNaN(d.getTime())) return;
        const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        mapa.set(chave, (mapa.get(chave) ?? 0) + (parseFloat(c.total_liquido) || 0));
      });
    return Array.from(mapa.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([chave, valor]) => {
        const [ano, mes] = chave.split("-");
        return { rotulo: `${mes}/${ano.slice(2)}`, valor };
      });
  }, [ficha]);

  const cliente = ficha?.cliente;
  const wpp = linkWhatsapp(cliente?.telefone);
  const diasUltima = diasDesde(ficha?.ultima_compra);

  return (
    <div className="page">
      <Link to="/clientes" className="voltar-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Clientes
      </Link>

      {erro && <div className="alert erro">{erro}</div>}

      {carregando ? (
        <p className="vazio">Carregando...</p>
      ) : !ficha || !cliente ? (
        <p className="vazio">Cliente não encontrado.</p>
      ) : (
        <>
          <div className="page-title">
            <span className="title-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21a8 8 0 0 1 16 0" />
              </svg>
            </span>
            <h1>{cliente.nome}</h1>
            {!cliente.ativo && <span className="chip mov-saida">Inativo</span>}
          </div>

          <div className="ficha-contatos">
            {cliente.telefone ? (
              <span>
                📞 {cliente.telefone}
                {wpp && (
                  <a
                    href={wpp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn secundario pequeno"
                    style={{ marginLeft: "0.5rem" }}
                  >
                    WhatsApp
                  </a>
                )}
              </span>
            ) : (
              <span className="muted">Sem telefone</span>
            )}
            <span>{cliente.email ? `✉️ ${cliente.email}` : <span className="muted">Sem e-mail</span>}</span>
            <span>
              {cliente.endereco ? `📍 ${cliente.endereco}` : <span className="muted">Sem endereço</span>}
            </span>
            {cliente.data_nascimento && (
              <span>🎂 {dataBR(cliente.data_nascimento)}</span>
            )}
            <span className="muted">Cliente desde {dataBR(cliente.criado_em)}</span>
          </div>

          <div className="kpis">
            <div className="kpi">
              <span className="kpi-label">Total gasto</span>
              <span className="kpi-valor">{brl(ficha.total_gasto)}</span>
            </div>
            <div className="kpi">
              <span className="kpi-label">Compras</span>
              <span className="kpi-valor">{ficha.num_compras}</span>
              <span className="kpi-sub">{ficha.total_itens} itens no total</span>
            </div>
            <div className="kpi">
              <span className="kpi-label">Ticket médio</span>
              <span className="kpi-valor">{brl(ficha.ticket_medio)}</span>
            </div>
            <div className="kpi">
              <span className="kpi-label">Última compra</span>
              <span className="kpi-valor">{dataBR(ficha.ultima_compra)}</span>
              {diasUltima != null && (
                <span className="kpi-sub">
                  {diasUltima === 0 ? "hoje" : `há ${diasUltima} dias`}
                </span>
              )}
            </div>
            <div className="kpi">
              <span className="kpi-label">Saldo devedor (fiado)</span>
              <span
                className={`kpi-valor ${parseFloat(ficha.saldo_devedor) > 0 ? "ambar" : ""}`}
              >
                {brl(ficha.saldo_devedor)}
              </span>
              {parseFloat(ficha.saldo_devedor) > 0 && (
                <span className="kpi-sub">a receber</span>
              )}
            </div>
          </div>

          {gastosPorMes.length >= 2 && (
            <div className="card">
              <h2>Gastos por mês</h2>
              <LinhaSaldo
                pontos={gastosPorMes.map((m) => ({
                  rotulo: m.rotulo,
                  valor: m.valor,
                }))}
                formatar={brl}
              />
            </div>
          )}

          <div className="card">
            <h2>Produtos favoritos</h2>
            {ficha.favoritos.length === 0 ? (
              <p className="vazio">Ainda sem compras registradas.</p>
            ) : (
              <BarrasHorizontais
                barras={ficha.favoritos.map((f) => ({
                  label: f.produto_nome,
                  valor: f.quantidade,
                }))}
                formatar={(v) => `${v} un`}
              />
            )}
          </div>

          <div className="card">
            <h2>Histórico de compras</h2>
            {ficha.compras.length === 0 ? (
              <p className="vazio">Este cliente ainda não comprou.</p>
            ) : (
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Pagamento</th>
                    <th className="num">Itens</th>
                    <th className="num">Total</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {ficha.compras.map((c) => {
                    const saldo = parseFloat(c.saldo_devedor) || 0;
                    const fiadoAberto = c.a_prazo && !c.estornada && saldo > 0;
                    return (
                      <tr key={c.id} className={c.estornada ? "inativo" : undefined}>
                        <td className="muted">{dataHora(c.criado_em)}</td>
                        <td className="muted">
                          {c.forma_pagamento === "fiado" ? "Fiado" : c.forma_pagamento ?? "—"}
                        </td>
                        <td className="num">{c.num_itens}</td>
                        <td className="num">{brl(c.total_liquido)}</td>
                        <td>
                          {c.estornada ? (
                            <span className="chip mov-saida">Estornada</span>
                          ) : fiadoAberto ? (
                            <span className="chip fiado" title={`Falta ${brl(saldo)}`}>
                              Fiado · falta {brl(saldo)}
                            </span>
                          ) : c.a_prazo ? (
                            <span className="chip quitado">Fiado quitado</span>
                          ) : c.tem_devolucao ? (
                            <span className="chip mov-ajuste">Troca parcial</span>
                          ) : (
                            <span className="chip mov-entrada">Concluída</span>
                          )}
                        </td>
                        <td className="acoes">
                          {fiadoAberto && (
                            <button
                              className="btn primario pequeno"
                              onClick={() => abrirReceber(c.id)}
                            >
                              Receber
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {vendaReceber && (
        <ReceberPagamentoModal
          venda={vendaReceber}
          onFechar={() => setVendaReceber(null)}
          onSucesso={() => {
            setVendaReceber(null);
            carregarFicha();
          }}
        />
      )}
    </div>
  );
}
