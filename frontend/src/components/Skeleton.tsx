import type { CSSProperties } from "react";

/** Bloco de carregamento (placeholder animado). */
export function Skeleton({
  largura,
  altura,
  radius,
}: {
  largura?: string;
  altura?: string;
  radius?: string;
}) {
  const style: CSSProperties = {
    width: largura,
    height: altura,
    borderRadius: radius,
  };
  return <span className="skeleton" style={style} aria-hidden="true" />;
}

/** Esqueleto de tabela/lista: algumas linhas no formato do conteúdo. */
export function SkeletonTabela({ linhas = 6 }: { linhas?: number }) {
  return (
    <div className="skeleton-tabela" aria-hidden="true">
      {Array.from({ length: linhas }).map((_, i) => (
        <span className="skeleton skeleton-row" key={i} />
      ))}
    </div>
  );
}
