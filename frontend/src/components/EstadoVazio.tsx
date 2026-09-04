import { type ReactNode } from "react";
import { Link } from "react-router-dom";

interface Acao {
  rotulo: string;
  onClick?: () => void;
  to?: string;
}

// Ícone padrão (caixa vazia) quando a tela não passa um específico.
const ICONE_PADRAO = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 8l2-4h14l2 4" />
    <path d="M3 8h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
    <path d="M9 12h6" />
  </svg>
);

const ICONE_SUCESSO = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

/**
 * Estado vazio reutilizável: ícone + título + descrição + ação opcional.
 * `tom="sucesso"` para situações positivas (ex.: nada pendente).
 */
export default function EstadoVazio({
  titulo,
  descricao,
  acao,
  icone,
  tom = "neutro",
}: {
  titulo: string;
  descricao?: string;
  acao?: Acao;
  icone?: ReactNode;
  tom?: "neutro" | "sucesso";
}) {
  const iconeFinal = icone ?? (tom === "sucesso" ? ICONE_SUCESSO : ICONE_PADRAO);

  return (
    <div className="estado-vazio">
      <span className={`ev-icone ${tom}`}>{iconeFinal}</span>
      <p className="ev-titulo">{titulo}</p>
      {descricao && <p className="ev-descricao">{descricao}</p>}
      {acao &&
        (acao.to ? (
          <Link to={acao.to} className="btn primario">
            {acao.rotulo}
          </Link>
        ) : (
          <button type="button" className="btn primario" onClick={acao.onClick}>
            {acao.rotulo}
          </button>
        ))}
    </div>
  );
}
