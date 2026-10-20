import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { assinarToken, comSessao } from '@/lib/sessao-servidor'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Mesma mensagem para email inexistente e senha errada (não revela quem tem conta)
const ERRO_CREDENCIAIS = 'Email ou senha incorretos'

export async function POST(req: NextRequest) {
  try {
    const { email, senha } = await req.json()

    if (!email || !senha) {
      return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 })
    }

    const emailNorm = email.trim().toLowerCase()

    // 1. Tenta encontrar em clinica_admins
    const adminRes = await supabase
      .from('clinica_admins')
      .select('id, email, senha_hash, nome, role, clinica_id, ativo, onboarding_concluido')
      .ilike('email', emailNorm)
      .maybeSingle()

    const admin = adminRes.data
    if (admin) {
      if (!admin.ativo) {
        return NextResponse.json({ error: 'Conta desativada' }, { status: 403 })
      }
      const ok = await bcrypt.compare(senha, admin.senha_hash)
      if (!ok) {
        return NextResponse.json({ error: ERRO_CREDENCIAIS }, { status: 401 })
      }

      // Busca dados da clínica
      const { data: clinica } = await supabase
        .from('clinicas')
        .select('id, nome, tipo, email, telefone')
        .eq('id', admin.clinica_id)
        .single()

      const token = await assinarToken({ sub: admin.id, tipo: 'clinica', clinica_id: admin.clinica_id, medico_id: null })
      return comSessao(NextResponse.json({
        ok: true,
        tipo: 'clinica',
        token,
        clinica,
        admin: {
          id: admin.id,
          email: admin.email,
          nome: admin.nome,
          role: admin.role,
          clinica_id: admin.clinica_id,
          onboarding_concluido: admin.onboarding_concluido === true,
        },
      }), token)
    }

    // 2. Tenta encontrar em medicos
    // A mesma pessoa pode ter um login em cada unidade da organização (mesmo email):
    // entra na primeira ativa cuja senha confere; as outras aparecem no seletor de unidade do topo.
    const { data: candidatos } = await supabase
      .from('medicos')
      .select('*')
      .ilike('email', emailNorm)
      .order('criado_em', { ascending: true })

    if (candidatos && candidatos.length) {
      let medico: any = null
      for (const m of candidatos as any[]) {
        if (m.senha_hash && m.senha_hash.startsWith('$2') && await bcrypt.compare(senha, m.senha_hash)) {
          if (m.ativo) { medico = m; break }
          medico = medico || m
        }
      }
      if (!medico) {
        return NextResponse.json({ error: ERRO_CREDENCIAIS }, { status: 401 })
      }
      if (!medico.ativo) {
        return NextResponse.json({ error: 'Conta desativada. Procure o administrador.' }, { status: 403 })
      }

      // Busca clínica pra saber o tipo
      const { data: clinica } = await supabase
        .from('clinicas')
        .select('id, nome, tipo')
        .eq('id', medico.clinica_id)
        .single()

      const token = await assinarToken({ sub: medico.id, tipo: 'medico', clinica_id: medico.clinica_id || null, medico_id: medico.id })
      return comSessao(NextResponse.json({
        ok: true,
        tipo: 'medico',
        token,
        medico: { ...medico, senha: undefined, senha_hash: undefined, token_verificacao: undefined, token_expira_em: undefined },
        clinica,
        precisa_trocar_senha: medico.senha_provisoria === true,
      }), token)
    }

    return NextResponse.json({ error: ERRO_CREDENCIAIS }, { status: 401 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
