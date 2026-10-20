import { NextRequest, NextResponse } from 'next/server'
import { log } from '@/lib/logger'
import { ErroAtendimento } from '@/lib/atendimento/servidor'
import { concluirUpload, documentoDoPaciente, prepararUpload } from '@/lib/portal/arquivos'
import { checkinPeloPortal, confirmarPeloPortal, dadosDoPortal, remarcarPeloPortal, validarToken } from '@/lib/portal/servidor'

/**
 * Portal do paciente (público, protegido pelo token do link).
 *   GET                                         → clínica, próxima consulta, formulários e retorno
 *   POST { acao: 'confirmar', agendamento_id }
 *   POST { acao: 'remarcar', agendamento_id, preferencia? }
 *   POST { acao: 'checkin', agendamento_id }    → { senha, na_frente }
 *   POST { acao: 'upload', nome, tipo, tamanho } → { id, caminho, token } (envio direto ao storage)
 *   POST { acao: 'upload_ok', anexo_id }
 *   POST { acao: 'documento', documento_id }     → HTML do documento liberado
 */
export const dynamic = 'force-dynamic'

const invalido = () => NextResponse.json({ erro: 'Este link não vale mais.', invalido: true }, { status: 404 })
const falha = (e: any) => {
  if (e instanceof ErroAtendimento) return NextResponse.json({ erro: e.message }, { status: e.status || 400 })
  log.error('[portal]', e)
  return NextResponse.json({ erro: 'Não conseguimos concluir agora. Tente de novo.' }, { status: 500 })
}

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const t = await validarToken(params.token)
    if (!t) return invalido()
    return NextResponse.json(await dadosDoPortal(t), { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) { return falha(e) }
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const t = await validarToken(params.token)
    if (!t) return invalido()
    const b = await req.json().catch(() => ({}))
    const ag = String(b.agendamento_id || '')
    if (b.acao === 'confirmar') return NextResponse.json(await confirmarPeloPortal(t, ag))
    if (b.acao === 'remarcar') return NextResponse.json(await remarcarPeloPortal(t, ag, String(b.preferencia || '')))
    if (b.acao === 'checkin') return NextResponse.json(await checkinPeloPortal(t, ag))
    if (b.acao === 'upload') return NextResponse.json(await prepararUpload(t.paciente_id, t.clinica_chave, String(b.nome || ''), String(b.tipo || ''), Number(b.tamanho) || 0))
    if (b.acao === 'upload_ok') return NextResponse.json(await concluirUpload(t.paciente_id, String(b.anexo_id || '')))
    if (b.acao === 'documento') {
      const html = await documentoDoPaciente(t.paciente_id, String(b.documento_id || ''))
      return html ? new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }) : NextResponse.json({ erro: 'Documento não encontrado.' }, { status: 404 })
    }
    return NextResponse.json({ erro: 'Ação inválida.' }, { status: 400 })
  } catch (e) { return falha(e) }
}
