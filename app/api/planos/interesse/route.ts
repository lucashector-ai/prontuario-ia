import { NextRequest, NextResponse } from 'next/server'
import { supabaseServidor as db } from '@/lib/servidor'
import { contextoDaRequisicao, naoAutenticado } from '@/lib/acesso'
import { enviarEmail, escaparHtml } from '@/lib/email'
import { sessaoDaRequisicao } from '@/lib/sessao-servidor'

/**
 * "Quero o plano completo": manda um email para a equipe comercial (EMAIL_PEDIDOS_PLANO)
 * e guarda o pedido em notificacoes_admin (histórico, mesmo se o email falhar).
 */
export async function POST(req: NextRequest) {
  const ctx = await contextoDaRequisicao(req)
  if (!ctx) return naoAutenticado()
  const { recurso, plano } = await req.json().catch(() => ({}))
  const sessao = await sessaoDaRequisicao(req)
  const [{ data: clinica }, quem] = await Promise.all([
    db.from('clinicas').select('nome, email, telefone, plano').eq('id', ctx.clinica_id || '').maybeSingle(),
    db.from(ctx.tipo === 'clinica' ? 'clinica_admins' : 'medicos').select('nome, email').eq('id', sessao?.sub || '').maybeSingle(),
  ])
  const c: any = clinica || {}
  const p: any = quem.data || {}
  const mensagem = `${c.nome || 'Clínica'} (${c.email || 'sem email'} · ${c.telefone || 'sem telefone'}) quer o plano ${plano || 'completo'}${recurso ? ` — tentou usar: ${recurso}` : ''}. Plano atual: ${c.plano || 'sem plano'}. Pedido feito por ${p.nome || '—'} (${p.email || '—'}). Clínica ${ctx.clinica_id}.`
  await db.from('notificacoes_admin').insert({ medico_id: ctx.medico_id, titulo: 'Pedido de plano completo', mensagem })

  const destino = process.env.EMAIL_PEDIDOS_PLANO || 'contato@clinical360.app'
  await enviarEmail(destino, `Pedido de plano ${plano || 'completo'} — ${c.nome || 'Clínica'}`, `
    <div style="font-family:system-ui,sans-serif;font-size:15px;color:#1C1B22;line-height:1.6">
      <h2 style="margin:0 0 12px">Pedido de plano completo</h2>
      <p><b>Clínica:</b> ${escaparHtml(c.nome)}<br><b>Email da clínica:</b> ${escaparHtml(c.email)}<br><b>Telefone:</b> ${escaparHtml(c.telefone)}</p>
      <p><b>Plano escolhido:</b> ${escaparHtml(plano || 'não informado')}</p>
      <p><b>Quem pediu:</b> ${escaparHtml(p.nome)} (${escaparHtml(p.email)})<br><b>O que tentou usar:</b> ${escaparHtml(recurso || '—')}<br><b>Plano atual:</b> ${escaparHtml(c.plano || 'sem plano')}</p>
      <p style="color:#5E5B6B;font-size:13px">Para liberar: /superadmin → alterar o plano da clínica ${escaparHtml(ctx.clinica_id)}.</p>
    </div>`)
  return NextResponse.json({ ok: true })
}
