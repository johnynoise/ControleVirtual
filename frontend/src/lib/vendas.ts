// Rótulos compartilhados das telas de venda (histórico, detalhes, trocas).
import type { MotivoDevolucao } from "../types";

/** Formas de pagamento, indexadas pelo valor que vem da API. */
export const PAGAMENTOS: Record<string, { rotulo: string; icone: string }> = {
  dinheiro: { rotulo: "Dinheiro", icone: "💵" },
  pix: { rotulo: "PIX", icone: "⚡" },
  cartao_credito: { rotulo: "Crédito", icone: "💳" },
  cartao_debito: { rotulo: "Débito", icone: "🏦" },
  fiado: { rotulo: "A prazo", icone: "📓" },
  outro: { rotulo: "Outro", icone: "•" },
};

/** Rótulo curto da forma de pagamento (sem ícone). */
export function rotuloPagamento(forma: string | null | undefined): string {
  if (!forma) return "—";
  return PAGAMENTOS[forma]?.rotulo ?? forma;
}

/** Motivos de troca, na ordem em que aparecem no formulário. */
export const MOTIVOS_TROCA: { valor: MotivoDevolucao; rotulo: string }[] = [
  { valor: "defeito", rotulo: "Defeito" },
  { valor: "nao_gostou", rotulo: "Cliente não gostou" },
  { valor: "tamanho_errado", rotulo: "Tamanho/modelo errado" },
  { valor: "produto_errado", rotulo: "Produto errado" },
  { valor: "arrependimento", rotulo: "Desistência/arrependimento" },
  { valor: "outro", rotulo: "Outro" },
];

/** Rótulo legível de um motivo de troca (cai no próprio valor se desconhecido). */
export function rotuloMotivo(motivo: string): string {
  return MOTIVOS_TROCA.find((m) => m.valor === motivo)?.rotulo ?? motivo;
}
