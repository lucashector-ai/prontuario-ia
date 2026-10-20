import { NextRequest, NextResponse } from 'next/server'
import { supabaseServidor as db } from '@/lib/servidor'
import { contextoDaRequisicao, naoAutenticado } from '@/lib/acesso'

/** "Quero o plano completo": registra o pedido para a equipe do Clinical 360 entrar em contato. */
export async function POST(req: NextRequest) {
  const ctx = await contextoDaRequisicao(req)
  if (!ctx) return naoAutenticado()
  const { recurso } = await req.json().catch(() => ({}))
  const { data: clinica } = await db.from('clinicas').select('nome, email, telefone, plano').eq('id', ctx.clinica_id || '').maybeSingle()
  await db.from('notificacoes_admin').insert({
    medico_id: ctx.medico_id,
    titulo: 'Pedido de plano completo',
    mensagem: `${(clinica as any)?.nome || 'Clínica'} (${(clinica as any)?.email || 'sem email'} · ${(clinica as any)?.telefone || 'sem telefone'}) quer o plano completo${recurso ? ` — tentou usar: ${recurso}` : ''}. Plano atual: ${(clinica as any)?.plano || 'sem plano'}. Clínica ${ctx.clinica_id}.`,
  })
  return NextResponse.json({ ok: true })
}
