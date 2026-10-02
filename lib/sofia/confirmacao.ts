/**
 * Confirmação automática de consultas e combate à falta (no-show).
 *
 *   - lembrete 48h (informativo)          → agendamentos.lembrete_48h_enviado
 *   - confirmação 24h (com botões)        → agendamentos.confirmacao_24h_enviada / confirmacao_24h_status
 *   - lembrete 2h (informativo)           → agendamentos.lembrete_2h_enviado
 *   - resposta à oferta da lista de espera ("Quero esse horário" | "Não posso")
 *
 * Disparado pelo cron /api/cron/confirmacoes (a cada 15 min) e, para a 24h, também
 * pelo webhook do WhatsApp. Idempotente: cada agendamento é "reservado" com um UPDATE
 * condicional (flag = false → true) ANTES do envio, então nunca sai duas vezes.
 */
import { log } from '@/lib/logger'
import { supabaseServidor as supabase, agoraSP } from '@/lib/servidor'
import { enviarWhatsApp, normalizarTelefone } from '@/lib/whatsapp/enviar'
import {
  BOTOES_CONFIRMACAO_24H, mesclarConfig, dataHoraSP, primeiroNomeDe, preencher, ehErroDeSchema,
  type ConfirmacaoConfig,
} from '@/components/confirmacoes/modelos'

export type Contagem = { enviados: number; falhas: number; erro?: string }

const HORA = 60 * 60 * 1000

/** Mensagens a pacientes só entre 8h e 20h (horário de São Paulo). */
export function dentroDoHorarioComercial() {
  const { hora } = agoraSP()
  return hora >= 8 && hora < 20
}

/** Config do médico (sem linha / sem tabela = padrões ligados). */
export async function carregarConfigConfirmacao(medicoId: string): Promise<ConfirmacaoConfig> {
  try {
    const { data, error } = await supabase.from('confirmacao_config').select('*').eq('medico_id', medicoId).maybeSingle()
    if (error) return mesclarConfig(null)
    return mesclarConfig(data)
  } catch {
    return mesclarConfig(null)
  }
}

/** Nome do médico e da clínica para os placeholders {medico} e {clinica}. */
export async function nomesMedicoClinica(medicoId: string) {
  const { data: med } = await supabase.from('medicos').select('nome, clinica_id, telefone').eq('id', medicoId).maybeSingle()
  let clinica = ''
  if (med?.clinica_id) {
    const { data: cl } = await supabase.from('clinicas').select('nome').eq('id', med.clinica_id).maybeSingle()
    clinica = cl?.nome || ''
  }
  return { medico: med?.nome || '', clinica: clinica || med?.nome || '', telefoneMedico: (med as any)?.telefone || null }
}

type Janela = {
  medicoId: string
  flag: 'lembrete_48h_enviado' | 'confirmacao_24h_enviada' | 'lembrete_2h_enviado'
  deHoras: number
  ateHoras: number
  modelo: string
  botoes?: string[]
  marcaMetadata: string
  extraAoReservar?: Record<string, any>
  aoFalhar?: Record<string, any>
  nomes: { medico: string; clinica: string }
}

