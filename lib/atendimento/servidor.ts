/**
 * Fluxo de atendimento — regras do servidor (rotas /api/atendimento e /api/painel).
 *
 *   const ctx = await contextoAtendimento(req)          // quem chama e de qual clínica
 *   const at = await fazerCheckin(ctx, { agendamentoId, prioridade })
 *   const chamado = await chamarProximo(ctx, { medicoId, consultorioId })
 *
 * "Clínica" aqui é a chave da clínica do token; médico autônomo (sem clínica) usa o
 * próprio id como chave, para ter setores, senhas e painel do mesmo jeito.
 */
import { NextRequest } from 'next/server'
import { supabaseServidor as db } from '@/lib/servidor'
import { sessaoDaRequisicao } from '@/lib/sessao-servidor'
import { log } from '@/lib/logger'
import { enviarWhatsApp } from '@/lib/whatsapp/enviar'
import {
  ehMensagemDeChegada, hojeSP, limitesDoDiaSP, nomeNoPainel, prefixoSenha, prioridadePelaIdade, ordenarFila,
  type Atendimento, type ExibicaoPainel, type Prioridade,
} from './comum'

export class ErroAtendimento extends Error {
  constructor(msg: string, public status = 400) { super(msg) }
}

export type Contexto = {
  clinica: string                 // chave da clínica
  usuario: string                 // quem está operando (sub do token)
  medicoId: string | null         // médico logado (null para admin da clínica)
  tipo: 'clinica' | 'medico' | 'atendente'
}

export async function contextoAtendimento(req: NextRequest): Promise<Contexto> {
  const s = await sessaoDaRequisicao(req)
  if (!s) throw new ErroAtendimento('Sessão expirada. Entre de novo.', 401)
  const clinica = s.clinica_id || s.medico_id
  if (!clinica) throw new ErroAtendimento('Conta sem clínica.', 403)
  return { clinica, usuario: s.sub, medicoId: s.medico_id, tipo: s.tipo }
}

/** Médicos da clínica (ou o próprio, se autônomo). */
export async function medicosDaClinica(ctx: Contexto) {
  if (ctx.clinica === ctx.medicoId) {
    const { data } = await db.from('medicos').select('id, nome, cargo, consultorio_id').eq('id', ctx.medicoId)
    return data || []
  }
  const { data } = await db.from('medicos').select('id, nome, cargo, consultorio_id')
    .eq('clinica_id', ctx.clinica).eq('ativo', true).order('nome')
  return (data || []).filter((m: any) => (m.cargo || 'medico') !== 'recepcionista')
}

async function garantirMedico(ctx: Contexto, medicoId: string) {
  const medicos = await medicosDaClinica(ctx)
  const m = medicos.find((x: any) => x.id === medicoId)
  if (!m) throw new ErroAtendimento('Médico não pertence a esta clínica.', 403)
  return m as { id: string; nome: string; consultorio_id: string | null }
}

export async function carregarAtendimento(ctx: Contexto, id: string): Promise<Atendimento> {
  const { data } = await db.from('atendimentos').select(SELECT_ATENDIMENTO).eq('id', id).eq('clinica_id', ctx.clinica).maybeSingle()
  if (!data) throw new ErroAtendimento('Atendimento não encontrado.', 404)
  return (await comMedico([data as any]))[0] as any
}

// O nome do médico vem à parte (comMedico): atendimentos.medico_id não tem chave
// estrangeira para medicos, então o PostgREST não consegue juntar as tabelas.
export const SELECT_ATENDIMENTO =
  '*, paciente:pacientes(id, nome, telefone, data_nascimento), consultorio:consultorios(id, nome)'

async function comMedico<T extends { medico_id: string }>(lista: T[]): Promise<(T & { medico: { id: string; nome: string } | null })[]> {
  const ids = Array.from(new Set(lista.map(a => a.medico_id)))
  if (!ids.length) return lista.map(a => ({ ...a, medico: null }))
  const { data } = await db.from('medicos').select('id, nome').in('id', ids)
  const porId = new Map((data || []).map((m: any) => [m.id, m]))
  return lista.map(a => ({ ...a, medico: porId.get(a.medico_id) || null }))
}

