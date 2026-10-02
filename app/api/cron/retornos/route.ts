import { NextRequest, NextResponse } from 'next/server'
import { supabaseServidor as db, autorizarCron, agoraSP } from '@/lib/servidor'
import { conciliarRetornos, hojeSP, horarioComercialSP, lembrarRetorno, somarDias, type ContextoMedico } from '../../retornos/comum'
import { liberarTravados, processarLoteCampanha } from '../../reativacao/processar'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Cron diário de retornos (sugestão no vercel.json: "0 13 * * *" = 10h em São Paulo).
 *  1. Concilia retornos com a agenda (paciente já marcou → 'agendado'; consulta realizada → 'concluido').
 *  2. Lembra por WhatsApp os retornos 'pendente' com data_prevista até N dias à frente (?dias=7),
 *     ainda sem lembrete (idempotente: reserva lembrete_enviado_em antes de enviar) → 'lembrado'.
 *  3. Retoma campanhas de reativação que pararam no meio (fora do horário / aba fechada).
 * Mensagens só entre 8h e 20h (SP).
 */
export async function GET(req: NextRequest) {
  const negado = autorizarCron(req); if (negado) return negado
  const inicio = Date.now()
  const dias = Math.min(30, Math.max(1, Number(req.nextUrl.searchParams.get('dias')) || 7))

  let conciliados = 0
  try { conciliados = await conciliarRetornos() } catch {}

  const { hora } = agoraSP()
  if (!horarioComercialSP(hora)) return NextResponse.json({ ok: true, fora_horario: true, hora_sp: hora, conciliados })

  const hoje = hojeSP()
  const { data: alvo, error } = await db.from('retornos').select('*')
    .eq('status', 'pendente').is('lembrete_enviado_em', null)
    .lte('data_prevista', somarDias(hoje, dias))
    .gte('data_prevista', somarDias(hoje, -30)) // atrasados há mais de 30 dias não recebem lembrete automático
    .order('data_prevista').limit(300)
  if (error) return NextResponse.json({ ok: false, error: error.message, conciliados }, { status: 500 })

  const cache = new Map<string, ContextoMedico>()
  let lembrados = 0, falhas = 0, pulados = 0
  const erros: Record<string, number> = {}
  for (const r of alvo || []) {
    if (Date.now() - inicio > 200_000) break // deixa folga para as campanhas
    const res = await lembrarRetorno(r, { cache })
    if (res.ok) lembrados++
    else if ((res as any).pulado) pulados++
    else { falhas++; erros[res.erro || 'erro'] = (erros[res.erro || 'erro'] || 0) + 1 }
    await new Promise(ok => setTimeout(ok, 400))
  }

  // Campanhas de reativação em andamento
  let campanhasEnviadas = 0, campanhasFalhas = 0
  try {
    await liberarTravados()
    const { data: camps } = await db.from('campanhas_reativacao').select('id').eq('status', 'enviando').order('criado_em').limit(10)
    for (const c of camps || []) {
      if (Date.now() - inicio > 240_000) break
      const r = await processarLoteCampanha(c.id, { lote: 15, cache })
      campanhasEnviadas += r.enviados; campanhasFalhas += r.falhas
    }
  } catch {}

  return NextResponse.json({
    ok: true, dias_antes: dias, candidatos: alvo?.length || 0, lembrados, falhas, pulados, erros, conciliados,
    campanhas: { enviados: campanhasEnviadas, falhas: campanhasFalhas },
  })
}
