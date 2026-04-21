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

function gerarToken() {
  return crypto.randomBytes(32).toString('hex')
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { clinica, admin, medicos } = body

    if (!clinica?.nome || !clinica?.email) {
      return NextResponse.json({ error: 'Nome e email da clínica são obrigatórios' }, { status: 400 })
    }
    if (!admin?.email || !senhaEhForte(admin?.senha || '')) {
      return NextResponse.json({ error: 'Admin precisa de email e senha forte (8+ caracteres com maiúscula, minúscula e número)' }, { status: 400 })
    }

    const { data: clinicaExistente } = await supabase
      .from('clinicas').select('id').eq('email', clinica.email).maybeSingle()
    if (clinicaExistente) {
      return NextResponse.json({ error: 'Email da clínica já cadastrado' }, { status: 400 })
    }

    const { data: adminExistente } = await supabase
      .from('clinica_admins').select('id').eq('email', admin.email).maybeSingle()
    if (adminExistente) {
      return NextResponse.json({ error: 'Email do admin já está em uso' }, { status: 400 })
    }

    const { data: novaClinica, error: errC } = await supabase
      .from('clinicas')
      .insert({
        nome: clinica.nome,
        email: clinica.email,
        telefone: clinica.telefone || null,
        tipo: 'clinica',
      })
      .select()
      .single()
    if (errC) return NextResponse.json({ error: errC.message }, { status: 500 })

    const senhaHash = await bcrypt.hash(admin.senha, 10)
    const tokenAdmin = gerarToken()
    const expira = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

    const { data: novoAdmin, error: errA } = await supabase
      .from('clinica_admins')
      .insert({
        clinica_id: novaClinica.id,
        email: admin.email,
        senha_hash: senhaHash,
        nome: admin.nome || clinica.nome,
        role: 'owner',
        verificado: false,
        token_verificacao: tokenAdmin,
        token_expira_em: expira,
      })
      .select()
      .single()
    if (errA) return NextResponse.json({ error: errA.message }, { status: 500 })

    const medicosCriados: any[] = []
    if (medicos && Array.isArray(medicos)) {
      for (const m of medicos) {
        if (!m.nome || !m.email || !senhaEhForte(m.senha || '')) continue
        const senhaMedHash = await bcrypt.hash(m.senha, 10)
        const tokenMed = gerarToken()
        const { data: novoMedico, error: errM } = await supabase
          .from('medicos')
          .insert({
            clinica_id: novaClinica.id,
            nome: m.nome,
            email: m.email,
            senha_hash: senhaMedHash,
            crm: m.crm || null,
            especialidade: m.especialidade || null,
            cargo: 'medico',
            ativo: true,
            verificado: false,
            token_verificacao: tokenMed,
            token_expira_em: expira,
          })
          .select()
          .single()
        if (!errM && novoMedico) medicosCriados.push(novoMedico)
      }
    }

    return NextResponse.json({
      ok: true,
      clinica: novaClinica,
      admin_id: novoAdmin.id,
      admin_email: novoAdmin.email,
      medicos_criados: medicosCriados.length,
      token_verificacao: tokenAdmin,
      tipo_conta: 'clinica',
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
