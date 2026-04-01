import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// POST - envia NPS apos consulta
export async function POST(req: NextRequest) {
  try {
    const { medico_id, consulta_id } = await req.json()
    if (!medico_id) return NextResponse.json({ error: 'medico_id obrigatorio' }, { status: 400 })

    const { data: config } = await supabase
      .from('whatsapp_config')
      .select('access_token, phone_number_id, nome_exibicao')
      .eq('medico_id', medico_id)
      .eq('ativo', true)
      .single()

    if (!config?.access_token) return NextResponse.json({ error: 'WhatsApp nao configurado' }, { status: 400 })

    // Busca consultas de hoje sem NPS
    let query = supabase
      .from('consultas')
      .select('id, data_hora, pacientes(id, nome, telefone)')
      .eq('medico_id', medico_id)
      .is('nps_enviado', null)

    if (consulta_id) {
      query = query.eq('id', consulta_id)
    } else {
      const hoje = new Date()
      hoje.setHours(0, 0, 0, 0)
      query = query.gte('data_hora', hoje.toISOString())
    }

    const { data: consultas } = await query.limit(20)
    if (!consultas?.length) return NextResponse.json({ enviados: 0 })

    let enviados = 0
    const clinica = config.nome_exibicao || 'Clinica MedIA'

    for (const c of consultas) {
      const paciente = c.pacientes as any
      if (!paciente?.telefone) continue

      const nome = paciente.nome?.split(' ')[0] || 'paciente'
      const mensagem = `Oi, ${nome}! 😊 Obrigado por nos visitar hoje!

Podemos melhorar? Numa escala de *0 a 10*, o quanto voce indicaria a ${clinica} para um amigo?

Digite apenas o numero (ex: 9)`

      try {
        const { data: conversa } = await supabase
          .from('whatsapp_conversas')
          .select('id')
          .eq('paciente_id', paciente.id)
          .eq('medico_id', medico_id)
          .maybeSingle()

        if (conversa) {
          const r = await fetch('https://graph.facebook.com/v20.0/' + config.phone_number_id + '/messages', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + config.access_token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ messaging_product: 'whatsapp', to: paciente.telefone, type: 'text', text: { body: mensagem } })
          })
          const d = await r.json()

          if (d.messages?.[0]?.id) {
            await supabase.from('whatsapp_mensagens').insert({
              conversa_id: conversa.id, tipo: 'enviada', conteudo: mensagem,
              metadata: { nps: true, consulta_id: c.id }
            })
            // Marca consulta como NPS enviado
            await supabase.from('consultas').update({ nps_enviado: true }).eq('id', c.id)
            enviados++
          }
        }
      } catch (e) { console.error('Erro NPS:', e) }
    }

    return NextResponse.json({ enviados, total: consultas.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET - retorna metricas de NPS
export async function GET(req: NextRequest) {
  const medicoId = req.nextUrl.searchParams.get('medico_id')
  if (!medicoId) return NextResponse.json({ error: 'medico_id obrigatorio' }, { status: 400 })

  const trintaDias = new Date()
  trintaDias.setDate(trintaDias.getDate() - 30)

  const { data: respostas } = await supabase
    .from('whatsapp_nps')
    .select('nota, pacientes(nome), criado_em')
    .eq('medico_id', medicoId)
    .gte('criado_em', trintaDias.toISOString())
    .order('criado_em', { ascending: false })

  const notas = respostas?.map(r => r.nota) || []
  const promotores = notas.filter(n => n >= 9).length
  const detratores = notas.filter(n => n <= 6).length
  const nps = notas.length ? Math.round(((promotores - detratores) / notas.length) * 100) : 0
  const media = notas.length ? Math.round(notas.reduce((a, b) => a + b, 0) / notas.length * 10) / 10 : 0

  return NextResponse.json({
    nps, media, total: notas.length,
    promotores, detratores,
    neutros: notas.length - promotores - detratores,
    respostas: respostas?.slice(0, 10) || []
  })
}
