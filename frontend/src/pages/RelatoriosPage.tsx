import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { DestaqueRelatorio } from "../types";
import { obterDestaques } from "../services/relatorios";

interface ItemRelatorio {
  to?: string;
  /** Slug do relatório, usado para casar o card com o destaque do backend. */
  chave?: string;
  titulo: string;
  descricao: string;
  disponivel: boolean;
}

interface GrupoRelatorio {
  nome: string;
  icone: ReactNode;
  itens: ItemRelatorio[];
}

const seta = (
  <svg
    className="seta"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 12h14" />
    <path d="M13 6l6 6-6 6" />
  </svg>
);

const icones = {
  vendas: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
      <path d="M2 3h3l2.4 12.2a1.5 1.5 0 0 0 1.5 1.2h8.2a1.5 1.5 0 0 0 1.5-1.2L22 7H6" />
    </svg>
  ),
  produtos: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 3 7v10l9 5 9-5V7z" />
      <path d="M3 7l9 5 9-5" />
      <path d="M12 12v10" />
    </svg>
  ),
  estoque: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3l4 4-4 4" />
      <path d="M21 7H7" />
      <path d="M7 21l-4-4 4-4" />
      <path d="M3 17h14" />
    </svg>
  ),
  compras: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l1.5-4.5A1.5 1.5 0 0 1 6 3.5h12a1.5 1.5 0 0 1 1.5 1L21 9" />
      <path d="M3 9h18v3a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z" />
      <path d="M4 12v8h16v-8" />
    </svg>
  ),
  clientes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7" />
      <path d="M17.5 13.5a6.5 6.5 0 0 1 4 6.5" />
    </svg>
  ),
  fiscal: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2h9l4 4v16H6z" />
      <path d="M14 2v5h5" />
      <path d="M9 12h7" />
      <path d="M9 16h7" />
      <path d="M9 8h3" />
    </svg>
  ),
  dinheiro: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20" />
      <path d="M17 6.5c0-1.9-2.2-3-5-3s-5 1.1-5 3 2.2 2.8 5 3.2 5 1.3 5 3.3-2.2 3-5 3-5-1.1-5-3" />
    </svg>
  ),
};

const GRUPOS: GrupoRelatorio[] = [
  {
    nome: "Dinheiro",
    icone: icones.dinheiro,
    itens: [
      {
        to: "/relatorios/resultado",
        chave: "resultado",
        titulo: "Resultado do período",
        descricao:
          "Quanto sobrou depois da mercadoria e das despesas, comparado com o período anterior.",
        disponivel: true,
      },
      {
        to: "/relatorios/descontos",
        chave: "descontos",
        titulo: "Descontos concedidos",
        descricao: "Quanto de desconto você deu e em quais vendas.",
        disponivel: true,
      },
    ],
  },
  {
    nome: "Vendas",
    icone: icones.vendas,
    itens: [
      {
        to: "/relatorios/forma-pagamento",
        chave: "forma-pagamento",
        titulo: "Formas de pagamento",
        descricao: "Mix de faturamento por dinheiro, cartão, pix, a prazo e outros.",
        disponivel: true,
      },
      {
        to: "/relatorios/vendas-dia-horario",
        chave: "vendas-dia-horario",
        titulo: "Vendas por dia e horário",
        descricao: "Os dias e horários de maior movimento da loja.",
        disponivel: true,
      },
    ],
  },
  {
    nome: "Produtos",
    icone: icones.produtos,
    itens: [
      {
        to: "/relatorios/produtos-faturamento",
        chave: "produtos-faturamento",
        titulo: "De onde vem o faturamento",
        descricao:
          "Produtos e categorias que sustentam a receita, com lucro e margem (curva ABC).",
        disponivel: true,
      },
    ],
  },
  {
    nome: "Estoque",
    icone: icones.estoque,
    itens: [
      {
        to: "/relatorios/saude-estoque",
        chave: "saude-estoque",
        titulo: "Saúde do estoque",
        descricao:
          "O que vai faltar e o que está parado prendendo dinheiro, lado a lado.",
        disponivel: true,
      },
      {
        to: "/relatorios/perdas",
        chave: "perdas",
        titulo: "Perdas e ajustes",
        descricao: "Movimentações de perda e inventário, valorizadas.",
        disponivel: true,
      },
    ],
  },
  {
    nome: "Compras e fornecedores",
    icone: icones.compras,
    itens: [
      {
        to: "/relatorios/compras-fornecedor",
        chave: "compras-fornecedor",
        titulo: "Compras por fornecedor",
        descricao: "Quanto foi comprado de cada fornecedor no período.",
        disponivel: true,
      },
    ],
  },
  {
    nome: "Clientes",
    icone: icones.clientes,
    itens: [
      {
        to: "/relatorios/ranking-clientes",
        chave: "ranking-clientes",
        titulo: "Quem mais compra",
        descricao: "Seus melhores clientes por faturamento e nº de compras.",
        disponivel: true,
      },
      {
        to: "/relatorios/clientes-inativos",
        chave: "clientes-inativos",
        titulo: "Clientes que sumiram",
        descricao: "Quem não compra há muito tempo, para chamar de volta.",
        disponivel: true,
      },
    ],
  },
  {
    // Por último de propósito: é o relatório que ela abre uma vez por ano.
    nome: "Contabilidade",
    icone: icones.fiscal,
    itens: [
      {
        to: "/relatorios/fiscal",
        titulo: "Fechamento para o contador",
        descricao:
          "Consolidado do ano: receita, custo, despesas, estoque e contas a receber.",
        disponivel: true,
      },
    ],
  },
];