// ── Configuração ─────────────────────────────────────────────────────────────

export async function setoresDaClinica(ctx: Contexto) {
  const [{ data: setores }, { data: consultorios }] = await Promise.all([
    db.from('setores').select('*').eq('clinica_id', ctx.clinica).order('ordem').order('criado_em'),
    db.from('consultorios').select('*').eq('clinica_id', ctx.clinica).order('ordem').order('criado_em'),
  ])
  return { setores: setores || [], consultorios: consultorios || [] }
}

/** Setor para onde vai o paciente do médico: o do consultório padrão dele, senão o primeiro ativo. */
async function setorDoMedico(ctx: Contexto, consultorioId: string | null): Promise<string | null> {
  if (consultorioId) {
    const { data } = await db.from('consultorios').select('setor_id').eq('id', consultorioId).eq('clinica_id', ctx.clinica).maybeSingle()
    if (data?.setor_id) return data.setor_id
  }
  const { data } = await db.from('setores').select('id').eq('clinica_id', ctx.clinica).eq('ativo', true).order('ordem').limit(1)
  return data?.[0]?.id || null
}

// ── Fila do dia ──────────────────────────────────────────────────────────────

export async function filaDoDia(ctx: Contexto, p: { dia?: string; medicoId?: string | null }) {
  const dia = p.dia || hojeSP()
  let q = db.from('atendimentos').select(SELECT_ATENDIMENTO).eq('clinica_id', ctx.clinica).eq('dia', dia)
  if (p.medicoId) q = q.eq('medico_id', p.medicoId)
  const { data: atendimentos, error } = await q.order('chegada_em')
  if (error) throw error

  // Agendados do dia que ainda não chegaram
  const medicos = await medicosDaClinica(ctx)
  const ids = p.medicoId ? [p.medicoId] : medicos.map((m: any) => m.id)
  const { de, ate } = limitesDoDiaSP(dia)
  const comCheckin = new Set((atendimentos || []).map((a: any) => a.agendamento_id).filter(Boolean))
  const { data: ags } = ids.length ? await db.from('agendamentos')
    .select('id, data_hora, medico_id, tipo, motivo, status, paciente:pacientes(id, nome, telefone, data_nascimento), medico:medicos(id, nome)')
    .in('medico_id', ids).gte('data_hora', de).lte('data_hora', ate)
    .not('status', 'in', '(cancelado,faltou,realizado)').order('data_hora') : { data: [] as any[] }

  return {
    dia,
    atendimentos: (await comMedico((atendimentos || []) as any[])) as any as Atendimento[],
    esperados: (ags || []).filter((a: any) => !comCheckin.has(a.id)),
    medicos: medicos.map((m: any) => ({ id: m.id, nome: m.nome, consultorio_id: m.consultorio_id })),
  }
}

// ── Check-in ─────────────────────────────────────────────────────────────────

