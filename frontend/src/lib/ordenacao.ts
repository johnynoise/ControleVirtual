// Utilitários de ordenação de listas por coluna.

export type Direcao = "asc" | "desc";

export interface EstadoOrdenacao<K extends string> {
  campo: K;
  direcao: Direcao;
}

/**
 * Ordena uma cópia da lista pelo campo/direção informados. `valorDe` extrai o
 * valor comparável de cada item (número ou texto). Valores nulos vão para o fim.
 */
export function ordenar<T, K extends string>(
  itens: T[],
  estado: EstadoOrdenacao<K>,
  valorDe: (item: T, campo: K) => string | number | null | undefined
): T[] {
  const fator = estado.direcao === "asc" ? 1 : -1;
  return [...itens].sort((a, b) => {
    const va = valorDe(a, estado.campo);
    const vb = valorDe(b, estado.campo);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === "number" && typeof vb === "number") {
      return (va - vb) * fator;
    }
    return (
      String(va).localeCompare(String(vb), "pt-BR", {
        numeric: true,
        sensitivity: "base",
      }) * fator
    );
  });
}

/**
 * Próximo estado ao clicar num cabeçalho: alterna a direção se for o mesmo
 * campo; senão, ordena pelo novo campo em ordem crescente.
 */
export function proximaOrdenacao<K extends string>(
  estado: EstadoOrdenacao<K>,
  campo: K
): EstadoOrdenacao<K> {
  if (estado.campo === campo) {
    return { campo, direcao: estado.direcao === "asc" ? "desc" : "asc" };
  }
  return { campo, direcao: "asc" };
}
