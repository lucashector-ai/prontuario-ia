import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Valida API key e retorna medico_id
async function validarApiKey(key: string) {
  const { data } = await supabase
    .from('medicos')
    .select('id, nome, clinica_id')
    .eq('api_key', key)
    .eq('ativo', true)
    .single()
  return data
}

// GET /api/public?key=xxx&recurso=pacientes
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key')
  const recurso = req.nextUrl.searchParams.get('recurso')

  if (!key) return NextResponse.json({ error: 'API key obrigatória' }, { status: 401 })

  const medico = await validarApiKey(key)
  if (!medico) return NextResponse.json({ error: 'API key inválida' }, { status: 401 })

  if (recurso === 'pacientes') {
    const { data } = await supabase
      .from('pacientes')
      .select('id, nome, telefone, email, data_nascimento, sexo, criado_em')
      .eq('medico_id', medico.id)
      .order('criado_em', { ascending: false })
      .limit(100)
    return NextResponse.json({ ok: true, pacientes: data })
  }

  if (recurso === 'agendamentos') {
    const { data } = await supabase
      .from('agendamentos')
      .select('id, data_hora, tipo, status, motivo, pacientes(nome, telefone)')
      .eq('medico_id', medico.id)
      .gte('data_hora', new Date().toISOString())
      .order('data_hora')
      .limit(50)
    return NextResponse.json({ ok: true, agendamentos: data })
  }

  if (recurso === 'consultas') {
    const { data } = await supabase
      .from('consultas')
      .select('id, criado_em, diagnostico_principal, cids, pacientes(nome)')
      .eq('medico_id', medico.id)
      .order('criado_em', { ascending: false })
      .limit(50)
    return NextResponse.json({ ok: true, consultas: data })
  }

  return NextResponse.json({ 
    ok: true, 
    medico: { id: medico.id, nome: medico.nome },
    recursos: ['pacientes', 'agendamentos', 'consultas'],
    uso: '?key=SUA_KEY&recurso=pacientes'
  })
}

// POST /api/public/gerar-key — gera nova API key para o médico
export async function POST(req: NextRequest) {
  const { medico_id } = await req.json()
  if (!medico_id) return NextResponse.json({ error: 'medico_id obrigatório' }, { status: 400 })

  const apiKey = 'mk_' + crypto.randomBytes(24).toString('hex')
  
  await supabase.from('medicos').update({ api_key: apiKey }).eq('id', medico_id)
  
  return NextResponse.json({ ok: true, api_key: apiKey })
}
