import { NextRequest, NextResponse } from 'next/server'
import { log } from '@/lib/logger'
import { contextoDaRequisicao, naoAutenticado, proibido } from '@/lib/acesso'
import { ErroAtendimento } from '@/lib/atendimento/servidor'
import { cancelarOrcamento, enviarOrcamento, listarOrcamentos, marcarAgendado, salvarOrcamento } from '@/lib/orcamentos/servidor'

/**
 * Orçamentos da clínica da sessão.
 *   GET ?paciente_id=                       → lista
 *   POST { acao: 'salvar', ...orcamento }   → { id }
 *   POST { acao: 'enviar', id }             → { link, texto, telefone } (texto pronto para o WhatsApp)
 *   POST { acao: 'cancelar' | 'agendado', id }
 */
const falha = (e: any) => {
  if (e instanceof ErroAtendimento) return NextResponse.json({ error: e.message }, { status: e.status || 400 })
  log.error('[orcamentos]', e)
  return NextResponse.json({ error: 'Não foi possível concluir. Tente de novo.' }, { status: 500 })
}

async function contexto(req: NextRequest) {
  const ctx = await contextoDaRequisicao(req)
  if (!ctx) return { erro: naoAutenticado() }
  if (ctx.tipo === 'atendente') return { erro: proibido() }
  return { ctx }
}

export async function GET(req: NextRequest) {
  const { ctx, erro } = await contexto(req)
  if (erro) return erro
  try {
    return NextResponse.json({ orcamentos: await listarOrcamentos(ctx!, { pacienteId: req.nextUrl.searchParams.get('paciente_id') }) })
  } catch (e) { return falha(e) }
}

export async function POST(req: NextRequest) {
  const { ctx, erro } = await contexto(req)
  if (erro) return erro
  try {
    const b = await req.json()
    if (b.acao === 'salvar') return NextResponse.json(await salvarOrcamento(ctx!, b))
    if (b.acao === 'enviar') return NextResponse.json(await enviarOrcamento(ctx!, String(b.id || '')))
    if (b.acao === 'cancelar') return NextResponse.json(await cancelarOrcamento(ctx!, String(b.id || '')))
    if (b.acao === 'agendado') return NextResponse.json(await marcarAgendado(ctx!, String(b.id || '')))
    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
  } catch (e) { return falha(e) }
}
