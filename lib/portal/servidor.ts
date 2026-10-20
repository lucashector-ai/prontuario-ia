/**
 * Portal do paciente (/p/<token>): link pessoal, sem login, válido por 30 dias e renovado a cada envio.
 * Tudo aqui roda com service role e sempre parte do token → paciente → clínica dona do link;
 * o paciente só enxerga e mexe nos próprios agendamentos daquela clínica.
 * Prontuário nunca aparece no portal.
 */
import { supabaseServidor as db } from '@/lib/servidor'
import { ErroAtendimento, fazerCheckin, type Contexto } from '@/lib/atendimento/servidor'
import { marcarConfirmadoVia } from '@/lib/sofia/confirmacao'
import { urlFormularioPublico } from '@/lib/formularios/envios'
export { linkDoPortal, linkDoPortalDoPaciente } from './link'

const MIN = 60000
/** "Cheguei" vale de 60 min antes até 30 min depois do horário marcado. */
export const JANELA_CHECKIN = { antes: 60 * MIN, depois: 30 * MIN }

export type PortalToken = { token: string; paciente_id: string; clinica_chave: string }

export async function validarToken(token: string): Promise<PortalToken | null> {
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token || '')) return null
  const { data } = await db.from('portal_tokens').select('token, paciente_id, clinica_chave, expira_em, revogado_em').eq('token', token).maybeSingle()
  if (!data || data.revogado_em || new Date(data.expira_em).getTime() < Date.now()) return null
  return { token: data.token, paciente_id: data.paciente_id, clinica_chave: data.clinica_chave }
}

/** Clínica (ou consultório do autônomo) para o cabeçalho e o rodapé. */
async function dadosDaClinica(chave: string) {
  const { data: c } = await db.from('clinicas').select('nome, logo_url, telefone, endereco').eq('id', chave).maybeSingle()
  if (c) return { nome: c.nome || '', logo_url: c.logo_url || null, telefone: c.telefone || null, endereco: c.endereco || null }
  const { data: m } = await db.from('medicos').select('nome, telefone').eq('id', chave).maybeSingle()
  return { nome: (m as any)?.nome || '', logo_url: null, telefone: (m as any)?.telefone || null, endereco: null }
}

/** Agendamento do paciente nesta clínica (garante que o id pertence ao dono do link). */
async function agendamentoDoPaciente(t: PortalToken, agendamentoId: string) {
  const { data: ag } = await db.from('agendamentos').select('id, paciente_id, medico_id, data_hora, status, confirmacao_24h_status')
    .eq('id', agendamentoId).eq('paciente_id', t.paciente_id).maybeSingle()
  if (!ag) throw new ErroAtendimento('Consulta não encontrada.', 404)
  return ag as any
}

export async function dadosDoPortal(t: PortalToken) {
  const agora = new Date()
  const [clinica, { data: pac }, { data: ags }, { data: forms }, { data: rets }] = await Promise.all([
    dadosDaClinica(t.clinica_chave),
    db.from('pacientes').select('nome').eq('id', t.paciente_id).maybeSingle(),
    db.from('agendamentos').select('id, data_hora, duracao, tipo, status, confirmacao_24h_status, meet_link, medico:medicos(nome, especialidade)')
      .eq('paciente_id', t.paciente_id).gte('data_hora', new Date(agora.getTime() - JANELA_CHECKIN.depois).toISOString())
      .in('status', ['agendado', 'confirmado', 'confirmacao_enviada']).order('data_hora').limit(3),
    db.from('formularios_envios').select('token, expira_em, template:formularios_templates(nome)')
      .eq('paciente_id', t.paciente_id).eq('status', 'pendente').gt('expira_em', agora.toISOString()).order('enviado_em', { ascending: false }).limit(5),
    db.from('retornos').select('id, data_prevista, motivo').eq('paciente_id', t.paciente_id).eq('status', 'pendente').order('data_prevista').limit(1),
  ])
  db.from('portal_tokens').update({ ultimo_acesso_em: agora.toISOString() }).eq('token', t.token).then(() => {}, () => {})

  const proxima = (ags || [])[0] as any
  let checkin: { senha: string } | null = null
  if (proxima) {
    const { data: at } = await db.from('atendimentos').select('senha').eq('agendamento_id', proxima.id).maybeSingle()
    if (at) checkin = { senha: (at as any).senha }
  }
  const inicio = proxima ? new Date(proxima.data_hora).getTime() : 0
  return {
    clinica,
    paciente: { primeiro_nome: String((pac as any)?.nome || '').trim().split(/\s+/)[0] || '' },
    proxima: proxima ? {
      id: proxima.id, data_hora: proxima.data_hora, duracao: Number(proxima.duracao) || 30, tipo: proxima.tipo,
      confirmada: proxima.status === 'confirmado' || proxima.confirmacao_24h_status === 'confirmado',
      remarcar_pedido: proxima.confirmacao_24h_status === 'reagendou',
      medico: proxima.medico?.nome || null, especialidade: proxima.medico?.especialidade || null,
      teleconsulta: proxima.meet_link || null,
      pode_checkin: !proxima.meet_link && agora.getTime() >= inicio - JANELA_CHECKIN.antes && agora.getTime() <= inicio + JANELA_CHECKIN.depois,
      checkin,
    } : null,
    formularios: (forms || []).map((f: any) => ({ nome: f.template?.nome || 'Formulário', url: urlFormularioPublico('c', f.token) })),
    retorno: (rets || [])[0] ? { data_prevista: (rets as any)[0].data_prevista, motivo: (rets as any)[0].motivo || null } : null,
  }
}

