import type { Venda } from "../types";
import { useConfiguracao } from "./ConfiguracaoContext";

const PAGAMENTO_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  fiado: "A prazo",
  outro: "Outro",
};

function brl(valor: number | string): string {
  const n = typeof valor === "string" ? parseFloat(valor) : valor;
  return (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function Recibo({
  venda,
  dinheiro,
}: {
  venda: Venda;
  dinheiro?: { recebido: number; troco: number } | null;
}) {
  const { config } = useConfiguracao();
  const nomeLoja = config?.nome_loja || "ControleVirtual";

  return (
    <div className="recibo">
      <div className="recibo-cabecalho">
        {config?.logo && (
          <img src={config.logo} alt={nomeLoja} className="recibo-logo" />
        )}
        <strong>{nomeLoja}</strong>
        <div>Recibo de venda</div>
      </div>

      <div className="recibo-info">
        <div>Venda nº {venda.id}</div>
        <div>{dataHora(venda.criado_em)}</div>
        {venda.cliente_nome && <div>Cliente: {venda.cliente_nome}</div>}
      </div>

      <div className="recibo-linha" />

      <table className="recibo-itens">
        <tbody>
          {venda.itens.map((it) => (
            <tr key={it.id}>
              <td>
                {it.quantidade}x {it.produto_nome}
                <div className="recibo-unit">{brl(it.preco_unitario)} un.</div>
              </td>
              <td className="r">{brl(it.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="recibo-linha" />

      <div className="recibo-totais">
        <div>
          <span>Subtotal</span>
          <span>{brl(venda.total_bruto)}</span>
        </div>
        {parseFloat(venda.desconto) > 0 && (
          <div>
            <span>Desconto</span>
            <span>- {brl(venda.desconto)}</span>
          </div>
        )}
        <div className="total">
          <span>Total</span>
          <span>{brl(venda.total_liquido)}</span>
        </div>
        <div>
          <span>Pagamento</span>
          <span>{venda.forma_pagamento ? PAGAMENTO_LABEL[venda.forma_pagamento] ?? venda.forma_pagamento : "—"}</span>
        </div>
        {dinheiro && (
          <>
            <div>
              <span>Dinheiro</span>
              <span>{brl(dinheiro.recebido)}</span>
            </div>
            <div>
              <span>Troco</span>
              <span>{brl(dinheiro.troco)}</span>
            </div>
          </>
        )}
        {venda.a_prazo && !venda.cancelada_em && (
          <>
            {parseFloat(venda.total_pago) > 0 && (
              <div>
                <span>Já pago</span>
                <span>{brl(venda.total_pago)}</span>
              </div>
            )}
            <div className="saldo">
              <span>{venda.quitada ? "Quitado" : "Saldo devedor"}</span>
              <span>{venda.quitada ? "✓" : brl(venda.saldo_devedor)}</span>
            </div>
          </>
        )}
      </div>

      <div className="recibo-linha" />

      <div className="recibo-rodape">Obrigado pela preferência!</div>
    </div>
  );
}
