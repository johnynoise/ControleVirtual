import { useMemo } from "react";

// Controle de paginação reutilizável: setas de anterior/próxima e números
// de página, com reticências quando há muitas páginas.
export default function Paginacao({
  pagina,
  totalPaginas,
  onChange,
}: {
  pagina: number;
  totalPaginas: number;
  onChange: (pagina: number) => void;
}) {
  const paginas = useMemo<(number | "...")[]>(() => {
    if (totalPaginas <= 7) {
      return Array.from({ length: totalPaginas }, (_, i) => i + 1);
    }
    const lista: (number | "...")[] = [1];
    const inicio = Math.max(2, pagina - 1);
    const fim = Math.min(totalPaginas - 1, pagina + 1);
    if (inicio > 2) lista.push("...");
    for (let p = inicio; p <= fim; p++) lista.push(p);
    if (fim < totalPaginas - 1) lista.push("...");
    lista.push(totalPaginas);
    return lista;
  }, [totalPaginas, pagina]);

  if (totalPaginas <= 1) return null;

  return (
    <div className="paginacao">
      <button
        type="button"
        className="pag-btn"
        onClick={() => onChange(Math.max(1, pagina - 1))}
        disabled={pagina === 1}
        aria-label="Página anterior"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>
      {paginas.map((p, idx) =>
        p === "..." ? (
          <span key={`e${idx}`} className="pag-ellipsis">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            className={`pag-btn${p === pagina ? " ativo" : ""}`}
            onClick={() => onChange(p)}
          >
            {p}
          </button>
        )
      )}
      <button
        type="button"
        className="pag-btn"
        onClick={() => onChange(Math.min(totalPaginas, pagina + 1))}
        disabled={pagina === totalPaginas}
        aria-label="Próxima página"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>
    </div>
  );
}
