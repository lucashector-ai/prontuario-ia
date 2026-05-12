import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

function gerarToken() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export async function POST(req: Request) {
  try {
    const { email } = await req.json()
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Email inválido.' }, { status: 400 })
    }

    const sb = adminClient()
    const emailNorm = email.trim().toLowerCase()

    // tenta achar pacientes_portal existente
    let { data: pp } = await sb
      .from('pacientes_portal')
      .select('id, paciente_id, email')
      .eq('email', emailNorm)
      .maybeSingle()

    // se não existe, tenta achar paciente pelo email e criar vínculo
    if (!pp) {
      const { data: paciente } = await sb
        .from('pacientes')
        .select('id, email')
        .ilike('email', emailNorm)
        .maybeSingle()

      if (!paciente) {
        return NextResponse.json({ error: 'Email não encontrado nos cadastros da clínica.' }, { status: 404 })
      }

      const { data: novo, error: errIns } = await sb
        .from('pacientes_portal')
        .insert({ paciente_id: paciente.id, email: emailNorm })
        .select('id, paciente_id, email')
        .single()

      if (errIns) {
        return NextResponse.json({ error: 'Não consegui criar o acesso. Tente novamente.' }, { status: 500 })
      }
      pp = novo
    }

    const token = gerarToken()
    const expira = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    const { error: errUpd } = await sb
      .from('pacientes_portal')
      .update({ magic_link_token: token, magic_link_expira_em: expira })
      .eq('id', pp!.id)

    if (errUpd) {
      return NextResponse.json({ error: 'Falha ao gerar link.' }, { status: 500 })
    }

    // TODO: integrar com Resend/WhatsApp pra enviar o link real.
    // Por enquanto, em dev o token volta na resposta. Em prod, vai pro log.
    const isDev = process.env.NODE_ENV !== 'production'
    if (!isDev) {
      console.log(`[portal/login] token gerado para ${emailNorm}: ${token} (expira ${expira})`)
    }

    return NextResponse.json({
      sent: true,
      devToken: isDev ? token : undefined,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro inesperado.' }, { status: 500 })
  }
}
