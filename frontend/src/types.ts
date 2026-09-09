// Tipos que espelham os schemas do backend (FastAPI/Pydantic).

export type TipoPessoa = "fisica" | "juridica";

export type RegimeTributario =
  | "pessoa_fisica"
  | "mei"
  | "simples_nacional"
  | "lucro_presumido"
  | "lucro_real";

export interface Configuracao {
  id: number;
  nome_loja: string;
  cor: string;
  logo?: string | null;
  documento?: string | null;
  telefone?: string | null;
  endereco?: string | null;
  email?: string | null;
  recibo_rodape?: string | null;

  // Cadastro fiscal — tudo opcional (pessoa física não tem CNPJ nem IE).
  tipo_pessoa?: TipoPessoa | null;
  razao_social?: string | null;
  inscricao_estadual?: string | null;
  inscricao_municipal?: string | null;
  cnae?: string | null;
  data_abertura?: string | null;
  regime_tributario?: RegimeTributario | null;
  cep?: string | null;
  cidade?: string | null;
  estado?: string | null;
  contador_nome?: string | null;
  contador_contato?: string | null;
  /** Rótulo do regime pronto para exibição (calculado no backend). */
  regime_rotulo?: string | null;
  /** "CPF", "CNPJ" ou "CPF / CNPJ", conforme o tipo de pessoa. */
  documento_rotulo: string;

  atualizado_em: string;
}

export interface ConfiguracaoUpdate {
  nome_loja?: string;
  cor?: string;
  logo?: string | null;
  documento?: string | null;
  telefone?: string | null;
  endereco?: string | null;
  email?: string | null;
  recibo_rodape?: string | null;

  tipo_pessoa?: TipoPessoa | null;
  razao_social?: string | null;
  inscricao_estadual?: string | null;
  inscricao_municipal?: string | null;
  cnae?: string | null;
  data_abertura?: string | null;
  regime_tributario?: RegimeTributario | null;
  cep?: string | null;
  cidade?: string | null;
  estado?: string | null;
  contador_nome?: string | null;
  contador_contato?: string | null;
}

/** Opção de lista do cadastro fiscal, vinda do backend. */
export interface OpcaoConfiguracao {
  valor: string;
  rotulo: string;
}

export interface OpcoesConfiguracao {
  tipos_pessoa: OpcaoConfiguracao[];
  regimes_tributarios: OpcaoConfiguracao[];
}

export type TipoCampo = "texto" | "numero" | "lista" | "booleano" | "data";

export interface CampoSchema {
  chave: string;
  rotulo: string;
  tipo: TipoCampo;
  opcoes?: string[] | null;
  obrigatorio: boolean;
}

export interface Categoria {
  id: number;
  nome: string;
  descricao?: string | null;
  campos_schema: CampoSchema[];
  criado_em: string;
  atualizado_em: string;
}

export interface CategoriaCreate {
  nome: string;
  descricao?: string | null;
  campos_schema: CampoSchema[];
}

export interface Variacao {
  id: number;
  sku?: string | null;
  codigo_barras?: string | null;
  atributos: Record<string, unknown>;
  preco_venda?: string | null;
  estoque: number;
  criado_em: string;
  atualizado_em: string;
}

export interface VariacaoCreate {
  sku?: string | null;
  codigo_barras?: string | null;
  atributos: Record<string, unknown>;
  preco_venda?: number | null;
  estoque: number;
}

export interface Produto {
  id: number;
  nome: string;
  sku?: string | null;
  codigo_barras?: string | null;
  descricao?: string | null;
  categoria_id: number;
  preco_custo: string;
  preco_venda: string;
  /** Preço para venda a prazo (fiado). Nulo = usa o preço à vista. */
  preco_venda_prazo?: string | null;
  estoque: number;
  estoque_minimo: number;
  atributos: Record<string, unknown>;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
  variacoes: Variacao[];
  // Campos computados pelo backend:
  /** Preço a prazo já com o fallback para o preço à vista aplicado. */
  preco_venda_prazo_efetivo: string;
  lucro_unitario: string;
  margem_percentual: string;
  markup_percentual: string;
  estoque_total: number;
}

