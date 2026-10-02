/**
 * Funções de servidor compartilhadas por /api/retornos, /api/reativacao e /api/cron/retornos.
 * (Arquivo comum — não é rota.)
 */
import { supabaseServidor as db } from '@/lib/servidor'
import { enviarWhatsApp, preencherModelo } from '@/lib/whatsapp/enviar'

export const URL_APP = (process.env.NEXT_PUBLIC_APP_URL || 'https://clinical360.vercel.app').replace(/\/$/, '')

/** Tabela/coluna inexistente (migration não rodada). */
export const faltaMigration = (erro: any) =>
  !!erro && /column|relation|does not exist|schema cache|42P01|42703/i.test(String(erro.message || erro.code || erro))

/** Hoje em São Paulo, 'YYYY-MM-DD'. */
export function hojeSP(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

/** Soma dias a uma data 'YYYY-MM-DD' (sem fuso). */
export function somarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(a, m - 1, d + dias))
  return dt.toISOString().slice(0, 10)
}

/** '2026-11-14' → '14/11' */
export function dataCurta(iso: string) {
  const [, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}`
}

export function horarioComercialSP(hora: number) {
  return hora >= 8 && hora < 20
}

export type ContextoMedico = { id: string; nome: string; clinica: string; linkAgenda: string | null }

/** Nome do médico, nome da clínica e link da agenda pública (se ativa). Cacheável por chamada. */
export async function contextoMedico(medicoId: string, cache?: Map<string, ContextoMedico>): Promise<ContextoMedico> {
  const em = cache?.get(medicoId)
  if (em) return em
  const { data: m } = await db.from('medicos').select('*').eq('id', medicoId).maybeSingle()
  let clinica = ''
  let slugClinica: string | null = null
  if (m?.clinica_id) {
    const { data: c } = await db.from('clinicas').select('*').eq('id', m.clinica_id).maybeSingle()
    clinica = c?.nome || ''
    slugClinica = c?.slug_publico || null
  }
  let linkAgenda: string | null = null
  if (m?.slug_publico && m?.agenda_publica_ativa) {
    linkAgenda = slugClinica ? `${URL_APP}/agenda/${slugClinica}/${m.slug_publico}` : `${URL_APP}/agenda/${m.slug_publico}`
  }
  const ctx = { id: medicoId, nome: m?.nome || '', clinica, linkAgenda }
  cache?.set(medicoId, ctx)
  return ctx
}

export function tituloMedico(nome: string) {
  if (!nome) return ''
  return /^(dr|dra)\.?\s/i.test(nome) ? nome : `Dr(a). ${nome}`
}

/** Texto do lembrete de retorno. */
export function textoLembrete(p: { nome: string; motivo?: string | null; dataPrevista: string; ctx: ContextoMedico }) {
  const primeiro = (p.nome || '').trim().split(/\s+/)[0] || ''
  const quem = p.ctx.clinica || tituloMedico(p.ctx.nome) || 'a clínica'
  const motivo = p.motivo ? ` (${p.motivo.trim()})` : ''
  const convite = p.ctx.linkAgenda
    ? `Para escolher o melhor horário, é só acessar: ${p.ctx.linkAgenda}`
    : 'Responda esta mensagem com o melhor dia e horário para você que a gente agenda.'
  return preencherModelo(
    'Olá, {nome}! Aqui é {quem}. Está chegando a data do seu retorno{motivo}, previsto para {data}. {convite}',
    { nome: primeiro, quem: p.ctx.clinica ? `da ${quem}` : quem, motivo, data: dataCurta(p.dataPrevista), convite },
  )
}

/**
 * Envia o lembrete de UM retorno, reservando-o antes (lembrete_enviado_em) para nunca mandar duas vezes.
 * `forcar` = envio manual ("Lembrar agora"), ignora lembrete já enviado.
 */
export async function lembrarRetorno(retorno: any, opts: { forcar?: boolean; cache?: Map<string, ContextoMedico> } = {}) {
  const agora = new Date().toISOString()
  let q = db.from('retornos').update({ lembrete_enviado_em: agora }).eq('id', retorno.id)
  if (!opts.forcar) q = q.is('lembrete_enviado_em', null)
  const { data: reservado, error } = await q.select('id')
  if (error) return { ok: false, erro: error.message }
  if (!reservado?.length) return { ok: false, erro: 'já lembrado', pulado: true }

  const { data: pac } = await db.from('pacientes').select('id, nome, telefone').eq('id', retorno.paciente_id).maybeSingle()
  const desfazer = () => db.from('retornos').update({ lembrete_enviado_em: retorno.lembrete_enviado_em || null }).eq('id', retorno.id)
  if (!pac?.telefone) { await desfazer(); return { ok: false, erro: 'Paciente sem telefone' } }

  const ctx = await contextoMedico(retorno.medico_id, opts.cache)
  const texto = textoLembrete({ nome: pac.nome, motivo: retorno.motivo, dataPrevista: retorno.data_prevista, ctx })
  const r = await enviarWhatsApp({
    medicoId: retorno.medico_id, telefone: pac.telefone, texto,
    registrar: { nome: pac.nome, pacienteId: pac.id, metadata: { lembrete_retorno: true, retorno_id: retorno.id } },
  })
  if (!r.ok) { await desfazer(); return { ok: false, erro: r.erro || 'Falha no envio' } }
  if (retorno.status === 'pendente') await db.from('retornos').update({ status: 'lembrado' }).eq('id', retorno.id)
  return { ok: true }
}

/**
 * Concilia retornos em aberto com a agenda: se o paciente marcou consulta depois que o retorno
 * foi criado, o retorno vira 'agendado'; se essa consulta foi realizada, 'concluido'.
 */
export async function conciliarRetornos(medicoId?: string) {
  let q = db.from('retornos').select('id, medico_id, paciente_id, criado_em, status, agendamento_id').in('status', ['pendente', 'lembrado', 'agendado'])
  if (medicoId) q = q.eq('medico_id', medicoId)
  const { data: abertos, error } = await q.limit(2000)
  if (error || !abertos?.length) return 0
  const pacIds = Array.from(new Set(abertos.map(r => r.paciente_id)))
  let ag: any[] = []
  for (let i = 0; i < pacIds.length; i += 200) {
    const { data } = await db.from('agendamentos').select('*')
      .in('paciente_id', pacIds.slice(i, i + 200)).neq('status', 'cancelado')
    ag = ag.concat(data || [])
  }
  let mudou = 0
  for (const r of abertos) {
    if (r.status === 'agendado') {
      const a = ag.find(x => x.id === r.agendamento_id)
      if (a?.status === 'realizado') { await db.from('retornos').update({ status: 'concluido' }).eq('id', r.id); mudou++ }
      continue
    }
    // agendamento criado depois do retorno (ou com data após a criação do retorno)
    const cand = ag
      .filter(a => a.paciente_id === r.paciente_id && a.medico_id === r.medico_id && a.status !== 'faltou'
        && new Date(a.criado_em || a.data_hora).getTime() >= new Date(r.criado_em).getTime() - 60_000
        && new Date(a.data_hora).getTime() >= new Date(r.criado_em).getTime())
      .sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime())[0]
    if (cand) {
      await db.from('retornos').update({ status: cand.status === 'realizado' ? 'concluido' : 'agendado', agendamento_id: cand.id }).eq('id', r.id)
      mudou++
    }
  }
  return mudou
}