/** Formata o valor do destaque conforme o tipo que o backend informou. */
function valorDestaque(d: DestaqueRelatorio): string {
  if (d.formato === "texto") return d.valor;
  const n = parseFloat(d.valor) || 0;
  if (d.formato === "moeda") {
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  if (d.formato === "percentual") {
    return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  }
  return n.toLocaleString("pt-BR");
}

export default function RelatoriosPage() {
  const [destaques, setDestaques] = useState<Record<string, DestaqueRelatorio>>({});

  // Os destaques são enfeite informativo: se falharem, o hub segue funcionando
  // como lista de links. Por isso o erro é engolido de propósito.
  useEffect(() => {
    let ativo = true;
    obterDestaques()
      .then((d) => {
        if (!ativo) return;
        setDestaques(Object.fromEntries(d.linhas.map((l) => [l.chave, l])));
      })
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <span className="title-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18" />
              <path d="M7 15l4-4 3 3 5-6" />
            </svg>
          </span>
          <h1>Relatórios</h1>
        </div>
      </div>
      <p className="subtitle">
        Escolha um relatório para analisar suas vendas, produtos, estoque e
        clientes.
      </p>

      {GRUPOS.map((grupo) => (
        <section className="relatorio-grupo" key={grupo.nome}>
          <div className="relatorio-grupo-titulo">
            {grupo.icone}
            {grupo.nome}
          </div>
          <div className="relatorio-cards">
            {grupo.itens.map((item) => {
              const destaque = item.chave ? destaques[item.chave] : undefined;
              return item.disponivel && item.to ? (
                <Link key={item.titulo} to={item.to} className="relatorio-card">
                  <div className="relatorio-card-topo">
                    <span className="relatorio-card-titulo">{item.titulo}</span>
                    {seta}
                  </div>
                  {destaque && (
                    <div className={`relatorio-card-destaque ${destaque.tom}`}>
                      <strong>{valorDestaque(destaque)}</strong>
                      {destaque.detalhe && <span>{destaque.detalhe}</span>}
                    </div>
                  )}
                  <span className="relatorio-card-desc">{item.descricao}</span>
                </Link>
              ) : (
                <div key={item.titulo} className="relatorio-card em-breve">
                  <div className="relatorio-card-topo">
                    <span className="relatorio-card-titulo">{item.titulo}</span>
                    <span className="badge-breve">Em breve</span>
                  </div>
                  <span className="relatorio-card-desc">{item.descricao}</span>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
