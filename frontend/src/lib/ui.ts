// Helpers de UI compartilhados entre as telas de cadastro.

// Paleta para avatares (cor derivada do nome, estável).
const CORES_AVATAR = [
  "#2f6bff",
  "#12a150",
  "#c06a00",
  "#7c4dff",
  "#00b8d9",
  "#e8467c",
  "#0aa38b",
  "#e02d3c",
];

/** Cor de avatar estável a partir de um texto (nome). */
export function corAvatar(nome: string): string {
  let soma = 0;
  for (let i = 0; i < nome.length; i++) soma += nome.charCodeAt(i);
  return CORES_AVATAR[soma % CORES_AVATAR.length];
}

/** Iniciais (1 ou 2 letras) a partir de um nome. */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/** Monta um link de WhatsApp a partir do telefone (formato brasileiro). */
export function linkWhatsapp(telefone: string | null | undefined): string | null {
  if (!telefone) return null;
  let digitos = telefone.replace(/\D/g, "");
  if (digitos.length < 10) return null;
  if (digitos.length <= 11) digitos = `55${digitos}`;
  return `https://wa.me/${digitos}`;
}

/** Ícone de WhatsApp (para reuso em ações de linha). */
export const WHATSAPP_PATH =
  "M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2zm0 2a8 8 0 1 1-4.1 14.9l-.3-.2-2.8.8.8-2.7-.2-.3A8 8 0 0 1 12 4zm-2.5 3.4c-.2 0-.5 0-.7.3-.3.3-.9.9-.9 2.1s.9 2.4 1 2.6c.1.2 1.7 2.8 4.3 3.8 2.1.8 2.6.7 3 .6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2 0-.1-.2-.2-.5-.3l-1.6-.8c-.2-.1-.4-.1-.6.1l-.6.8c-.1.2-.3.2-.5.1-.2-.1-1-.4-1.9-1.2-.7-.6-1.2-1.4-1.3-1.6-.1-.2 0-.4.1-.5l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.8-1.9c-.2-.5-.4-.4-.5-.5h-.5z";

/** Formata um número (ou string numérica) como moeda em reais. */
export function brl(valor: number | string | null | undefined): string {
  const n = typeof valor === "string" ? parseFloat(valor) : valor ?? 0;
  return (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Data curta (dd/mm/aaaa). Retorna "—" quando ausente/inválida. */
export function dataBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

/** Data e hora curtas (dd/mm/aaaa hh:mm). */
export function dataHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** Extrai a mensagem de erro de uma resposta de API (FastAPI). */
export function extrairErro(err: unknown): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response
    ?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    return detail.map((d: { msg?: string }) => d.msg ?? "").join("; ");
  }
  return "Não foi possível concluir a operação.";
}
