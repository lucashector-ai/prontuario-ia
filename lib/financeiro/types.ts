// Tipos do módulo financeiro — espelham o schema em supabase_financeiro_setup.sql

export type ComandaStatus = 'rascunho' | 'aberta' | 'fechada' | 'paga' | 'cancelada'
export type ComandaOrigem = 'agendamento' | 'avulsa'
export type ItemTipo = 'consulta' | 'procedimento' | 'exame' | 'produto' | 'pacote' | 'outro'
export type RecebimentoStatus =
  | 'pendente' | 'pago' | 'parcial' | 'atrasado' | 'cancelado' | 'reembolsado'
export type DespesaStatus = 'pendente' | 'pago' | 'atrasado' | 'cancelado'
export type MovimentacaoTipo = 'entrada' | 'saida'
export type MovimentacaoOrigem = 'recebimento' | 'despesa' | 'ajuste_manual' | 'estorno'

export interface FormaPagamento {
  id: string
  codigo: string
  nome: string
  permite_parcelamento: boolean
  ordem: number
  ativo: boolean
  created_at: string
}

export interface Comanda {
  id: string
  clinica_id: string | null
  agendamento_id: string | null
  paciente_id: string | null
  profissional_id: string | null
  status: ComandaStatus
  origem: ComandaOrigem
  observacoes: string | null
  valor_estimado: number | null
  valor_total: number
  desconto: number
  acrescimo: number
  valor_final: number
  aberto_em: string | null
  fechado_em: string | null
  fechado_por: string | null
  created_at: string
  updated_at: string
}

export interface ComandaItem {
  id: string
  comanda_id: string
  tipo: ItemTipo
  descricao: string
  quantidade: number
  valor_unitario: number
  valor_total: number
  profissional_id: string | null
  observacoes: string | null
  created_at: string
}

export interface Recebimento {
  id: string
  clinica_id: string
  comanda_id: string | null
  paciente_id: string | null
  forma_pagamento_id: string | null
  status: RecebimentoStatus
  valor: number
  valor_pago: number
  parcela_numero: number | null
  parcela_total: number | null
  vencimento: string | null
  pago_em: string | null
  pago_por: string | null
  observacoes: string | null
  created_at: string
  updated_at: string
}

export interface Despesa {
  id: string
  clinica_id: string
  categoria: string | null
  descricao: string
  fornecedor: string | null
  valor: number
  vencimento: string | null
  status: DespesaStatus
  pago_em: string | null
  forma_pagamento_id: string | null
  recorrente: boolean
  recorrencia_periodicidade: 'semanal' | 'mensal' | 'anual' | null
  observacoes: string | null
  created_at: string
  updated_at: string
}

export interface MovimentacaoCaixa {
  id: string
  clinica_id: string
  tipo: MovimentacaoTipo
  origem: MovimentacaoOrigem
  recebimento_id: string | null
  despesa_id: string | null
  forma_pagamento_id: string | null
  valor: number
  data_movimentacao: string
  descricao: string | null
  criado_por: string | null
  created_at: string
}

export interface MetricasFinanceiras {
  faturamentoMes: number
  recebidoMes: number
  aReceber: number
  ticketMedio: number
  comandasFechadasMes: number
  faturamentoMesAnterior: number
  recebidoMesAnterior: number
}

// Resultado padrão de todas as funções da camada de dados
export interface Resultado<T> {
  data: T | null
  error: string | null
}
