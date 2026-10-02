import { NextRequest, NextResponse } from 'next/server'
import { supabaseServidor as db, autorizarCron, agoraSP } from '@/lib/servidor'
import { log } from '@/lib/logger'
import {
  carregarConfigConfirmacao, nomesMedicoClinica, dentroDoHorarioComercial,
  dispararLembretes48h, dispararConfirmacoes24h, dispararLembretes2h, type Contagem,
} from '@/lib/sofia/confirmacao'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Cron de confirmações (sugestão vercel.json: a cada 15 min — "*\/15 * * * *").
 * Para cada médico com WhatsApp configurado, conforme confirmacao_config:
 *   lembrete 48h · confirmação 24h (botões) · lembrete 2h.
 * Só envia entre 8h e 20h (São Paulo). Idempotente (flags em agendamentos).
 */
export async function GET(req: NextRequest) {
  const negado = autorizarCron(req)
  if (negado) return negado

  const zero = (): Contagem => ({ enviados: 0, falhas: 0 })
  const total = { lembrete_48h: zero(), confirmacao_24h: zero(), lembrete_2h: zero() }

  if (!dentroDoHorarioComercial()) {
    return NextResponse.json({ ok: true, fora_do_horario: true, hora_sp: agoraSP().hora, medicos: 0, ...total })
  }

  const { data: configs, error } = await db.from('whatsapp_config').select('medico_id, ativo')
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  const medicos = Array.from(new Set((configs || []).filter((c: any) => c.medico_id && c.ativo !== false).map((c: any) => c.medico_id as string)))

  const avisos: string[] = []
  const somar = (alvo: Contagem, r: Contagem) => {
    alvo.enviados += r.enviados
    alvo.falhas += r.falhas
    if (r.erro && !avisos.includes(r.erro)) avisos.push(r.erro)
  }

  for (const medicoId of medicos) {
    try {
      const cfg = await carregarConfigConfirmacao(medicoId)
      const nomes = await nomesMedicoClinica(medicoId)
      somar(total.lembrete_48h, await dispararLembretes48h(medicoId, cfg, nomes))
      somar(total.confirmacao_24h, await dispararConfirmacoes24h(medicoId, cfg, nomes))
      somar(total.lembrete_2h, await dispararLembretes2h(medicoId, cfg, nomes))
    } catch (e: any) {
      log.error('cron confirmacoes: medico', medicoId, e?.message)
    }
  }

  return NextResponse.json({ ok: true, medicos: medicos.length, ...total, ...(avisos.length ? { avisos } : {}) })
}
