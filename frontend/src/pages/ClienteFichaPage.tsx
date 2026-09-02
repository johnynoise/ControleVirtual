import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { FichaCliente } from "../types";
import { obterFichaCliente } from "../services/clientes";
import { BarrasHorizontais, LinhaSaldo } from "./relatorios/Charts";

function brl(valor: number | string | null | undefined): string {
  const n = typeof valor === "string" ? parseFloat(valor) : valor ?? 0;
  return (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dataBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

function dataHoraBR(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function diasDesde(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

/** Monta um link de WhatsApp a partir do telefone (formato brasileiro). */
function linkWhatsapp(telefone: string | null | undefined): string | null {
  if (!telefone) return null;
  let digitos = telefone.replace(/\D/g, "");
  if (digitos.length < 10) return null;
  if (digitos.length <= 11) digitos = `55${digitos}`;
  return `https://wa.me/${digitos}`;
}

function extrairErro(err: unknown): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data
    ?.detail;
  if (typeof detail === "string") return detail;
  return "Não foi possível carregar a ficha do cliente.";
}

export default function ClienteFichaPage() {
  const { id } = useParams<{ id: string }>();
  const [ficha, setFicha] = useState<FichaCliente | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let ativo = true;
    setCarregando(true);
    setErro(null);
    obterFichaCliente(Number(id))
      .then((f) => ativo && setFicha(f))
      .catch((e) => ativo && setErro(extrairErro(e)))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [id]);

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
                  </tr>
                </thead>
                <tbody>
                  {ficha.compras.map((c) => (
                    <tr key={c.id} className={c.estornada ? "inativo" : undefined}>
                      <td className="muted">{dataHoraBR(c.criado_em)}</td>
                      <td className="muted">{c.forma_pagamento ?? "—"}</td>
                      <td className="num">{c.num_itens}</td>
                      <td className="num">{brl(c.total_liquido)}</td>
                      <td>
                        {c.estornada ? (
                          <span className="chip mov-saida">Estornada</span>
                        ) : c.tem_devolucao ? (
                          <span className="chip mov-ajuste">Devolução parcial</span>
                        ) : (
                          <span className="chip mov-entrada">Concluída</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
