/**
 * Painel do gestor — GET ?de=YYYY-MM-DD&ate=YYYY-MM-DD&medico_id=…
 * Só para quem administra: conta da clínica, médico admin ou médico autônomo.
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServidor as db } from '@/lib/servidor'
import { log } from '@/lib/logger'
import { ErroAtendimento, contextoAtendimento } from '@/lib/atendimento/servidor'
import { indicadores } from '@/lib/atendimento/gestao'
import { hojeSP } from '@/lib/atendimento/comum'

export const dynamic = 'force-dynamic'
const ehData = (s: string | null) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)

export async function GET(req: NextRequest) {
  try {
    const ctx = await contextoAtendimento(req)
    if (ctx.tipo !== 'clinica' && ctx.clinica !== ctx.medicoId) {
      const { data } = await db.from('medicos').select('cargo').eq('id', ctx.medicoId!).maybeSingle()
      if (data?.cargo !== 'admin') throw new ErroAtendimento('O painel do gestor é só para administradores.', 403)
    }
    const sp = req.nextUrl.searchParams
    const ate = ehData(sp.get('ate')) ? sp.get('ate')! : hojeSP()
    const de = ehData(sp.get('de')) ? sp.get('de')! : ate
    if (de > ate) throw new ErroAtendimento('Período inválido.')
    if ((new Date(ate).getTime() - new Date(de).getTime()) / 864e5 > 366) throw new ErroAtendimento('Escolha até 1 ano.')
    const r = await indicadores(ctx, { de, ate, medicoId: sp.get('medico_id') })
    return NextResponse.json(r || { vazio: true })
  } catch (e: any) {
    if (e instanceof ErroAtendimento) return NextResponse.json({ error: e.message }, { status: e.status })
    log.error('[gestao]', e?.message || e)
    return NextResponse.json({ error: 'Não foi possível calcular os indicadores.' }, { status: 500 })
  }
}
