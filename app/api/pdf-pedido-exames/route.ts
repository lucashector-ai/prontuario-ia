import { NextRequest, NextResponse } from 'next/server'
import { contextoDaRequisicao, naoAutenticado } from '@/lib/acesso'
import { guardarDocumento } from '@/lib/portal/arquivos'
import { dadosDoDocumento, paginaDocumento, esc } from '@/lib/documentos-html'

/**
 * Pedido de exames para o paciente levar ao laboratório.
 * Corpo: { paciente_id?, paciente_avulso?, medico_id?, exames: [{ nome, indicacao? }] | string, indicacao_clinica?, observacoes? }
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await contextoDaRequisicao(req)
    if (!ctx) return naoAutenticado()
    const b = await req.json()
    const d = await dadosDoDocumento(ctx, { medicoId: b.medico_id, pacienteId: b.paciente_id, pacienteAvulso: b.paciente_avulso })
    if (!d) return NextResponse.json({ error: 'Não foi possível montar o pedido: confira o médico e o paciente.' }, { status: 400 })
    if (!d.paciente.nome) return NextResponse.json({ error: 'Escolha o paciente antes de imprimir o pedido.' }, { status: 400 })
    const lista: { nome: string; indicacao?: string }[] = Array.isArray(b.exames)
      ? b.exames.filter((e: any) => e?.nome)
      : String(b.exames || '').split('\n').map(s => s.trim()).filter(Boolean).map(nome => ({ nome }))
    if (!lista.length) return NextResponse.json({ error: 'Inclua pelo menos um exame.' }, { status: 400 })

    const corpo = `<p>Solicito os seguintes exames:</p>
      <ol>${lista.map(e => `<li><b>${esc(e.nome)}</b>${e.indicacao ? `<br/><span style="font-size:12px;color:#444">${esc(e.indicacao)}</span>` : ''}</li>`).join('')}</ol>
      ${b.indicacao_clinica ? `<p><b>Indicação clínica:</b> ${esc(b.indicacao_clinica)}</p>` : ''}
      ${b.observacoes ? `<p><b>Orientações:</b> ${esc(b.observacoes)}</p>` : ''}`
    const html = paginaDocumento('Pedido de exames', d, corpo)
    if (b.liberar_portal) await guardarDocumento(ctx, { pacienteId: b.paciente_id, medicoId: b.medico_id, tipo: 'pedido_exames', titulo: `Pedido de exames (${lista.length})`, html }).catch(() => {})
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  } catch {
    return NextResponse.json({ error: 'Não foi possível gerar o pedido de exames. Tente de novo.' }, { status: 500 })
  }
}