/** Envia o modelo para os agendamentos da janela [agora+de, agora+ate] ainda não avisados. */
async function processarJanela(j: Janela): Promise<Contagem> {
  const res: Contagem = { enviados: 0, falhas: 0 }
  const agora = Date.now()
  const { data: ags, error } = await supabase
    .from('agendamentos')
    .select('id, data_hora, status, meet_link, paciente_id, pacientes(nome, telefone)')
    .eq('medico_id', j.medicoId)
    .gte('data_hora', new Date(agora + j.deHoras * HORA).toISOString())
    .lte('data_hora', new Date(agora + j.ateHoras * HORA).toISOString())
    .in('status', ['agendado', 'confirmado'])
    .or(`${j.flag}.is.null,${j.flag}.eq.false`)
  if (error) {
    if (ehErroDeSchema(error)) return { ...res, erro: 'rode a migration 0010' }
    log.error('confirmacoes: busca', j.flag, error.message)
    return { ...res, erro: error.message }
  }

  for (const ag of ags || []) {
    const pac: any = Array.isArray((ag as any).pacientes) ? (ag as any).pacientes[0] : (ag as any).pacientes
    if (!pac?.telefone || !normalizarTelefone(pac.telefone)) continue

    // Reserva o agendamento (UPDATE condicional) — quem reservou é quem envia
    const { data: reservado, error: errRes } = await supabase
      .from('agendamentos')
      .update({ [j.flag]: true, ...(j.extraAoReservar || {}) })
      .eq('id', ag.id)
      .or(`${j.flag}.is.null,${j.flag}.eq.false`)
      .select('id')
    if (errRes || !reservado?.length) continue

    const { data, hora } = dataHoraSP(ag.data_hora)
    const texto = preencher(j.modelo, {
      nome: primeiroNomeDe(pac.nome), data, hora, medico: j.nomes.medico, clinica: j.nomes.clinica,
      online: ag.meet_link ? ' (online)' : '',
    })
    const r = await enviarWhatsApp({
      medicoId: j.medicoId, telefone: pac.telefone, texto, botoes: j.botoes,
      registrar: { nome: pac.nome, pacienteId: ag.paciente_id, metadata: { [j.marcaMetadata]: true, agendamento_id: ag.id } },
    })
    if (r.ok) {
      res.enviados++
      log.info('CONFIRMACOES', j.flag, 'enviado:', ag.id)
    } else {
      res.falhas++
      log.error('CONFIRMACOES', j.flag, 'falhou:', ag.id, r.erro)
      if (j.aoFalhar) await supabase.from('agendamentos').update(j.aoFalhar).eq('id', ag.id)
    }
  }
  return res
}

/** Lembrete informativo 48h antes (janela 44h–52h). */
export async function dispararLembretes48h(medicoId: string, cfg?: ConfirmacaoConfig, nomes?: { medico: string; clinica: string }): Promise<Contagem> {
  const c = cfg || await carregarConfigConfirmacao(medicoId)
  if (!c.lembrete_48h) return { enviados: 0, falhas: 0 }
  return processarJanela({
    medicoId, flag: 'lembrete_48h_enviado', deHoras: 44, ateHoras: 52, modelo: c.modelo_48h,
    marcaMetadata: 'lembrete_48h', nomes: nomes || await nomesMedicoClinica(medicoId),
  })
}

/**
 * Confirmação 24h (janela 20h–28h) com botões 'Sim confirmo' | 'Preciso remarcar' | 'Não poderei ir'.
 * Marca confirmacao_24h_enviada = true e confirmacao_24h_status = 'pendente'; a resposta é
 * tratada no webhook (detectarRespostaConfirmacao24h). Também chamada pelo webhook.
 */
export async function dispararConfirmacoes24h(medico_id: string, cfg?: ConfirmacaoConfig, nomes?: { medico: string; clinica: string }): Promise<Contagem> {
  try {
    if (!dentroDoHorarioComercial()) return { enviados: 0, falhas: 0 }
    const c = cfg || await carregarConfigConfirmacao(medico_id)
    if (!c.confirmacao_24h) return { enviados: 0, falhas: 0 }
    return await processarJanela({
      medicoId: medico_id, flag: 'confirmacao_24h_enviada', deHoras: 20, ateHoras: 28, modelo: c.modelo_24h,
      botoes: BOTOES_CONFIRMACAO_24H, marcaMetadata: 'confirmacao_24h',
      extraAoReservar: { confirmacao_24h_status: 'pendente' },
      aoFalhar: { confirmacao_24h_status: 'erro_envio' },
      nomes: nomes || await nomesMedicoClinica(medico_id),
    })
  } catch (e: any) {
    log.error('dispararConfirmacoes24h erro:', e)
    return { enviados: 0, falhas: 0, erro: e?.message }
  }
}

