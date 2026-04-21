import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { token, tipo } = await req.json()
    if (!token) return NextResponse.json({ error: 'Token ausente' }, { status: 400 })

    const tabela = tipo === 'admin' ? 'clinica_admins' : 'medicos'

    const { data, error } = await supabase
      .from(tabela)
      .select('id, verificado, token_expira_em')
      .eq('token_verificacao', token)
      .maybeSingle()

    if (error || !data) {
      return NextResponse.json({ error: 'Token inválido ou já usado' }, { status: 404 })
    }

    if (data.verificado) {
      return NextResponse.json({ ok: true, mensagem: 'Email já havia sido verificado anteriormente' })
    }

    if (data.token_expira_em && new Date(data.token_expira_em).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Token expirado. Solicite um novo link.' }, { status: 410 })
    }

    const { error: updErr } = await supabase
      .from(tabela)
      .update({
        verificado: true,
        token_verificacao: null,
        token_expira_em: null,
      })
      .eq('id', data.id)

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

    return NextResponse.json({ ok: true, mensagem: 'Sua conta está confirmada. Já pode acessar a plataforma.' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
