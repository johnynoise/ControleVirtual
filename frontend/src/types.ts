// Tipos que espelham os schemas do backend (FastAPI/Pydantic).

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
  | "outro";

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

export interface ItemVendaCreate {
  produto_id: number;
  quantidade: number;
  preco_unitario?: number | null;
}

export interface Venda {
  id: number;
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
  itens: ItemVenda[];
}

export interface VendaCreate {
  cliente_nome?: string | null;
  forma_pagamento?: FormaPagamento | null;
  desconto: number;
  observacao?: string | null;
  itens: ItemVendaCreate[];
}