/** Lembrete 2h antes (janela 1h45–3h), só se não cancelado. */
export async function dispararLembretes2h(medicoId: string, cfg?: ConfirmacaoConfig, nomes?: { medico: string; clinica: string }): Promise<Contagem> {
  const c = cfg || await carregarConfigConfirmacao(medicoId)
  if (!c.lembrete_2h) return { enviados: 0, falhas: 0 }
  return processarJanela({
    medicoId, flag: 'lembrete_2h_enviado', deHoras: 1.75, ateHoras: 3, modelo: c.modelo_2h,
    marcaMetadata: 'lembrete_2h', nomes: nomes || await nomesMedicoClinica(medicoId),
  })
}

/** Preenche confirmado_em / confirmado_via (melhor esforço — não quebra sem a migration 0010). */
export async function marcarConfirmadoVia(agendamentoId: string, via: 'whatsapp' | 'manual' = 'whatsapp') {
  try {
    await supabase.from('agendamentos')
      .update({ confirmado_em: new Date().toISOString(), confirmado_via: via, status: 'confirmado' })
      .eq('id', agendamentoId)
  } catch (e) {
    log.error('marcarConfirmadoVia', e)
  }
}

/**
 * Cria notificação pro médico quando paciente recusa ou ignora confirmação.
 */
export async function notificarMedico(params: {
  medico_id: string
  tipo: 'confirmacao_recusada' | 'confirmacao_ignorada' | 'reagendamento_solicitado'
  agendamento_id: string
  paciente_id?: string
  titulo: string
  descricao?: string
}) {
  await supabase.from('notificacoes_medico').insert({
    medico_id: params.medico_id,
    tipo: params.tipo,
    agendamento_id: params.agendamento_id,
    paciente_id: params.paciente_id || null,
    titulo: params.titulo,
    descricao: params.descricao || null,
  })
}

/**
 * Detecta se a mensagem do paciente é uma resposta de confirmação 24h.
 * Retorna o agendamento em questão, ou null se não for.
 */
export async function detectarRespostaConfirmacao24h(telefone: string, medico_id: string) {
  const { data: ag } = await supabase
    .from('agendamentos')
    .select('*, pacientes(nome, telefone, id)')
    .eq('medico_id', medico_id)
    .eq('confirmacao_24h_enviada', true)
    .eq('confirmacao_24h_status', 'pendente')
    .order('data_hora', { ascending: true })
    .limit(5)

  if (!ag) return null

  // Filtra pelo telefone do paciente
  const telLimpo = telefone.replace(/[^0-9]/g, '')
  const encontrado = ag.find(a => a.pacientes?.telefone?.replace(/[^0-9]/g, '') === telLimpo)
  return encontrado || null
}

// ── Lista de espera: resposta à oferta de horário ─────────────────────────────

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Mesmo número? Tolera o 9º dígito ausente (WhatsApp às vezes manda sem). */
export function mesmoTelefone(a?: string | null, b?: string | null) {
  const na = normalizarTelefone(a), nb = normalizarTelefone(b)
  if (!na || !nb) return false
  if (na === nb) return true
  return na.slice(0, 4) === nb.slice(0, 4) && na.slice(-8) === nb.slice(-8)
}

/**
 * Trata "Quero esse horário" / "Não posso" quando há uma oferta pendente para o telefone.
 * Retorna true se a mensagem foi consumida (o webhook deve pular o resto do fluxo).
 */
