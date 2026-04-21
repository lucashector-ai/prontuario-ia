import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function senhaEhForte(s: string) {
  return s.length >= 8 && /[A-Z]/.test(s) && /[a-z]/.test(s) && /[0-9]/.test(s)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { nome, email, senha, crm, especialidade, empresa_nome, telefone } = body

    if (!nome || !email || !senhaEhForte(senha || '')) {
      return NextResponse.json({ error: 'Nome, email e senha forte (8+ caracteres com maiúscula, minúscula e número) são obrigatórios' }, { status: 400 })
    }
    if (!empresa_nome) {
      return NextResponse.json({ error: 'Nome da empresa/consultório é obrigatório' }, { status: 400 })
    }

    const { data: medicoExistente } = await supabase
      .from('medicos').select('id').eq('email', email).maybeSingle()
    if (medicoExistente) {
      return NextResponse.json({ error: 'Email já cadastrado' }, { status: 400 })
    }

    const { data: novaClinica, error: errC } = await supabase
      .from('clinicas')
      .insert({
        nome: empresa_nome,
        tipo: 'autonomo',
      })
      .select()
      .single()
    if (errC) return NextResponse.json({ error: errC.message }, { status: 500 })

    const senhaHash = await bcrypt.hash(senha, 10)
    const token = crypto.randomBytes(32).toString('hex')
    const expira = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

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
        verificado: false,
        token_verificacao: token,
        token_expira_em: expira,
      })
      .select()
      .single()
    if (errM) return NextResponse.json({ error: errM.message }, { status: 500 })

    const baseUrl = req.headers.get('origin') || 'https://prontuario-ia-five.vercel.app'
    const linkVerify = `${baseUrl}/verificar-email?token=${token}&tipo=medico`

    return NextResponse.json({
      ok: true,
      medico: novoMedico,
      verificacao_pendente: true,
      link_verify_debug: linkVerify,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
