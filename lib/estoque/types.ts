export const CATEGORIAS = ['peptideo', 'toxina', 'preenchedor', 'medicamento', 'descartavel', 'cosmetico', 'outro'] as const
export type Categoria = (typeof CATEGORIAS)[number]

export const UNIDADES = ['ml', 'mg', 'frasco', 'caixa', 'unidade', 'ampola', 'sachê'] as const
export type Unidade = (typeof UNIDADES)[number]

export type Produto = {
  id: string
  clinica_id: string
  nome: string
  marca: string | null
  categoria: Categoria
  unidade: Unidade
  estoque_atual: number
  estoque_minimo: number
  custo_unitario: number
  preco_venda: number | null
  foto_url: string | null
  ativo: boolean
  criado_em: string
  atualizado_em: string
  lotes_ativos?: number  // join derivado
}

export type Lote = {
  id: string
  produto_id: string
  numero_lote: string
  validade: string | null
  quantidade_inicial: number
  quantidade_atual: number
  fornecedor_id: string | null
  preco_compra: number | null
  data_compra: string | null
  ativo: boolean
  criado_em: string
  // joins
  produto?: { id: string; nome: string; unidade: Unidade; categoria: Categoria } | null
  fornecedor?: { id: string; nome: string } | null
}

export type Fornecedor = {
  id: string
  clinica_id: string
  nome: string
  cnpj: string | null
  telefone: string | null
  email: string | null
  observacoes: string | null
  ativo: boolean
}

export type ProdutoUsado = {
  produto_id: string
  lote_id?: string | null
  quantidade: number
  custo_unitario?: number
}

export type ProcedimentoRealizado = {
  id: string
  clinica_id: string
  agendamento_id: string | null
  paciente_id: string | null
  medico_id: string | null
  procedimento_id: string | null
  nome_procedimento: string | null
  produtos_usados: ProdutoUsado[]
  realizado_em: string
  custo_total: number
  preco_cobrado: number
  margem_valor: number
  margem_percentual: number | null
  observacoes: string | null
  // joins
  paciente?: { nome: string } | null
  medico?: { nome: string } | null
}

export const CATEGORIA_LABEL: Record<Categoria, string> = {
  peptideo: 'Peptídeo',
  toxina: 'Toxina',
  preenchedor: 'Preenchedor',
  medicamento: 'Medicamento',
  descartavel: 'Descartável',
  cosmetico: 'Cosmético',
  outro: 'Outro',
}

export const UNIDADE_LABEL: Record<Unidade, string> = {
  ml: 'mL',
  mg: 'mg',
  frasco: 'Frasco',
  caixa: 'Caixa',
  unidade: 'Unid.',
  ampola: 'Ampola',
  sachê: 'Sachê',
}