export interface ProdutoCreate {
  nome: string;
  sku?: string | null;
  codigo_barras?: string | null;
  descricao?: string | null;
  categoria_id: number;
  preco_custo: number;
  preco_venda: number;
  preco_venda_prazo?: number | null;
  estoque: number;
  estoque_minimo: number;
  atributos: Record<string, unknown>;
  ativo: boolean;
  variacoes: VariacaoCreate[];
}

export type TipoMovimentacao = "entrada" | "saida" | "ajuste";

export interface Movimentacao {
  id: number;
  produto_id: number | null;
  variacao_id: number | null;
  fornecedor_id: number | null;
  produto_nome: string;
  fornecedor_nome?: string | null;
  tipo: TipoMovimentacao;
  quantidade: number;
  estoque_resultante: number;
  motivo?: string | null;
  custo_unitario?: string | null;
  observacao?: string | null;
  criado_em: string;
}

export interface MovimentacaoCreate {
  produto_id: number;
  variacao_id?: number | null;
  fornecedor_id?: number | null;
  tipo: TipoMovimentacao;
  quantidade: number;
  motivo?: string | null;
  custo_unitario?: number | null;
  observacao?: string | null;
}

export interface Fornecedor {
  id: number;
  nome: string;
  nome_fantasia?: string | null;
  documento?: string | null;
  email?: string | null;
  telefone?: string | null;
  contato?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  estado?: string | null;
  observacao?: string | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface FornecedorCreate {
  nome: string;
  nome_fantasia?: string | null;
  documento?: string | null;
  email?: string | null;
  telefone?: string | null;
  contato?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  estado?: string | null;
  observacao?: string | null;
  ativo: boolean;
}

export type FormaPagamento =
  | "dinheiro"
  | "cartao_credito"
  | "cartao_debito"
  | "pix"
  | "fiado"
  | "outro";

// Formas aceitas ao receber (quitar) um fiado — sem "fiado".
export type FormaRecebimento =
  | "dinheiro"
  | "cartao_credito"
  | "cartao_debito"
  | "pix"
  | "outro";

export interface Pagamento {
  id: number;
  venda_id: number;
  valor: string;
  forma_pagamento?: string | null;
  observacao?: string | null;
  criado_em: string;
}

export interface PagamentoCreate {
  valor: number;
  forma_pagamento: FormaRecebimento;
  observacao?: string | null;
}

export interface ContaReceber {
  cliente_id: number | null;
  cliente_nome: string;
  cliente_telefone?: string | null;
  num_vendas: number;
  total_devido: string;
  venda_mais_antiga: string;
  parcelas_vencidas: number;
  valor_vencido: string;
}

export interface Parcela {
  id: number;
  venda_id: number;
  numero: number;
  valor: string;
  vencimento: string;
}

export interface ParcelaCreate {
  numero: number;
  valor: number;
  vencimento: string; // ISO date (YYYY-MM-DD)
}

export interface ItemVenda {
  id: number;
  produto_id: number | null;
  produto_nome: string;
  quantidade: number;
  preco_unitario: string;
  custo_unitario: string;
  subtotal: string;
  lucro: string;
}

export type MotivoDevolucao =
  | "defeito"
  | "nao_gostou"
  | "tamanho_errado"
  | "produto_errado"
  | "arrependimento"
  | "outro";

export interface ItemDevolucao {
  id: number;
  produto_id: number | null;
  produto_nome: string;
  quantidade: number;
  preco_unitario: string;
  custo_unitario: string;
  subtotal: string;
}

export type StatusFornecedor = "pendente" | "resolvido";

export interface Devolucao {
  id: number;
  venda_id: number;
  motivo: string;
  observacao?: string | null;
  /** Peça com defeito, marcada para acerto com o fornecedor. */
  defeito: boolean;
  /** Situação no acerto com o fornecedor (nulo quando não é defeito). */
  status_fornecedor?: StatusFornecedor | null;
  valor_devolvido: string;
  criado_em: string;
  itens: ItemDevolucao[];
}

export interface ItemDevolucaoCreate {
  item_venda_id: number;
  quantidade: number;
}

export interface DevolucaoCreate {
  motivo: MotivoDevolucao;
  observacao?: string | null;
  /** Marca a peça como defeito, pendente de troca com o fornecedor. */
  defeito?: boolean;
  itens: ItemDevolucaoCreate[];
}

export interface ItemVendaCreate {
  produto_id: number;
  quantidade: number;
  preco_unitario?: number | null;
}

export interface Venda {
  id: number;
  cliente_id?: number | null;
  cliente_nome?: string | null;
  forma_pagamento?: string | null;
  total_bruto: string;
  desconto: string;
  total_liquido: string;
  custo_total: string;
  lucro: string;
  margem_percentual: string;
  observacao?: string | null;
  criado_em: string;
  cancelada_em?: string | null;
  motivo_cancelamento?: string | null;
  entrega_status?: string | null;
  entregue_em?: string | null;
  endereco_entrega?: string | null;
  itens: ItemVenda[];
  devolucoes: Devolucao[];
  pagamentos: Pagamento[];
  parcelas: Parcela[];
  // Campos computados pelo backend (fiado):
  a_prazo: boolean;
  total_pago: string;
  saldo_devedor: string;
  quitada: boolean;
  // Campos computados pelo backend (delivery):
  is_delivery: boolean;
  entrega_pendente: boolean;
}

export interface VendaCreate {
  cliente_id?: number | null;
  cliente_nome?: string | null;
  forma_pagamento?: FormaPagamento | null;
  desconto: number;
  observacao?: string | null;
  itens: ItemVendaCreate[];
  parcelas?: ParcelaCreate[];
  entrega?: boolean;
  endereco_entrega?: string | null;
}

export interface Cliente {
  id: number;
  nome: string;
  telefone?: string | null;
  email?: string | null;
  data_nascimento?: string | null;
  endereco?: string | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface ClienteCreate {
  nome: string;
  telefone?: string | null;
  email?: string | null;
  data_nascimento?: string | null;
  endereco?: string | null;
  ativo: boolean;
}

export interface ProdutoFavorito {
  produto_id: number | null;
  produto_nome: string;
  quantidade: number;
  total: string;
}

export interface CompraResumo {
  id: number;
  criado_em: string;
  forma_pagamento?: string | null;
  total_liquido: string;
  num_itens: number;
  estornada: boolean;
  tem_devolucao: boolean;
  a_prazo: boolean;
  total_pago: string;
  saldo_devedor: string;
}

export interface FichaCliente {
  cliente: Cliente;
  num_compras: number;
  total_gasto: string;
  ticket_medio: string;
  total_itens: number;
  primeira_compra: string | null;
  ultima_compra: string | null;
  saldo_devedor: string;
  favoritos: ProdutoFavorito[];
  compras: CompraResumo[];
}

/**
 * Recorte de tempo dos relatórios: ou os últimos N dias, ou um intervalo de
 * datas fechado (YYYY-MM-DD nas duas pontas). É o que a API aceita em
 * `?dias=` ou `?inicio=&fim=`.
 */
export type PeriodoRelatorio =
  | { dias: number }
  | { inicio: string; fim: string };

export interface ResumoPeriodo {
  dias: number;
  inicio: string;
  fim: string;
  num_vendas: number;
  faturamento: string;
  custo: string;
  lucro: string;
  desconto: string;
  ticket_medio: string;
  margem_percentual: string;
}

export interface VendaDia {
  dia: string;
  faturamento: string;
  lucro: string;
  num_vendas: number;
}

export interface ProdutoRanking {
  produto_id: number | null;
  produto_nome: string;
  quantidade: number;
  faturamento: string;
  lucro: string;
}

export interface MaisVendidos {
  por_quantidade: ProdutoRanking[];
  por_lucro: ProdutoRanking[];
}

export interface ItemEstoqueBaixo {
  produto_id: number;
  nome: string;
  estoque: number;
  estoque_minimo: number;
}

export interface ResumoEstoque {
  num_produtos: number;
  valor_custo_total: string;
  valor_venda_total: string;
  qtd_estoque_baixo: number;
  itens_estoque_baixo: ItemEstoqueBaixo[];
}


// ---------------------------------------------------------------------------
// Tipos da seção "Relatórios".
// ---------------------------------------------------------------------------

export interface FormaPagamentoLinha {
  forma: string;
  forma_rotulo: string;
  num_vendas: number;
  faturamento: string;
  percentual: string;
}

export interface RelatorioFormaPagamento {
  dias: number;
  inicio: string;
  fim: string;
  faturamento_total: string;
  linhas: FormaPagamentoLinha[];
}

export interface CurvaAbcLinha {
  produto_id: number | null;
  produto_nome: string;
  quantidade: number;
  faturamento: string;
  percentual: string;
  percentual_acumulado: string;
  classe: "A" | "B" | "C";
}

export interface RelatorioCurvaAbc {
  dias: number;
  inicio: string;
  fim: string;
  faturamento_total: string;
  qtd_classe_a: number;
  qtd_classe_b: number;
  qtd_classe_c: number;
  linhas: CurvaAbcLinha[];
}

export interface SemGiroLinha {
  produto_id: number;
  produto_nome: string;
  estoque: number;
  valor_parado: string;
  ultima_venda: string | null;
  dias_sem_venda: number | null;
}

export interface RelatorioSemGiro {
  dias: number;
  inicio: string;
  fim: string;
  qtd_produtos: number;
  valor_parado_total: string;
  linhas: SemGiroLinha[];
}

export interface KardexLinha {
  id: number;
  criado_em: string;
  tipo: TipoMovimentacao;
  quantidade: number;
  estoque_resultante: number;
  motivo: string | null;
  fornecedor_nome: string | null;
  custo_unitario: string | null;
}

export interface RelatorioKardex {
  produto_id: number;
  produto_nome: string;
  estoque_atual: number | null;
  dias: number;
  inicio: string;
  fim: string;
  total_entradas: number;
  total_saidas: number;
  num_movimentacoes: number;
  linhas: KardexLinha[];
}

export interface RankingClienteLinha {
  cliente_id: number | null;
  cliente_nome: string;
  num_compras: number;
  faturamento: string;
  ticket_medio: string;
  ultima_compra: string | null;
}

export interface RelatorioRankingClientes {
  dias: number;
  inicio: string;
  fim: string;
  qtd_clientes: number;
  faturamento_identificado: string;
  /** Vendas de balcão (sem cliente): ficam fora do ranking. */
  num_vendas_sem_cliente: number;
  faturamento_sem_cliente: string;
  percentual_sem_cliente: string;
  linhas: RankingClienteLinha[];
}

export interface ComprasFornecedorLinha {
  fornecedor_id: number | null;
  fornecedor_nome: string;
  num_entradas: number;
  quantidade_total: number;
  valor_total: string;
}

export interface RelatorioComprasFornecedor {
  dias: number;
  inicio: string;
  fim: string;
  valor_total_geral: string;
  linhas: ComprasFornecedorLinha[];
}


// ---------------------------------------------------------------------------
// Segunda leva de relatórios.
// ---------------------------------------------------------------------------

export interface DiaSemanaLinha {
  indice: number;
  rotulo: string;
  num_vendas: number;
  faturamento: string;
}

export interface HoraLinha {
  hora: number;
  num_vendas: number;
  faturamento: string;
}

export interface RelatorioVendasDiaHorario {
  dias: number;
  inicio: string;
  fim: string;
  por_dia_semana: DiaSemanaLinha[];
  por_hora: HoraLinha[];
  melhor_dia: string | null;
  melhor_hora: number | null;
}

export interface DescontoLinha {
  venda_id: number;
  criado_em: string;
  cliente_nome: string;
  total_bruto: string;
  desconto: string;
  percentual: string;
  total_liquido: string;
}

export interface RelatorioDescontos {
  dias: number;
  inicio: string;
  fim: string;
  num_vendas: number;
  num_vendas_com_desconto: number;
  total_bruto: string;
  total_desconto: string;
  percentual_medio: string;
  linhas: DescontoLinha[];
}

export interface CategoriaLinha {
  categoria_id: number | null;
  categoria_nome: string;
  quantidade: number;
  faturamento: string;
  lucro: string;
  percentual: string;
}

export interface RelatorioVendasCategoria {
  dias: number;
  inicio: string;
  fim: string;
  faturamento_total: string;
  linhas: CategoriaLinha[];
}

export interface PerdaLinha {
  id: number;
  criado_em: string;
  produto_nome: string;
  tipo: TipoMovimentacao;
  quantidade: number;
  estoque_resultante: number;
  motivo: string | null;
  valor_estimado: string | null;
}

export interface RelatorioPerdas {
  dias: number;
  inicio: string;
  fim: string;
  num_movimentacoes: number;
  valor_perdas_estimado: string;
  linhas: PerdaLinha[];
}

export interface GiroLinha {
  produto_id: number;
  produto_nome: string;
  estoque: number;
  qtd_vendida: number;
  venda_media_diaria: string;
  cobertura_dias: number | null;
}

export interface RelatorioGiro {
  dias: number;
  inicio: string;
  fim: string;
  qtd_produtos: number;
  linhas: GiroLinha[];
}

export interface ClienteInativoLinha {
  cliente_id: number;
  cliente_nome: string;
  telefone: string | null;
  ultima_compra: string | null;
  dias_sem_comprar: number | null;
  num_compras: number;
  faturamento_total: string;
}

export interface RelatorioClientesInativos {
  dias: number;
  qtd_clientes: number;
  linhas: ClienteInativoLinha[];
}

// --------------------------------------------------------------------------- //
// Defeitos a acertar com o fornecedor
// --------------------------------------------------------------------------- //

/** Filtro da fila de defeitos. */
export type FiltroDefeito = "pendente" | "resolvido" | "todos";

export interface ItemDefeito {
  produto_id: number | null;
  produto_nome: string;
  quantidade: number;
  custo_unitario: string;
  preco_unitario: string;
  /** Fornecedor da última compra registrada do produto (pode não existir). */
  fornecedor_id?: number | null;
  fornecedor_nome?: string | null;
}

export interface Defeito {
  devolucao_id: number;
  venda_id: number;
  cliente_id?: number | null;
  cliente_nome?: string | null;
  criado_em: string;
  motivo: string;
  observacao?: string | null;
  status_fornecedor: StatusFornecedor;
  resolvido_em?: string | null;
  resolucao_observacao?: string | null;
  quantidade_total: number;
  valor_devolvido: string;
  custo_total: string;
  itens: ItemDefeito[];
}

export interface DefeitoResumo {
  pendentes: number;
  pecas_pendentes: number;
  custo_pendente: string;
  valor_pendente: string;
  resolvidos: number;
}

// --------------------------------------------------------------------------- //
// Despesas
// --------------------------------------------------------------------------- //

/** Situação do pagamento usada nos filtros da tela. */
export type SituacaoDespesa = "todas" | "paga" | "aberta";

export interface Despesa {
  id: number;
  descricao: string;
  categoria: string;
  /** Rótulo pronto para exibição, calculado no backend. */
  categoria_rotulo: string;
  valor: string;
  /** Mês a que a despesa se refere (competência). */
  data_competencia: string;
  /** Quando o dinheiro saiu. Nulo = ainda em aberto. */
  data_pagamento?: string | null;
  forma_pagamento?: string | null;
  fornecedor_id?: number | null;
  fornecedor_nome?: string | null;
  documento?: string | null;
  /** Entra na apuração do resultado do período. */
  operacional: boolean;
  recorrente: boolean;
  observacao?: string | null;
  paga: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface DespesaCreate {
  descricao: string;
  categoria: string;
  valor: number | string;
  data_competencia: string;
  data_pagamento?: string | null;
  forma_pagamento?: string | null;
  fornecedor_id?: number | null;
  documento?: string | null;
  operacional: boolean;
  recorrente: boolean;
  observacao?: string | null;
}

/** Opção de categoria vinda do backend (evita duplicar a lista no frontend). */
export interface CategoriaDespesaOpcao {
  valor: string;
  rotulo: string;
  operacional_padrao: boolean;
}

export interface CategoriaDespesaLinha {
  categoria: string;
  categoria_rotulo: string;
  quantidade: number;
  total: string;
  percentual: string;
}

export interface MesDespesaLinha {
  ano: number;
  mes: number;
  rotulo: string;
  quantidade: number;
  total: string;
  total_operacional: string;
}

export interface ResumoDespesas {
  inicio: string;
  fim: string;
  quantidade: number;
  total: string;
  total_operacional: string;
  total_nao_operacional: string;
  total_pago: string;
  total_em_aberto: string;
  por_categoria: CategoriaDespesaLinha[];
  por_mes: MesDespesaLinha[];
}

/** Filtros aceitos pelos endpoints de listagem e resumo de despesas. */
export interface FiltrosDespesa {
  inicio?: string;
  fim?: string;
  categoria?: string;
  situacao?: "paga" | "aberta";
  apenas_operacionais?: boolean;
  busca?: string;
}

// --------------------------------------------------------------------------- //
// Relatório fiscal consolidado
// --------------------------------------------------------------------------- //

export interface IdentificacaoLoja {
  nome: string;
  razao_social?: string | null;
  documento?: string | null;
  /** "CPF", "CNPJ" ou "CPF / CNPJ", conforme o tipo de pessoa. */
  documento_rotulo: string;
  tipo_pessoa?: string | null;
  regime_tributario?: string | null;
  regime_rotulo?: string | null;
  inscricao_estadual?: string | null;
  inscricao_municipal?: string | null;
  cnae?: string | null;
  data_abertura?: string | null;
  telefone?: string | null;
  email?: string | null;
  endereco?: string | null;
  cep?: string | null;
  cidade?: string | null;
  estado?: string | null;
  contador_nome?: string | null;
  contador_contato?: string | null;
  /** Falta documento ou regime: vira aviso no relatório, não erro. */
  cadastro_incompleto: boolean;
}

export interface ReceitaMesLinha {
  ano: number;
  mes: number;
  rotulo: string;
  num_vendas: number;
  /** Pela data da venda. */
  competencia: string;
  /** Pela data em que o dinheiro entrou (à vista + quitações de fiado). */
  caixa: string;
}

export interface ReceitaFiscal {
  num_vendas: number;
  total_bruto: string;
  desconto_total: string;
  total_competencia: string;
  total_caixa: string;
  ticket_medio: string;
  /** Informativo: a receita já está líquida de devoluções. */
  devolucoes_qtd: number;
  devolucoes_valor: string;
  vendas_canceladas_qtd: number;
  por_mes: ReceitaMesLinha[];
}

export interface CompraFornecedorLinha {
  fornecedor_id?: number | null;
  fornecedor_nome: string;
  documento?: string | null;
  num_entradas: number;
  quantidade: number;
  valor: string;
}

export interface CustoMercadoria {
  cmv: string;
  compras_total: string;
  compras_quantidade_itens: number;
  perdas_valor: string;
  perdas_quantidade: number;
  por_fornecedor: CompraFornecedorLinha[];
}

export interface EstoqueFiscal {
  num_produtos: number;
  valor_custo: string;
  valor_venda: string;
  /** Falso quando o período já terminou: o estoque é a posição de hoje. */
  posicao_atual: boolean;
}

export interface DespesasFiscal {
  total: string;
  operacional: string;
  nao_operacional: string;
  total_pago: string;
  total_em_aberto: string;
  quantidade: number;
  por_categoria: CategoriaDespesaLinha[];
  por_mes: MesDespesaLinha[];
}

export interface ResultadoFiscal {
  receita_competencia: string;
  cmv: string;
  lucro_bruto: string;
  perdas: string;
  despesas_operacionais: string;
  resultado_operacional: string;
  margem_bruta_percentual: string;
  margem_liquida_percentual: string;
}

export interface ContasReceberFiscal {
  qtd_vendas: number;
  qtd_clientes: number;
  total_vendido: string;
  total_recebido: string;
  total_em_aberto: string;
}

export interface RelatorioFiscal {
  loja: IdentificacaoLoja;
  inicio: string;
  fim: string;
  dias: number;
  gerado_em: string;
  receita: ReceitaFiscal;
  formas_pagamento: FormaPagamentoLinha[];
  custos: CustoMercadoria;
  estoque: EstoqueFiscal;
  despesas: DespesasFiscal;
  resultado: ResultadoFiscal;
  contas_a_receber: ContasReceberFiscal;
  /** Ressalvas de método, para os números não serem lidos fora de contexto. */
  avisos: string[];
}
