import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabase } from '@/lib/supabase'
import { assinarToken, comSessao } from '@/lib/sessao-servidor'

export async function POST(req: NextRequest) {
  try {
    const { email, senha } = await req.json()
    if (!email || !senha) return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 })
    const { data } = await supabase.from('atendentes').select('*').ilike('email', String(email).trim()).eq('ativo', true).maybeSingle()
    if (!data?.senha) return NextResponse.json({ error: 'Email ou senha incorretos' }, { status: 401 })

    // Senhas novas ficam em bcrypt; as antigas (texto puro) são convertidas no primeiro login
    const ehHash = String(data.senha).startsWith('$2')
    const ok = ehHash ? await bcrypt.compare(senha, data.senha) : data.senha === senha
    if (!ok) return NextResponse.json({ error: 'Email ou senha incorretos' }, { status: 401 })
    if (!ehHash) await supabase.from('atendentes').update({ senha: await bcrypt.hash(senha, 10) }).eq('id', data.id)

    const { data: med } = await supabase.from('medicos').select('clinica_id').eq('id', data.medico_id).maybeSingle()
    const token = await assinarToken({ sub: data.id, tipo: 'atendente', clinica_id: med?.clinica_id || null, medico_id: data.medico_id })
    return comSessao(NextResponse.json({
      token,
      atendente: { id: data.id, nome: data.nome, email: data.email, cargo: data.cargo, medico_id: data.medico_id },
    }), token)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