export async function fazerCheckin(ctx: Contexto, p: {
  agendamentoId?: string | null
  pacienteId?: string | null
  medicoId?: string | null
  prioridade?: Prioridade | null
  origem?: Atendimento['origem']
  observacao?: string | null
}): Promise<{ atendimento: Atendimento; jaExistia: boolean }> {
  const dia = hojeSP()
  let medicoId = p.medicoId || null
  let pacienteId = p.pacienteId || null
  let horario: string | null = null

  if (p.agendamentoId) {
    // Check-in repetido devolve o mesmo atendimento (e a mesma senha)
    const { data: existente } = await db.from('atendimentos').select(SELECT_ATENDIMENTO)
      .eq('agendamento_id', p.agendamentoId).eq('clinica_id', ctx.clinica).maybeSingle()
    if (existente) return { atendimento: await carregarAtendimento(ctx, (existente as any).id), jaExistia: true }

    const { data: ag } = await db.from('agendamentos').select('id, medico_id, paciente_id, data_hora, status').eq('id', p.agendamentoId).maybeSingle()
    if (!ag) throw new ErroAtendimento('Agendamento não encontrado.', 404)
    if (ag.status === 'cancelado') throw new ErroAtendimento('Este agendamento foi cancelado.')
    medicoId = ag.medico_id; pacienteId = ag.paciente_id; horario = ag.data_hora
  }
  if (!medicoId) throw new ErroAtendimento('Escolha o médico.')
  if (!pacienteId) throw new ErroAtendimento('Escolha o paciente.')
  const medico = await garantirMedico(ctx, medicoId)

  const { data: pac } = await db.from('pacientes').select('id, data_nascimento').eq('id', pacienteId).maybeSingle()
  if (!pac) throw new ErroAtendimento('Paciente não encontrado.', 404)

  // Paciente já na fila hoje com este médico (encaixe repetido) → mesmo atendimento
  if (!p.agendamentoId) {
    const { data: ativo } = await db.from('atendimentos').select(SELECT_ATENDIMENTO)
      .eq('clinica_id', ctx.clinica).eq('dia', dia).eq('paciente_id', pacienteId).eq('medico_id', medicoId)
      .in('status', ['aguardando', 'chamado', 'em_atendimento']).maybeSingle()
    if (ativo) return { atendimento: await carregarAtendimento(ctx, (ativo as any).id), jaExistia: true }
  }

  const prioridade: Prioridade = p.prioridade || prioridadePelaIdade(pac.data_nascimento)
  const { data: senha, error: eSenha } = await db.rpc('c360_proxima_senha', { p_clinica: ctx.clinica, p_dia: dia, p_prefixo: prefixoSenha(prioridade) })
  if (eSenha) throw eSenha

  const linha = {
    clinica_id: ctx.clinica, medico_id: medicoId, paciente_id: pacienteId, agendamento_id: p.agendamentoId || null,
    setor_id: await setorDoMedico(ctx, medico.consultorio_id), consultorio_id: medico.consultorio_id || null,
    dia, senha, status: 'aguardando', prioridade, origem: p.origem || (p.agendamentoId ? 'recepcao' : 'encaixe'),
    horario_previsto: horario, observacao: p.observacao || null, criado_por: ctx.usuario,
  }
  const { data, error } = await db.from('atendimentos').insert(linha).select(SELECT_ATENDIMENTO).single()
  if (error) {
    // Corrida: outro computador fez o check-in do mesmo agendamento no mesmo instante
    if (p.agendamentoId && /atendimentos_agendamento_uniq/.test(error.message)) {
      const { data: outro } = await db.from('atendimentos').select('id').eq('agendamento_id', p.agendamentoId).single()
      return { atendimento: await carregarAtendimento(ctx, (outro as any).id), jaExistia: true }
    }
    throw error
  }
  if (p.agendamentoId) {
    await db.from('agendamentos').update({ status: 'confirmado' }).eq('id', p.agendamentoId).in('status', ['agendado', 'confirmacao_enviada'])
  }
  return { atendimento: await carregarAtendimento(ctx, (data as any).id), jaExistia: false }
}

// ── Chamada ──────────────────────────────────────────────────────────────────

