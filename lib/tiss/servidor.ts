/**
 * Auxiliares SÓ de servidor para as rotas /api/tiss/*.
 * Escopo: clinica_id (clínica) ou medico_id (médico autônomo) vem na query/corpo,
 * no mesmo padrão das demais rotas do app.
 */
import { NextResponse } from 'next/server'
import { supabaseServidor as db } from '@/lib/servidor'
import type { HistoricoGuia } from './tipos'

export { db }

export const faltaMigration = (erro: any) =>
  !!erro && /column|relation|does not exist|schema cache/i.test(String(erro?.message || erro))

/** Resposta de erro padronizada; tabela inexistente → 503 com aviso da migration. */
export function erro(e: any, status = 500) {
  if (faltaMigration(e)) {
    return NextResponse.json({ error: 'Rode a migration 0012_faturamento_tiss no Supabase.', migration: '0012' }, { status: 503 })
  }
  return NextResponse.json({ error: e?.message || String(e) }, { status })
}

export const ruim = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status })

export type Escopo = { clinica_id?: string | null; medico_id?: string | null }

export function escopoDe(src: URLSearchParams | Record<string, any>): Escopo {
  const get = (k: string) => (src instanceof URLSearchParams ? src.get(k) : src?.[k]) || null
  return { clinica_id: get('clinica_id'), medico_id: get('medico_id') }
}

/** Ids das operadoras visíveis no escopo (clínica tem prioridade sobre médico). */
export async function operadorasDoEscopo(esc: Escopo): Promise<{ ids: string[]; erro?: any }> {
  if (!esc.clinica_id && !esc.medico_id) return { ids: [] }
  let q = db.from('operadoras').select('id')
  q = esc.clinica_id ? q.eq('clinica_id', esc.clinica_id) : q.eq('medico_id', esc.medico_id!)
  const { data, error } = await q
  return { ids: (data || []).map((o: any) => o.id), erro: error }
}

/** Garante que a operadora pertence ao escopo informado. */
export async function operadoraNoEscopo(operadoraId: string, esc: Escopo) {
  const { data, error } = await db.from('operadoras').select('*').eq('id', operadoraId).maybeSingle()
  if (error) return { erro: error }
  if (!data) return { erro: { message: 'Operadora não encontrada.' }, status: 404 }
  const ok = (esc.clinica_id && data.clinica_id === esc.clinica_id) || (!esc.clinica_id && esc.medico_id && data.medico_id === esc.medico_id)
  if (!ok) return { erro: { message: 'Operadora fora do seu escopo.' }, status: 403 }
  return { operadora: data }
}

/**
 * Próximo número sequencial (guia ou lote) da operadora — compare-and-swap no
 * contador da própria operadora, com novas tentativas em caso de concorrência.
 */
export async function proximoNumero(operadoraId: string, campo: 'ultimo_numero_guia' | 'ultimo_numero_lote'): Promise<number> {
  for (let i = 0; i < 6; i++) {
    const { data, error } = await db.from('operadoras').select(campo).eq('id', operadoraId).single()
    if (error) throw error
    const atual = Number((data as any)[campo]) || 0
    const { data: upd, error: e2 } = await db.from('operadoras')
      .update({ [campo]: atual + 1 }).eq('id', operadoraId).eq(campo, atual).select('id')
    if (e2) throw e2
    if (upd && upd.length) return atual + 1
  }
  throw new Error('Não foi possível gerar o número sequencial. Tente de novo.')
}

export const evento = (ev: string, detalhe?: string): HistoricoGuia => ({ em: new Date().toISOString(), evento: ev, ...(detalhe ? { detalhe } : {}) })

export const numero = (v: any) => (v === '' || v === null || v === undefined ? null : Math.round(Number(v) * 100) / 100)

/** Carrega a guia e confere o escopo pela operadora dela. */
export async function guiaNoEscopo(guiaId: string, esc: Escopo) {
  const { data, error } = await db.from('guias_tiss').select('*').eq('id', guiaId).maybeSingle()
  if (error) return { erro: error }
  if (!data) return { erro: { message: 'Guia não encontrada.' }, status: 404 }
  const r = await operadoraNoEscopo(data.operadora_id, esc)
  if (r.erro) return { erro: r.erro, status: r.status }
  return { guia: data, operadora: r.operadora }
}
