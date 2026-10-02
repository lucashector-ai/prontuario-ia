import { NextRequest, NextResponse } from 'next/server'
import { assinarToken, comSessao } from '@/lib/sessao-servidor'
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
      .select('*')
      .eq('token_verificacao', token)
      .maybeSingle()

    if (error || !data) {
      return NextResponse.json({ error: 'Token inválido ou já usado' }, { status: 404 })
    }

    if (data.token_expira_em && new Date(data.token_expira_em).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Token expirado. Solicite um novo link.' }, { status: 410 })
    }

    // Marca como verificado + limpa token (só se ainda não estava)
    if (!data.verificado) {
      const { error: updErr } = await supabase
        .from(tabela)
        .update({
          verificado: true,
          token_verificacao: null,
          token_expira_em: null,
        })
        .eq('id', data.id)
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
    }

    // Monta payload pra auto-login
    if (tipo === 'admin') {
      const { data: clinica } = await supabase
        .from('clinicas')
        .select('id, nome, tipo, email, telefone')
        .eq('id', data.clinica_id)
        .single()

      const tokenSessao = await assinarToken({ sub: data.id, tipo: 'clinica', clinica_id: data.clinica_id, medico_id: null })
      return comSessao(NextResponse.json({
        ok: true,
        tipo_conta: 'clinica',
        token: tokenSessao,
        admin: {
          id: data.id,
          email: data.email,
          nome: data.nome,
          role: data.role,
          clinica_id: data.clinica_id,
        },
        clinica,
        mensagem: 'Email confirmado! Redirecionando...',
      }), tokenSessao)
    } else {
      const { data: clinica } = await supabase
        .from('clinicas')
        .select('id, nome, tipo')
        .eq('id', data.clinica_id)
        .single()

      const medicoLimpo = { ...data, senha: undefined, senha_hash: undefined, token_verificacao: undefined }

      const tokenSessao = await assinarToken({ sub: data.id, tipo: 'medico', clinica_id: data.clinica_id || null, medico_id: data.id })
      return comSessao(NextResponse.json({
        ok: true,
        tipo_conta: 'medico',
        token: tokenSessao,
        medico: medicoLimpo,
        clinica,
        mensagem: 'Email confirmado! Redirecionando...',
      }), tokenSessao)
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
