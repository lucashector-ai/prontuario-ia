import { NextRequest, NextResponse } from 'next/server'
import { log } from '@/lib/logger'
import { contextoDaRequisicao, naoAutenticado } from '@/lib/acesso'
import { ErroAtendimento } from '@/lib/atendimento/servidor'
import { linkDoPortal } from '@/lib/portal/servidor'

/** POST { paciente_id } → { url, expira_em }: link do portal do paciente (cria ou renova por 30 dias). */
export async function POST(req: NextRequest) {
  try {
    const ctx = await contextoDaRequisicao(req)
    if (!ctx) return naoAutenticado()
    if (ctx.tipo === 'atendente') return NextResponse.json({ erro: 'Sem permissão.' }, { status: 403 })
    const { paciente_id } = await req.json().catch(() => ({}))
    const chave = ctx.clinica_id || ctx.medico_id
    if (!paciente_id || !chave) return NextResponse.json({ erro: 'Paciente não informado.' }, { status: 400 })
    return NextResponse.json(await linkDoPortal(String(paciente_id), chave))
  } catch (e: any) {
    if (e instanceof ErroAtendimento) return NextResponse.json({ erro: e.message }, { status: e.status || 400 })
    log.error('[portal/link]', e)
    return NextResponse.json({ erro: 'Não foi possível gerar o link.' }, { status: 500 })
  }
}
