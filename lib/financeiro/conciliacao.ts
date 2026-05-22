import { supabase } from '@/lib/supabase'
import { registrarEntrada, registrarSaida } from './movimentacoes'
import type { Resultado } from './types'

export interface TransacaoExtrato {
  data: string        // ISO YYYY-MM-DD
  descricao: string
  valor: number       // assinado: + entrada, − saída
}

export interface MovNaoConciliada {
  id: string
  data_movimentacao: string
  descricao: string | null
  tipo: 'entrada' | 'saida'
  valor: number
}

export interface ParExtrato {
  transacao: TransacaoExtrato
  sugestao: MovNaoConciliada | null
}

// ─── Parse de extrato OFX ───────────────────────────────────────────────────
// OFX é o formato padrão de extrato dos bancos brasileiros.
export function parseOFX(texto: string): TransacaoExtrato[] {
  const transacoes: TransacaoExtrato[] = []
  const blocos = texto.split(/<STMTTRN>/i).slice(1)
  for (const bloco of blocos) {
    const data = bloco.match(/<DTPOSTED>\s*(\d{8})/i)
    const valor = bloco.match(/<TRNAMT>\s*(-?[\d.]+)/i)
    const memo = bloco.match(/<MEMO>\s*(.*)/i) || bloco.match(/<NAME>\s*(.*)/i)
    if (!data || !valor) continue
    const d = data[1]
    transacoes.push({
      data: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`,
      descricao: (memo?.[1] || '').trim().replace(/<\/?[^>]+>/g, '').slice(0, 200) || 'Lançamento',
      valor: Number(valor[1]) || 0,
    })
  }
  return transacoes
}

// ─── Movimentações não conciliadas da conta ─────────────────────────────────
export async function listarNaoConciliadas(
  clinicaId: string,
  contaId: string,
): Promise<Resultado<MovNaoConciliada[]>> {
  const { data, error } = await supabase
    .from('movimentacoes_caixa')
    .select('id, data_movimentacao, descricao, tipo, valor')
    .eq('clinica_id', clinicaId)
    .eq('conta_id', contaId)
    .eq('conciliado', false)
    .order('data_movimentacao', { ascending: false })
    .limit(500)
  return { data: (data as MovNaoConciliada[]) || [], error: error?.message || null }
}

// Casa cada transação do extrato com a movimentação mais provável
// (mesmo valor assinado, data dentro de ±3 dias).
export function casarExtrato(
  extrato: TransacaoExtrato[],
  movs: MovNaoConciliada[],
): ParExtrato[] {
  const usados = new Set<string>()
  const dist = (a: string, b: string) =>
    Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86400000

  return extrato.map((t) => {
    const sugestao = movs.find((m) => {
      if (usados.has(m.id)) return false
      const valorMov = m.tipo === 'entrada' ? Number(m.valor) : -Number(m.valor)
      return Math.abs(valorMov - t.valor) < 0.01 &&
        dist(m.data_movimentacao, t.data) <= 3
    }) || null
    if (sugestao) usados.add(sugestao.id)
    return { transacao: t, sugestao }
  })
}

// ─── Ações ──────────────────────────────────────────────────────────────────
export async function conciliarMovimentacao(id: string): Promise<Resultado<boolean>> {
  const { error } = await supabase
    .from('movimentacoes_caixa')
    .update({ conciliado: true, conciliado_em: new Date().toISOString() })
    .eq('id', id)
  return { data: error ? null : true, error: error?.message || null }
}

export async function desconciliar(id: string): Promise<Resultado<boolean>> {
  const { error } = await supabase
    .from('movimentacoes_caixa')
    .update({ conciliado: false, conciliado_em: null })
    .eq('id', id)
  return { data: error ? null : true, error: error?.message || null }
}

// Cria uma movimentação já conciliada — para itens do extrato que não existiam
// no sistema (tarifa bancária, rendimento, etc).
export async function criarLancamentoConciliado(input: {
  clinica_id: string
  conta_id: string
  data: string
  descricao: string
  valor: number   // assinado
  criado_por?: string | null
}): Promise<Resultado<boolean>> {
  const comum = {
    clinica_id: input.clinica_id,
    conta_id: input.conta_id,
    valor: Math.abs(input.valor),
    data: input.data,
    descricao: input.descricao,
    origem: 'ajuste_manual' as const,
    criado_por: input.criado_por || null,
  }
  const r = input.valor >= 0 ? await registrarEntrada(comum) : await registrarSaida(comum)
  if (r.error || !r.data) return { data: null, error: r.error || 'falha ao criar lançamento' }
  return conciliarMovimentacao(r.data.id)
}
