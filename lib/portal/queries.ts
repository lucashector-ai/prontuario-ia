import { supabase } from '@/lib/supabase'
import type {
  Agendamento,
  Consulta,
  Exame,
  PortalChatMensagem,
  PortalDocumento,
  PortalProtocolo,
  Prescricao,
} from './types'

/**
 * Helpers de query do portal. Todas retornam [] quando a tabela não existe ou
 * o Supabase falha — o portal degrada graciosamente pra empty state quando
 * rodando sem env real / schema não aplicado.
 */

async function safeList<T>(promise: PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  try {
    const { data, error } = await promise
    if (error) {
      if (typeof console !== 'undefined') console.warn('[portal queries]', error.message)
      return []
    }
    return data || []
  } catch (err: any) {
    if (typeof console !== 'undefined') console.warn('[portal queries]', err?.message || err)
    return []
  }
}

async function safeOne<T>(promise: PromiseLike<{ data: T | null; error: any }>): Promise<T | null> {
  try {
    const { data, error } = await promise
    if (error) return null
    return data
  } catch {
    return null
  }
}

export async function getProximoAgendamento(pacienteId: string): Promise<Agendamento | null> {
  const hoje = new Date().toISOString().split('T')[0]
  return safeOne<Agendamento>(
    supabase
      .from('agendamentos')
      .select('*')
      .eq('paciente_id', pacienteId)
      .gte('data', hoje)
      .neq('status', 'cancelado')
      .order('data', { ascending: true })
      .order('hora', { ascending: true })
      .limit(1)
      .maybeSingle(),
  )
}

export async function listarConsultas(pacienteId: string, limit = 50): Promise<Consulta[]> {
  return safeList<Consulta>(
    supabase
      .from('consultas')
      .select('*')
      .eq('paciente_id', pacienteId)
      .order('data', { ascending: false })
      .limit(limit),
  )
}

export async function buscarConsulta(id: string): Promise<Consulta | null> {
  return safeOne<Consulta>(supabase.from('consultas').select('*').eq('id', id).maybeSingle())
}

export async function listarExames(pacienteId: string): Promise<Exame[]> {
  return safeList<Exame>(
    supabase
      .from('exames')
      .select('*')
      .eq('paciente_id', pacienteId)
      .order('data_realizacao', { ascending: false }),
  )
}

export async function buscarExame(id: string): Promise<Exame | null> {
  return safeOne<Exame>(supabase.from('exames').select('*').eq('id', id).maybeSingle())
}

export async function listarPrescricoes(pacienteId: string): Promise<Prescricao[]> {
  return safeList<Prescricao>(
    supabase
      .from('prescricoes')
      .select('*')
      .eq('paciente_id', pacienteId)
      .order('criado_em', { ascending: false }),
  )
}

export async function listarDocumentos(pacienteId: string): Promise<PortalDocumento[]> {
  return safeList<PortalDocumento>(
    supabase
      .from('portal_documentos')
      .select('*')
      .eq('paciente_id', pacienteId)
      .order('criado_em', { ascending: false }),
  )
}

export async function listarProtocolos(pacienteId: string): Promise<PortalProtocolo[]> {
  return safeList<PortalProtocolo>(
    supabase
      .from('portal_protocolos')
      .select('*')
      .eq('paciente_id', pacienteId)
      .order('iniciado_em', { ascending: false }),
  )
}

export async function listarMensagens(pacienteId: string, limit = 100): Promise<PortalChatMensagem[]> {
  return safeList<PortalChatMensagem>(
    supabase
      .from('portal_chat_mensagens')
      .select('*')
      .eq('paciente_id', pacienteId)
      .order('criada_em', { ascending: true })
      .limit(limit),
  )
}

export async function contarMensagensNaoLidas(pacienteId: string): Promise<number> {
  try {
    const { count } = await supabase
      .from('portal_chat_mensagens')
      .select('id', { count: 'exact', head: true })
      .eq('paciente_id', pacienteId)
      .eq('lida', false)
      .neq('remetente', 'paciente')
    return count || 0
  } catch {
    return 0
  }
}

export async function enviarMensagem(pacienteId: string, conteudo: string): Promise<void> {
  try {
    await supabase.from('portal_chat_mensagens').insert({
      paciente_id: pacienteId,
      remetente: 'paciente',
      conteudo,
      lida: false,
    })
  } catch (err) {
    if (typeof console !== 'undefined') console.warn('[enviarMensagem]', err)
  }
}

/**
 * Eventos da timeline — combina consultas, exames, prescrições, documentos
 * num único feed cronológico decrescente.
 */
export type TimelineEvent = {
  id: string
  tipo: 'consulta' | 'exame' | 'prescricao' | 'documento' | 'agendamento'
  data: string
  titulo: string
  descricao?: string
  link?: string
}

export async function montarTimeline(pacienteId: string): Promise<TimelineEvent[]> {
  const [consultas, exames, prescricoes, documentos] = await Promise.all([
    listarConsultas(pacienteId, 100),
    listarExames(pacienteId),
    listarPrescricoes(pacienteId),
    listarDocumentos(pacienteId),
  ])

  const events: TimelineEvent[] = []

  for (const c of consultas) {
    if (!c.data) continue
    events.push({
      id: `consulta-${c.id}`,
      tipo: 'consulta',
      data: c.data,
      titulo: 'Consulta médica',
      descricao: c.resumo || undefined,
      link: `/portal/consultas/${c.id}`,
    })
  }
  for (const e of exames) {
    const d = e.data_realizacao || e.criado_em
    if (!d) continue
    events.push({
      id: `exame-${e.id}`,
      tipo: 'exame',
      data: d,
      titulo: e.nome || 'Exame',
      link: `/portal/exames/${e.id}`,
    })
  }
  for (const p of prescricoes) {
    if (!p.criado_em) continue
    events.push({
      id: `prescricao-${p.id}`,
      tipo: 'prescricao',
      data: p.criado_em,
      titulo: 'Nova prescrição',
      link: `/portal/receitas`,
    })
  }
  for (const d of documentos) {
    events.push({
      id: `doc-${d.id}`,
      tipo: 'documento',
      data: d.criado_em,
      titulo: d.titulo,
      link: `/portal/documentos`,
    })
  }

  return events.sort((a, b) => (a.data < b.data ? 1 : -1))
}
