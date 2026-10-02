import { NextRequest } from 'next/server'
import { supabaseServidor as db } from '@/lib/servidor'
import { sessaoDaRequisicao } from '@/lib/sessao-servidor'

/**
 * Quem está conectando e para qual médico vão as conversas.
 * Médico logado → ele mesmo. Admin da clínica → o médico pedido (se for da clínica) ou o primeiro ativo.
 */
export async function escopoCanais(req: NextRequest, medicoPedido?: string | null) {
  const s = await sessaoDaRequisicao(req)
  if (!s) return null
  let medicos: { id: string; nome: string }[] = []
  if (s.clinica_id) {
    const { data } = await db.from('medicos').select('id, nome').eq('clinica_id', s.clinica_id).eq('ativo', true).order('criado_em')
    medicos = (data || []) as any
  }
  if (s.medico_id && !medicos.some(m => m.id === s.medico_id)) {
    const { data } = await db.from('medicos').select('id, nome').eq('id', s.medico_id).maybeSingle()
    if (data) medicos.unshift(data as any)
  }
  const medicoId =
    (medicoPedido && medicos.some(m => m.id === medicoPedido) && medicoPedido) ||
    s.medico_id || medicos[0]?.id || null
  return { sessao: s, clinicaId: s.clinica_id, medicoId, medicos, medicoIds: medicos.map(m => m.id) }
}
