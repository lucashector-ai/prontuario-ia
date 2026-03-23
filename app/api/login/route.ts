import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  try {
    const { email, senha } = await req.json()

    const { data: medico, error } = await supabase
      .from('medicos')
      .select('*')
      .eq('email', email)
      .eq('ativo', true)
      .single()

    if (error || !medico) {
      return NextResponse.json({ error: 'E-mail ou senha incorretos' }, { status: 401 })
    }

    const senhaOk = await bcrypt.compare(senha, medico.senha_hash)
    if (!senhaOk) {
      return NextResponse.json({ error: 'E-mail ou senha incorretos' }, { status: 401 })
    }

    const { senha_hash, ...medicoSemSenha } = medico
    return NextResponse.json({ medico: medicoSemSenha })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
