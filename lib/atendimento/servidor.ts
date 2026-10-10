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
    .select('id, data_hora, medico_id, tipo, motivo, status, paciente:pacientes(id, nome, telefone, data_nascimento, cpf, convenio), medico:medicos(id, nome)')
    .in('medico_id', ids).gte('data_hora', de).lte('data_hora', ate)
    .not('status', 'in', '(cancelado,faltou,realizado)').order('data_hora') : { data: [] as any[] }

  return {
    dia,
    atendimentos: (await comMedico((atendimentos || []) as any[])) as any as Atendimento[],
    esperados: (ags || []).filter((a: any) => !comCheckin.has(a.id)),
    medicos: medicos.map((m: any) => ({ id: m.id, nome: m.nome, consultorio_id: m.consultorio_id })),
    saidas: p.medicoId ? [] : await saidasPendentes(ctx),
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

  const setorId = await setorDoMedico(ctx, medico.consultorio_id)
  const linha = {
    clinica_id: ctx.clinica, medico_id: medicoId, paciente_id: pacienteId, agendamento_id: p.agendamentoId || null,
    setor_id: setorId, consultorio_id: medico.consultorio_id || null,
    dia, senha, status: (await usaTriagem(setorId)) ? 'aguardando_triagem' : 'aguardando', prioridade, origem: p.origem || (p.agendamentoId ? 'recepcao' : 'encaixe'),
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
  ausente: { de: ['chamado', 'aguardando', 'em_triagem', 'aguardando_triagem'], para: 'ausente' },
  voltar_fila: { de: ['chamado', 'ausente', 'cancelado', 'em_triagem'], para: 'aguardando' },
  cancelar: { de: ['aguardando', 'chamado', 'ausente', 'aguardando_triagem', 'em_triagem'], para: 'cancelado' },
}

export async function mudarAtendimento(ctx: Contexto, id: string, acao: AcaoAtendimento, extra: {
  prioridade?: Prioridade
  retorno?: { dias: number; motivo?: string | null } | null
  saida?: { itens: string[]; obs?: string | null } | null
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
  // Quem ainda não passou pela triagem volta para a fila da triagem (se a sala usa)
  if (acao === 'voltar_fila' && !atual.risco && await usaTriagem(atual.setor_id)) campos.status = 'aguardando_triagem'
  if (acao === 'iniciar') campos.inicio_em = agora
  if (acao === 'finalizar') { campos.fim_em = agora; if (!atual.inicio_em) campos.inicio_em = atual.chamado_em || agora }

  const { data } = await db.from('atendimentos').update(campos).eq('id', id).in('status', t.de).select('id').maybeSingle()
  if (!data) throw new ErroAtendimento(`Não dá para ${acao.replace('_', ' ')}: o atendimento está "${atual.status}".`, 409)

  if (acao === 'finalizar') {
    if (atual.agendamento_id) await db.from('agendamentos').update({ status: 'realizado' }).eq('id', atual.agendamento_id)
    let retorno: { id: string; data_prevista: string } | null = null
    if (extra.retorno?.dias && atual.paciente_id) {
      const d = new Date(); d.setDate(d.getDate() + Math.round(extra.retorno.dias))
      const { data: r, error } = await db.from('retornos').insert({
        medico_id: atual.medico_id, paciente_id: atual.paciente_id, data_prevista: hojeSP(d),
        motivo: extra.retorno.motivo || null, origem: 'consulta', status: 'pendente',
      }).select('id, data_prevista').single()
      if (error) log.warn('[atendimento] retorno', error.message)
      else retorno = r
    }
    await registrarSaida(ctx, atual, retorno, extra.saida || null)
  }
  return carregarAtendimento(ctx, id)
}

// ── Saída do consultório → recepção ─────────────────────────────────────────

export const ITENS_SAIDA: Record<string, string> = {
  retorno: 'Agendar retorno', exames: 'Entregar pedido de exames', receita: 'Entregar receita',
  atestado: 'Entregar atestado/declaração', procedimento: 'Agendar procedimento', encaminhamento: 'Entregar encaminhamento',
}
const dataCurta = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

/**
 * Médico finalizou com retorno e/ou recados: a saída fica pendente para a recepção
 * e ela recebe o aviso (sino + canto da tela). Sem a migration 0019, só avisa.
 */
async function registrarSaida(ctx: Contexto, at: Atendimento, retorno: { id: string; data_prevista: string } | null, saida: { itens: string[]; obs?: string | null } | null) {
  const itens = Array.from(new Set([...(retorno ? ['retorno'] : []), ...(saida?.itens || []).filter(i => i in ITENS_SAIDA)]))
  const obs = saida?.obs?.trim().slice(0, 500) || null
  if (!itens.length && !obs) return

  const { error } = await db.from('atendimentos').update({
    saida_status: 'pendente', saida_itens: itens, saida_obs: obs, retorno_id: retorno?.id || null,
  }).eq('id', at.id)
  if (error) log.warn('[atendimento] saída (rode a migration 0019)', error.message)

  const nome = at.paciente?.nome?.split(' ').slice(0, 2).join(' ') || `Senha ${at.senha}`
  const partes = itens.map(i => i === 'retorno' && retorno ? `Retorno por volta de ${dataCurta(retorno.data_prevista)}` : ITENS_SAIDA[i])
  if (obs) partes.push(`“${obs}”`)
  const { error: eN } = await db.from('notificacoes_medico').insert({
    medico_id: at.medico_id, paciente_id: at.paciente_id, agendamento_id: at.agendamento_id, tipo: 'saida_recepcao',
    titulo: `${nome} saiu do consultório`, descricao: `${at.medico?.nome || 'Médico'}: ${partes.join(' · ')}`,
    link: `/recepcao?saida=${at.id}`, lida: false,
  })
  if (eN) log.warn('[atendimento] aviso de saída', eN.message)
}

/** Saídas pendentes (últimos 14 dias) com o retorno pedido, para a recepção resolver. */
export async function saidasPendentes(ctx: Contexto) {
  const desde = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10)
  const { data, error } = await db.from('atendimentos').select(SELECT_ATENDIMENTO)
    .eq('clinica_id', ctx.clinica).eq('saida_status', 'pendente').gte('dia', desde).order('fim_em', { ascending: false }).limit(50)
  if (error) return []   // sem a migration 0019
  const lista = await comMedico((data || []) as any[])
  const ids = lista.map((a: any) => a.retorno_id).filter(Boolean)
  const { data: rets } = ids.length ? await db.from('retornos').select('id, data_prevista, motivo, status, agendamento_id').in('id', ids) : { data: [] as any[] }
  const porId = new Map((rets || []).map((r: any) => [r.id, r]))

  // Retorno já marcado na agenda depois da saída? Liga ao agendamento (selo "Retorno agendado")
  const abertos = lista.filter((a: any) => a.paciente_id && porId.get(a.retorno_id)?.status === 'pendente')
  if (abertos.length) {
    const { data: futuros } = await db.from('agendamentos').select('id, paciente_id, medico_id, data_hora, criado_em, status')
      .in('paciente_id', abertos.map((a: any) => a.paciente_id)).gte('data_hora', new Date().toISOString()).not('status', 'in', '(cancelado,faltou)')
    for (const a of abertos as any[]) {
      const ag = (futuros || []).find((f: any) => f.paciente_id === a.paciente_id && f.medico_id === a.medico_id && (f.criado_em || '') >= (a.fim_em || ''))
      if (!ag) continue
      const r = porId.get(a.retorno_id)
      await db.from('retornos').update({ status: 'agendado', agendamento_id: ag.id }).eq('id', r.id).eq('status', 'pendente')
      porId.set(r.id, { ...r, status: 'agendado', agendamento_id: ag.id })
    }
  }
  return lista.map((a: any) => ({ ...a, retorno: a.retorno_id ? porId.get(a.retorno_id) || null : null }))
}

export async function resolverSaida(ctx: Contexto, id: string) {
  const { data, error } = await db.from('atendimentos').update({ saida_status: 'resolvida', saida_resolvida_em: new Date().toISOString(), saida_resolvida_por: ctx.usuario })
    .eq('id', id).eq('clinica_id', ctx.clinica).select('id').maybeSingle()
  if (error) throw error
  if (!data) throw new ErroAtendimento('Saída não encontrada.', 404)
  // O aviso dessa saída deixa de contar como não lido
  await db.from('notificacoes_medico').update({ lida: true }).eq('tipo', 'saida_recepcao').eq('link', `/recepcao?saida=${id}`)
}

/** WhatsApp para o paciente: a clínica vai marcar o retorno (a Sofia continua a conversa). */
export async function whatsappRetorno(ctx: Contexto, id: string) {
  const at: any = await carregarAtendimento(ctx, id)
  if (!at.paciente?.telefone) throw new ErroAtendimento('Paciente sem celular cadastrado.')
  let quando = ''
  if (at.retorno_id) {
    const { data: r } = await db.from('retornos').select('data_prevista').eq('id', at.retorno_id).maybeSingle()
    if (r?.data_prevista) quando = ` para por volta de ${dataCurta(r.data_prevista)}`
  }
  const nome = at.paciente.nome?.split(' ')[0] || ''
  const texto = `Olá${nome ? `, ${nome}` : ''}! ${at.medico?.nome ? `${at.medico.nome} pediu` : 'O médico pediu'} seu retorno${quando}. Qual dia e período ficam melhores para você? Responda aqui que já vemos um horário. 🙂`
  const r = await enviarWhatsApp({ medicoId: at.medico_id, telefone: at.paciente.telefone, texto, registrar: { nome: at.paciente.nome, pacienteId: at.paciente.id, metadata: { atendimento: at.id, tipo: 'retorno_saida' } } })
  if (!r.ok) throw new ErroAtendimento(r.erro || 'Não foi possível enviar pelo WhatsApp.')
}

// ── Painel da TV (público, pelo link secreto) ────────────────────────────────

export async function dadosDoPainel(token: string) {
  if (!/^[a-f0-9]{24,64}$/i.test(token)) return null
  const { data: setor } = await db.from('setores').select('id, clinica_id, nome, painel_voz, painel_mensagem, ativo').eq('painel_token', token).maybeSingle()
  if (!setor || !setor.ativo) return null
  const { de } = limitesDoDiaSP(hojeSP())
  const [{ data: chamadas }, { data: clinica }] = await Promise.all([
    db.from('chamadas_painel').select('id, atendimento_id, senha, nome_exibicao, local, criado_em')
      .eq('setor_id', setor.id).gte('criado_em', de).order('criado_em', { ascending: false }).limit(30),
    db.from('clinicas').select('nome, logo_url').eq('id', setor.clinica_id).maybeSingle(),
  ])
  const avisos = await avisosAtivos(setor.clinica_id, setor.id)
  return {
    avisos: avisos.map(a => a.texto),
    setor: { nome: setor.nome, voz: setor.painel_voz, mensagem: setor.painel_mensagem },
    clinica: { nome: clinica?.nome || null, logo_url: clinica?.logo_url || null },
    // "Chamar de novo" gera chamada nova (a TV toca de novo), mas a lista mostra cada paciente uma vez
    chamadas: (chamadas || []).filter((c: any, i, l) => !c.atendimento_id || l.findIndex((x: any) => x.atendimento_id === c.atendimento_id) === i)
      .slice(0, 8).map(({ atendimento_id, ...c }: any) => c),
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

// ── Recepção: cadastro rápido, falta, ficha do paciente ─────────────────────

const soDigitos = (s?: string | null) => String(s || '').replace(/\D/g, '')

/** O paciente pertence a esta clínica (ou a um médico dela)? */
async function pacienteDaClinica(ctx: Contexto, pacienteId: string) {
  const { data: p } = await db.from('pacientes').select('*').eq('id', pacienteId).maybeSingle()
  if (!p) throw new ErroAtendimento('Paciente não encontrado.', 404)
  const ids = (await medicosDaClinica(ctx)).map((m: any) => m.id)
  if (p.clinica_id !== ctx.clinica && !ids.includes(p.medico_id)) throw new ErroAtendimento('Paciente de outra clínica.', 403)
  return p
}

/**
 * Cadastro rápido na recepção (quem chega sem cadastro). Se já existe paciente da
 * clínica com o mesmo CPF ou telefone, devolve esse — sem duplicar.
 */
export async function novoPaciente(ctx: Contexto, d: {
  nome: string; telefone?: string | null; cpf?: string | null; data_nascimento?: string | null; convenio?: string | null; medicoId?: string | null
}) {
  const nome = String(d.nome || '').trim().replace(/\s+/g, ' ').slice(0, 160)
  if (nome.split(' ').length < 2) throw new ErroAtendimento('Digite nome e sobrenome.')
  const cpf = soDigitos(d.cpf)
  if (cpf && cpf.length !== 11) throw new ErroAtendimento('CPF precisa ter 11 dígitos.')
  const tel = soDigitos(d.telefone)
  if (tel && (tel.length < 10 || tel.length > 13)) throw new ErroAtendimento('Telefone incompleto (com DDD).')
  if (d.data_nascimento && !/^\d{4}-\d{2}-\d{2}$/.test(d.data_nascimento)) throw new ErroAtendimento('Data de nascimento inválida.')

  const medicos = await medicosDaClinica(ctx)
  const ids = medicos.map((m: any) => m.id)
  const medicoId = d.medicoId && ids.includes(d.medicoId) ? d.medicoId : (ctx.medicoId && ids.includes(ctx.medicoId) ? ctx.medicoId : ids[0])
  if (!medicoId) throw new ErroAtendimento('Cadastre um médico na clínica primeiro.')

  // Já existe? (mesmo CPF ou mesmo telefone, na clínica)
  if (cpf || tel) {
    const filtros = [cpf && `cpf.eq.${cpf}`, cpf && `cpf.eq.${cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}`, tel && `telefone.ilike.%${tel.slice(-8)}%`].filter(Boolean).join(',')
    const { data: iguais } = await db.from('pacientes').select('id, nome, telefone, cpf, data_nascimento, convenio, clinica_id, medico_id')
      .or(filtros).in('medico_id', ids).limit(5)
    const mesmo = (iguais || []).find((p: any) => (cpf && soDigitos(p.cpf) === cpf) || (tel && soDigitos(p.telefone).endsWith(tel.slice(-8)) && p.nome?.split(' ')[0]?.toLowerCase() === nome.split(' ')[0].toLowerCase()))
    if (mesmo) return { paciente: mesmo, jaExistia: true }
  }

  const linha: Record<string, any> = {
    nome, medico_id: medicoId, clinica_id: ctx.clinica === ctx.medicoId ? null : ctx.clinica,
    telefone: tel || null, cpf: cpf || null, data_nascimento: d.data_nascimento || null,
    convenio: d.convenio ? String(d.convenio).slice(0, 80) : null,
  }
  const { data, error } = await db.from('pacientes').insert(linha).select('id, nome, telefone, cpf, data_nascimento, convenio').single()
  if (error) throw error
  return { paciente: data, jaExistia: false }
}

/** Atualiza na chegada os dados que a recepção confere (telefone, convênio...). */
export async function atualizarPaciente(ctx: Contexto, pacienteId: string, d: Record<string, any>) {
  await pacienteDaClinica(ctx, pacienteId)
  const c: Record<string, any> = {}
  if (d.telefone !== undefined) { const t = soDigitos(d.telefone); if (t && (t.length < 10 || t.length > 13)) throw new ErroAtendimento('Telefone incompleto (com DDD).'); c.telefone = t || null }
  if (d.cpf !== undefined) { const x = soDigitos(d.cpf); if (x && x.length !== 11) throw new ErroAtendimento('CPF precisa ter 11 dígitos.'); c.cpf = x || null }
  if (d.data_nascimento !== undefined) c.data_nascimento = /^\d{4}-\d{2}-\d{2}$/.test(d.data_nascimento || '') ? d.data_nascimento : null
  if (d.convenio !== undefined) c.convenio = d.convenio ? String(d.convenio).slice(0, 80) : null
  if (d.nr_carteirinha !== undefined) c.nr_carteirinha = d.nr_carteirinha ? String(d.nr_carteirinha).slice(0, 40) : null
  if (!Object.keys(c).length) return
  const { error } = await db.from('pacientes').update(c).eq('id', pacienteId)
  if (error) throw error
}

/** Paciente agendado não veio: marca falta no agendamento. */
export async function marcarFalta(ctx: Contexto, agendamentoId: string) {
  const ids = (await medicosDaClinica(ctx)).map((m: any) => m.id)
  const { data, error } = await db.from('agendamentos').update({ status: 'faltou' })
    .eq('id', agendamentoId).in('medico_id', ids).not('status', 'in', '(cancelado,realizado)').select('id').maybeSingle()
  if (error) throw error
  if (!data) throw new ErroAtendimento('Agendamento não encontrado ou já encerrado.', 404)
}

/** Ficha para o consultório: dados clínicos, últimas consultas e a pré-consulta do WhatsApp. */
export async function fichaDoPaciente(ctx: Contexto, pacienteId: string, agendamentoId?: string | null) {
  const p = await pacienteDaClinica(ctx, pacienteId)
  const [{ data: consultas }, ag] = await Promise.all([
    db.from('consultas').select('id, criado_em, data_hora, avaliacao, diagnostico_principal, plano, cids')
      .eq('paciente_id', pacienteId).order('criado_em', { ascending: false }).limit(5),
    agendamentoId ? db.from('agendamentos').select('motivo, tipo, pre_consulta_contexto').eq('id', agendamentoId).maybeSingle() : Promise.resolve({ data: null }),
  ])
  return {
    paciente: {
      id: p.id, nome: p.nome, telefone: p.telefone, data_nascimento: p.data_nascimento, sexo: p.sexo || p.genero || null,
      convenio: p.convenio, alergias: p.alergias, comorbidades: p.comorbidades, medicamentos_uso: p.medicamentos_uso,
    },
    consultas: consultas || [],
    agendamento: (ag as any)?.data || null,
  }
}

/** Médico escolheu em qual consultório está hoje (recepção e TV passam a usar esse). */
export async function definirConsultorio(ctx: Contexto, medicoId: string, consultorioId: string) {
  await garantirMedico(ctx, medicoId)
  const { data } = await db.from('consultorios').select('id').eq('id', consultorioId).eq('clinica_id', ctx.clinica).eq('ativo', true).maybeSingle()
  if (!data) throw new ErroAtendimento('Consultório não encontrado.', 404)
  const { error } = await db.from('medicos').update({ consultorio_id: consultorioId }).eq('id', medicoId)
  if (error) throw error
}

// ── Ficha 360 do paciente (histórico completo, também usada para exportar) ────

export async function fichaCompleta(ctx: Contexto, pacienteId: string) {
  const p = await pacienteDaClinica(ctx, pacienteId)
  const [consultas, agendamentos, retornos, atendimentos, medicos] = await Promise.all([
    db.from('consultas').select('id, criado_em, data_hora, medico_id, subjetivo, avaliacao, plano, diagnostico_principal, cids')
      .eq('paciente_id', pacienteId).order('criado_em', { ascending: false }).limit(100),
    db.from('agendamentos').select('id, data_hora, status, tipo, motivo, medico_id, criado_em')
      .eq('paciente_id', pacienteId).order('data_hora', { ascending: false }).limit(200),
    db.from('retornos').select('id, data_prevista, status, motivo, medico_id, criado_em, agendamento_id')
      .eq('paciente_id', pacienteId).order('data_prevista', { ascending: false }).limit(50),
    db.from('atendimentos').select('id, dia, senha, status, prioridade, origem, chegada_em, chamado_em, inicio_em, fim_em, medico_id')
      .eq('paciente_id', pacienteId).order('chegada_em', { ascending: false }).limit(100),
    db.from('medicos').select('id, nome').in('id', (await medicosDaClinica(ctx)).map((m: any) => m.id)),
  ])
  const nomes = new Map((medicos.data || []).map((m: any) => [m.id, m.nome]))
  const comNome = <T extends { medico_id: string | null }>(l: T[] | null) => (l || []).map(x => ({ ...x, medico: nomes.get(x.medico_id as string) || null }))

  const ags = comNome(agendamentos.data as any[])
  const agora = Date.now()
  const passados = ags.filter((a: any) => new Date(a.data_hora).getTime() < agora && a.status !== 'cancelado')
  const faltas = passados.filter((a: any) => a.status === 'faltou').length
  const { senha_hash, ...paciente } = p as any
  return {
    paciente,
    consultas: comNome(consultas.data as any[]),
    agendamentos: ags,
    retornos: comNome(retornos.data as any[]),
    atendimentos: atendimentos.error ? [] : comNome(atendimentos.data as any[]),
    resumo: {
      consultas: (consultas.data || []).length,
      faltas,
      comparecimento: passados.length ? Math.round(((passados.length - faltas) / passados.length) * 100) : null,
      ultima_consulta: consultas.data?.[0]?.data_hora || consultas.data?.[0]?.criado_em || null,
      proximo: ags.filter((a: any) => new Date(a.data_hora).getTime() >= agora && !['cancelado', 'faltou'].includes(a.status)).at(-1) || null,
    },
  }
}

// ── Triagem ──────────────────────────────────────────────────────────────────

async function usaTriagem(setorId: string | null): Promise<boolean> {
  if (!setorId) return false
  const { data, error } = await db.from('setores').select('usa_triagem').eq('id', setorId).maybeSingle()
  return !error && !!(data as any)?.usa_triagem
}

/**
 * Enfermagem chama o próximo para a triagem (ou um paciente específico / de novo).
 * Ordem: prioridade da lei e chegada. A troca de status é condicional — duas salas de
 * triagem chamando juntas nunca pegam o mesmo paciente.
 */
export async function chamarTriagem(ctx: Contexto, p: { consultorioId: string | null; atendimentoId?: string | null; rechamar?: boolean }) {
  let sala: { id: string; nome: string; setor_id: string } | null = null
  if (p.consultorioId) {
    const { data } = await db.from('consultorios').select('id, nome, setor_id').eq('id', p.consultorioId).eq('clinica_id', ctx.clinica).maybeSingle()
    if (!data) throw new ErroAtendimento('Sala não encontrada.', 404)
    sala = data
  }
  const agora = new Date().toISOString()
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    let alvo: any
    if (p.atendimentoId) {
      alvo = await carregarAtendimento(ctx, p.atendimentoId)
    } else {
      const { data: fila } = await db.from('atendimentos').select('id, prioridade, horario_previsto, chegada_em, chamadas, status')
        .eq('clinica_id', ctx.clinica).eq('dia', hojeSP()).eq('status', 'aguardando_triagem')
      alvo = ordenarFila((fila || []) as any).find(() => true)
      if (!alvo) return null
    }
    const permitidos = p.rechamar ? ['em_triagem', 'aguardando_triagem', 'ausente'] : ['aguardando_triagem', 'ausente']
    const { data } = await db.from('atendimentos')
      .update({ status: 'em_triagem', chamado_em: agora, chamadas: (alvo.chamadas || 0) + 1, atualizado_em: agora })
      .eq('id', alvo.id).in('status', permitidos).select('id').maybeSingle()
    if (data) {
      const at = await carregarAtendimento(ctx, alvo.id)
      await registrarChamada(ctx, at, sala)
      return at
    }
    if (p.atendimentoId) throw new ErroAtendimento('Este paciente já foi chamado.', 409)
    // outro computador pegou este paciente no mesmo instante: tenta o próximo
  }
  throw new ErroAtendimento('Fila muito disputada agora. Tente de novo.', 409)
}

const faixa = (v: any, min: number, max: number, nome: string) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(String(v).replace(',', '.'))
  if (!Number.isFinite(n) || n < min || n > max) throw new ErroAtendimento(`${nome} fora do esperado (${min} a ${max}).`)
  return n
}

/** Salva a triagem e manda o paciente para a fila do médico, já com a cor. */
export async function registrarTriagem(ctx: Contexto, id: string, d: Record<string, any>) {
  const at = await carregarAtendimento(ctx, id)
  if (!['em_triagem', 'aguardando_triagem'].includes(at.status)) throw new ErroAtendimento('Este paciente não está na triagem.', 409)
  const risco = String(d.risco || '')
  if (!['vermelho', 'laranja', 'amarelo', 'verde', 'azul'].includes(risco)) throw new ErroAtendimento('Escolha a classificação de risco.')
  const linha = {
    clinica_id: ctx.clinica, atendimento_id: at.id, paciente_id: at.paciente_id, profissional_id: ctx.medicoId,
    pa_sistolica: faixa(d.pa_sistolica, 40, 300, 'Pressão sistólica'), pa_diastolica: faixa(d.pa_diastolica, 20, 200, 'Pressão diastólica'),
    fc: faixa(d.fc, 20, 250, 'Frequência cardíaca'), fr: faixa(d.fr, 4, 80, 'Frequência respiratória'),
    temperatura: faixa(d.temperatura, 30, 45, 'Temperatura'), spo2: faixa(d.spo2, 40, 100, 'Saturação'),
    glicemia: faixa(d.glicemia, 10, 1000, 'Glicemia'), peso: faixa(d.peso, 0.3, 400, 'Peso'), altura: faixa(d.altura, 20, 250, 'Altura'),
    dor: faixa(d.dor, 0, 10, 'Dor'),
    queixa: d.queixa ? String(d.queixa).slice(0, 1000) : null, observacoes: d.observacoes ? String(d.observacoes).slice(0, 1000) : null, risco,
  }
  const { error } = await db.from('triagens').insert(linha)
  if (error) throw error
  const { data } = await db.from('atendimentos').update({ status: 'aguardando', risco, atualizado_em: new Date().toISOString() })
    .eq('id', at.id).in('status', ['em_triagem', 'aguardando_triagem']).select('id').maybeSingle()
  if (!data) throw new ErroAtendimento('O atendimento mudou enquanto a triagem era salva. Atualize a tela.', 409)
  // Emergência: avisa na hora (médico e recepção)
  if (risco === 'vermelho' || risco === 'laranja') {
    await db.from('notificacoes_medico').insert({
      medico_id: at.medico_id, paciente_id: at.paciente_id, tipo: 'triagem_urgente', lida: false,
      titulo: `${risco === 'vermelho' ? 'EMERGÊNCIA' : 'Muito urgente'}: ${at.paciente?.nome?.split(' ').slice(0, 2).join(' ') || at.senha}`,
      descricao: `Triagem ${risco}${linha.queixa ? ` · ${linha.queixa.slice(0, 120)}` : ''}`, link: '/consultorio',
    })
  }
  return carregarAtendimento(ctx, at.id)
}

/** Última triagem de um atendimento (para o médico ver na ficha). */
export async function triagemDoAtendimento(ctx: Contexto, atendimentoId: string) {
  const { data, error } = await db.from('triagens').select('*').eq('atendimento_id', atendimentoId).eq('clinica_id', ctx.clinica)
    .order('criado_em', { ascending: false }).limit(1).maybeSingle()
  return error ? null : data
}

// ── Recados na TV e atraso do médico ─────────────────────────────────────────

export type AvisoPainel = { id: string; tipo: string; texto: string; expira_em: string; medico_id: string | null; setor_id: string | null }

/** Recados ativos da clínica (ou de uma sala). Sem a migration 0022, nenhum. */
export async function avisosAtivos(clinica: string, setorId?: string | null): Promise<AvisoPainel[]> {
  let q = db.from('avisos_painel').select('id, tipo, texto, expira_em, medico_id, setor_id').eq('clinica_id', clinica).gt('expira_em', new Date().toISOString())
  if (setorId) q = q.or(`setor_id.is.null,setor_id.eq.${setorId}`)
  const { data, error } = await q.order('criado_em', { ascending: false }).limit(10)
  return error ? [] : ((data || []) as AvisoPainel[])
}

/** Recepção publica um recado na TV (ex.: "Sistema de cartão fora do ar — aceitamos Pix"). */
export async function publicarRecado(ctx: Contexto, p: { texto: string; horas: number; setorId?: string | null }) {
  const texto = String(p.texto || '').trim().slice(0, 160)
  if (texto.length < 3) throw new ErroAtendimento('Escreva o recado.')
  const horas = Math.min(12, Math.max(0.25, Number(p.horas) || 1))
  const { error } = await db.from('avisos_painel').insert({
    clinica_id: ctx.clinica, setor_id: p.setorId || null, tipo: 'recado', texto,
    expira_em: new Date(Date.now() + horas * 3600e3).toISOString(), criado_por: ctx.usuario,
  })
  if (error) throw error
}

export async function retirarAviso(ctx: Contexto, id: string) {
  const { error } = await db.from('avisos_painel').update({ expira_em: new Date().toISOString() }).eq('id', id).eq('clinica_id', ctx.clinica)
  if (error) throw error
}

/**
 * Médico avisa que está atrasado: recado na TV, aviso para a recepção e, se pedir,
 * WhatsApp para quem ainda não chegou (com o novo horário provável e opção de remarcar).
 */
export async function avisarAtraso(ctx: Contexto, p: { medicoId: string; minutos: number; whatsapp: boolean }) {
  const medico = await garantirMedico(ctx, p.medicoId)
  const minutos = Math.min(240, Math.max(5, Math.round(Number(p.minutos) || 0)))
  const agora = new Date()
  // Um atraso por médico: o novo substitui o anterior
  await db.from('avisos_painel').update({ expira_em: agora.toISOString() }).eq('clinica_id', ctx.clinica).eq('medico_id', medico.id).eq('tipo', 'atraso').gt('expira_em', agora.toISOString())
  const { error } = await db.from('avisos_painel').insert({
    clinica_id: ctx.clinica, medico_id: medico.id, tipo: 'atraso', criado_por: ctx.usuario,
    texto: `${medico.nome} está com atraso de cerca de ${minutos} min. Agradecemos a compreensão.`,
    expira_em: new Date(agora.getTime() + Math.max(60, minutos * 2) * 60e3).toISOString(),
  })
  if (error) throw error

  await db.from('notificacoes_medico').insert({
    medico_id: medico.id, tipo: 'atraso_medico', lida: false, link: '/recepcao',
    titulo: `${medico.nome} vai atrasar ~${minutos} min`, descricao: 'O recado já está na TV da sala de espera. Avise quem perguntar e ofereça remarcar se preferirem.',
  })

  let enviados = 0
  if (p.whatsapp) {
    const { de, ate } = limitesDoDiaSP(hojeSP())
    const { data: ags } = await db.from('agendamentos').select('id, data_hora, paciente:pacientes(id, nome, telefone)')
      .eq('medico_id', medico.id).gte('data_hora', new Date(agora.getTime() - 30 * 60e3).toISOString()).lte('data_hora', ate)
      .gte('data_hora', de).not('status', 'in', '(cancelado,faltou,realizado)')
    const ids = (ags || []).map((a: any) => a.id)
    const { data: chegaram } = ids.length ? await db.from('atendimentos').select('agendamento_id').in('agendamento_id', ids) : { data: [] as any[] }
    const jaAqui = new Set((chegaram || []).map((c: any) => c.agendamento_id))
    for (const a of (ags || []) as any[]) {
      if (jaAqui.has(a.id) || !a.paciente?.telefone) continue
      const previsto = new Date(new Date(a.data_hora).getTime() + minutos * 60e3).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
      const hora = new Date(a.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
      const r = await enviarWhatsApp({
        medicoId: medico.id, telefone: a.paciente.telefone,
        texto: `Olá, ${a.paciente.nome?.split(' ')[0] || ''}! ${medico.nome} está com atraso de cerca de ${minutos} min hoje. Sua consulta das ${hora} deve começar por volta das ${previsto}. Se preferir remarcar, é só responder aqui. Desculpe o transtorno.`,
        registrar: { nome: a.paciente.nome, pacienteId: a.paciente.id, metadata: { tipo: 'atraso_medico', agendamento: a.id } },
      })
      if (r.ok) enviados++
    }
  }
  return { minutos, enviados }
}

/** Médico encerrou o atraso (tira o recado da TV). */
export async function encerrarAtraso(ctx: Contexto, medicoId: string) {
  await garantirMedico(ctx, medicoId)
  await db.from('avisos_painel').update({ expira_em: new Date().toISOString() }).eq('clinica_id', ctx.clinica).eq('medico_id', medicoId).eq('tipo', 'atraso').gt('expira_em', new Date().toISOString())
}
