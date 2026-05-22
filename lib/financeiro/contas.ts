import { supabase } from '@/lib/supabase'
import { registrarEntrada, registrarSaida } from './movimentacoes'
import type { ContaBancaria, ContaTipo, SaldoConta, Resultado } from './types'

const num = (v: any) => Number(v) || 0

// ─── CRUD ───────────────────────────────────────────────────────────────────

export async function listarContas(
  clinicaId: string,
  apenasAtivas = false,
): Promise<Resultado<ContaBancaria[]>> {
  let query = supabase
    .from('contas_bancarias')
    .select('*')
    .eq('clinica_id', clinicaId)
    .order('nome')
  if (apenasAtivas) query = query.eq('ativo', true)
  const { data, error } = await query
  return { data: (data as ContaBancaria[]) || [], error: error?.message || null }
}

export async function criarConta(input: {
  clinica_id: string
  nome: string
  instituicao?: string | null
  tipo?: ContaTipo
  saldo_inicial?: number
  unidade_id?: string | null
}): Promise<Resultado<ContaBancaria>> {
  const { data, error } = await supabase
    .from('contas_bancarias')
    .insert({
      clinica_id: input.clinica_id,
      nome: input.nome,
      instituicao: input.instituicao || null,
      tipo: input.tipo || 'corrente',
      saldo_inicial: input.saldo_inicial || 0,
      unidade_id: input.unidade_id || null,
    })
    .select()
    .single()
  return { data: data as ContaBancaria | null, error: error?.message || null }
}

export async function atualizarConta(
  id: string,
  campos: Partial<Pick<ContaBancaria, 'nome' | 'instituicao' | 'tipo' | 'saldo_inicial' | 'ativo'>>,
): Promise<Resultado<ContaBancaria>> {
  const { data, error } = await supabase
    .from('contas_bancarias').update(campos).eq('id', id).select().single()
  return { data: data as ContaBancaria | null, error: error?.message || null }
}

// ─── Saldos ─────────────────────────────────────────────────────────────────

export interface ResumoSaldos {
  contas: SaldoConta[]
  semConta: number   // movimentações sem conta atribuída (entradas - saídas)
  total: number      // soma dos saldos de todas as contas
}

export async function obterSaldos(clinicaId: string): Promise<Resultado<ResumoSaldos>> {
  try {
    const [contasR, movR] = await Promise.all([
      supabase.from('contas_bancarias').select('*').eq('clinica_id', clinicaId).order('nome'),
      supabase.from('movimentacoes_caixa').select('tipo, valor, conta_id').eq('clinica_id', clinicaId),
    ])
    const contas = (contasR.data as ContaBancaria[]) || []
    const movs = movR.data || []

    const delta: Record<string, { e: number; s: number }> = {}
    let semContaE = 0, semContaS = 0
    for (const m of movs) {
      const v = num(m.valor)
      const id = (m as any).conta_id
      if (!id) {
        if (m.tipo === 'entrada') semContaE += v; else semContaS += v
        continue
      }
      if (!delta[id]) delta[id] = { e: 0, s: 0 }
      if (m.tipo === 'entrada') delta[id].e += v; else delta[id].s += v
    }

    const saldoContas: SaldoConta[] = contas.map((c) => {
      const d = delta[c.id] || { e: 0, s: 0 }
      return {
        ...c,
        entradas: d.e,
        saidas: d.s,
        saldoAtual: num(c.saldo_inicial) + d.e - d.s,
      }
    })
    const total = saldoContas.reduce((s, c) => s + c.saldoAtual, 0)

    return { data: { contas: saldoContas, semConta: semContaE - semContaS, total }, error: null }
  } catch (e: any) {
    return { data: null, error: e?.message || 'erro ao calcular saldos' }
  }
}

// ─── Transferência entre contas ─────────────────────────────────────────────

export async function registrarTransferencia(input: {
  clinica_id: string
  conta_origem_id: string
  conta_destino_id: string
  valor: number
  data?: string
  descricao?: string
  criado_por?: string | null
}): Promise<Resultado<boolean>> {
  if (input.conta_origem_id === input.conta_destino_id) {
    return { data: null, error: 'a conta de origem e destino devem ser diferentes' }
  }
  if (!input.valor || input.valor <= 0) {
    return { data: null, error: 'informe um valor válido' }
  }

  const saida = await registrarSaida({
    clinica_id: input.clinica_id,
    conta_id: input.conta_origem_id,
    valor: input.valor,
    origem: 'transferencia',
    data: input.data,
    descricao: input.descricao || 'Transferência entre contas',
    criado_por: input.criado_por || null,
  })
  if (saida.error) return { data: null, error: saida.error }

  const entrada = await registrarEntrada({
    clinica_id: input.clinica_id,
    conta_id: input.conta_destino_id,
    valor: input.valor,
    origem: 'transferencia',
    data: input.data,
    descricao: input.descricao || 'Transferência entre contas',
    criado_por: input.criado_por || null,
  })
  if (entrada.error) return { data: null, error: entrada.error }

  return { data: true, error: null }
}

// ─── Ajuste manual de saldo ─────────────────────────────────────────────────
// valor positivo = entrada de ajuste; negativo = saída de ajuste.
export async function ajustarSaldo(input: {
  clinica_id: string
  conta_id: string
  valor: number
  descricao?: string
  criado_por?: string | null
}): Promise<Resultado<boolean>> {
  if (!input.valor) return { data: null, error: 'informe um valor de ajuste' }
  const comum = {
    clinica_id: input.clinica_id,
    conta_id: input.conta_id,
    valor: Math.abs(input.valor),
    origem: 'ajuste_manual' as const,
    descricao: input.descricao || 'Ajuste manual de saldo',
    criado_por: input.criado_por || null,
  }
  const r = input.valor > 0 ? await registrarEntrada(comum) : await registrarSaida(comum)
  return { data: r.error ? null : true, error: r.error }
}