export async function tratarRespostaListaEspera(telefone: string, medicoId: string, texto: string): Promise<boolean> {
  const t = semAcento(texto)
  const quer = t.includes('quero esse horario')
  const naoPode = t === 'nao posso' || t.startsWith('nao posso')
  if (!quer && !naoPode) return false

  const { data: ofertas, error } = await supabase
    .from('lista_espera').select('*')
    .eq('medico_id', medicoId).eq('status', 'oferecido')
    .order('oferecido_em', { ascending: false }).limit(20)
  if (error || !ofertas?.length) return false
  const item = ofertas.find(o => mesmoTelefone(o.telefone, telefone))
  if (!item) return false

  const responder = (msg: string) => enviarWhatsApp({
    medicoId, telefone, texto: msg,
    registrar: { nome: item.nome, pacienteId: item.paciente_id, metadata: { lista_espera: true, item_id: item.id } },
  })

  if (naoPode || !item.oferta_data_hora) {
    await supabase.from('lista_espera').update({ status: 'aguardando', oferta_data_hora: null }).eq('id', item.id)
    await responder('Sem problemas! Você continua na lista de espera e eu aviso quando abrir outro horário.')
    return true
  }

  const ini = new Date(item.oferta_data_hora)
  const dur = Number(item.oferta_duracao) || 30
  if (ini.getTime() < Date.now()) {
    await supabase.from('lista_espera').update({ status: 'aguardando', oferta_data_hora: null }).eq('id', item.id)
    await responder('Poxa, esse horário já passou. Você continua na lista e eu aviso no próximo que abrir.')
    return true
  }

  // Horário ainda livre? (nenhum agendamento ativo sobrepondo)
  const { data: doDia } = await supabase.from('agendamentos')
    .select('id, data_hora, duracao, status')
    .eq('medico_id', medicoId)
    .gte('data_hora', new Date(ini.getTime() - 4 * HORA).toISOString())
    .lte('data_hora', new Date(ini.getTime() + dur * 60000).toISOString())
  const fim = ini.getTime() + dur * 60000
  const ocupado = (doDia || []).some(a => {
    if (a.status === 'cancelado' || a.status === 'faltou') return false
    const ai = new Date(a.data_hora).getTime()
    const af = ai + (Number(a.duracao) || 30) * 60000
    return ai < fim && af > ini.getTime()
  })
  if (ocupado) {
    await supabase.from('lista_espera').update({ status: 'aguardando', oferta_data_hora: null }).eq('id', item.id)
    await responder('Poxa, esse horário acabou de ser preenchido. Você continua na lista e eu aviso no próximo que abrir.')
    return true
  }

  // Paciente cadastrado: usa o do item ou procura pelo telefone
  let pacienteId: string | null = item.paciente_id || null
  if (!pacienteId) {
    const { data: pacs } = await supabase.from('pacientes').select('id, telefone').eq('medico_id', medicoId).not('telefone', 'is', null).limit(1000)
    pacienteId = (pacs || []).find(p => mesmoTelefone(p.telefone, telefone))?.id || null
  }

  const base = {
    medico_id: medicoId, paciente_id: pacienteId, data_hora: ini.toISOString(), duracao: String(dur),
    tipo: item.tipo || 'consulta', status: 'confirmado',
    motivo: pacienteId ? 'Encaixe da lista de espera' : `Lista de espera — ${item.nome}`,
    observacoes: pacienteId ? null : (item.telefone ? `Contato: ${item.telefone}` : null),
  }
  let { data: novo, error: errIns } = await supabase.from('agendamentos')
    .insert({ ...base, confirmado_em: new Date().toISOString(), confirmado_via: 'whatsapp' }).select('id').single()
  if (errIns && ehErroDeSchema(errIns)) {
    ;({ data: novo, error: errIns } = await supabase.from('agendamentos').insert(base).select('id').single())
  }
  if (errIns || !novo) {
    log.error('lista_espera: falha ao agendar', errIns?.message)
    await responder('Recebi! A equipe vai confirmar seu horário em instantes.')
    return true
  }

  await supabase.from('lista_espera').update({ status: 'agendado', agendamento_id: novo.id }).eq('id', item.id)
  try {
    await supabase.from('notificacoes_medico').insert({
      medico_id: medicoId, tipo: 'lista_espera_agendado', agendamento_id: novo.id, paciente_id: pacienteId,
      titulo: `${item.nome} aceitou o horário da lista de espera`,
      descricao: `Consulta em ${ini.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
    })
  } catch { /* notificação é opcional */ }

  const { data, hora } = dataHoraSP(ini)
  await responder(`Perfeito, ${primeiroNomeDe(item.nome)}! Seu horário está confirmado: ${data}, às ${hora}. Até lá!`)
  return true
}
