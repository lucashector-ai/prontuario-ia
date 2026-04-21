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
    const { medico_id, nova_senha } = await req.json()
    if (!medico_id) return NextResponse.json({ error: 'medico_id é obrigatório' }, { status: 400 })
    if (!senhaEhForte(nova_senha)) {
      return NextResponse.json({ error: 'Senha não atende aos critérios de segurança' }, { status: 400 })
    }

    // Verifica se o médico existe e realmente tem senha provisória
    const { data: medico, error: errBusca } = await supabase
      .from('medicos')
      .select('id, senha_provisoria')
      .eq('id', medico_id)
      .single()

    if (errBusca || !medico) {
      return NextResponse.json({ error: 'Médico não encontrado' }, { status: 404 })
    }

    const hash = await bcrypt.hash(nova_senha, 10)
    const { error } = await supabase
      .from('medicos')
      .update({ senha_hash: hash, senha_provisoria: false })
      .eq('id', medico_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
