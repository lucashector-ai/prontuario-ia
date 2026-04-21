import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { nome, email, senha, crm, especialidade, empresa_nome, telefone } = body

    if (!nome || !email || !senha || senha.length < 6) {
      return NextResponse.json({ error: 'Nome, email e senha (min 6 caracteres) são obrigatórios' }, { status: 400 })
    }
    if (!empresa_nome) {
      return NextResponse.json({ error: 'Nome da empresa/consultório é obrigatório' }, { status: 400 })
    }

    const { data: medicoExistente } = await supabase
      .from('medicos').select('id').eq('email', email).maybeSingle()
    if (medicoExistente) {
      return NextResponse.json({ error: 'Email já cadastrado' }, { status: 400 })
    }

    // Cria uma "clínica tipo autônomo" com o nome da empresa
    const { data: novaClinica, error: errC } = await supabase
      .from('clinicas')
      .insert({
        nome: empresa_nome,
        tipo: 'autonomo',
      })
      .select()
      .single()

    if (errC) return NextResponse.json({ error: errC.message }, { status: 500 })

    // Cria o médico como admin da sua própria "clínica"
    const senhaHash = await bcrypt.hash(senha, 10)
    const { data: novoMedico, error: errM } = await supabase
      .from('medicos')
      .insert({
        clinica_id: novaClinica.id,
        nome,
        email,
        senha: senhaHash,
        crm: crm || null,
        especialidade: especialidade || null,
        telefone: telefone || null,
        empresa_nome,
        cargo: 'admin',
        ativo: true,
      })
      .select()
      .single()

    if (errM) return NextResponse.json({ error: errM.message }, { status: 500 })

    return NextResponse.json({ ok: true, medico: novoMedico })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
