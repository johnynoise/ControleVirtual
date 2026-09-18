// Utilidades para vendas a prazo (fiado).
//
// Os pagamentos não são amarrados a uma parcela no banco: a quitação é sempre
// acumulada na venda (cada pagamento tem sua data em `criado_em`). Aqui
// deduzimos o status de cada parcela e a data em que foi quitada varrendo os
// pagamentos em ordem cronológica.
import type { Parcela, Venda } from "../types";
import { brl, dataBR } from "./ui";

export type StatusParcela = "paga" | "parcial" | "aberta";

export interface ParcelaInfo extends Parcela {
  valorNum: number;
  status: StatusParcela;
  restante: number;
  pagoEm: string | null;
  vencida: boolean;
  diasAtraso: number;
}

/** Dias de atraso de uma data de vencimento (0 se ainda não venceu). */
function diasAtrasoDe(vencimentoISO: string): number {
  // Trata "YYYY-MM-DD" como data local pura (evita erro de fuso de 1 dia).
  const soData = /^\d{4}-\d{2}-\d{2}$/.exec(vencimentoISO);
  const venc = soData
    ? (() => {
        const [a, m, d] = vencimentoISO.split("-").map(Number);
        return new Date(a, m - 1, d);
      })()
    : new Date(vencimentoISO);
  if (Number.isNaN(venc.getTime())) return 0;
  // Compara só a data (zera horas) para não contar atraso no próprio dia.
  const hoje = new Date();
  venc.setHours(0, 0, 0, 0);
  hoje.setHours(0, 0, 0, 0);
  const dias = Math.floor((hoje.getTime() - venc.getTime()) / 86_400_000);
  return dias > 0 ? dias : 0;
}

/** Data (ISO) do pagamento que fez o total pago alcançar `alvo`, ou null. */
function dataQuitacao(venda: Venda, alvo: number): string | null {
  const pagamentosOrd = [...venda.pagamentos].sort(
    (a, b) => new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime()
  );
  let acc = 0;
  for (const pg of pagamentosOrd) {
    acc += parseFloat(pg.valor) || 0;
    if (acc >= alvo - 0.005) return pg.criado_em;
  }
  return null;
}

/** Situação de cada parcela da venda (ordenadas por número). */
export function statusParcelas(venda: Venda): ParcelaInfo[] {
  const pago = parseFloat(venda.total_pago) || 0;
  let acumulado = 0;
  return [...venda.parcelas]
    .sort((a, b) => a.numero - b.numero)
    .map((p) => {
      const valorNum = parseFloat(p.valor) || 0;
      const inicio = acumulado;
      acumulado += valorNum;
      const fim = acumulado;
      let status: StatusParcela;
      let restante: number;
      let pagoEm: string | null = null;
      if (pago >= fim - 0.005) {
        status = "paga";
        restante = 0;
        pagoEm = dataQuitacao(venda, fim);
      } else if (pago > inicio + 0.005) {
        status = "parcial";
        restante = fim - pago;
      } else {
        status = "aberta";
        restante = valorNum;
      }
      const diasAtraso = status === "paga" ? 0 : diasAtrasoDe(p.vencimento);
      const vencida = diasAtraso > 0;
      return { ...p, valorNum, status, restante, pagoEm, vencida, diasAtraso };
    });
}

/** Data (ISO) em que a venda foi totalmente quitada, ou null se ainda em aberto. */
export function dataQuitacaoVenda(venda: Venda): string | null {
  const total = parseFloat(venda.total_liquido) || 0;
  if (total <= 0) return null;
  return dataQuitacao(venda, total);
}

/**
 * Monta a mensagem de cobrança (para WhatsApp) de forma enxuta: lista os itens
 * das compras em aberto com seus valores, a próxima parcela a vencer de cada
 * compra e o total devido. Retorna texto puro (com quebras de linha) pronto
 * para encodar.
 */
export function montarMensagemCobranca(
  clienteNome: string,
  vendasAbertas: Venda[]
): string {
  const primeiroNome = (clienteNome || "").trim().split(/\s+/)[0] || "";
  const saudacao = primeiroNome ? `Olá, ${primeiroNome}!` : "Olá!";

  const linhas: string[] = [
    saudacao,
    "",
    "Segue o resumo das suas compras a prazo em aberto:",
    "",
  ];

  let totalEmAberto = 0;
  const varias = vendasAbertas.length > 1;

  vendasAbertas.forEach((v, indice) => {
    totalEmAberto += parseFloat(v.saldo_devedor) || 0;

    // Com mais de uma compra, separa cada uma com um cabeçalho para não
    // misturar os itens de compras diferentes.
    if (varias) {
      if (indice > 0) linhas.push("");
      linhas.push(`Compra de ${dataBR(v.criado_em)}:`);
    }

    v.itens.forEach((i) => {
      linhas.push(`• ${i.quantidade}x ${i.produto_nome} — ${brl(i.subtotal)}`);
    });

    // Próxima parcela a vencer desta compra (a mais antiga em aberto).
    const proxima = statusParcelas(v)
      .filter((p) => p.status !== "paga")
      .sort(
        (a, b) =>
          new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime()
      )[0];

    if (proxima) {
      const marca = proxima.vencida ? " (vencida)" : "";
      linhas.push(
        `Próxima parcela: ${brl(proxima.restante)} até ${dataBR(proxima.vencimento)}${marca}`
      );
    }
  });

  linhas.push("");
  linhas.push(`Total em aberto: ${brl(totalEmAberto)}`);

  linhas.push("");
  linhas.push("Qualquer dúvida, estou à disposição. Obrigado!");

  return linhas.join("\n");
}
