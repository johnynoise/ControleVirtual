import { useEffect, useMemo, useState } from "react";
import type { RenegociacaoParcela, Venda } from "../types";
import { renegociarDivida } from "../services/vendas";
import { useToast } from "./Feedback";
import { brl, dataBR, extrairErro } from "../lib/ui";

// Data (YYYY-MM-DD, fuso local) daqui a `offsetDias` dias — mesmo padrão usado
// no parcelamento do PDV, como sugestão inicial de vencimento.
function dataISO(offsetDias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDias);
  return d.toISOString().slice(0, 10);
}

// Modal para renegociar a dívida em aberto de um cliente: soma o saldo
// devedor de todas as vendas a prazo abertas e permite reparcelar o total em
// até 5 novas parcelas, criando uma venda consolidada. Usado nas contas a
// receber quando o cliente tem uma ou mais compras a prazo em aberto.
export default function RenegociarDividaModal({
  clienteId,
  clienteNome,
  vendasAbertas,
  onFechar,
  onSucesso,
}: {
  clienteId: number;
  clienteNome: string;
  vendasAbertas: Venda[];
  onFechar: () => void;
  onSucesso: () => void;
}) {
  const toast = useToast();

  const totalDivida = useMemo(
    () =>
      vendasAbertas.reduce((acc, v) => acc + (parseFloat(v.saldo_devedor) || 0), 0),
    [vendasAbertas]
  );

  const [numParcelas, setNumParcelas] = useState<1 | 2 | 3 | 4 | 5>(2);
  const [vencimentos, setVencimentos] = useState<string[]>([]);
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Divide o total em partes iguais, jogando a sobra de arredondamento na
  // última parcela (ex.: 100/3 → 33,33 · 33,33 · 33,34). Mesma lógica do PDV.
  const valoresParcelas = useMemo(() => {
    const n = numParcelas;
    if (n <= 0 || totalDivida <= 0) return [];
    const centavos = Math.round(totalDivida * 100);
    const base = Math.floor(centavos / n);
    const resto = centavos - base * n;
    const valores: number[] = [];
    for (let i = 0; i < n; i++) {
      valores.push((base + (i === n - 1 ? resto : 0)) / 100);
    }
    return valores;
  }, [numParcelas, totalDivida]);

  useEffect(() => {
    setVencimentos((atual) => {
      const novo = atual.slice(0, numParcelas);
      for (let k = 0; k < numParcelas; k++) {
        if (!novo[k]) novo[k] = dataISO(30 * (k + 1));
      }
      return novo;
    });
  }, [numParcelas]);

  function definirVencimento(indice: number, valor: string) {
    setErro(null);
    setVencimentos((atual) => {
      const novo = [...atual];
      novo[indice] = valor;
      return novo;
    });
  }

  async function confirmar() {
    if (totalDivida <= 0) {
      setErro("Este cliente não tem dívida em aberto para renegociar.");
      return;
    }
    if (vencimentos.slice(0, numParcelas).some((d) => !d)) {
      setErro("Informe a data de vencimento de cada parcela.");
      return;
    }

    const parcelas: RenegociacaoParcela[] = valoresParcelas.map((valor, k) => ({
      numero: k + 1,
      valor,
      vencimento: vencimentos[k],
    }));

    setSalvando(true);
    setErro(null);
    try {
      const resultado = await renegociarDivida(clienteId, {
        parcelas,
        observacao: observacao.trim() || null,
      });
      toast.sucesso(
        `Dívida de ${clienteNome} renegociada: ${brl(resultado.total_renegociado)} em ${numParcelas}x.`
      );
      onSucesso();
    } catch (err) {
      setErro(extrairErro(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="recibo-overlay" onClick={onFechar}>
      <div className="modal-box form" onClick={(e) => e.stopPropagation()}>
        <h2>Renegociar dívida</h2>
        <p className="muted" style={{ marginBottom: "1rem" }}>
          {clienteNome} · {vendasAbertas.length}{" "}
          {vendasAbertas.length === 1 ? "compra" : "compras"} a prazo em aberto
        </p>

        {erro && <div className="alert erro">{erro}</div>}

        <div className="kpis">
          <div className="kpi">
            <span className="kpi-label">Compras em aberto</span>
            <span className="kpi-valor">{vendasAbertas.length}</span>
          </div>
          <div className="kpi">
            <span className="kpi-label">Total a renegociar</span>
            <span className="kpi-valor ambar">{brl(totalDivida)}</span>
          </div>
        </div>

        <div className="fiado-compras" style={{ marginBottom: "1rem" }}>
          {vendasAbertas.map((v) => (
            <div key={v.id} className="fiado-compra">
              <div className="fiado-compra-topo">
                <span className="fiado-compra-titulo">
                  Venda #{v.id}
                  <span className="muted"> · {dataBR(v.criado_em)}</span>
                </span>
                <span className="fiado-compra-saldo">
                  Falta{" "}
                  <strong className="texto-ambar">{brl(v.saldo_devedor)}</strong>
                  <span className="muted"> de {brl(v.total_liquido)}</span>
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="pdv-parcelamento">
          <span className="pdv-label">Novo parcelamento</span>
          <div className="pdv-parcelas-opcoes" role="group" aria-label="Número de parcelas">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className={`pdv-parcela-opcao${numParcelas === n ? " ativo" : ""}`}
                onClick={() => setNumParcelas(n as 1 | 2 | 3 | 4 | 5)}
                aria-pressed={numParcelas === n}
              >
                {n}x
              </button>
            ))}
          </div>

          <ul className="pdv-parcelas-lista">
            {valoresParcelas.map((valor, k) => (
              <li key={k} className="pdv-parcela-linha">
                <span className="pdv-parcela-rotulo">
                  {k + 1}ª parcela
                  <strong>{brl(valor)}</strong>
                </span>
                <label className="pdv-parcela-data">
                  <span>Vence em</span>
                  <input
                    type="date"
                    value={vencimentos[k] ?? ""}
                    onChange={(e) => definirVencimento(k, e.target.value)}
                  />
                </label>
              </li>
            ))}
          </ul>
        </div>

        <label style={{ marginTop: "1rem" }}>
          Observação (opcional)
          <input
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Ex.: cliente combinou pagar em 2x"
          />
        </label>

        <div className="form-acoes">
          <button
            className="btn primario"
            onClick={confirmar}
            disabled={salvando || totalDivida <= 0}
          >
            {salvando ? "Renegociando..." : `Renegociar ${brl(totalDivida)}`}
          </button>
          <button type="button" className="btn secundario" onClick={onFechar}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
