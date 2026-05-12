import { supabase } from '@/lib/supabase'
import type {
  Categoria,
  ComissaoConfig,
  Conta,
  FluxoDiario,
  KPIs,
  Movimentacao,
  PixCobranca,
  PlanoRecorrente,
} from './types'

async function safeList<T>(promise: any): Promise<T[]> {
  try {
    const { data, error } = await promise
    if (error) {
      if (typeof console !== 'undefined') console.warn('[financeiro queries]', error.message)
      return []
    }
    return (data as T[]) || []
  } catch (err: any) {
    if (typeof console !== 'undefined') console.warn('[financeiro queries]', err?.message || err)
    return []
  }
}

export type Periodo = 7 | 30 | 90 | 180 | 365

function rangeDe(periodo: Periodo) {
  const fim = new Date()
  const ini = new Date()
  ini.setDate(fim.getDate() - periodo)
  return {
    inicio: ini.toISOString().split('T')[0],
    fim: fim.toISOString().split('T')[0],
  }
}

function rangeAnterior(periodo: Periodo) {
  const fim = new Date()
  fim.setDate(fim.getDate() - periodo)
  const ini = new Date()
  ini.setDate(ini.getDate() - 2 * periodo)
  return {
    inicio: ini.toISOString().split('T')[0],
    fim: fim.toISOString().split('T')[0],
  }
}

export async function listarMovimentacoes(
  clinicaId: string,
  opts?: {
    tipo?: 'receita' | 'despesa' | 'todos'
    status?: string | 'todos'
    inicio?: string
    fim?: string
    limit?: number
  },
): Promise<Movimentacao[]> {
  let q = supabase
    .from('financeiro_movimentacoes')
    .select('*, pacientes:paciente_id(nome, telefone), medicos:medico_id(nome), categoria:categoria_id(nome, cor, tipo)')
    .eq('clinica_id', clinicaId)
    .order('data_movimentacao', { ascending: false })

  if (opts?.tipo && opts.tipo !== 'todos') q = q.eq('tipo', opts.tipo)
  if (opts?.status && opts.status !== 'todos') q = q.eq('status', opts.status)
  if (opts?.inicio) q = q.gte('data_movimentacao', opts.inicio)
  if (opts?.fim) q = q.lte('data_movimentacao', opts.fim)
  if (opts?.limit) q = q.limit(opts.limit)

  return safeList<Movimentacao>(q)
}

export async function listarCategorias(clinicaId: string): Promise<Categoria[]> {
  return safeList<Categoria>(
    supabase.from('financeiro_categorias').select('*').eq('clinica_id', clinicaId).eq('ativo', true).order('nome'),
  )
}

export async function listarContas(clinicaId: string): Promise<Conta[]> {
  return safeList<Conta>(
    supabase.from('financeiro_contas').select('*').eq('clinica_id', clinicaId).eq('ativo', true).order('nome'),
  )
}

export async function listarComissoesConfig(clinicaId: string): Promise<ComissaoConfig[]> {
  return safeList<ComissaoConfig>(
    supabase.from('financeiro_comissoes_config').select('*').eq('clinica_id', clinicaId).eq('ativo', true),
  )
}

export async function listarMedicos(clinicaId: string): Promise<{ id: string; nome: string }[]> {
  return safeList<{ id: string; nome: string }>(
    supabase.from('medicos').select('id, nome').eq('clinica_id', clinicaId).order('nome'),
  )
}

export async function listarPix(clinicaId: string, statusFiltro?: string): Promise<PixCobranca[]> {
  let q = supabase
    .from('financeiro_pix_cobrancas')
    .select('*, pacientes:paciente_id(nome)')
    .eq('clinica_id', clinicaId)
    .order('criada_em', { ascending: false })
  if (statusFiltro && statusFiltro !== 'todos') q = q.eq('status', statusFiltro)
  return safeList<PixCobranca>(q)
}

export async function listarPlanos(clinicaId: string, statusFiltro?: string): Promise<PlanoRecorrente[]> {
  let q = supabase
    .from('financeiro_planos_recorrentes')
    .select('*, pacientes:paciente_id(nome)')
    .eq('clinica_id', clinicaId)
    .order('criado_em', { ascending: false })
  if (statusFiltro && statusFiltro !== 'todos') q = q.eq('status', statusFiltro)
  return safeList<PlanoRecorrente>(q)
}

/**
 * Calcula KPIs do período + variação contra o período anterior equivalente.
 */
