/**
 * Estado de erro padronizado: ícone + mensagem + ação de "Tentar de novo".
 * Usado quando uma tela não consegue carregar seus dados.
 */
export default function EstadoErro({
  mensagem,
  onTentarNovamente,
}: {
  mensagem?: string | null;
  onTentarNovamente?: () => void;
}) {
  return (
    <div className="estado-erro">
      <span className="ee-icone">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      </span>
      <p className="ee-titulo">Não foi possível carregar</p>
      <p className="ee-msg">
        {mensagem ?? "Verifique sua conexão e tente novamente."}
      </p>
      {onTentarNovamente && (
        <button type="button" className="btn secundario" onClick={onTentarNovamente}>
          Tentar de novo
        </button>
      )}
    </div>
  );
}
