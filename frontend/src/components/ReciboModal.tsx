import type { Venda } from "../types";
import Recibo from "./Recibo";

// Modal reutilizável que exibe o recibo de uma venda com ações de
// imprimir e fechar. Usado tanto no PDV (após finalizar) quanto no
// histórico (ao reimprimir uma venda antiga).
export default function ReciboModal({
  venda,
  onFechar,
}: {
  venda: Venda;
  onFechar: () => void;
}) {
  return (
    <div className="recibo-overlay" onClick={onFechar}>
      <div className="recibo-modal" onClick={(e) => e.stopPropagation()}>
        <div className="recibo-area">
          <Recibo venda={venda} />
        </div>
        <div className="recibo-acoes no-print">
          <button className="btn primario" onClick={() => window.print()}>
            Imprimir
          </button>
          <button className="btn secundario" onClick={onFechar}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
