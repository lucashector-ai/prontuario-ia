import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function senhaEhForte(s: string) {
  return s.length >= 8 && /[A-Z]/.test(s) && /[a-z]/.test(s) && /[0-9]/.test(s)
}

export async function POST(req: NextRequest) {
  try {
    const { medico_id, senha_nova } = await req.json()
    if (!medico_id || !senha_nova) {
      return NextResponse.json({ error: 'Dados faltando' }, { status: 400 })
    }
    if (!senhaEhForte(senha_nova)) {
      return NextResponse.json({ error: 'Senha não atende aos critérios' }, { status: 400 })
    }

    const hash = await bcrypt.hash(senha_nova, 10)

    const { error } = await supabase
      .from('medicos')
      .update({
        senha_hash: hash,
        senha_provisoria: false,
      })
      .eq('id', medico_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
