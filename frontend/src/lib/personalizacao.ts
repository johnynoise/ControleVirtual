// Personalização da loja: paleta de cores curada e aplicação da cor de destaque.

export interface CorPaleta {
  nome: string;
  cor: string;
}

// Paleta curada de cores de destaque (evita combinações de baixo contraste).
export const PALETA: CorPaleta[] = [
  { nome: "Azul", cor: "#2f6bff" },
  { nome: "Verde", cor: "#12a150" },
  { nome: "Turquesa", cor: "#0aa3c2" },
  { nome: "Roxo", cor: "#7c4dff" },
  { nome: "Rosa", cor: "#e8467c" },
  { nome: "Vermelho", cor: "#e02d3c" },
  { nome: "Laranja", cor: "#e8730c" },
  { nome: "Grafite", cor: "#475569" },
];

export const COR_PADRAO = PALETA[0].cor;

/**
 * Aplica a cor de destaque nas variáveis do design system.
 * Os tons "escuro" e "suave" são derivados com color-mix referenciando
 * --text e --surface, então se adaptam automaticamente ao tema claro/escuro.
 */
export function aplicarCor(cor: string): void {
  const s = document.documentElement.style;
  s.setProperty("--azul", cor);
  s.setProperty("--azul-escuro", `color-mix(in srgb, ${cor} 78%, var(--text))`);
  s.setProperty("--azul-suave", `color-mix(in srgb, ${cor} 14%, var(--surface))`);
}
