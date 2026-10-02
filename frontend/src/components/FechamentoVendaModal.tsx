import type { Cliente, FormaPagamento } from "../types";
import { brl, formatarTelefone } from "../lib/ui";

const PAGAMENTOS: { valor: FormaPagamento; rotulo: string; icone: string }[] = [
  { valor: "dinheiro", rotulo: "Dinheiro", icone: "💵" },
  { valor: "pix", rotulo: "PIX", icone: "⚡" },
  { valor: "cartao_credito", rotulo: "Crédito", icone: "💳" },
  { valor: "cartao_debito", rotulo: "Débito", icone: "🏦" },
  { valor: "fiado", rotulo: "A prazo", icone: "📓" },
  { valor: "outro", rotulo: "Outro", icone: "•" },
];

interface Props {
  onFechar: () => void;
  onConfirmar: () => void;
  salvando: boolean;

  // Totais (já calculados pela página, só para exibição).
  totalBruto: number;
  totalDescontoItens: number;
  descontoValor: number;
  descontoPercentual: number;
  descontoExcedido: boolean;
  descontoPedido: number;
  totalAposItens: number;
  totalLiquido: number;
  vendaZerada: boolean;

  // Cliente.
  clientes: Cliente[];
  clienteId: number | "";
  setClienteId: (id: number | "") => void;
  clienteSelecionado: Cliente | null;
  novoCliente: boolean;
  setNovoCliente: (v: boolean) => void;
  ncNome: string;
  setNcNome: (v: string) => void;
  ncTelefone: string;
  setNcTelefone: (v: string) => void;
  ncEmail: string;
  setNcEmail: (v: string) => void;
  ncEndereco: string;
  setNcEndereco: (v: string) => void;
  salvandoCliente: boolean;
  salvarNovoCliente: () => void;
  cancelarNovoCliente: () => void;

  // Entrega.
  entrega: boolean;
  setEntrega: (v: boolean) => void;

  // Pagamento.
  formaPagamento: FormaPagamento;
  setFormaPagamento: (f: FormaPagamento) => void;

  // Desconto total.
  desconto: string;
  setDesconto: (v: string) => void;
  descontoTipo: "reais" | "percent";
  setDescontoTipo: (t: "reais" | "percent") => void;

  // Parcelamento (fiado).
  numParcelas: 1 | 2 | 3 | 4 | 5;
  setNumParcelas: (n: 1 | 2 | 3 | 4 | 5) => void;
  valoresParcelas: number[];
  vencimentos: string[];
  definirVencimento: (indice: number, valor: string) => void;

  // Troco (dinheiro).
  recebido: string;
  setRecebido: (v: string) => void;
  recebidoNum: number;
  troco: number;
  sugestoesRecebido: number[];
}