export async function confirmarPeloPortal(t: PortalToken, agendamentoId: string) {
  const ag = await agendamentoDoPaciente(t, agendamentoId)
  if (!['agendado', 'confirmado', 'confirmacao_enviada'].includes(ag.status)) throw new ErroAtendimento('Esta consulta não pode mais ser confirmada.', 409)
  await marcarConfirmadoVia(ag.id, 'portal')
  await db.from('agendamentos').update({ confirmacao_24h_status: 'confirmado', confirmacao_24h_resposta_em: new Date().toISOString() }).eq('id', ag.id)
  return { ok: true }
}

/** Pedido de novo horário: a consulta continua marcada até a recepção remarcar; ela recebe o aviso no sino. */
export async function remarcarPeloPortal(t: PortalToken, agendamentoId: string, preferencia: string) {
  const ag = await agendamentoDoPaciente(t, agendamentoId)
  const { data: pac } = await db.from('pacientes').select('nome').eq('id', t.paciente_id).maybeSingle()
  const quando = new Date(ag.data_hora).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
  const pref = String(preferencia || '').trim().slice(0, 300)
  await db.from('agendamentos').update({ confirmacao_24h_status: 'reagendou', confirmacao_24h_resposta_em: new Date().toISOString() }).eq('id', ag.id)
  await db.from('notificacoes_medico').insert({
    medico_id: ag.medico_id, agendamento_id: ag.id, paciente_id: t.paciente_id, tipo: 'reagendamento_solicitado',
    titulo: `${String((pac as any)?.nome || 'Paciente').split(' ').slice(0, 2).join(' ')} pediu para remarcar`,
    descricao: `Consulta de ${quando}${pref ? ` · prefere: ${pref}` : ''} (pelo portal do paciente)`,
    link: `/agenda?ag=${ag.id}`, lida: false,
  })
  return { ok: true }
}

export async function checkinPeloPortal(t: PortalToken, agendamentoId: string) {
  const ag = await agendamentoDoPaciente(t, agendamentoId)
  const inicio = new Date(ag.data_hora).getTime(), agora = Date.now()
  if (agora < inicio - JANELA_CHECKIN.antes) throw new ErroAtendimento('O "Cheguei" libera 1 hora antes da consulta.', 409)
  if (agora > inicio + JANELA_CHECKIN.depois) throw new ErroAtendimento('Passou o horário desta consulta. Fale com a recepção.', 409)
  const { data: autonomo } = await db.from('medicos').select('id').eq('id', t.clinica_chave).maybeSingle()
  const ctx: Contexto = { clinica: t.clinica_chave, usuario: t.paciente_id, medicoId: autonomo ? autonomo.id : null, tipo: autonomo ? 'medico' : 'clinica' }
  const { atendimento, jaExistia } = await fazerCheckin(ctx, { agendamentoId: ag.id, origem: 'portal' })
  const { count } = await db.from('atendimentos').select('id', { count: 'exact', head: true })
    .eq('clinica_id', t.clinica_chave).eq('dia', atendimento.dia).in('status', ['aguardando', 'aguardando_triagem'])
    .lt('chegada_em', atendimento.chegada_em || new Date().toISOString())
  return { senha: atendimento.senha, ja_existia: jaExistia, na_frente: count || 0 }
}
