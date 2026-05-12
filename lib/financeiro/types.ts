export type Movimentacao = {
  id: string
  clinica_id: string
  tipo: 'receita' | 'despesa'
  valor: number
  status: 'pendente' | 'pago' | 'recebido' | 'previsto' | 'cancelado' | 'atrasado'
  data_movimentacao: string
  data_pagamento: string | null
  descricao?: string | null
  categoria_id?: string | null
  conta_id?: string | null
  medico_id?: string | null
  paciente_id?: string | null
  agendamento_id?: string | null
  recorrente?: boolean
  recorrencia_origem_id?: string | null
  // joins (quando aplicado)
  pacientes?: { nome: string; telefone?: string } | null
  medicos?: { nome: string } | null
  categoria?: { nome: string; cor?: string; tipo?: string } | null
}

export type Categoria = {
  id: string
  clinica_id: string
  nome: string
  tipo: 'receita' | 'despesa'
  cor?: string | null
  ativo: boolean
}

export type Conta = {
  id: string
  clinica_id: string
  nome: string
  ativo: boolean
}

export type ComissaoConfig = {
  id: string
  clinica_id: string
  medico_id: string
  tipo_calculo: 'percentual_consulta' | 'percentual_procedimento' | 'fixo'
  percentual?: number | null
  valor_fixo?: number | null
  ativo: boolean
}

export type PixCobranca = {
  id: string
  clinica_id: string
  paciente_id: string | null
  agendamento_id: string | null
  movimentacao_id: string | null
  valor: number
  descricao: string | null
  txid: string | null
  qr_code: string | null
  qr_code_image_url: string | null
  status: 'pendente' | 'pago' | 'expirado' | 'cancelado'
  expira_em: string | null
  pago_em: string | null
  criada_em: string
  pacientes?: { nome: string } | null
}

export type PlanoRecorrente = {
  id: string
  clinica_id: string
  paciente_id: string
  nome: string
  descricao: string | null
  valor_mensal: number
  parcelas_total: number
  parcelas_pagas: number
  proximo_vencimento: string | null
  iniciado_em: string
  status: 'ativo' | 'pausado' | 'concluido' | 'cancelado'
  pacientes?: { nome: string } | null
}

export type FluxoDiario = {
  data: string  // ISO date YYYY-MM-DD
  receita: number
  despesa: number
  saldo: number
}

export type KPIs = {
  receita: number
  despesa: number
  lucro: number
  aReceber: number
  variacaoReceita: number  // % vs período anterior
  variacaoDespesa: number
}