// Modal de fechamento da venda: concentra tudo que só importa no momento de
// decidir COMO a venda é paga e PARA QUEM (cliente/entrega) — separado da
// lista de itens, que fica sempre visível no carrinho.
//
// Estrutura em 3 partes fixas (header/footer não rolam, só o meio):
//   header  → total sempre visível, não se perde ao rolar o conteúdo.
//   corpo   → fluxo único: pagamento → cliente → entrega → parcelas → desconto.
//   footer  → ações de confirmar/voltar, sempre alcançáveis mesmo com o
//             parcelamento aberto (que é o bloco que mais cresce em altura).
export default function FechamentoVendaModal({
  onFechar,
  onConfirmar,
  salvando,
  totalBruto,
  totalDescontoItens,
  descontoValor,
  descontoPercentual,
  descontoExcedido,
  descontoPedido,
  totalAposItens,
  totalLiquido,
  vendaZerada,
  clientes,
  clienteId,
  setClienteId,
  clienteSelecionado,
  novoCliente,
  setNovoCliente,
  ncNome,
  setNcNome,
  ncTelefone,
  setNcTelefone,
  ncEmail,
  setNcEmail,
  ncEndereco,
  setNcEndereco,
  salvandoCliente,
  salvarNovoCliente,
  cancelarNovoCliente,
  entrega,
  setEntrega,
  formaPagamento,
  setFormaPagamento,
  desconto,
  setDesconto,
  descontoTipo,
  setDescontoTipo,
  numParcelas,
  setNumParcelas,
  valoresParcelas,
  vencimentos,
  definirVencimento,
  recebido,
  setRecebido,
  recebidoNum,
  troco,
  sugestoesRecebido,
}: Props) {
  const rotuloConfirmar = entrega
    ? "Registrar entrega"
    : formaPagamento === "fiado"
      ? "Vender a prazo"
      : "Confirmar venda";

  return (
    <div className="recibo-overlay" onClick={onFechar}>
      <div
        className="modal-box modal-lg fechamento-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Fechamento da venda"
      >
        {/* Header fixo: o total nunca fica fora de vista, mesmo rolando o
            parcelamento aberto (o bloco que mais cresce em altura). */}
        <div className="fechamento-header">
          <h2>Fechar venda</h2>
          <div className={`fechamento-total${vendaZerada ? " zerado" : ""}`}>
            <span>Total</span>
            <strong>{brl(totalLiquido)}</strong>
          </div>
        </div>

        <div className="fechamento-corpo">
          {/* 1. Forma de pagamento: primeira decisão, a mais importante. */}
          <section className="fechamento-secao">
            <span className="pdv-label">Forma de pagamento</span>
            <div className="pdv-pgto-pills">
              {PAGAMENTOS.map((p) => (
                <button
                  key={p.valor}
                  type="button"
                  className={`pdv-pill${formaPagamento === p.valor ? " ativo" : ""}`}
                  onClick={() => setFormaPagamento(p.valor)}
                >
                  <span className="pdv-pill-icone">{p.icone}</span>
                  {p.rotulo}
                </button>
              ))}
            </div>
            {formaPagamento === "fiado" && (
              <p className={`pdv-fiado-aviso${clienteId === "" ? " alerta" : ""}`}>
                {clienteId === ""
                  ? "⚠ Selecione um cliente abaixo: a venda a prazo fica no nome dele."
                  : "📓 Esta venda entra como saldo devedor do cliente."}
              </p>
            )}
          </section>

          {/* 2. Cliente: compacto, só expande com o cadastro rápido. */}
          <section className="fechamento-secao">
            <label className="fechamento-campo-linha" htmlFor="fechamento-cliente">
              <span className="pdv-label">Cliente</span>
              <div className="linha-inline">
                <select
                  id="fechamento-cliente"
                  value={clienteId}
                  onChange={(e) =>
                    setClienteId(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  disabled={novoCliente}
                >
                  <option value="">Sem cliente</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
                {!novoCliente && (
                  <button
                    type="button"
                    className="btn secundario pequeno"
                    onClick={() => setNovoCliente(true)}
                  >
                    + Novo
                  </button>
                )}
              </div>
            </label>

            {novoCliente && (
              <div className="pdv-novo-cliente">
                <input
                  value={ncNome}
                  onChange={(e) => setNcNome(e.target.value)}
                  placeholder="Nome do cliente"
                  autoFocus
                />
                <input
                  type="tel"
                  inputMode="tel"
                  value={ncTelefone}
                  onChange={(e) => setNcTelefone(formatarTelefone(e.target.value))}
                  placeholder="Telefone (opcional)"
                />
                <input
                  type="email"
                  value={ncEmail}
                  onChange={(e) => setNcEmail(e.target.value)}
                  placeholder="E-mail (opcional)"
                />
                <input
                  value={ncEndereco}
                  onChange={(e) => setNcEndereco(e.target.value)}
                  placeholder="Endereço (para delivery)"
                />
                <div className="form-acoes" style={{ marginTop: 0 }}>
                  <button
                    type="button"
                    className="btn primario pequeno"
                    onClick={salvarNovoCliente}
                    disabled={salvandoCliente}
                  >
                    {salvandoCliente ? "Salvando..." : "Salvar"}
                  </button>
                  <button
                    type="button"
                    className="btn secundario pequeno"
                    onClick={cancelarNovoCliente}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* 3. Delivery: decisão independente da forma de pagamento, por
              isso fica numa seção própria em vez de encaixada entre elas. */}
          <section className="fechamento-secao">
            <label className="pdv-entrega-toggle">
              <input
                type="checkbox"
                checked={entrega}
                onChange={(e) => setEntrega(e.target.checked)}
              />
              <span className="pdv-entrega-texto">
                <strong>🛵 Delivery (entrega)</strong>
                <span className="muted">
                  Entra como pedido pendente. A venda só é concluída ao
                  confirmar a entrega.
                </span>
              </span>
            </label>
            {entrega &&
              (clienteSelecionado == null ? (
                <p className="pdv-entrega-aviso alerta">
                  ⚠ Selecione um cliente acima: a entrega vai para o endereço
                  cadastrado dele.
                </p>
              ) : (clienteSelecionado.endereco ?? "").trim() === "" ? (
                <p className="pdv-entrega-aviso alerta">
                  ⚠ {clienteSelecionado.nome} não tem endereço cadastrado.
                  Edite o cliente para adicionar.
                </p>
              ) : (
                <p className="pdv-entrega-aviso">
                  📍 Entregar em: {clienteSelecionado.endereco}
                </p>
              ))}
          </section>

          {/* 4. Parcelamento: só existe no fiado. Lista compacta em vez de
              cards grandes — cada linha cabe em ~40px. */}
          {formaPagamento === "fiado" && totalLiquido > 0 && (
            <section className="fechamento-secao">
              <span className="pdv-label">Parcelar em</span>
              <div
                className="pdv-parcelas-opcoes"
                role="group"
                aria-label="Número de parcelas"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`pdv-parcela-opcao${numParcelas === n ? " ativo" : ""}`}
                    onClick={() => setNumParcelas(n as 1 | 2 | 3 | 4 | 5)}
                    aria-pressed={numParcelas === n}
                  >
                    {n}x
                  </button>
                ))}
              </div>

              <table className="pdv-parcelas-tabela">
                <thead>
                  <tr>
                    <th>Parcela</th>
                    <th>Valor</th>
                    <th>Vencimento</th>
                  </tr>
                </thead>
                <tbody>
                  {valoresParcelas.map((valor, k) => (
                    <tr key={k}>
                      <td>{k + 1}ª</td>
                      <td>{brl(valor)}</td>
                      <td>
                        <input
                          type="date"
                          value={vencimentos[k] ?? ""}
                          onChange={(e) => definirVencimento(k, e.target.value)}
                          aria-label={`Vencimento da ${k + 1}ª parcela`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* 5. Desconto e troco: ajustes finos do total, já mostrado fixo
              no header — aqui só o necessário para chegar nele. */}
          <section className="fechamento-secao">
            <div className="pdv-linha-desc">
              <span>Subtotal</span>
              <span>{brl(totalBruto)}</span>
            </div>
            {totalDescontoItens > 0 && (
              <div className="pdv-linha-desc">
                <span>Desconto nos itens</span>
                <span>− {brl(totalDescontoItens)}</span>
              </div>
            )}
            <div className="pdv-linha-desc">
              <label htmlFor="pdv-desconto">Desconto total</label>
              <div className="pdv-desc-campo">
                <div className="pdv-desc-toggle" role="group" aria-label="Tipo de desconto">
                  <button
                    type="button"
                    className={descontoTipo === "reais" ? "ativo" : ""}
                    onClick={() => setDescontoTipo("reais")}
                    aria-pressed={descontoTipo === "reais"}
                  >
                    R$
                  </button>
                  <button
                    type="button"
                    className={descontoTipo === "percent" ? "ativo" : ""}
                    onClick={() => setDescontoTipo("percent")}
                    aria-pressed={descontoTipo === "percent"}
                  >
                    %
                  </button>
                </div>
                <input
                  id="pdv-desconto"
                  type="text"
                  inputMode="decimal"
                  value={desconto}
                  onChange={(e) => setDesconto(e.target.value)}
                />
              </div>
            </div>
            {descontoValor > 0 && (
              <div className="pdv-linha-desc">
                <span>
                  Desconto aplicado{" "}
                  <span className="pdv-desc-pct">
                    ({descontoPercentual.toFixed(descontoPercentual < 10 ? 1 : 0)}%)
                  </span>
                </span>
                <span>− {brl(descontoValor)}</span>
              </div>
            )}
            {descontoExcedido && (
              <p className="pdv-desc-aviso" role="alert">
                ⚠ Desconto de {brl(descontoPedido)} é maior que o subtotal.
                Aplicando no máximo {brl(totalAposItens)}.
              </p>
            )}
            {vendaZerada && !descontoExcedido && (
              <p className="pdv-desc-aviso" role="alert">
                ⚠ O desconto zerou a venda. Confira antes de finalizar.
              </p>
            )}

            {formaPagamento === "dinheiro" && totalLiquido > 0 && !entrega && (
              <div className="pdv-troco">
                <label htmlFor="pdv-recebido" className="pdv-label">
                  Dinheiro recebido
                </label>
                {sugestoesRecebido.length > 0 && (
                  <div className="pdv-troco-chips">
                    {sugestoesRecebido.map((v) => (
                      <button
                        key={v}
                        type="button"
                        className="pdv-troco-chip"
                        onClick={() => setRecebido(String(v))}
                      >
                        {v === totalLiquido ? "Exato" : brl(v)}
                      </button>
                    ))}
                  </div>
                )}
                <input
                  id="pdv-recebido"
                  className="pdv-troco-input"
                  type="text"
                  inputMode="decimal"
                  value={recebido}
                  onChange={(e) => setRecebido(e.target.value)}
                  placeholder="0,00"
                />
                {recebidoNum > 0 && (
                  <div className={`pdv-troco-linha ${troco >= 0 ? "ok" : "falta"}`}>
                    <span>{troco >= 0 ? "Troco" : "Falta"}</span>
                    <strong>{brl(Math.abs(troco))}</strong>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Footer fixo: sempre alcançável, mesmo com o parcelamento aberto. */}
        <div className="fechamento-acoes">
          <button
            type="button"
            className="btn secundario"
            onClick={onFechar}
            disabled={salvando}
          >
            Voltar ao carrinho
          </button>
          <button
            type="button"
            className="btn primario"
            onClick={onConfirmar}
            disabled={salvando}
          >
            {salvando
              ? entrega
                ? "Registrando..."
                : "Finalizando..."
              : `${rotuloConfirmar} · ${brl(totalLiquido)}`}
            {!salvando && <kbd className="pdv-kbd-btn">F2</kbd>}
          </button>
        </div>
      </div>
    </div>
  );
}
