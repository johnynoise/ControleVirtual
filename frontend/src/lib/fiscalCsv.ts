// Geração do CSV do relatório fiscal.
//
// Fica separado da tela por dois motivos: é lógica pura (dá para testar sem
// montar componente) e o formato do arquivo é uma decisão que tende a mudar
// sozinha, sem mexer no layout.

import type { RelatorioFiscal } from "../types";

/** Data ISO (YYYY-MM-DD) no formato brasileiro, sem depender de fuso. */
function dataBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const soData = /^\d{4}-\d{2}-\d{2}$/.exec(iso);
  if (soData) {
    const [ano, mes, dia] = iso.split("-");
    return `${dia}/${mes}/${ano}`;
  }
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}

/** Data e hora curtas, para o "gerado em". */
function dataHoraBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/**
 * Monta o CSV do relatório em blocos numerados, no formato que o Excel
 * brasileiro abre direto: separador ponto e vírgula e vírgula decimal.
 */
export function montarCsvFiscal(r: RelatorioFiscal): string {
  const linhas: string[] = [];
  // Ponto e vírgula dentro do texto viraria separador, então é trocado.
  const add = (...campos: (string | number)[]) =>
    linhas.push(campos.map((c) => String(c).replace(/;/g, ",")).join(";"));
  // Dinheiro e percentual saem com vírgula decimal e sem símbolo, para o Excel
  // reconhecer como número.
  const n = (v: string) => v.replace(".", ",");

  add("RELATORIO FISCAL");
  add("Loja", r.loja.nome);
  // O cadastro é todo opcional: cada linha só sai quando o campo foi preenchido.
  const opcional = (rotulo: string, valor: string | null | undefined) => {
    if (valor) add(rotulo, valor);
  };
  opcional("Razao social", r.loja.razao_social);
  opcional(r.loja.documento_rotulo, r.loja.documento);
  opcional("Regime tributario", r.loja.regime_rotulo);
  opcional("Inscricao estadual", r.loja.inscricao_estadual);
  opcional("Inscricao municipal", r.loja.inscricao_municipal);
  opcional("CNAE", r.loja.cnae);
  opcional("Data de abertura", r.loja.data_abertura ? dataBR(r.loja.data_abertura) : null);
  opcional("Endereco", r.loja.endereco);
  opcional("CEP", r.loja.cep);
  opcional(
    "Cidade/UF",
    [r.loja.cidade, r.loja.estado].filter(Boolean).join("/") || null
  );
  opcional("Telefone", r.loja.telefone);
  opcional("E-mail", r.loja.email);
  opcional("Contador", r.loja.contador_nome);
  opcional("Contato do contador", r.loja.contador_contato);
  add("Periodo", `${dataBR(r.inicio)} a ${dataBR(r.fim)}`);
  add("Gerado em", dataHoraBR(r.gerado_em));
  add("");

  add("1. RECEITA");
  add("Numero de vendas", r.receita.num_vendas);
  add("Total bruto", n(r.receita.total_bruto));
  add("Descontos", n(r.receita.desconto_total));
  add("Receita por competencia", n(r.receita.total_competencia));
  add("Receita por caixa", n(r.receita.total_caixa));
  add("Ticket medio", n(r.receita.ticket_medio));
  add("Devolucoes no periodo (ja descontadas da receita)", n(r.receita.devolucoes_valor));
  add("Vendas canceladas (informativo)", r.receita.vendas_canceladas_qtd);
  add("");
  add("Mes", "Vendas", "Competencia", "Caixa");
  r.receita.por_mes.forEach((m) =>
    add(m.rotulo, m.num_vendas, n(m.competencia), n(m.caixa))
  );
  add("Total", r.receita.num_vendas, n(r.receita.total_competencia), n(r.receita.total_caixa));
  add("");

  add("2. RECEBIMENTOS POR FORMA DE PAGAMENTO");
  add("Forma", "Vendas", "Valor", "%");
  r.formas_pagamento.forEach((f) =>
    add(f.forma_rotulo, f.num_vendas, n(f.faturamento), n(f.percentual))
  );
  add("");

  add("3. CUSTO DA MERCADORIA E COMPRAS");
  add("CMV (custo da mercadoria vendida)", n(r.custos.cmv));
  add("Compras no periodo", n(r.custos.compras_total));
  add("Itens comprados", r.custos.compras_quantidade_itens);
  add("Perdas e quebras", n(r.custos.perdas_valor));
  add("");
  add("Fornecedor", "CNPJ/CPF", "Entradas", "Itens", "Valor");
  r.custos.por_fornecedor.forEach((f) =>
    add(f.fornecedor_nome, f.documento ?? "", f.num_entradas, f.quantidade, n(f.valor))
  );
  add("Total", "", "", r.custos.compras_quantidade_itens, n(r.custos.compras_total));
  add("");

  add("4. ESTOQUE");
  add(
    "Posicao",
    r.estoque.posicao_atual
      ? "na data do relatorio"
      : "posicao de hoje, nao a do fim do periodo"
  );
  add("Produtos", r.estoque.num_produtos);
  add("Valor a custo", n(r.estoque.valor_custo));
  add("Valor a preco de venda", n(r.estoque.valor_venda));
  add("");

  add("5. DESPESAS");
  add("Total", n(r.despesas.total));
  add("Operacional (entra no resultado)", n(r.despesas.operacional));
  add("Nao operacional", n(r.despesas.nao_operacional));
  add("Pago", n(r.despesas.total_pago));
  add("Em aberto", n(r.despesas.total_em_aberto));
  add("");
  add("Categoria", "Lancamentos", "Total", "%");
  r.despesas.por_categoria.forEach((c) =>
    add(c.categoria_rotulo, c.quantidade, n(c.total), n(c.percentual))
  );
  add("");
  add("Mes", "Lancamentos", "Total", "Operacional");
  r.despesas.por_mes.forEach((m) =>
    add(m.rotulo, m.quantidade, n(m.total), n(m.total_operacional))
  );
  add("");

  add("6. APURACAO DO RESULTADO (COMPETENCIA)");
  add("Receita", n(r.resultado.receita_competencia));
  add("(-) CMV", n(r.resultado.cmv));
  add("= Lucro bruto", n(r.resultado.lucro_bruto));
  add("(-) Perdas", n(r.resultado.perdas));
  add("(-) Despesas operacionais", n(r.resultado.despesas_operacionais));
  add("= Resultado operacional", n(r.resultado.resultado_operacional));
  add("Margem bruta %", n(r.resultado.margem_bruta_percentual));
  add("Margem liquida %", n(r.resultado.margem_liquida_percentual));
  add("");

  add(`7. CONTAS A RECEBER EM ABERTO (posicao em ${dataBR(r.fim)})`);
  add("Vendas a prazo em aberto", r.contas_a_receber.qtd_vendas);
  add("Clientes", r.contas_a_receber.qtd_clientes);
  add("Total vendido", n(r.contas_a_receber.total_vendido));
  add("Total recebido", n(r.contas_a_receber.total_recebido));
  add("Saldo em aberto", n(r.contas_a_receber.total_em_aberto));
  add("");

  add("OBSERVACOES DE METODO");
  r.avisos.forEach((a, i) => add(`${i + 1}`, a));

  return linhas.join("\r\n");
}

/** Nome do arquivo exportado, com o período no nome. */
export function nomeArquivoCsvFiscal(r: RelatorioFiscal): string {
  return `relatorio-fiscal-${r.inicio}-a-${r.fim}.csv`;
}

/** Dispara o download do CSV no navegador. */
export function baixarCsvFiscal(r: RelatorioFiscal): void {
  // O BOM faz o Excel reconhecer o UTF-8 e mostrar os acentos certos.
  const conteudo = "\ufeff" + montarCsvFiscal(r);
  const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivoCsvFiscal(r);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