/** Chama o próximo da fila do médico (ou um paciente específico / de novo) e manda para a TV. */
export async function chamar(ctx: Contexto, p: {
  medicoId: string
  consultorioId: string | null
  atendimentoId?: string | null
  rechamar?: boolean
}): Promise<Atendimento | null> {
  await garantirMedico(ctx, p.medicoId)
  let consultorio: { id: string; nome: string; setor_id: string } | null = null
  if (p.consultorioId) {
    const { data } = await db.from('consultorios').select('id, nome, setor_id').eq('id', p.consultorioId).eq('clinica_id', ctx.clinica).maybeSingle()
    if (!data) throw new ErroAtendimento('Consultório não encontrado.', 404)
    consultorio = data
    await db.from('medicos').update({ consultorio_id: data.id }).eq('id', p.medicoId)
  }

  let alvo: any = null
  if (p.atendimentoId) {
    const atual = await carregarAtendimento(ctx, p.atendimentoId)
    if (atual.medico_id !== p.medicoId) throw new ErroAtendimento('Este paciente está na fila de outro médico.', 409)
    const permitidos = p.rechamar ? ['chamado', 'aguardando', 'ausente'] : ['aguardando', 'ausente']
    const { data } = await db.from('atendimentos')
      .update({ status: 'chamado', chamado_em: new Date().toISOString(), chamadas: atual.chamadas + 1, consultorio_id: consultorio?.id || atual.consultorio_id, atualizado_em: new Date().toISOString() })
      .eq('id', atual.id).in('status', permitidos).select('id').maybeSingle()
    if (!data) throw new ErroAtendimento('Este paciente já foi chamado ou atendido.', 409)
    alvo = data
  } else {
    const { data, error } = await db.rpc('c360_chamar_proximo', { p_medico: p.medicoId, p_dia: hojeSP(), p_consultorio: consultorio?.id || null })
    if (error) throw error
    alvo = Array.isArray(data) ? data[0] : data
    if (!alvo) return null
  }

  const at = await carregarAtendimento(ctx, alvo.id)
  await registrarChamada(ctx, at, consultorio)
  avisarPorWhatsApp(ctx, at, consultorio?.nome || at.consultorio?.nome || 'Consultório').catch(e => log.warn('[atendimento] aviso whatsapp', e?.message))
  return at
}

async function registrarChamada(ctx: Contexto, at: Atendimento, consultorio: { nome: string; setor_id: string } | null) {
  const setorId = consultorio?.setor_id || at.setor_id
  let exibicao: ExibicaoPainel = 'senha_nome'
  if (setorId) {
    const { data } = await db.from('setores').select('painel_exibicao').eq('id', setorId).maybeSingle()
    if (data?.painel_exibicao) exibicao = data.painel_exibicao
  }
  await db.from('chamadas_painel').insert({
    clinica_id: ctx.clinica, setor_id: setorId, atendimento_id: at.id, senha: at.senha,
    nome_exibicao: nomeNoPainel(at.paciente?.nome, exibicao),
    local: consultorio?.nome || at.consultorio?.nome || 'Consultório',
  })
}

/** "Sua vez" para quem foi chamado e "você é o próximo" para o seguinte da fila. Melhor esforço. */
async function avisarPorWhatsApp(ctx: Contexto, at: Atendimento, local: string) {
  const setorId = at.consultorio_id
    ? (await db.from('consultorios').select('setor_id').eq('id', at.consultorio_id).maybeSingle()).data?.setor_id
    : at.setor_id
  if (setorId) {
    const { data: setor } = await db.from('setores').select('avisar_whatsapp').eq('id', setorId).maybeSingle()
    if (setor && setor.avisar_whatsapp === false) return
  }
  const nome = at.paciente?.nome?.split(' ')[0] || ''
  if (at.paciente?.telefone && at.chamadas === 1) {
    await enviarWhatsApp({
      medicoId: at.medico_id, telefone: at.paciente.telefone,
      texto: `${nome ? nome + ', é' : 'É'} a sua vez! Senha ${at.senha} — dirija-se ao ${local}.`,
      registrar: { nome: at.paciente.nome, pacienteId: at.paciente.id, metadata: { atendimento: at.id, tipo: 'chamada' } },
    })
  }
  const { data: fila } = await db.from('atendimentos').select('id, prioridade, horario_previsto, chegada_em, senha, paciente:pacientes(id, nome, telefone)')
    .eq('clinica_id', ctx.clinica).eq('medico_id', at.medico_id).eq('dia', at.dia).eq('status', 'aguardando')
  const proximo: any = ordenarFila((fila || []) as any)[0]
  if (proximo?.paciente?.telefone) {
    const { count } = await db.from('whatsapp_mensagens').select('id', { count: 'exact', head: true })
      .contains('metadata', { atendimento: proximo.id, tipo: 'proximo' })
    if (count) return   // já avisado
    await enviarWhatsApp({
      medicoId: at.medico_id, telefone: proximo.paciente.telefone,
      texto: `${proximo.paciente.nome?.split(' ')[0] || 'Olá'}, você é o próximo! Fique atento ao painel — senha ${proximo.senha}.`,
      registrar: { nome: proximo.paciente.nome, pacienteId: proximo.paciente.id, metadata: { atendimento: proximo.id, tipo: 'proximo' } },
    })
  }
}

