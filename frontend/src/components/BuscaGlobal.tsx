import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Cliente, Produto } from "../types";
import { listarProdutos } from "../services/produtos";
import { listarClientes } from "../services/clientes";
import { brl, corAvatar, iniciais } from "../lib/ui";

// Páginas navegáveis pela busca global (também servem de atalho de navegação).
const PAGINAS: { rotulo: string; to: string; palavras?: string }[] = [
  { rotulo: "Início", to: "/dashboard", palavras: "dashboard painel resumo" },
  { rotulo: "Vender (PDV)", to: "/vendas", palavras: "venda caixa balcao ponto de venda" },
  { rotulo: "Histórico de vendas", to: "/vendas/historico", palavras: "vendas recibos" },
  { rotulo: "Produtos", to: "/produtos", palavras: "estoque catalogo" },
  { rotulo: "Estoque", to: "/movimentacoes", palavras: "movimentacoes entrada saida ajuste" },
  { rotulo: "Fornecedores", to: "/fornecedores", palavras: "compras" },
  { rotulo: "Clientes", to: "/clientes", palavras: "" },
  { rotulo: "A prazo (contas a receber)", to: "/contas-a-receber", palavras: "devedor divida fiado a prazo" },
  { rotulo: "Categorias", to: "/categorias", palavras: "" },
  { rotulo: "Relatórios", to: "/relatorios", palavras: "curva abc kardex giro ranking" },
];

const LIMITE = 6;

type Item =
  | { tipo: "pagina"; chave: string; rotulo: string; to: string }
  | { tipo: "cliente"; chave: string; rotulo: string; sub: string; to: string }
  | { tipo: "produto"; chave: string; rotulo: string; sub: string; cor: string; to: string };

interface Grupo {
  titulo: string;
  itens: Item[];
}

