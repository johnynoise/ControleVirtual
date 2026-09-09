import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Venda } from "../types";
import {
  confirmarEntrega,
  estornarVenda,
  listarEntregas,
} from "../services/vendas";
import EstadoVazio from "../components/EstadoVazio";
import EstadoErro from "../components/EstadoErro";
import { useToast } from "../components/Feedback";
import { brl, dataHora, extrairErro } from "../lib/ui";

const ROTULO_PAGAMENTO: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  cartao_credito: "Crédito",
  cartao_debito: "Débito",
  fiado: "Fiado",
  outro: "Outro",
};

type Filtro = "pendentes" | "entregues";

export default function DeliveryPage() {
  const toast = useToast();
  const [pedidos, setPedidos] = useState<Venda[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("pendentes");
  // Id do pedido em processamento (confirmar/cancelar), para desabilitar botões.
  const [processando, setProcessando] = useState<number | null>(null);

  function carregar() {
    setCarregando(true);
    setErro(null);
    // Traz todos os pedidos de delivery (pendentes + entregues).
    listarEntregas(true)
      .then((p) => setPedidos(p))
      .catch((e) => setErro(extrairErro(e)))
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    carregar();
  }, []);

  // Pendentes: fila da mais antiga para a mais recente. Entregues: mais
  // recentes primeiro. Pedidos cancelados não aparecem em nenhuma das listas.
  const pendentes = useMemo(
    () =>
      pedidos
        .filter((p) => p.entrega_status === "pendente" && !p.cancelada_em)
        .sort((a, b) => +new Date(a.criado_em) - +new Date(b.criado_em)),
    [pedidos]
  );
  const entregues = useMemo(
    () =>
      pedidos
        .filter((p) => p.entrega_status === "entregue")
        .sort(
          (a, b) =>
            +new Date(b.entregue_em ?? b.criado_em) -
            +new Date(a.entregue_em ?? a.criado_em)
        ),
    [pedidos]
  );

  const lista = filtro === "pendentes" ? pendentes : entregues;

  const totais = useMemo(() => {
    const valor = pendentes.reduce(
      (acc, p) => acc + (parseFloat(p.total_liquido) || 0),
      0
    );
    return { valor };
  }, [pendentes]);

  async function confirmar(pedido: Venda) {
    setProcessando(pedido.id);
    try {
      await confirmarEntrega(pedido.id);
      toast.sucesso(`Pedido #${pedido.id} entregue e venda confirmada.`);
      carregar();
    } catch (e) {
      toast.erro(extrairErro(e));
    } finally {
      setProcessando(null);
    }
  }

  async function cancelar(pedido: Venda) {
    if (
      !window.confirm(
        `Cancelar o pedido de entrega #${pedido.id}? O pedido não será entregue.`
      )
    ) {
      return;
    }
    setProcessando(pedido.id);
    try {
      await estornarVenda(pedido.id, "Pedido de entrega cancelado");
      toast.sucesso(`Pedido #${pedido.id} cancelado.`);
      carregar();
    } catch (e) {
      toast.erro(extrairErro(e));
    } finally {
      setProcessando(null);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <span className="title-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 13h11V6H3z" />
              <path d="M14 9h4l3 3v4h-7z" />
              <circle cx="7" cy="18" r="1.6" />
              <circle cx="17" cy="18" r="1.6" />
            </svg>
          </span>
          <div>
            <h1>Delivery</h1>
            <p className="pdv-sub">
              Pedidos aguardando entrega. Ao confirmar, a venda é realizada e o
              estoque é baixado.
            </p>
          </div>
        </div>
        <Link to="/vendas" className="btn primario">
          Nova venda
        </Link>
      </div>

      <div className="kpis" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="kpi">
          <span className="kpi-label">A entregar</span>
          <span className="kpi-valor">{pendentes.length}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Valor a entregar</span>
          <span className="kpi-valor">{brl(totais.valor)}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Entregues</span>
          <span className="kpi-valor verde">{entregues.length}</span>
        </div>
      </div>

      <div className="cr-filtro" role="group" aria-label="Filtrar entregas" style={{ marginBottom: "1rem" }}>
        <button
          type="button"
          className={`cr-filtro-btn${filtro === "pendentes" ? " ativo" : ""}`}
          onClick={() => setFiltro("pendentes")}
          aria-pressed={filtro === "pendentes"}
        >
          A entregar
          {pendentes.length > 0 && (
            <span className="cr-filtro-badge">{pendentes.length}</span>
          )}
        </button>
        <button
          type="button"
          className={`cr-filtro-btn${filtro === "entregues" ? " ativo" : ""}`}
          onClick={() => setFiltro("entregues")}
          aria-pressed={filtro === "entregues"}
        >
          Entregues
        </button>
      </div>

      {carregando ? (
        <p className="vazio">Carregando pedidos...</p>
      ) : erro ? (
        <EstadoErro mensagem={erro} onTentarNovamente={carregar} />
      ) : lista.length === 0 ? (
        <EstadoVazio
          tom={filtro === "pendentes" ? "sucesso" : "neutro"}
          titulo={
            filtro === "pendentes"
              ? "Nenhuma entrega pendente"
              : "Nenhuma entrega concluída"
          }
          descricao={
            filtro === "pendentes"
              ? "Pedidos marcados como delivery na tela de venda aparecem aqui até serem entregues."
              : "As entregas confirmadas vão aparecer aqui."
          }
          acao={
            filtro === "pendentes"
              ? { rotulo: "Ir para vendas", to: "/vendas" }
              : undefined
          }
        />
      ) : (
        <div className="card">
          <table className="tabela tabela-cards">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Cliente</th>
                <th>Itens</th>
                <th>Pagamento</th>
                <th className="num">Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => {
                const emProcesso = processando === p.id;
                const entregue = p.entrega_status === "entregue";
                return (
                  <tr key={p.id}>
                    <td data-label="Pedido">
                      <strong>#{p.id}</strong>
                      <div className="muted">{dataHora(p.criado_em)}</div>
                    </td>
                    <td data-label="Cliente">
                      <div className="delivery-cliente">
                        <span className="delivery-nome">
                          {p.cliente_nome || "Sem cliente"}
                        </span>
                        {p.endereco_entrega && (
                          <span className="delivery-endereco">
                            📍 {p.endereco_entrega}
                          </span>
                        )}
                      </div>
                    </td>
                    <td data-label="Itens">
                      <ul className="delivery-itens">
                        {p.itens.map((it) => (
                          <li key={it.id}>
                            <span className="delivery-item-qtd">
                              {it.quantidade}×
                            </span>
                            <span className="delivery-item-nome">
                              {it.produto_nome}
                            </span>
                            <span className="delivery-item-subtotal">
                              {brl(it.subtotal)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td data-label="Pagamento" className="muted">
                      {ROTULO_PAGAMENTO[p.forma_pagamento ?? ""] ??
                        p.forma_pagamento ??
                        "—"}
                    </td>
                    <td data-label="Total" className="num">
                      <strong>{brl(p.total_liquido)}</strong>
                    </td>
                    <td className="acoes">
                      {entregue ? (
                        <span className="chip mov-entrada">
                          Entregue em {dataHora(p.entregue_em)}
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn primario pequeno"
                            onClick={() => confirmar(p)}
                            disabled={emProcesso}
                          >
                            {emProcesso ? "Confirmando..." : "Entregue"}
                          </button>
                          <button
                            type="button"
                            className="btn perigo pequeno"
                            onClick={() => cancelar(p)}
                            disabled={emProcesso}
                          >
                            Cancelar
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
