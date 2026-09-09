import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Defeito, DefeitoResumo, FiltroDefeito } from "../types";
import {
  listarDefeitos,
  obterResumoDefeitos,
  reabrirDefeito,
  resolverDefeito,
} from "../services/defeitos";
import EstadoVazio from "../components/EstadoVazio";
import EstadoErro from "../components/EstadoErro";
import { SkeletonTabela } from "../components/Skeleton";
import { useToast } from "../components/Feedback";
import { brl, dataHora, extrairErro } from "../lib/ui";
import { rotuloMotivo } from "../lib/vendas";

const FILTROS: { valor: FiltroDefeito; rotulo: string }[] = [
  { valor: "pendente", rotulo: "Pendentes" },
  { valor: "resolvido", rotulo: "Resolvidos" },
  { valor: "todos", rotulo: "Todos" },
];

const SEM_FORNECEDOR = "Fornecedor não identificado";

/** Fornecedores distintos das peças de uma troca. */
function fornecedoresDe(defeito: Defeito): string[] {
  const nomes = new Set<string>();
  for (const item of defeito.itens) {
    nomes.add(item.fornecedor_nome || SEM_FORNECEDOR);
  }
  return [...nomes];
}

export default function DefeitosPage() {
  const toast = useToast();
  const [lista, setLista] = useState<Defeito[]>([]);
  const [resumo, setResumo] = useState<DefeitoResumo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroDefeito>("pendente");

  // Troca selecionada para dar baixa, com a observação do acerto.
  const [defeitoBaixa, setDefeitoBaixa] = useState<Defeito | null>(null);
  const [obsBaixa, setObsBaixa] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Id em processamento (reabrir), para desabilitar o botão da linha.
  const [processando, setProcessando] = useState<number | null>(null);

  async function carregar(alvo: FiltroDefeito = filtro) {
    setCarregando(true);
    setErro(null);
    try {
      const [defeitos, totais] = await Promise.all([
        listarDefeitos(alvo),
        obterResumoDefeitos(),
      ]);
      setLista(defeitos);
      setResumo(totais);
    } catch (err) {
      setErro(extrairErro(err));
    } finally {
      setCarregando(false);
    }
  }

  // Recarrega ao abrir a tela e a cada troca de filtro.
  useEffect(() => {
    carregar(filtro);
  }, [filtro]);

  // Agrupamento por fornecedor: quem chamar e quantas peças cobrar.
  const porFornecedor = useMemo(() => {
    const mapa = new Map<string, { pecas: number; custo: number; trocas: number }>();
    for (const d of lista) {
      if (d.status_fornecedor !== "pendente") continue;
      for (const item of d.itens) {
        const chave = item.fornecedor_nome || SEM_FORNECEDOR;
        const atual = mapa.get(chave) ?? { pecas: 0, custo: 0, trocas: 0 };
        atual.pecas += item.quantidade;
        atual.custo += (parseFloat(item.custo_unitario) || 0) * item.quantidade;
        atual.trocas += 1;
        mapa.set(chave, atual);
      }
    }
    return [...mapa.entries()].sort((a, b) => b[1].pecas - a[1].pecas);
  }, [lista]);

  async function confirmarBaixa() {
    if (!defeitoBaixa) return;
    setSalvando(true);
    try {
      await resolverDefeito(defeitoBaixa.devolucao_id, obsBaixa.trim() || null);
      const id = defeitoBaixa.devolucao_id;
      setDefeitoBaixa(null);
      setObsBaixa("");
      await carregar(filtro);
      toast.sucesso(`Troca #${id} baixada: acerto com o fornecedor concluído.`);
    } catch (err) {
      toast.erro(extrairErro(err));
    } finally {
      setSalvando(false);
    }
  }

  async function reabrir(defeito: Defeito) {
    setProcessando(defeito.devolucao_id);
    try {
      await reabrirDefeito(defeito.devolucao_id);
      await carregar(filtro);
      toast.sucesso(`Troca #${defeito.devolucao_id} voltou para os pendentes.`);
    } catch (err) {
      toast.erro(extrairErro(err));
    } finally {
      setProcessando(null);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <span className="title-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.3 3.6 1.8 18a1.8 1.8 0 0 0 1.6 2.7h17.2a1.8 1.8 0 0 0 1.6-2.7L13.7 3.6a1.8 1.8 0 0 0-3.4 0z" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
          </span>
          <div>
            <h1>Defeitos com o fornecedor</h1>
            <p className="pdv-sub">
              Peças que voltaram com defeito e ainda precisam ser trocadas ou
              creditadas pelo fornecedor. Dê baixa quando o acerto for feito.
            </p>
          </div>
        </div>
        <Link to="/vendas/historico" className="btn secundario">
          Ir para o histórico
        </Link>
      </div>

      {erro && lista.length > 0 && <div className="alert erro">{erro}</div>}

      <div className="kpis" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="kpi">
          <span className="kpi-label">Trocas pendentes</span>
          <span className="kpi-valor">{resumo?.pendentes ?? 0}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Peças a acertar</span>
          <span className="kpi-valor">{resumo?.pecas_pendentes ?? 0}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Custo parado</span>
          <span className="kpi-valor">{brl(resumo?.custo_pendente ?? 0)}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Já resolvidas</span>
          <span className="kpi-valor verde">{resumo?.resolvidos ?? 0}</span>
        </div>
      </div>

      {filtro !== "resolvido" && porFornecedor.length > 0 && (
        <div className="card">
          <h2>A cobrar por fornecedor</h2>
          <ul className="defeito-fornecedores">
            {porFornecedor.map(([nome, dados]) => (
              <li key={nome}>
                <span className="df-nome">{nome}</span>
                <span className="df-dados">
                  {dados.pecas} {dados.pecas === 1 ? "peça" : "peças"} ·{" "}
                  {brl(dados.custo)} em custo
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <div className="toolbar">
          <div className="cr-filtro" role="group" aria-label="Filtrar defeitos">
            {FILTROS.map((f) => (
              <button
                key={f.valor}
                type="button"
                className={`cr-filtro-btn${filtro === f.valor ? " ativo" : ""}`}
                onClick={() => setFiltro(f.valor)}
                aria-pressed={filtro === f.valor}
              >
                {f.rotulo}
              </button>
            ))}
          </div>
          <span className="contagem">
            {lista.length} {lista.length === 1 ? "troca" : "trocas"}
          </span>
        </div>

        {carregando ? (
          <SkeletonTabela />
        ) : erro && lista.length === 0 ? (
          <EstadoErro mensagem={erro} onTentarNovamente={() => carregar(filtro)} />
        ) : lista.length === 0 ? (
          <EstadoVazio
            tom={filtro === "pendente" ? "sucesso" : "neutro"}
            titulo={
              filtro === "pendente"
                ? "Nenhum defeito pendente"
                : filtro === "resolvido"
                  ? "Nenhum acerto concluído ainda"
                  : "Nenhum defeito registrado"
            }
            descricao={
              filtro === "pendente"
                ? "Quando uma troca for marcada como defeito no histórico de vendas, ela aparece aqui até o fornecedor resolver."
                : "Ao dar baixa em um defeito, ele passa a aparecer nesta lista."
            }
          />
        ) : (
          <table className="tabela tabela-cards">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Peças</th>
                <th>Fornecedor</th>
                <th>Origem</th>
                <th className="num">Custo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((d) => {
                const pendente = d.status_fornecedor === "pendente";
                return (
                  <tr key={d.devolucao_id}>
                    <td data-label="Quando" className="muted">
                      {dataHora(d.criado_em)}
                      {!pendente && (
                        <div className="chip mov-entrada" style={{ marginTop: "0.3rem" }}>
                          Resolvido
                        </div>
                      )}
                    </td>
                    <td data-label="Peças">
                      <ul className="defeito-itens">
                        {d.itens.map((item, i) => (
                          <li key={`${d.devolucao_id}-${item.produto_id ?? i}`}>
                            <strong>{item.quantidade}×</strong> {item.produto_nome}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td data-label="Fornecedor">
                      {fornecedoresDe(d).map((nome) => (
                        <div
                          key={nome}
                          className={nome === SEM_FORNECEDOR ? "muted" : undefined}
                        >
                          {nome}
                        </div>
                      ))}
                    </td>
                    <td data-label="Origem">
                      <div>Venda #{d.venda_id}</div>
                      <div className="muted">
                        {d.cliente_nome ?? "Sem cliente"} · {rotuloMotivo(d.motivo)}
                      </div>
                      {d.observacao && <div className="muted">{d.observacao}</div>}
                      {!pendente && d.resolvido_em && (
                        <div className="muted">
                          Baixado em {dataHora(d.resolvido_em)}
                          {d.resolucao_observacao && ` · ${d.resolucao_observacao}`}
                        </div>
                      )}
                    </td>
                    <td data-label="Custo" className="num">
                      <strong>{brl(d.custo_total)}</strong>
                      <div className="muted">venda {brl(d.valor_devolvido)}</div>
                    </td>
                    <td className="acoes">
                      {pendente ? (
                        <button
                          type="button"
                          className="btn primario pequeno"
                          onClick={() => {
                            setDefeitoBaixa(d);
                            setObsBaixa("");
                          }}
                        >
                          Dar baixa
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn secundario pequeno"
                          onClick={() => reabrir(d)}
                          disabled={processando === d.devolucao_id}
                        >
                          {processando === d.devolucao_id
                            ? "Reabrindo..."
                            : "Reabrir"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {defeitoBaixa && (
        <div className="recibo-overlay" onClick={() => setDefeitoBaixa(null)}>
          <div className="modal-box form" onClick={(e) => e.stopPropagation()}>
            <h2>Dar baixa no defeito · troca #{defeitoBaixa.devolucao_id}</h2>
            <p className="muted" style={{ marginBottom: "1rem" }}>
              Use isto quando o fornecedor já tiver resolvido:{" "}
              {defeitoBaixa.itens
                .map((i) => `${i.quantidade}× ${i.produto_nome}`)
                .join(", ")}
              {" · "}
              {brl(defeitoBaixa.custo_total)} em custo.
            </p>

            <label>
              Como foi resolvido? (opcional)
              <input
                value={obsBaixa}
                onChange={(e) => setObsBaixa(e.target.value)}
                placeholder="Ex.: fornecedor trocou a peça / deu crédito de R$ 8,00"
                autoFocus
              />
            </label>

            <div className="form-acoes">
              <button
                className="btn primario"
                onClick={confirmarBaixa}
                disabled={salvando}
              >
                {salvando ? "Salvando..." : "Confirmar baixa"}
              </button>
              <button
                type="button"
                className="btn secundario"
                onClick={() => setDefeitoBaixa(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