// ── Mudanças de status ───────────────────────────────────────────────────────

export type AcaoAtendimento = 'iniciar' | 'finalizar' | 'ausente' | 'voltar_fila' | 'cancelar' | 'prioridade'

const TRANSICOES: Record<Exclude<AcaoAtendimento, 'prioridade'>, { de: string[]; para: string }> = {
  iniciar: { de: ['chamado', 'aguardando'], para: 'em_atendimento' },
  finalizar: { de: ['em_atendimento', 'chamado'], para: 'finalizado' },
  ausente: { de: ['chamado', 'aguardando'], para: 'ausente' },
  voltar_fila: { de: ['chamado', 'ausente', 'cancelado'], para: 'aguardando' },
  cancelar: { de: ['aguardando', 'chamado', 'ausente'], para: 'cancelado' },
}

export async function mudarAtendimento(ctx: Contexto, id: string, acao: AcaoAtendimento, extra: {
  prioridade?: Prioridade
  retorno?: { dias: number; motivo?: string | null } | null
} = {}): Promise<Atendimento> {
  const atual = await carregarAtendimento(ctx, id)
  const agora = new Date().toISOString()

  if (acao === 'prioridade') {
    if (!extra.prioridade) throw new ErroAtendimento('Prioridade inválida.')
    await db.from('atendimentos').update({ prioridade: extra.prioridade, atualizado_em: agora }).eq('id', id)
    return carregarAtendimento(ctx, id)
  }

  const t = TRANSICOES[acao]
  if (!t) throw new ErroAtendimento('Ação inválida.')
  const campos: Record<string, any> = { status: t.para, atualizado_em: agora }
  if (acao === 'iniciar') campos.inicio_em = agora
  if (acao === 'finalizar') { campos.fim_em = agora; if (!atual.inicio_em) campos.inicio_em = atual.chamado_em || agora }

  const { data } = await db.from('atendimentos').update(campos).eq('id', id).in('status', t.de).select('id').maybeSingle()
  if (!data) throw new ErroAtendimento(`Não dá para ${acao.replace('_', ' ')}: o atendimento está "${atual.status}".`, 409)

  if (acao === 'finalizar') {
    if (atual.agendamento_id) await db.from('agendamentos').update({ status: 'realizado' }).eq('id', atual.agendamento_id)
    if (extra.retorno?.dias && atual.paciente_id) {
      const d = new Date(); d.setDate(d.getDate() + Math.round(extra.retorno.dias))
      const { error } = await db.from('retornos').insert({
        medico_id: atual.medico_id, paciente_id: atual.paciente_id, data_prevista: hojeSP(d),
        motivo: extra.retorno.motivo || null, origem: 'consulta', status: 'pendente',
      })
      if (error) log.warn('[atendimento] retorno', error.message)
    }
  }
  return carregarAtendimento(ctx, id)
}

// ── Painel da TV (público, pelo link secreto) ────────────────────────────────

export async function dadosDoPainel(token: string) {
  if (!/^[a-f0-9]{24,64}$/i.test(token)) return null
  const { data: setor } = await db.from('setores').select('id, clinica_id, nome, painel_voz, painel_mensagem, ativo').eq('painel_token', token).maybeSingle()
  if (!setor || !setor.ativo) return null
  const { de } = limitesDoDiaSP(hojeSP())
  const [{ data: chamadas }, { data: clinica }] = await Promise.all([
    db.from('chamadas_painel').select('id, senha, nome_exibicao, local, criado_em')
      .eq('setor_id', setor.id).gte('criado_em', de).order('criado_em', { ascending: false }).limit(8),
    db.from('clinicas').select('nome, logo_url').eq('id', setor.clinica_id).maybeSingle(),
  ])
  return {
    setor: { nome: setor.nome, voz: setor.painel_voz, mensagem: setor.painel_mensagem },
    clinica: { nome: clinica?.nome || null, logo_url: clinica?.logo_url || null },
    chamadas: chamadas || [],
  }
}

