import { useMemo, useState } from "react";
import type { FormaRecebimento, Venda } from "../types";
import { registrarPagamento } from "../services/vendas";
import { useToast } from "./Feedback";
import { statusParcelas } from "../lib/fiado";
import { brl, dataBR, dataHora, extrairErro } from "../lib/ui";

const FORMAS: { valor: FormaRecebimento; rotulo: string }[] = [
  { valor: "dinheiro", rotulo: "Dinheiro" },
  { valor: "pix", rotulo: "PIX" },
  { valor: "cartao_credito", rotulo: "Crédito" },
  { valor: "cartao_debito", rotulo: "Débito" },
  { valor: "outro", rotulo: "Outro" },
];

// Modal para registrar o recebimento (quitação parcial ou total) de uma venda
// a prazo. Usado no histórico, na ficha do cliente e nas contas a receber.
export default function ReceberPagamentoModal({
  venda,
  onFechar,
  onSucesso,
}: {
  venda: Venda;
  onFechar: () => void;
  onSucesso: (venda: Venda) => void;
}) {
  const toast = useToast();
  const saldo = parseFloat(venda.saldo_devedor) || 0;

  // Situação de cada parcela em relação ao total já pago (ver lib/fiado).
  const parcelasInfo = useMemo(() => statusParcelas(venda), [venda]);

  const temParcelas = parcelasInfo.length > 0;
  const primeiraAberta = parcelasInfo.find((p) => p.status !== "paga");

  const [valor, setValor] = useState(
    primeiraAberta ? primeiraAberta.restante.toFixed(2) : venda.saldo_devedor
  );
  const [parcelaSel, setParcelaSel] = useState<number | null>(
    primeiraAberta?.numero ?? null
  );
  const [forma, setForma] = useState<FormaRecebimento>("dinheiro");
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const valorNum = parseFloat(valor) || 0;

  function selecionarParcela(numero: number, restante: number) {
    setParcelaSel(numero);
    setValor(restante.toFixed(2));
    setErro(null);
  }

  function alterarValor(novo: string) {
    setValor(novo);
    // Edição manual "desvincula" da parcela selecionada (o valor pode ser
    // diferente do exato da parcela, ex.: cliente pagou a mais).
    setParcelaSel(null);
  }

  async function confirmar() {
    if (valorNum <= 0) {
      setErro("Informe um valor maior que zero.");
      return;
    }
    if (valorNum > saldo + 0.001) {
      setErro(`Valor acima do saldo devedor (${brl(saldo)}).`);
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const atualizada = await registrarPagamento(venda.id, {
        valor: valorNum,
        forma_pagamento: forma,
        observacao: obs.trim() || null,
      });
      const restante = parseFloat(atualizada.saldo_devedor) || 0;
      toast.sucesso(
        restante > 0
          ? `Pagamento de ${brl(valorNum)} registrado. Falta ${brl(restante)}.`
          : `Venda #${venda.id} quitada!`
      );
      onSucesso(atualizada);
    } catch (err) {
      setErro(extrairErro(err));
    } finally {
      setSalvando(false);
    }
  }

  function preencherTotal() {
    setValor(venda.saldo_devedor);
    setParcelaSel(null);
  }

  return (
    <div className="recibo-overlay" onClick={onFechar}>
      <div className="modal-box form" onClick={(e) => e.stopPropagation()}>
        <h2>Receber · venda #{venda.id}</h2>
        <p className="muted" style={{ marginBottom: "1rem" }}>
          {venda.cliente_nome ?? "Cliente"} · a prazo desde{" "}
          {dataHora(venda.criado_em)}
        </p>

        {erro && <div className="alert erro">{erro}</div>}

        <div className="kpis">
          <div className="kpi">
            <span className="kpi-label">Total da venda</span>
            <span className="kpi-valor">{brl(venda.total_liquido)}</span>
          </div>
          <div className="kpi">
            <span className="kpi-label">Já pago</span>
            <span className="kpi-valor verde">{brl(venda.total_pago)}</span>
          </div>
          <div className="kpi">
            <span className="kpi-label">Saldo devedor</span>
            <span className="kpi-valor ambar">{brl(saldo)}</span>
          </div>
        </div>

        {temParcelas && (
          <div className="receber-parcelas">
            <span className="pdv-label">Parcelas — toque para preencher o valor</span>
            <ul className="receber-parcelas-lista">
              {parcelasInfo.map((p) => {
                const paga = p.status === "paga";
                const selecionada = parcelaSel === p.numero;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      className={`receber-parcela${selecionada ? " ativo" : ""}${paga ? " paga" : ""}`}
                      onClick={() => selecionarParcela(p.numero, p.restante)}
                      disabled={paga}
                    >
                      <span className="receber-parcela-info">
                        <strong>{p.numero}ª parcela</strong>
                        <span className="muted">vence {dataBR(p.vencimento)}</span>
                      </span>
                      <span className="receber-parcela-valor">
                        {brl(p.valorNum)}
                        {p.status === "paga" && (
                          <span className="chip quitado">
                            {p.pagoEm ? `Paga em ${dataBR(p.pagoEm)}` : "Paga"}
                          </span>
                        )}
                        {p.status === "parcial" && (
                          <span className="chip fiado">Falta {brl(p.restante)}</span>
                        )}
                        {p.status === "aberta" && (
                          <span className="chip mov-ajuste">Em aberto</span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="grid-2" style={{ marginTop: "1rem" }}>
          <label>
            Valor recebido (R$)
            <div className="linha-inline">
              <input
                type="number"
                step="0.01"
                min="0"
                max={saldo}
                value={valor}
                autoFocus
                onChange={(e) => alterarValor(e.target.value)}
              />
              <button
                type="button"
                className="btn secundario pequeno"
                onClick={preencherTotal}
              >
                Tudo
              </button>
            </div>
          </label>
          <label>
            Forma
            <select
              value={forma}
              onChange={(e) => setForma(e.target.value as FormaRecebimento)}
            >
              {FORMAS.map((f) => (
                <option key={f.valor} value={f.valor}>
                  {f.rotulo}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label style={{ marginTop: "1rem" }}>
          Observação (opcional)
          <input
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Ex.: pagou metade agora"
          />
        </label>

        <div className="form-acoes">
          <button
            className="btn primario"
            onClick={confirmar}
            disabled={salvando || valorNum <= 0}
          >
            {salvando ? "Registrando..." : `Registrar ${brl(valorNum)}`}
          </button>
          <button type="button" className="btn secundario" onClick={onFechar}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
