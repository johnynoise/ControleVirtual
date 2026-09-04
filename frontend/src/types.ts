// Tipos que espelham os schemas do backend (FastAPI/Pydantic).

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
  estoque: number;
  estoque_minimo: number;
  atributos: Record<string, unknown>;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
  variacoes: Variacao[];
  // Campos computados pelo backend:
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
  num_vendas: number;
  total_devido: string;
  venda_mais_antiga: string;
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

export interface Devolucao {
  id: number;
  venda_id: number;
  motivo: string;
  observacao?: string | null;
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
  itens: ItemVenda[];
  devolucoes: Devolucao[];
  pagamentos: Pagamento[];
  // Campos computados pelo backend (fiado):
  a_prazo: boolean;
  total_pago: string;
  saldo_devedor: string;
  quitada: boolean;
}

export interface VendaCreate {
  cliente_id?: number | null;
  cliente_nome?: string | null;
  forma_pagamento?: FormaPagamento | null;
  desconto: number;
  observacao?: string | null;
  itens: ItemVendaCreate[];
}

export interface Cliente {
  id: number;
  nome: string;
  telefone?: string | null;
  email?: string | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface ClienteCreate {
  nome: string;
  telefone?: string | null;
  email?: string | null;
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

export interface ResumoPeriodo {
  dias: number;
  inicio: string;
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
  qtd_clientes: number;
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
