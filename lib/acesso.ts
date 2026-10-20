/**
 * Quem pode o quê nas rotas /api que usam a chave de servidor (service role ignora o RLS,
 * então a checagem tem que ser feita aqui):
 *
 *   const ctx = await contextoDaRequisicao(req)    // null = sem sessão
 *   if (!ctx?.gestor) return proibido()
 *   ... sempre use ctx.clinica_id da SESSÃO, nunca o clinica_id do corpo/URL
 *
 * Gestor = dono/admin da clínica (conta clinica_admins) ou médico com cargo 'admin'.
 */
import { NextRequest, NextResponse } from 'next/server'
import { sessaoDaRequisicao } from '@/lib/sessao-servidor'
import { supabaseServidor as db } from '@/lib/servidor'

export type Contexto = {
  tipo: 'clinica' | 'medico' | 'atendente'
  clinica_id: string | null
  medico_id: string | null
  /** Dono/admin da clínica (pode gerenciar equipe e configurações). */
  gestor: boolean
}

export async function contextoDaRequisicao(req: NextRequest): Promise<Contexto | null> {
  const s = await sessaoDaRequisicao(req)
  if (!s) return null
  let gestor = s.tipo === 'clinica' && !!s.clinica_id
  if (!gestor && s.tipo === 'medico' && s.medico_id) {
    const { data } = await db.from('medicos').select('cargo, ativo, clinica_id').eq('id', s.medico_id).maybeSingle()
    gestor = !!data && data.ativo !== false && data.cargo === 'admin' && (!s.clinica_id || data.clinica_id === s.clinica_id)
  }
  return { tipo: s.tipo, clinica_id: s.clinica_id, medico_id: s.medico_id, gestor }
}

/** A pessoa (linha de medicos) pertence à clínica da sessão? */
export async function medicoDaClinica(medicoId: string, clinicaId: string | null) {
  if (!medicoId || !clinicaId) return null
  const { data } = await db.from('medicos').select('id, clinica_id, cargo').eq('id', medicoId).eq('clinica_id', clinicaId).maybeSingle()
  return data as { id: string; clinica_id: string; cargo: string } | null
}

export const naoAutenticado = () => NextResponse.json({ error: 'Sessão expirada. Entre novamente.' }, { status: 401 })
export const proibido = (msg = 'Sem permissão para esta ação') => NextResponse.json({ error: msg }, { status: 403 })

/**
 * Prontuário é de quem atendeu (migration 0023), também nas rotas com chave de servidor:
 * médico lê o próprio; colega só se a clínica compartilha ou a consulta foi compartilhada;
 * recepção e enfermagem não leem; administrador da clínica lê (indicadores dependem disso).
 * Antes da 0023 rodar (coluna ausente), a clínica segue compartilhando como antes.
 */
export async function regraDoProntuario(ctx: Contexto) {
  const [{ data: eu }, clin, { data: meds }] = await Promise.all([
    ctx.medico_id ? db.from('medicos').select('cargo').eq('id', ctx.medico_id).maybeSingle() : Promise.resolve({ data: null }),
    ctx.clinica_id ? db.from('clinicas').select('prontuario_compartilhado').eq('id', ctx.clinica_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ctx.clinica_id ? db.from('medicos').select('id').eq('clinica_id', ctx.clinica_id) : Promise.resolve({ data: [] as any[] }),
  ])
  const daClinica = new Set<string>([...(meds || []).map((m: any) => m.id), ...(ctx.medico_id ? [ctx.medico_id] : [])])
  const apoio = ['recepcionista', 'enfermagem'].includes((eu as any)?.cargo)
  const compartilha = (clin as any)?.error ? true : !!(clin as any)?.data?.prontuario_compartilhado
  return (r: { medico_id?: string | null; compartilhada?: boolean | null }) => {
    if (!r.medico_id || !daClinica.has(r.medico_id)) return false
    if (ctx.tipo === 'clinica') return true
    if (apoio || ctx.tipo === 'atendente') return false
    return r.medico_id === ctx.medico_id || !!r.compartilhada || compartilha
  }
}
