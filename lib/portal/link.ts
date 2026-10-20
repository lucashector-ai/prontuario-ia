/**
 * Link pessoal do portal do paciente (/p/<token>): cria ou renova por 30 dias.
 * Separado de servidor.ts para os envios do WhatsApp poderem usar sem dependência circular.
 */
import { randomBytes } from 'crypto'
import { supabaseServidor as db } from '@/lib/servidor'
import { ErroAtendimento } from '@/lib/atendimento/servidor'

const DIA = 86400000

function baseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://clinical360.vercel.app').replace(/\/+$/, '')
}

/** Clínica dona do paciente: a clínica, ou o médico autônomo (mesma chave usada no atendimento). */
async function chaveDoPaciente(pacienteId: string): Promise<string | null> {
  const { data } = await db.from('pacientes').select('clinica_id, medico_id').eq('id', pacienteId).maybeSingle()
  return (data as any)?.clinica_id || (data as any)?.medico_id || null
}

/** Cria (ou renova por mais 30 dias) o link do portal de um paciente da clínica. */
export async function linkDoPortal(pacienteId: string, clinicaChave: string): Promise<{ url: string; expira_em: string }> {
  const dono = await chaveDoPaciente(pacienteId)
  if (!dono || dono !== clinicaChave) throw new ErroAtendimento('Paciente não encontrado.', 404)
  const expira = new Date(Date.now() + 30 * DIA).toISOString()
  const { data: atual } = await db.from('portal_tokens').select('token').eq('paciente_id', pacienteId).eq('clinica_chave', clinicaChave)
    .is('revogado_em', null).gt('expira_em', new Date().toISOString()).order('criado_em', { ascending: false }).limit(1)
  let token = atual?.[0]?.token as string | undefined
  if (token) {
    await db.from('portal_tokens').update({ expira_em: expira }).eq('token', token)
  } else {
    token = randomBytes(18).toString('base64url')
    const { error } = await db.from('portal_tokens').insert({ token, paciente_id: pacienteId, clinica_chave: clinicaChave, expira_em: expira })
    if (error) throw error
  }
  return { url: `${baseUrl()}/p/${token}`, expira_em: expira }
}

/** Link do portal pelo próprio paciente (a clínica dona dele). null se não der para gerar. */
export async function linkDoPortalDoPaciente(pacienteId: string | null | undefined): Promise<string | null> {
  if (!pacienteId) return null
  try {
    const chave = await chaveDoPaciente(pacienteId)
    return chave ? (await linkDoPortal(pacienteId, chave)).url : null
  } catch { return null }
}
