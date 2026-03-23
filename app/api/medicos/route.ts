import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  try {
    const { nome, crm, especialidade, email, senha } = await req.json()

    if (!nome || !crm || !email || !senha) {
      return NextResponse.json({ error: 'Preencha todos os campos obrigatórios' }, { status: 400 })
    }

    const senhaHash = await bcrypt.hash(senha, 10)

    const { data, error } = await supabase
      .from('medicos')
      .insert([{ nome, crm, especialidade, email, senha_hash: senhaHash }])
      .select('id, nome, crm, especialidade, email, criado_em')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'CRM ou e-mail já cadastrado' }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json({ medico: data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('medicos')
      .select('id, nome, crm, especialidade, email, ativo, criado_em')
      .order('criado_em', { ascending: false })

    if (error) throw error
    return NextResponse.json({ medicos: data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
