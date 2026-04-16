import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    const { data: medico } = await supabase
      .from('medicos').select('id, nome, email').eq('email', email).single()
    
    if (!medico) return NextResponse.json({ error: 'Email nao encontrado' }, { status: 404 })

    // Gera token de reset
    const token = crypto.randomUUID()
    const expira = new Date(Date.now() + 3600000).toISOString() // 1 hora

    await supabase.from('password_resets').upsert({ 
      medico_id: medico.id, token, expira_em: expira 
    }, { onConflict: 'medico_id' })

    // Por enquanto retorna o link diretamente (em produção mandaria email)
    const link = `${req.headers.get('origin')}/reset-password?token=${token}`
    console.log('RESET LINK:', link)
    
    return NextResponse.json({ ok: true, link })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
