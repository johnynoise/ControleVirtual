import type { Venda } from "../types";
import { brl, dataBR, dataHora } from "../lib/ui";
import { PAGAMENTOS, rotuloMotivo, rotuloPagamento } from "../lib/vendas";

// Modal com o "raio-x" de uma venda: situação, entrega, pagamento e trocas.
// Reúne o que antes ficava espalhado em chips na listagem do histórico.
export default function DetalhesVendaModal({
  venda,
  onFechar,
  onVerRecibo,
}: {
  venda: Venda;
  onFechar: () => void;
  // Opcional: atalho para abrir o recibo da mesma venda.
  onVerRecibo?: () => void;
}) {
  const estornada = Boolean(venda.cancelada_em);
  const pgto = venda.forma_pagamento ? PAGAMENTOS[venda.forma_pagamento] : undefined;
  const trocas = venda.devolucoes ?? [];
  const defeitosPendentes = trocas.filter(
    (d) => d.defeito && d.status_fornecedor === "pendente"
  );
  const totalTrocado = trocas.reduce(
    (acc, d) => acc + (parseFloat(d.valor_devolvido) || 0),
    0
  );

  return (
    <div className="recibo-overlay" onClick={onFechar}>
      <div className="modal-box modal-lg" onClick={(e) => e.stopPropagation()}>
        <h2>Detalhes da venda #{venda.id}</h2>
        <p className="muted">
          {dataHora(venda.criado_em)} · {venda.cliente_nome ?? "Sem cliente"}
        </p>

        <div className="chips" style={{ marginTop: "0.75rem" }}>
          {estornada ? (
            <span className="chip mov-saida">Estornada</span>
          ) : (
            <span className="chip mov-entrada">Concluída</span>
          )}
          {venda.is_delivery && <span className="chip delivery">🛵 Delivery</span>}
          {trocas.length > 0 && (
            <span className="chip mov-ajuste">
              {trocas.length === 1 ? "1 troca" : `${trocas.length} trocas`}
            </span>
          )}
          {venda.a_prazo && (
            <span className={`chip ${venda.quitada ? "quitado" : "fiado"}`}>
              {venda.quitada ? "A prazo quitado" : "A prazo em aberto"}
            </span>
          )}
          {defeitosPendentes.length > 0 && (
            <span className="chip alerta">Defeito pendente com o fornecedor</span>
          )}
        </div>

        <dl className="detalhes-lista">
          <div className="detalhes-linha">
            <dt>Situação</dt>
            <dd>
              {estornada ? (
                <>
                  Estornada em {dataHora(venda.cancelada_em)}
                  {venda.motivo_cancelamento && (
                    <span className="muted"> · {venda.motivo_cancelamento}</span>
                  )}
                </>
              ) : (
                "Venda concluída"
              )}
            </dd>
          </div>

          <div className="detalhes-linha">
            <dt>Entrega</dt>
            <dd>
              {venda.is_delivery ? (
                <>
                  Delivery ·{" "}
                  {venda.entrega_pendente
                    ? "aguardando entrega"
                    : `entregue em ${dataHora(venda.entregue_em)}`}
                  {venda.endereco_entrega && (
                    <div className="muted">{venda.endereco_entrega}</div>
                  )}
                </>
              ) : (
                "Retirada na loja"
              )}
            </dd>
          </div>

          <div className="detalhes-linha">
            <dt>Pagamento</dt>
            <dd>
              {pgto ? (
                <>
                  <span aria-hidden="true">{pgto.icone}</span> {pgto.rotulo}
                </>
              ) : (
                <span className="muted">Não informado</span>
              )}
            </dd>
          </div>

          <div className="detalhes-linha">
            <dt>Valores</dt>
            <dd>
              Total {brl(venda.total_liquido)}
              {parseFloat(venda.desconto) > 0 && (
                <span className="muted"> · desconto {brl(venda.desconto)}</span>
              )}
              <span className="muted">
                {" "}
                · lucro {brl(venda.lucro)} ({venda.margem_percentual}%)
              </span>
            </dd>
          </div>

          {venda.a_prazo && (
            <div className="detalhes-linha">
              <dt>A prazo</dt>
              <dd>
                Pago {brl(venda.total_pago)} de {brl(venda.total_liquido)}
                {venda.quitada ? (
                  <span className="muted"> · quitado</span>
                ) : (
                  <strong> · falta {brl(venda.saldo_devedor)}</strong>
                )}
                {venda.parcelas.length > 0 && (
                  <ul className="detalhes-itens">
                    {venda.parcelas.map((p) => (
                      <li key={p.id}>
                        Parcela {p.numero} · {brl(p.valor)} · vence{" "}
                        {dataBR(p.vencimento)}
                      </li>
                    ))}
                  </ul>
                )}
              </dd>
            </div>
          )}

          {venda.pagamentos.length > 0 && (
            <div className="detalhes-linha">
              <dt>Recebimentos</dt>
              <dd>
                <ul className="detalhes-itens">
                  {venda.pagamentos.map((p) => (
                    <li key={p.id}>
                      {dataHora(p.criado_em)} · {brl(p.valor)} ·{" "}
                      {rotuloPagamento(p.forma_pagamento)}
                      {p.observacao && (
                        <span className="muted"> · {p.observacao}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          )}

          <div className="detalhes-linha">
            <dt>Trocas</dt>
            <dd>
              {trocas.length === 0 ? (
                <span className="muted">Nenhuma troca registrada</span>
              ) : (
                <>
                  {trocas.length === 1 ? "1 troca" : `${trocas.length} trocas`} ·{" "}
                  {brl(totalTrocado)} em peças devolvidas
                  <ul className="detalhes-itens">
                    {trocas.map((d) => (
                      <li key={d.id}>
                        {dataHora(d.criado_em)} · {rotuloMotivo(d.motivo)} ·{" "}
                        {brl(d.valor_devolvido)}
                        {d.defeito && (
                          <span
                            className={`chip ${
                              d.status_fornecedor === "pendente"
                                ? "alerta"
                                : "mov-entrada"
                            } detalhes-chip`}
                          >
                            {d.status_fornecedor === "pendente"
                              ? "Defeito · pendente com o fornecedor"
                              : "Defeito · resolvido"}
                          </span>
                        )}
                        <div className="muted">
                          {d.itens
                            .map((i) => `${i.quantidade}x ${i.produto_nome}`)
                            .join(", ")}
                          {d.observacao && ` · ${d.observacao}`}
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </dd>
          </div>

          {venda.observacao && (
            <div className="detalhes-linha">
              <dt>Observação</dt>
              <dd>{venda.observacao}</dd>
            </div>
          )}
        </dl>

        <div className="form-acoes">
          {onVerRecibo && (
            <button className="btn secundario" onClick={onVerRecibo}>
              Ver recibo
            </button>
          )}
          <button className="btn primario" onClick={onFechar}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
