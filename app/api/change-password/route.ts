import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  try {
    const { medico_id, senha_atual, senha_nova } = await req.json()
    const { data: medico } = await supabase.from('medicos').select('senha_hash').eq('id', medico_id).single()
    if (!medico) return NextResponse.json({ error: 'Médico não encontrado' }, { status: 404 })
    const ok = await bcrypt.compare(senha_atual, medico.senha_hash)
    if (!ok) return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 401 })
    const hash = await bcrypt.hash(senha_nova, 10)
    await supabase.from('medicos').update({ senha_hash: hash }).eq('id', medico_id)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
