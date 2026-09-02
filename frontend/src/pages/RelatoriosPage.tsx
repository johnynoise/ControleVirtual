import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface ItemRelatorio {
  to?: string;
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
};

const GRUPOS: GrupoRelatorio[] = [
  {
    nome: "Vendas",
    icone: icones.vendas,
    itens: [
      {
        to: "/relatorios/forma-pagamento",
        titulo: "Formas de pagamento",
        descricao: "Mix de faturamento por dinheiro, cartão, pix e outros.",
        disponivel: true,
      },
      {
        to: "/relatorios/vendas-dia-horario",
        titulo: "Vendas por dia e horário",
        descricao: "Identifique os dias e horários de maior movimento.",
        disponivel: true,
      },
      {
        to: "/relatorios/descontos",
        titulo: "Descontos concedidos",
        descricao: "Total e percentual de desconto dado no período.",
        disponivel: true,
      },
    ],
  },
  {
    nome: "Produtos",
    icone: icones.produtos,
    itens: [
      {
        to: "/relatorios/curva-abc",
        titulo: "Curva ABC",
        descricao: "Quais produtos concentram o seu faturamento (regra 80/20).",
        disponivel: true,
      },
      {
        to: "/relatorios/sem-giro",
        titulo: "Produtos sem giro",
        descricao: "Itens parados em estoque, sem vendas no período.",
        disponivel: true,
      },
      {
        to: "/relatorios/vendas-categoria",
        titulo: "Vendas por categoria",
        descricao: "Desempenho de faturamento e lucro por categoria.",
        disponivel: true,
      },
    ],
  },
  {
    nome: "Estoque",
    icone: icones.estoque,
    itens: [
      {
        to: "/relatorios/kardex",
        titulo: "Kardex do produto",
        descricao: "Extrato de entradas, saídas e ajustes com saldo.",
        disponivel: true,
      },
      {
        to: "/relatorios/perdas",
        titulo: "Perdas e ajustes",
        descricao: "Movimentações de perda e inventário valorizadas.",
        disponivel: true,
      },
      {
        to: "/relatorios/giro",
        titulo: "Giro e cobertura",
        descricao: "Dias de estoque restantes no ritmo de venda atual.",
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
        titulo: "Ranking de clientes",
        descricao: "Quem mais compra, por faturamento e nº de compras.",
        disponivel: true,
      },
      {
        to: "/relatorios/clientes-inativos",
        titulo: "Clientes inativos",
        descricao: "Clientes sem compras há muito tempo, para reativar.",
        disponivel: true,
      },
    ],
  },
];

export default function RelatoriosPage() {
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
            {grupo.itens.map((item) =>
              item.disponivel && item.to ? (
                <Link key={item.titulo} to={item.to} className="relatorio-card">
                  <div className="relatorio-card-topo">
                    <span className="relatorio-card-titulo">{item.titulo}</span>
                    {seta}
                  </div>
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
              )
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
