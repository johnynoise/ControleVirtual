import type { ReactNode } from "react";
import type { EstadoOrdenacao } from "../lib/ordenacao";

/** Cabeçalho de tabela clicável que ordena a lista pelo campo indicado. */
export default function ThOrdenavel<K extends string>({
  campo,
  estado,
  onOrdenar,
  children,
  className,
}: {
  campo: K;
  estado: EstadoOrdenacao<K>;
  onOrdenar: (campo: K) => void;
  children: ReactNode;
  className?: string;
}) {
  const ativo = estado.campo === campo;
  return (
    <th
      className={`th-ord ${className ?? ""}${ativo ? " ativo" : ""}`}
      onClick={() => onOrdenar(campo)}
      aria-sort={ativo ? (estado.direcao === "asc" ? "ascending" : "descending") : "none"}
    >
      <span className="th-ord-conteudo">
        {children}
        <span className="th-ord-seta" aria-hidden="true">
          {ativo ? (estado.direcao === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </span>
    </th>
  );
}
