/**
 * Salas e equipamentos (migration 0031). A agenda pergunta `planejar` antes de salvar (mostra
 * "Sala 2 · Laser" ou o conflito com horários livres) e chama `reservar` depois de criar o
 * agendamento. O banco garante que não há duas reservas sobrepostas no mesmo recurso.
 * Sem salas cadastradas nada muda: clínica pequena não sente diferença.
 * chave = clínica da sessão (clinicas.id ou o id do médico autônomo), a mesma da Central.
 */
import { supabaseServidor as db } from '@/lib/servidor'
import { ErroAtendimento } from '@/lib/atendimento/servidor'
import { log } from '@/lib/logger'

const MIN = 60000
type Recurso = { id: string; nome: string }
export type Plano = {
  sem_salas?: boolean
  sala: Recurso | null
  equipamentos: Recurso[]
  conflito?: string
  livres?: string[]           // próximos inícios livres (ISO), clicáveis na agenda
}

const intervalo = (ini: Date, min: number) => `[${ini.toISOString()},${new Date(ini.getTime() + min * MIN).toISOString()})`
const hora = (iso: string | Date) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })

export async function dadosSalas(chave: string) {
  const [{ data: salas }, { data: setores }, { data: equip }, { data: padroes }] = await Promise.all([
    db.from('consultorios').select('id, nome, setor_id, tipo, descricao_local, ativo, ordem').eq('clinica_id', chave).order('ordem').order('criado_em'),
    db.from('setores').select('id, nome').eq('clinica_id', chave),
    db.from('equipamentos').select('id, nome, tipo, consultorio_id, ativo').eq('clinica_id', chave).order('nome'),
    db.from('medico_sala_padrao').select('medico_id, consultorio_id').eq('clinica_id', chave),
  ])
  const agora = new Date().toISOString()
  const { data: manut } = await db.from('reservas_recurso').select('id, equipamento_id, consultorio_id, periodo, observacao')
    .eq('clinica_id', chave).eq('motivo', 'manutencao').gte('criado_em', new Date(Date.now() - 90 * 864e5).toISOString())
  return {
    salas: salas || [], setores: setores || [], equipamentos: equip || [], padroes: padroes || [],
    manutencoes: (manut || []).filter((m: any) => String(m.periodo).split(',')[1]?.replace(/[)\]"]/g, '') > agora),
  }
}

async function pertence(tabela: 'consultorios' | 'equipamentos', id: string, chave: string) {
  const { data } = await db.from(tabela).select('id').eq('id', id).eq('clinica_id', chave).maybeSingle()
  if (!data) throw new ErroAtendimento('Não encontrado.', 404)
}

export async function salvarSala(chave: string, p: { id: string; tipo?: string; descricao_local?: string | null }) {
  await pertence('consultorios', p.id, chave)
  await db.from('consultorios').update({ tipo: String(p.tipo || 'consultorio').slice(0, 40), descricao_local: p.descricao_local ? String(p.descricao_local).slice(0, 120) : null }).eq('id', p.id)
  return { ok: true }
}

export async function salvarEquipamento(chave: string, p: { id?: string; nome: string; tipo: string; consultorio_id?: string | null; ativo?: boolean }) {
  const nome = String(p.nome || '').trim().slice(0, 80), tipo = String(p.tipo || '').trim().toLowerCase().slice(0, 40)
  if (!nome || !tipo) throw new ErroAtendimento('Informe o nome e o tipo do equipamento.', 422)
  if (p.consultorio_id) await pertence('consultorios', p.consultorio_id, chave)
  const campos = { nome, tipo, consultorio_id: p.consultorio_id || null, ativo: p.ativo !== false }
  if (p.id) { await pertence('equipamentos', p.id, chave); await db.from('equipamentos').update(campos).eq('id', p.id); return { id: p.id } }
  const { data, error } = await db.from('equipamentos').insert({ ...campos, clinica_id: chave }).select('id').single()
  if (error) throw error
  return { id: (data as any).id }
}

export async function excluirEquipamento(chave: string, id: string) {
  await pertence('equipamentos', id, chave)
  await db.from('equipamentos').delete().eq('id', id)
  return { ok: true }
}

export async function definirSalaPadrao(chave: string, medicoId: string, consultorioId: string | null) {
  const { data: m } = await db.from('medicos').select('id').eq('id', medicoId).or(`clinica_id.eq.${chave},id.eq.${chave}`).maybeSingle()
  if (!m) throw new ErroAtendimento('Profissional não encontrado.', 404)
  if (!consultorioId) { await db.from('medico_sala_padrao').delete().eq('clinica_id', chave).eq('medico_id', medicoId); return { ok: true } }
  await pertence('consultorios', consultorioId, chave)
  await db.from('medico_sala_padrao').upsert({ clinica_id: chave, medico_id: medicoId, consultorio_id: consultorioId })
  return { ok: true }
}

/** Reservas que se sobrepõem a [ini, fim) nos recursos informados (exceto as do próprio agendamento). */
async function ocupados(chave: string, ini: Date, fim: Date, ignorarAgendamento?: string | null) {
  let q = db.from('reservas_recurso').select('consultorio_id, equipamento_id, agendamento_id, periodo, motivo')
    .eq('clinica_id', chave).overlaps('periodo', intervalo(ini, (fim.getTime() - ini.getTime()) / MIN))
  if (ignorarAgendamento) q = q.or(`agendamento_id.is.null,agendamento_id.neq.${ignorarAgendamento}`)
  const { data } = await q
  return (data || []) as any[]
}

/** Escolhe sala e equipamentos livres para o horário. Sem exigência e sem sala padrão: não reserva nada. */
export async function planejar(chave: string, p: { medicoId?: string | null; procedimentoId?: string | null; inicio: string; duracao: number; ignorarAgendamento?: string | null }): Promise<Plano> {
  const ini = new Date(p.inicio)
  const dur = Math.max(5, Math.min(600, Number(p.duracao) || 30))
  if (isNaN(ini.getTime())) throw new ErroAtendimento('Horário inválido.', 422)
  const [{ data: salas }, { data: equip }, proc, padrao] = await Promise.all([
    db.from('consultorios').select('id, nome, tipo').eq('clinica_id', chave).eq('ativo', true).order('ordem'),
    db.from('equipamentos').select('id, nome, tipo, consultorio_id').eq('clinica_id', chave).eq('ativo', true),
    p.procedimentoId ? db.from('procedimentos').select('tipo_sala, equipamentos_tipos').eq('id', p.procedimentoId).maybeSingle() : Promise.resolve({ data: null }),
    p.medicoId ? db.from('medico_sala_padrao').select('consultorio_id').eq('clinica_id', chave).eq('medico_id', p.medicoId).maybeSingle() : Promise.resolve({ data: null }),
  ])
  if (!salas?.length) return { sem_salas: true, sala: null, equipamentos: [] }
  const tipoSala: string | null = (proc as any)?.data?.tipo_sala || null
  const tiposEquip: string[] = (proc as any)?.data?.equipamentos_tipos || []
  const salaPadrao: string | null = (padrao as any)?.data?.consultorio_id || null
  if (!tipoSala && !tiposEquip.length && !salaPadrao) return { sala: null, equipamentos: [] }

  const tentar = async (inicio: Date): Promise<Plano & { motivoConflito?: { recurso: string; ag?: string | null; fim?: string; plural?: boolean; semRecurso?: boolean } }> => {
    const fim = new Date(inicio.getTime() + dur * MIN)
    const ocup = await ocupados(chave, inicio, fim, p.ignorarAgendamento)
    const salaOcupada = new Set(ocup.filter(o => o.consultorio_id).map(o => o.consultorio_id))
    const equipOcupado = new Set(ocup.filter(o => o.equipamento_id).map(o => o.equipamento_id))
    const candidatas = (salas as any[]).filter(s => tipoSala ? s.tipo === tipoSala : (salaPadrao ? s.id === salaPadrao : true))
      .sort((a, b) => (a.id === salaPadrao ? -1 : b.id === salaPadrao ? 1 : 0))
    const sala = candidatas.find(s => !salaOcupada.has(s.id)) || null
    if ((tipoSala || salaPadrao) && !sala) {
      const o = ocup.find(x => candidatas.some(s => s.id === x.consultorio_id))
      if (!candidatas.length) return { sala: null, equipamentos: [], motivoConflito: { recurso: `Não há sala do tipo "${tipoSala}" cadastrada`, semRecurso: true } }
      return { sala: null, equipamentos: [], motivoConflito: { recurso: candidatas.length === 1 ? `A sala ${candidatas[0].nome}` : `Todas as salas do tipo "${tipoSala}"`, plural: candidatas.length > 1, ag: o?.agendamento_id, fim: String(o?.periodo || '').split(',')[1] } }
    }
    const escolhidos: Recurso[] = []
    for (const t of tiposEquip) {
      // Prefere o equipamento fixo na sala escolhida, depois os móveis
      const opcoes = (equip as any[]).filter(e => e.tipo === t && !escolhidos.some(x => x.id === e.id))
        .filter(e => !e.consultorio_id || e.consultorio_id === sala?.id)
        .sort((a, b) => (a.consultorio_id === sala?.id ? -1 : 0) - (b.consultorio_id === sala?.id ? -1 : 0))
      const livre = opcoes.find(e => !equipOcupado.has(e.id))
      if (!livre) {
        const o = ocup.find(x => opcoes.some(e => e.id === x.equipamento_id))
        if (!opcoes.length) return { sala: null, equipamentos: [], motivoConflito: { recurso: `Não há equipamento do tipo "${t}" cadastrado${sala ? ' para esta sala' : ''}`, semRecurso: true } }
        return { sala: null, equipamentos: [], motivoConflito: { recurso: opcoes.length === 1 ? `O equipamento ${opcoes[0].nome}` : `Todos os equipamentos do tipo "${t}"`, plural: opcoes.length > 1, ag: o?.agendamento_id, fim: String(o?.periodo || '').split(',')[1] } }
      }
      escolhidos.push({ id: livre.id, nome: livre.nome })
    }
    return { sala: sala ? { id: sala.id, nome: sala.nome } : null, equipamentos: escolhidos }
  }

  const r = await tentar(ini)
  if (!r.motivoConflito) return { sala: r.sala, equipamentos: r.equipamentos }
  if (r.motivoConflito.semRecurso) return { sala: null, equipamentos: [], conflito: `${r.motivoConflito.recurso}. Cadastre em Minha clínica → Salas e equipamentos.`, livres: [] }

  // Conflito: quem está usando e os próximos 3 horários livres no mesmo dia (de 15 em 15 min, até 8h à frente)
  let quem = ''
  if (r.motivoConflito.ag) {
    const { data: ag } = await db.from('agendamentos').select('medico:medicos(nome)').eq('id', r.motivoConflito.ag).maybeSingle()
    quem = (ag as any)?.medico?.nome ? ` (${(ag as any).medico.nome})` : ''
  }
  const ate = r.motivoConflito.fim ? ` até ${hora(r.motivoConflito.fim.replace(/[)\]"]/g, ''))}` : ''
  const livres: string[] = []
  const diaSP = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  for (let k = 1; k <= 32 && livres.length < 3; k++) {
    const t = new Date(ini.getTime() + k * 15 * MIN)
    if (diaSP(t) !== diaSP(ini)) break
    if (!(await tentar(t)).motivoConflito) livres.push(t.toISOString())
  }
  return {
    sala: null, equipamentos: [], livres,
    conflito: `${r.motivoConflito.recurso} ${r.motivoConflito.plural ? 'estão ocupados' : 'está em uso'} nesse horário${ate}${quem}.${livres.length ? ' Horários livres: ' + livres.map(hora).join(' · ') : ' Não há horário livre mais tarde neste dia.'}`,
  }
}

/** Reserva sala/equipamentos do agendamento (refaz se já havia). Conflito no banco → devolve o plano com alternativas. */
export async function reservar(chave: string, p: { agendamentoId: string; procedimentoId?: string | null }): Promise<Plano> {
  const { data: ag } = await db.from('agendamentos').select('id, medico_id, procedimento_id, data_hora, duracao, status').eq('id', p.agendamentoId).maybeSingle()
  const a: any = ag
  if (!a) throw new ErroAtendimento('Agendamento não encontrado.', 404)
  const { data: med } = await db.from('medicos').select('id').eq('id', a.medico_id).or(`clinica_id.eq.${chave},id.eq.${chave}`).maybeSingle()
  if (!med) throw new ErroAtendimento('Agendamento de outra clínica.', 403)
  if (['cancelado', 'faltou', 'realizado'].includes(a.status)) return { sala: null, equipamentos: [] }
  const duracao = Number(String(a.duracao || '30').replace(/\D/g, '')) || 30
  const plano = await planejar(chave, { medicoId: a.medico_id, procedimentoId: p.procedimentoId ?? a.procedimento_id, inicio: a.data_hora, duracao, ignorarAgendamento: a.id })
  await db.from('reservas_recurso').delete().eq('agendamento_id', a.id).eq('motivo', 'agendamento')
  if (plano.conflito || plano.sem_salas || (!plano.sala && !plano.equipamentos.length)) return plano
  const periodo = intervalo(new Date(a.data_hora), duracao)
  const linhas = [
    ...(plano.sala ? [{ clinica_id: chave, agendamento_id: a.id, consultorio_id: plano.sala.id, periodo }] : []),
    ...plano.equipamentos.map(e => ({ clinica_id: chave, agendamento_id: a.id, equipamento_id: e.id, periodo })),
  ]
  const { error } = await db.from('reservas_recurso').insert(linhas)
  if (error) {
    if ((error as any).code === '23P01') {
      log.warn('[salas] conflito ao reservar (corrida)', a.id)
      return planejar(chave, { medicoId: a.medico_id, procedimentoId: p.procedimentoId ?? a.procedimento_id, inicio: a.data_hora, duracao, ignorarAgendamento: a.id })
    }
    throw error
  }
  return plano
}

/** Equipamento (ou sala) em manutenção: tira das reservas afetadas e avisa no sino. */
export async function registrarManutencao(chave: string, p: { equipamentoId?: string | null; consultorioId?: string | null; inicio: string; fim: string; observacao?: string | null }) {
  const ini = new Date(p.inicio), fim = new Date(p.fim)
  if (isNaN(ini.getTime()) || isNaN(fim.getTime()) || fim <= ini) throw new ErroAtendimento('Período inválido.', 422)
  const alvo = p.equipamentoId ? { equipamento_id: p.equipamentoId } : { consultorio_id: p.consultorioId }
  if (p.equipamentoId) await pertence('equipamentos', p.equipamentoId, chave)
  else if (p.consultorioId) await pertence('consultorios', p.consultorioId, chave)
  else throw new ErroAtendimento('Escolha o equipamento ou a sala.', 422)
  const periodo = intervalo(ini, (fim.getTime() - ini.getTime()) / MIN)
  let q = db.from('reservas_recurso').select('id, agendamento_id').eq('clinica_id', chave).overlaps('periodo', periodo).not('agendamento_id', 'is', null)
  q = p.equipamentoId ? q.eq('equipamento_id', p.equipamentoId) : q.eq('consultorio_id', p.consultorioId!)
  const { data: afetadas } = await q
  const ids = (afetadas || []).map((r: any) => r.id)
  if (ids.length) await db.from('reservas_recurso').delete().in('id', ids)
  const { error } = await db.from('reservas_recurso').insert({ clinica_id: chave, ...alvo, periodo, motivo: 'manutencao', observacao: p.observacao ? String(p.observacao).slice(0, 200) : null })
  if (error) throw error
  const agIds = Array.from(new Set((afetadas || []).map((r: any) => r.agendamento_id)))
  if (agIds.length) {
    const { data: ags } = await db.from('agendamentos').select('id, medico_id, paciente_id, data_hora, pacientes(nome)').in('id', agIds)
    for (const a of (ags || []) as any[]) {
      await db.from('notificacoes_medico').insert({
        medico_id: a.medico_id, agendamento_id: a.id, paciente_id: a.paciente_id, tipo: 'recurso_manutencao', lida: false, link: `/agenda?ag=${a.id}`,
        titulo: 'Equipamento ou sala em manutenção', descricao: `${a.pacientes?.nome || 'Paciente'} · ${new Date(a.data_hora).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}: escolha outra sala, equipamento ou horário.`,
      })
    }
  }
  return { ok: true, afetados: agIds.length }
}

export async function encerrarManutencao(chave: string, reservaId: string) {
  await db.from('reservas_recurso').delete().eq('id', reservaId).eq('clinica_id', chave).eq('motivo', 'manutencao')
  return { ok: true }
}

/** Salas do dia: para cada sala e equipamento, o que está reservado (para a recepção e a enfermagem). */
export async function reservasDoDia(chave: string, dia: string) {
  const ini = new Date(dia + 'T00:00:00-03:00'), fim = new Date(ini.getTime() + 24 * 60 * MIN)
  const [{ data: res }, base] = await Promise.all([
    db.from('reservas_recurso').select('id, consultorio_id, equipamento_id, periodo, motivo, observacao, agendamento:agendamentos(id, data_hora, duracao, status, tipo, motivo, paciente:pacientes(nome), medico:medicos(nome))')
      .eq('clinica_id', chave).overlaps('periodo', intervalo(ini, 24 * 60)),
    dadosSalas(chave),
  ])
  const lista = (res || []).map((r: any) => {
    const [a, b] = String(r.periodo).replace(/[\[\]()"]/g, '').split(',')
    return { ...r, inicio: new Date(a).toISOString(), fim: new Date(b).toISOString() }
  }).filter(r => new Date(r.fim) > ini && new Date(r.inicio) < fim)
  return { ...base, reservas: lista }
}
