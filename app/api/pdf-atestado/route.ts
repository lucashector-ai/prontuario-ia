import { NextRequest, NextResponse } from 'next/server'
import { contextoDaRequisicao, naoAutenticado } from '@/lib/acesso'
import { dadosDoDocumento, paginaDocumento, porExtenso, esc, dataLonga } from '@/lib/documentos-html'

/**
 * Atestado médico (Res. CFM 1.658/2002): paciente identificado, dias por extenso, CID só com
 * autorização do paciente, local, data, hora, assinatura e CRM. Não depende de IA.
 * Corpo: { paciente_id?, paciente_avulso?, medico_id?, dias, inicio?, cid?, incluir_cid?, motivo?, observacoes?, tipo?: 'atestado' | 'comparecimento', horario? }
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await contextoDaRequisicao(req)
    if (!ctx) return naoAutenticado()
    const b = await req.json()
    const d = await dadosDoDocumento(ctx, { medicoId: b.medico_id || b.medico?.id, pacienteId: b.paciente_id || b.paciente?.id, pacienteAvulso: b.paciente_avulso || (b.paciente?.nome ? b.paciente : null) })
    if (!d) return NextResponse.json({ error: 'Não foi possível montar o atestado: confira o médico e o paciente.' }, { status: 400 })
    if (!d.paciente.nome) return NextResponse.json({ error: 'Escolha o paciente antes de emitir o atestado.' }, { status: 400 })

    const a = b.atestado || b
    const comparecimento = a.tipo === 'comparecimento'
    const dias = Math.max(1, Math.min(90, Math.round(Number(a.dias) || 1)))
    const inicio = a.inicio ? new Date(a.inicio + 'T12:00:00') : new Date()
    const cid = a.incluir_cid && a.cid ? String(a.cid).trim() : ''

    const corpo = comparecimento
      ? `<p>Declaro, para os devidos fins, que <b>${esc(d.paciente.nome)}</b> esteve em atendimento médico nesta data${a.horario ? `, no período de <b>${esc(a.horario)}</b>` : ''}.</p>`
      : `<p>Atesto, para os devidos fins, que <b>${esc(d.paciente.nome)}</b> esteve sob meus cuidados médicos e necessita de afastamento de suas atividades por <b>${dias} (${porExtenso(dias)}) dia${dias > 1 ? 's' : ''}</b>, a partir de ${esc(dataLonga(inicio))}.</p>
         ${cid ? `<p><b>CID-10:</b> ${esc(cid)} <span style="font-size:11.5px;color:#555">(informado com autorização do paciente)</span></p>` : ''}`
      + (a.motivo ? `<p><b>Observação:</b> ${esc(a.motivo)}</p>` : '')
      + (a.observacoes ? `<p>${esc(a.observacoes)}</p>` : '')

    const html = paginaDocumento(comparecimento ? 'Declaração de comparecimento' : 'Atestado médico', d, corpo)
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  } catch (e: any) {
    return NextResponse.json({ error: 'Não foi possível gerar o atestado. Tente de novo.' }, { status: 500 })
  }
}
