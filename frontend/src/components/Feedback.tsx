import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

// ------------------------------------------------------------------
// Sistema de feedback global: notificações (toasts) e confirmação.
// Um único provider expõe dois hooks: useToast() e useConfirm().
// ------------------------------------------------------------------

type TipoToast = "sucesso" | "erro" | "info";

interface ToastItem {
  id: number;
  tipo: TipoToast;
  texto: string;
}

interface ToastAPI {
  sucesso: (texto: string) => void;
  erro: (texto: string) => void;
  info: (texto: string) => void;
}

interface ConfirmOpts {
  titulo: string;
  mensagem?: string;
  confirmar?: string;
  cancelar?: string;
  perigo?: boolean;
}

type ConfirmFn = (opts: ConfirmOpts) => Promise<boolean>;

const ToastCtx = createContext<ToastAPI | null>(null);
const ConfirmCtx = createContext<ConfirmFn | null>(null);

export function useToast(): ToastAPI {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast precisa estar dentro de <FeedbackProvider>");
  return ctx;
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmCtx);
  if (!ctx) throw new Error("useConfirm precisa estar dentro de <FeedbackProvider>");
  return ctx;
}

const ICONES: Record<TipoToast, ReactNode> = {
  sucesso: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  erro: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8h.01M11 12h1v4h1" />
    </svg>
  ),
};

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const remover = useCallback((id: number) => {
    setToasts((atual) => atual.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (tipo: TipoToast, texto: string) => {
      const id = ++idRef.current;
      setToasts((atual) => [...atual, { id, tipo, texto }]);
      window.setTimeout(() => remover(id), 3800);
    },
    [remover]
  );

  const toastApi = useMemo<ToastAPI>(
    () => ({
      sucesso: (t) => push("sucesso", t),
      erro: (t) => push("erro", t),
      info: (t) => push("info", t),
    }),
    [push]
  );

  // Confirmação: guarda as opções e a função de resolução da Promise.
  const [confirmState, setConfirmState] = useState<{
    opts: ConfirmOpts;
    resolve: (v: boolean) => void;
  } | null>(null);

  const confirmar = useCallback<ConfirmFn>(
    (opts) => new Promise<boolean>((resolve) => setConfirmState({ opts, resolve })),
    []
  );

  function responder(valor: boolean) {
    confirmState?.resolve(valor);
    setConfirmState(null);
  }

  return (
    <ToastCtx.Provider value={toastApi}>
      <ConfirmCtx.Provider value={confirmar}>
        {children}

        <div className="toast-container" aria-live="polite" aria-atomic="false">
          {toasts.map((t) => (
            <div key={t.id} className={`toast toast-${t.tipo}`} role="status">
              <span className="toast-icone">{ICONES[t.tipo]}</span>
              <span className="toast-texto">{t.texto}</span>
              <button
                type="button"
                className="toast-fechar"
                onClick={() => remover(t.id)}
                aria-label="Fechar"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        {confirmState && (
          <div className="recibo-overlay" onClick={() => responder(false)}>
            <div
              className="modal-box modal-confirm"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <h2>{confirmState.opts.titulo}</h2>
              {confirmState.opts.mensagem && (
                <p className="muted" style={{ marginTop: "0.35rem" }}>
                  {confirmState.opts.mensagem}
                </p>
              )}
              <div className="form-acoes">
                <button
                  type="button"
                  className={`btn ${confirmState.opts.perigo ? "perigo" : "primario"}`}
                  onClick={() => responder(true)}
                  autoFocus
                >
                  {confirmState.opts.confirmar ?? "Confirmar"}
                </button>
                <button
                  type="button"
                  className="btn secundario"
                  onClick={() => responder(false)}
                >
                  {confirmState.opts.cancelar ?? "Cancelar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </ConfirmCtx.Provider>
    </ToastCtx.Provider>
  );
}
