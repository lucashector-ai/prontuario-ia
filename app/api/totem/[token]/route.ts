/**
 * Totem de autoatendimento — público, pelo link secreto do totem da sala de espera.
 *
 *   GET                                               → { setor, clinica, logo_url }
 *   POST { acao: 'buscar', cpf }                      → { agendamentos: [{ id, hora, medico, paciente, senha }] }
 *   POST { acao: 'checkin', cpf, agendamento_id, prioridade? } → { senha, ja_existia, medico, nome, prioridade }
 *   POST { acao: 'senha', prioridade?, motivo? }      → { senha, na_frente }   (senha de balcão)
 */
import { NextRequest, NextResponse } from 'next/server'
import { log } from '@/lib/logger'
import { ErroAtendimento } from '@/lib/atendimento/servidor'
import { buscarNoTotem, checkinNoTotem, dadosDoTotem, senhaDeBalcao } from '@/lib/atendimento/totem'
import { PRIORIDADES } from '@/lib/atendimento/comum'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

function erro(e: any) {
  if (e instanceof ErroAtendimento) return NextResponse.json({ error: e.message }, { status: e.status })
  log.error('[totem]', e?.message || e)
  return NextResponse.json({ error: 'Não foi possível agora. Procure a recepção.' }, { status: 500 })
}

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const d = await dadosDoTotem(params.token)
    if (!d) return NextResponse.json({ error: 'Totem desativado' }, { status: 404 })
    return NextResponse.json(d, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) { return erro(e) }
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const b = await req.json().catch(() => ({}))
    if (b.acao === 'buscar') return NextResponse.json(await buscarNoTotem(params.token, String(b.cpf || '')))
    if (b.acao === 'checkin') {
      const prio = PRIORIDADES.some(p => p.valor === b.prioridade) ? b.prioridade : null
      return NextResponse.json(await checkinNoTotem(params.token, String(b.cpf || ''), String(b.agendamento_id || ''), prio))
    }
    if (b.acao === 'senha') return NextResponse.json(await senhaDeBalcao(params.token, String(b.prioridade || 'normal'), String(b.motivo || 'sem_horario')))
    throw new ErroAtendimento('Ação desconhecida')
  } catch (e) { return erro(e) }
}