export async function calcularKPIs(clinicaId: string, periodo: Periodo): Promise<KPIs> {
  const atual = rangeDe(periodo)
  const ant = rangeAnterior(periodo)

  const [movsA, movsAnt] = await Promise.all([
    safeList<Movimentacao>(
      supabase
        .from('financeiro_movimentacoes')
        .select('tipo, valor, status, data_movimentacao')
        .eq('clinica_id', clinicaId)
        .gte('data_movimentacao', atual.inicio)
        .lte('data_movimentacao', atual.fim)
        .neq('status', 'cancelado'),
    ),
    safeList<Movimentacao>(
      supabase
        .from('financeiro_movimentacoes')
        .select('tipo, valor, status')
        .eq('clinica_id', clinicaId)
        .gte('data_movimentacao', ant.inicio)
        .lte('data_movimentacao', ant.fim)
        .neq('status', 'cancelado'),
    ),
  ])

  let receita = 0
  let despesa = 0
  let aReceber = 0
  for (const m of movsA) {
    const v = Number(m.valor) || 0
    if (m.tipo === 'receita') {
      receita += v
      if (m.status === 'pendente' || m.status === 'previsto') aReceber += v
    } else {
      despesa += v
    }
  }

  let receitaAnt = 0
  let despesaAnt = 0
  for (const m of movsAnt) {
    const v = Number(m.valor) || 0
    if (m.tipo === 'receita') receitaAnt += v
    else despesaAnt += v
  }

  const variacaoReceita = receitaAnt > 0 ? ((receita - receitaAnt) / receitaAnt) * 100 : 0
  const variacaoDespesa = despesaAnt > 0 ? ((despesa - despesaAnt) / despesaAnt) * 100 : 0

  return {
    receita,
    despesa,
    lucro: receita - despesa,
    aReceber,
    variacaoReceita,
    variacaoDespesa,
  }
}

/**
 * Série diária de receita/despesa dos últimos `periodo` dias. Mesmo sem
 * registros em alguns dias, retorna a série completa zerada.
 */
export async function fluxoCaixaDiario(clinicaId: string, periodo: Periodo): Promise<FluxoDiario[]> {
  const range = rangeDe(periodo)
  const movs = await safeList<Movimentacao>(
    supabase
      .from('financeiro_movimentacoes')
      .select('tipo, valor, data_movimentacao, status')
      .eq('clinica_id', clinicaId)
      .gte('data_movimentacao', range.inicio)
      .lte('data_movimentacao', range.fim)
      .neq('status', 'cancelado'),
  )

  // Inicializa todos os dias do período com zero
  const dias: FluxoDiario[] = []
  const cursor = new Date(range.inicio)
  const fim = new Date(range.fim)
  while (cursor <= fim) {
    dias.push({ data: cursor.toISOString().split('T')[0], receita: 0, despesa: 0, saldo: 0 })
    cursor.setDate(cursor.getDate() + 1)
  }

  // Indexa por data pra acumular rápido
  const idx = new Map(dias.map((d, i) => [d.data, i]))
  for (const m of movs) {
    const i = idx.get(m.data_movimentacao)
    if (i === undefined) continue
    const v = Number(m.valor) || 0
    if (m.tipo === 'receita') dias[i].receita += v
    else dias[i].despesa += v
  }
  for (const d of dias) d.saldo = d.receita - d.despesa

  return dias
}

/**
 * Calcula comissões por médico no período. Espera config em
 * `financeiro_comissoes_config` (tipo_calculo + percentual).
 */
export async function calcularComissoesPeriodo(clinicaId: string, periodo: Periodo) {
  const range = rangeDe(periodo)
  const [configs, movs, medicos] = await Promise.all([
    listarComissoesConfig(clinicaId),
    safeList<Movimentacao>(
      supabase
        .from('financeiro_movimentacoes')
        .select('medico_id, valor, status')
        .eq('clinica_id', clinicaId)
        .eq('tipo', 'receita')
        .gte('data_movimentacao', range.inicio)
        .lte('data_movimentacao', range.fim)
        .neq('status', 'cancelado'),
    ),
    listarMedicos(clinicaId),
  ])

  const porMedico = new Map<string, { medicoId: string; nome: string; receita: number; comissao: number; config?: ComissaoConfig }>()
  for (const med of medicos) {
    porMedico.set(med.id, { medicoId: med.id, nome: med.nome, receita: 0, comissao: 0 })
  }
  for (const m of movs) {
    if (!m.medico_id) continue
    const row = porMedico.get(m.medico_id)
    if (row) row.receita += Number(m.valor) || 0
  }
  for (const cfg of configs) {
    const row = porMedico.get(cfg.medico_id)
    if (!row) continue
    row.config = cfg
    if (cfg.tipo_calculo === 'fixo') {
      row.comissao = Number(cfg.valor_fixo) || 0
    } else {
      const p = Number(cfg.percentual) || 0
      row.comissao = (row.receita * p) / 100
    }
  }

  return Array.from(porMedico.values()).sort((a, b) => b.receita - a.receita)
}
