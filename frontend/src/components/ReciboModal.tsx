import { useState } from "react";
import type { Venda } from "../types";
import { enviarReciboEmail } from "../services/vendas";
import { extrairErro } from "../lib/ui";
import { useToast } from "./Feedback";
import Recibo from "./Recibo";

// Modal reutilizável que exibe o recibo de uma venda com ações de
// imprimir, enviar por email e fechar. Usado tanto no PDV (após finalizar)
// quanto no histórico (ao reimprimir uma venda antiga).
export default function ReciboModal({
  venda,
  onFechar,
  emailPadrao,
  dinheiro,
}: {
  venda: Venda;
  onFechar: () => void;
  // Email para pré-preencher o campo de envio (ex.: email do cliente da venda).
  emailPadrao?: string | null;
  // Dinheiro recebido/troco (só nas vendas em dinheiro recém-finalizadas).
  dinheiro?: { recebido: number; troco: number } | null;
}) {
  const toast = useToast();
  const [mostrarEnvio, setMostrarEnvio] = useState(false);
  const [email, setEmail] = useState(emailPadrao ?? "");
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    try {
      const destino = email.trim();
      const resp = await enviarReciboEmail(venda.id, destino || undefined);
      toast.sucesso(`Recibo enviado para ${resp.destinatario}`);
      setMostrarEnvio(false);
    } catch (err) {
      toast.erro(extrairErro(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="recibo-overlay" onClick={onFechar}>
      <div className="recibo-modal" onClick={(e) => e.stopPropagation()}>
        <div className="recibo-area">
          <Recibo venda={venda} dinheiro={dinheiro} />
        </div>

        {mostrarEnvio && (
          <form className="recibo-envio no-print" onSubmit={enviar}>
            <label htmlFor="recibo-email">Enviar recibo (PDF) por email</label>
            <div className="recibo-envio-linha">
              <input
                id="recibo-email"
                type="email"
                placeholder={
                  venda.cliente_nome
                    ? "Deixe em branco para usar o email do cliente"
                    : "email@exemplo.com"
                }
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                disabled={enviando}
              />
              <button className="btn primario" type="submit" disabled={enviando}>
                {enviando ? "Enviando…" : "Enviar"}
              </button>
            </div>
          </form>
        )}

        <div className="recibo-acoes no-print">
          <button
            className="btn secundario"
            onClick={() => setMostrarEnvio((v) => !v)}
          >
            Enviar por email
          </button>
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