/** Só "tabela/função não existe" conta como migration faltando (erro de junção ou de coluna aparece como erro normal). */
export const faltaMigration = (e: any) => {
  const m = String(e?.message || '')
  return /(relation|table|function)[^]*(atendimentos|setores|consultorios|chamadas_painel|senhas_contador|c360_proxima_senha|c360_chamar_proximo)[^]*(does not exist|schema cache)/i.test(m)
    || /Could not find the (table|function) [^]*(atendimentos|setores|consultorios|chamadas_painel|c360_)/i.test(m)
}

// ── Check-in pelo WhatsApp ("cheguei") ───────────────────────────────────────

/**
 * O paciente escreveu "cheguei": confirma a chegada no agendamento de hoje e responde
 * com a senha e a posição na fila. Devolve null quando não é o caso (a Sofia segue normal):
 * mensagem não é de chegada, paciente desconhecido ou clínica sem recepção configurada.
 */
export async function checkinPeloWhatsApp(p: { medicoId: string; pacienteId: string | null; texto: string }): Promise<string | null> {
  if (!p.pacienteId || !ehMensagemDeChegada(p.texto)) return null
  const { data: med } = await db.from('medicos').select('id, clinica_id').eq('id', p.medicoId).maybeSingle()
  if (!med) return null
  const clinica = med.clinica_id || med.id
  const { data: setores } = await db.from('setores').select('id, nome').eq('clinica_id', clinica).eq('ativo', true).limit(1)
  if (!setores?.length) return null   // clínica não usa a fila

  const ctx: Contexto = { clinica, usuario: med.id, medicoId: med.id, tipo: 'medico' }
  const ids = (await medicosDaClinica(ctx)).map((m: any) => m.id)
  const { de, ate } = limitesDoDiaSP(hojeSP())
  const { data: ags } = await db.from('agendamentos').select('id, data_hora')
    .eq('paciente_id', p.pacienteId).in('medico_id', ids.length ? ids : [med.id])
    .gte('data_hora', de).lte('data_hora', ate).not('status', 'in', '(cancelado,faltou,realizado)')
    .order('data_hora').limit(1)
  if (!ags?.length) return 'Não encontrei consulta sua marcada para hoje. Por favor, procure a recepção. 🙂'

  const { atendimento: at, jaExistia } = await fazerCheckin(ctx, { agendamentoId: ags[0].id, origem: 'whatsapp' })
  const { data: fila } = await db.from('atendimentos').select('id, prioridade, horario_previsto, chegada_em')
    .eq('clinica_id', clinica).eq('medico_id', at.medico_id).eq('dia', at.dia).eq('status', 'aguardando')
  const pos = ordenarFila((fila || []) as any).findIndex((x: any) => x.id === at.id) + 1
  const setor = setores.find(s => s.id === at.setor_id)?.nome || setores[0].nome
  const nome = at.paciente?.nome?.split(' ')[0] || ''

  if (jaExistia) return `${nome ? nome + ', sua' : 'Sua'} chegada já estava confirmada. Senha *${at.senha}*${pos > 0 ? ` — você é o ${pos}º da fila` : ''}.`
  return [
    `Chegada confirmada${nome ? `, ${nome}` : ''}! ✅`,
    `Sua senha é *${at.senha}*. Aguarde em: ${setor}.`,
    pos > 0 ? `Você é o ${pos}º da fila. Avisamos aqui quando estiver chegando a sua vez.` : 'Avisamos aqui quando for a sua vez.',
  ].join('\n')
}
