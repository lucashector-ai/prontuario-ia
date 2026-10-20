/** Limites do plano Grátis aplicados no servidor (ver lib/planos.ts). */
import type { NextRequest } from 'next/server'
import { sessaoDaRequisicao } from '@/lib/sessao-servidor'
import { supabaseServidor as db } from '@/lib/servidor'
import { PLANO_GRATIS, ehGratis, inicioDoMesSP } from '@/lib/planos'

export async function planoDaClinica(clinicaId: string | null | undefined): Promise<string | null> {
  if (!clinicaId) return null
  const { data } = await db.from('clinicas').select('plano').eq('id', clinicaId).maybeSingle()
  return (data as any)?.plano ?? null
}

/**
 * Plano Grátis: já usou as consultas com IA do mês? Devolve a mensagem para o usuário, ou null
 * se pode seguir. Planos pagos e contas antigas (sem plano) não têm limite.
 */
export async function cotaIaEsgotada(req: NextRequest): Promise<string | null> {
  const s = await sessaoDaRequisicao(req)
  if (!s?.clinica_id) return null
  if (!ehGratis(await planoDaClinica(s.clinica_id))) return null
  const { data: meds } = await db.from('medicos').select('id').eq('clinica_id', s.clinica_id)
  const ids = (meds || []).map((m: any) => m.id)
  if (!ids.length) return null
  const { count } = await db.from('consultas').select('id', { count: 'exact', head: true })
    .in('medico_id', ids).gte('criado_em', inicioDoMesSP())
  if ((count || 0) < PLANO_GRATIS.consultasIaMes) return null
  return `Você usou as ${PLANO_GRATIS.consultasIaMes} consultas com IA do plano Grátis neste mês. A gravação continua salva; para gerar o prontuário com a IA agora, passe para um plano completo.`
}
