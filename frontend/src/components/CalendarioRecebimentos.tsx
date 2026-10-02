import { useMemo, useState } from "react";
import type { ParcelaAReceber } from "../types";
import { brl } from "../lib/ui";

interface Props {
  parcelas: ParcelaAReceber[];
  /** Dia selecionado (YYYY-MM-DD) e callback para trocar a seleção. */
  selecionado: string | null;
  onSelecionar: (dataISO: string | null) => void;
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

function isoDia(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function hojeISO(): string {
  const h = new Date();
  return isoDia(h.getFullYear(), h.getMonth(), h.getDate());
}

/**
 * Calendário mensal compacto: cada dia com parcelas a receber mostra uma
 * marcação com o valor do dia. Clicar num dia filtra o resto da tela para
 * aquela data (via `onSelecionar`); clicar de novo limpa a seleção.
 */
export default function CalendarioRecebimentos({
  parcelas,
  selecionado,
  onSelecionar,
}: Props) {
  const hoje = hojeISO();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { ano: d.getFullYear(), mes: d.getMonth() };
  });

  // Soma o valor (e o lucro embutido) em aberto por dia de vencimento (YYYY-MM-DD).
  const porDia = useMemo(() => {
    const mapa = new Map<string, { total: number; lucro: number; vencidas: number; qtd: number }>();
    for (const p of parcelas) {
      const atual = mapa.get(p.vencimento) ?? { total: 0, lucro: 0, vencidas: 0, qtd: 0 };
      atual.total += parseFloat(p.valor_restante) || 0;
      atual.lucro += parseFloat(p.lucro_restante) || 0;
      atual.qtd += 1;
      if (p.vencida) atual.vencidas += 1;
      mapa.set(p.vencimento, atual);
    }
    return mapa;
  }, [parcelas]);

  const primeiroDia = new Date(cursor.ano, cursor.mes, 1);
  const ultimoDia = new Date(cursor.ano, cursor.mes + 1, 0).getDate();
  const offsetSemana = primeiroDia.getDay(); // 0 = domingo

  const celulas: Array<{ dia: number; iso: string } | null> = [];
  for (let i = 0; i < offsetSemana; i++) celulas.push(null);
  for (let dia = 1; dia <= ultimoDia; dia++) {
    celulas.push({ dia, iso: isoDia(cursor.ano, cursor.mes, dia) });
  }

  function mesAnterior() {
    setCursor((c) => (c.mes === 0 ? { ano: c.ano - 1, mes: 11 } : { ano: c.ano, mes: c.mes - 1 }));
  }
  function mesSeguinte() {
    setCursor((c) => (c.mes === 11 ? { ano: c.ano + 1, mes: 0 } : { ano: c.ano, mes: c.mes + 1 }));
  }
  function irParaHoje() {
    const d = new Date();
    setCursor({ ano: d.getFullYear(), mes: d.getMonth() });
  }

  function clicarDia(iso: string) {
    onSelecionar(selecionado === iso ? null : iso);
  }

  const resumoSelecionado = selecionado ? porDia.get(selecionado) : undefined;

  return (
    <div className="calendario-recebimentos">
      <div className="calendario-topo">
        <button type="button" className="btn secundario pequeno" onClick={mesAnterior} aria-label="Mês anterior">
          ‹
        </button>
        <span className="calendario-titulo">
          {MESES[cursor.mes]} {cursor.ano}
        </span>
        <button type="button" className="btn secundario pequeno" onClick={mesSeguinte} aria-label="Próximo mês">
          ›
        </button>
        <button type="button" className="btn secundario pequeno calendario-hoje" onClick={irParaHoje}>
          Hoje
        </button>
      </div>

      <div className="calendario-grade calendario-cabecalho">
        {DIAS_SEMANA.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>

      <div className="calendario-grade">
        {celulas.map((cel, i) => {
          if (!cel) return <span key={`vazio-${i}`} className="calendario-dia vazio-dia" />;
          const info = porDia.get(cel.iso);
          const ehHoje = cel.iso === hoje;
          const ativo = cel.iso === selecionado;
          const temValor = info && info.total > 0;
          return (
            <button
              type="button"
              key={cel.iso}
              className={`calendario-dia${ehHoje ? " hoje" : ""}${ativo ? " selecionado" : ""}${temValor ? " tem-valor" : ""}${info && info.vencidas > 0 ? " tem-atraso" : ""}`}
              onClick={() => clicarDia(cel.iso)}
              disabled={!temValor}
              title={
                temValor
                  ? `${brl(info!.total)} (lucro ${brl(info!.lucro)}) · ${info!.qtd} ${info!.qtd === 1 ? "parcela" : "parcelas"}`
                  : undefined
              }
            >
              <span className="calendario-dia-num">{cel.dia}</span>
              {temValor && (
                <span className="calendario-dia-valor">{brl(info!.total)}</span>
              )}
            </button>
          );
        })}
      </div>

      {selecionado && (
        <div className="calendario-resumo-dia">
          {resumoSelecionado ? (
            <>
              <strong>{brl(resumoSelecionado.total)}</strong> a receber em{" "}
              {selecionado.split("-").reverse().join("/")}
              <span className="texto-verde"> · lucro {brl(resumoSelecionado.lucro)}</span>{" "}
              ({resumoSelecionado.qtd}{" "}
              {resumoSelecionado.qtd === 1 ? "parcela" : "parcelas"}
              {resumoSelecionado.vencidas > 0 && (
                <span className="texto-vermelho"> · {resumoSelecionado.vencidas} vencida(s)</span>
              )}
              )
              <button type="button" className="btn secundario pequeno" onClick={() => onSelecionar(null)}>
                Limpar
              </button>
            </>
          ) : (
            <>
              Nenhuma parcela em {selecionado.split("-").reverse().join("/")}.
              <button type="button" className="btn secundario pequeno" onClick={() => onSelecionar(null)}>
                Limpar
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
