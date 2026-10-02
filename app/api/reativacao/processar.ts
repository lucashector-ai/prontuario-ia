/**
 * Envio das campanhas de reativação em lotes (usado por /api/reativacao e pelo cron /api/cron/retornos).
 * Cada destinatário é uma linha em campanhas_envios: pendente → processando (reservado) → enviado | falhou.
 * A reserva atômica (update … where status = 'pendente') garante que ninguém recebe duas vezes,
 * mesmo com dois processos rodando o mesmo lote.
 */
import { supabaseServidor as db, agoraSP } from '@/lib/servidor'
import { enviarWhatsApp, preencherModelo } from '@/lib/whatsapp/enviar'
import { contextoMedico, horarioComercialSP, tituloMedico, type ContextoMedico } from '../retornos/comum'

export const PAUSA_MS = 2500     // pausa entre mensagens (evita bloqueio por spam)
export const LOTE_PADRAO = 15    // ~40 s por chamada

const dormir = (ms: number) => new Promise(r => setTimeout(r, ms))

export type ResultadoLote = { enviados: number; falhas: number; restantes: number; concluida: boolean; foraHorario?: boolean }

export async function processarLoteCampanha(campanhaId: string, opts: { lote?: number; cache?: Map<string, ContextoMedico> } = {}): Promise<ResultadoLote> {
  const { data: camp } = await db.from('campanhas_reativacao').select('*').eq('id', campanhaId).maybeSingle()
  if (!camp) throw new Error('Campanha não encontrada')
  if (camp.status === 'concluida') return { enviados: 0, falhas: 0, restantes: 0, concluida: true }
  if (!horarioComercialSP(agoraSP().hora)) {
    return { enviados: 0, falhas: 0, restantes: await contarPendentes(campanhaId), concluida: false, foraHorario: true }
  }

  const ctx = await contextoMedico(camp.medico_id, opts.cache)
  const { data: fila } = await db.from('campanhas_envios').select('*').eq('campanha_id', campanhaId).eq('status', 'pendente').limit(opts.lote ?? LOTE_PADRAO)
  let enviados = 0, falhas = 0

  for (let i = 0; i < (fila || []).length; i++) {
    const env = fila![i]
    const { data: reservado } = await db.from('campanhas_envios')
      .update({ status: 'processando', enviado_em: new Date().toISOString() })
      .eq('id', env.id).eq('status', 'pendente').select('id')
    if (!reservado?.length) continue

    const { data: pac } = env.paciente_id
      ? await db.from('pacientes').select('id, nome, telefone').eq('id', env.paciente_id).maybeSingle()
      : { data: null as any }
    const nome = pac?.nome || ''
    const texto = preencherModelo(camp.mensagem, {
      nome: nome.trim().split(/\s+/)[0] || '', medico: tituloMedico(ctx.nome), clinica: ctx.clinica || tituloMedico(ctx.nome),
    })
    const r = await enviarWhatsApp({
      medicoId: camp.medico_id, telefone: env.telefone || pac?.telefone || '', texto,
      registrar: { nome: nome || null, pacienteId: env.paciente_id, metadata: { campanha_reativacao: true, campanha_id: campanhaId } },
    })
    await db.from('campanhas_envios').update(r.ok
      ? { status: 'enviado', erro: null, enviado_em: new Date().toISOString() }
      : { status: 'falhou', erro: (r.erro || 'Falha no envio').slice(0, 300) }).eq('id', env.id)
    if (r.ok) enviados++; else falhas++
    if (i < fila!.length - 1) await dormir(PAUSA_MS)
  }

  return { enviados, falhas, ...(await atualizarTotais(campanhaId)) }
}

async function contarPendentes(campanhaId: string) {
  const { count } = await db.from('campanhas_envios').select('id', { count: 'exact', head: true }).eq('campanha_id', campanhaId).in('status', ['pendente', 'processando'])
  return count || 0
}

/** Recalcula enviados/falhas e conclui a campanha quando não há mais pendentes. */
export async function atualizarTotais(campanhaId: string) {
  const { data } = await db.from('campanhas_envios').select('status').eq('campanha_id', campanhaId)
  const l = data || []
  const enviados = l.filter(e => e.status === 'enviado' || e.status === 'respondeu').length
  const falhas = l.filter(e => e.status === 'falhou').length
  const restantes = l.filter(e => e.status === 'pendente' || e.status === 'processando').length
  const concluida = restantes === 0
  await db.from('campanhas_reativacao').update({
    enviados, falhas, ...(concluida ? { status: 'concluida', concluida_em: new Date().toISOString() } : { status: 'enviando' }),
  }).eq('id', campanhaId)
  return { restantes, concluida }
}

/** Envios presos em 'processando' há mais de 15 min (processo interrompido) viram falha — nunca reenvia. */
export async function liberarTravados() {
  const limite = new Date(Date.now() - 15 * 60_000).toISOString()
  const { data } = await db.from('campanhas_envios').update({ status: 'falhou', erro: 'Envio interrompido — confira no Chat se a mensagem chegou' })
    .eq('status', 'processando').lt('enviado_em', limite).select('campanha_id')
  const ids = Array.from(new Set((data || []).map(d => d.campanha_id)))
  for (const id of ids) await atualizarTotais(id)
  return data?.length || 0
}