export default function BuscaGlobal({
  aberto,
  onFechar,
}: {
  aberto: boolean;
  onFechar: () => void;
}) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);

  const [termo, setTermo] = useState("");
  const [selecionado, setSelecionado] = useState(0);

  // Dados carregados uma única vez (na primeira abertura) e reaproveitados.
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    if (!aberto || carregado) return;
    let ativo = true;
    Promise.all([
      listarProdutos({ apenas_ativos: true }),
      listarClientes({ apenas_ativos: true }),
    ])
      .then(([prods, clis]) => {
        if (!ativo) return;
        setProdutos(prods);
        setClientes(clis);
        setCarregado(true);
      })
      .catch(() => {
        /* Busca é complementar: falha silenciosa mantém ao menos as páginas. */
      });
    return () => {
      ativo = false;
    };
  }, [aberto, carregado]);

  // Foca o campo e limpa o termo a cada abertura.
  useEffect(() => {
    if (aberto) {
      setTermo("");
      setSelecionado(0);
      // Espera o modal montar antes de focar.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [aberto]);

  const grupos = useMemo<Grupo[]>(() => {
    const t = termo.trim().toLowerCase();
    const lista: Grupo[] = [];

    const paginas = PAGINAS.filter(
      (p) =>
        !t ||
        p.rotulo.toLowerCase().includes(t) ||
        (p.palavras ?? "").includes(t)
    ).map<Item>((p) => ({
      tipo: "pagina",
      chave: `pag-${p.to}`,
      rotulo: p.rotulo,
      to: p.to,
    }));
    if (paginas.length) lista.push({ titulo: "Ir para", itens: paginas });

    if (t) {
      const clis = clientes
        .filter(
          (c) =>
            c.nome.toLowerCase().includes(t) ||
            (c.telefone ?? "").toLowerCase().includes(t) ||
            (c.email ?? "").toLowerCase().includes(t)
        )
        .slice(0, LIMITE)
        .map<Item>((c) => {
          // Mostra o campo que casou com a busca, para o motivo do resultado
          // ficar claro (ex.: buscou "johny" e casou pelo e-mail).
          const casaTel = (c.telefone ?? "").toLowerCase().includes(t);
          const casaEmail = (c.email ?? "").toLowerCase().includes(t);
          const sub =
            casaEmail && !casaTel
              ? c.email!
              : c.telefone || c.email || "Cliente";
          return {
            tipo: "cliente",
            chave: `cli-${c.id}`,
            rotulo: c.nome,
            sub,
            to: `/clientes/${c.id}`,
          };
        });
      if (clis.length) lista.push({ titulo: "Clientes", itens: clis });

      const prods = produtos
        .filter((p) =>
          [p.nome, p.sku, p.codigo_barras]
            .filter(Boolean)
            .some((campo) => (campo as string).toLowerCase().includes(t))
        )
        .slice(0, LIMITE)
        .map<Item>((p) => ({
          tipo: "produto",
          chave: `prod-${p.id}`,
          rotulo: p.nome,
          sub: `${brl(p.preco_venda)} · ${p.estoque_total} un`,
          cor: corAvatar(p.nome),
          to: `/produtos?busca=${encodeURIComponent(p.nome)}`,
        }));
      if (prods.length) lista.push({ titulo: "Produtos", itens: prods });
    }

    return lista;
  }, [termo, clientes, produtos]);

  // Lista achatada para a navegação por teclado.
  const itensPlanos = useMemo(() => grupos.flatMap((g) => g.itens), [grupos]);

  // Mantém a seleção dentro dos limites quando os resultados mudam.
  useEffect(() => {
    setSelecionado((s) => (s >= itensPlanos.length ? 0 : s));
  }, [itensPlanos.length]);

  // Rola o item selecionado para a área visível.
  useEffect(() => {
    const el = listaRef.current?.querySelector<HTMLElement>(
      `[data-idx="${selecionado}"]`
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [selecionado]);

  function acionar(item: Item | undefined) {
    if (!item) return;
    onFechar();
    navigate(item.to);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelecionado((s) => (itensPlanos.length ? (s + 1) % itensPlanos.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelecionado((s) =>
        itensPlanos.length ? (s - 1 + itensPlanos.length) % itensPlanos.length : 0
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      acionar(itensPlanos[selecionado]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onFechar();
    }
  }

  if (!aberto) return null;

  let indice = -1;

  return (
    <div className="busca-global-overlay" onClick={onFechar}>
      <div
        className="busca-global"
        role="dialog"
        aria-modal="true"
        aria-label="Busca global"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="busca-global-campo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Buscar produtos, clientes ou páginas..."
            aria-label="Buscar"
          />
          <kbd>Esc</kbd>
        </div>

        <div className="busca-global-lista" ref={listaRef}>
          {itensPlanos.length === 0 ? (
            <p className="busca-global-vazio">
              {termo.trim()
                ? "Nada encontrado."
                : "Digite para buscar produtos, clientes ou páginas."}
            </p>
          ) : (
            grupos.map((g) => (
              <div key={g.titulo} className="busca-global-grupo">
                <div className="busca-global-grupo-titulo">{g.titulo}</div>
                {g.itens.map((item) => {
                  indice += 1;
                  const idx = indice;
                  return (
                    <button
                      key={item.chave}
                      type="button"
                      data-idx={idx}
                      className={`busca-global-item${idx === selecionado ? " ativo" : ""}`}
                      onClick={() => acionar(item)}
                      onMouseMove={() => setSelecionado(idx)}
                    >
                      <span className={`bg-icone bg-${item.tipo}`}>
                        {item.tipo === "produto" ? (
                          <span
                            className="bg-avatar"
                            style={{ background: item.cor }}
                          >
                            {iniciais(item.rotulo)}
                          </span>
                        ) : item.tipo === "cliente" ? (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="8" r="3.5" />
                            <path d="M5 20a7 7 0 0 1 14 0" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 6l6 6-6 6" />
                          </svg>
                        )}
                      </span>
                      <span className="bg-texto">
                        <span className="bg-rotulo">{item.rotulo}</span>
                        {item.tipo !== "pagina" && (
                          <span className="bg-sub">{item.sub}</span>
                        )}
                      </span>
                      {idx === selecionado && (
                        <kbd className="bg-enter">↵</kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
