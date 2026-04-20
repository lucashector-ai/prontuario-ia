import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Chamado por cron job ou manualmente
// Envia follow-up para pacientes com consulta 3 dias atrás
export async function POST(req: NextRequest) {
  try {
    const { medico_id } = await req.json()
    
    const tresDiasAtras = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    const tresDiasAtrasStr = tresDiasAtras.toISOString().split('T')[0]
    
    // Busca agendamentos realizados há 3 dias
    const { data: agendamentos } = await supabase
      .from('agendamentos')
      .select('*, pacientes(nome, telefone)')
      .eq('medico_id', medico_id)
      .eq('status', 'realizado')
      .gte('data_hora', tresDiasAtrasStr + 'T00:00:00')
      .lte('data_hora', tresDiasAtrasStr + 'T23:59:59')
    
    if (!agendamentos?.length) {
      return NextResponse.json({ ok: true, enviados: 0 })
    }

    let enviados = 0
    for (const ag of agendamentos) {
      const paciente = (ag as any).pacientes
      if (!paciente?.telefone) continue
      
      // Verifica se já enviou follow-up
      const { data: jaEnviou } = await supabase
        .from('whatsapp_mensagens')
        .select('id')
        .eq('conversa_id', ag.id)
        .contains('metadata', { followup: true })
        .maybeSingle()
      
      if (jaEnviou) continue

      // Busca conversa do paciente
      const { data: conversa } = await supabase
        .from('whatsapp_conversas')
        .select('id')
        .eq('medico_id', medico_id)
        .or(`telefone.eq.${paciente.telefone},telefone.eq.55${paciente.telefone}`)
        .maybeSingle()
      
      if (!conversa) continue

      const msg = `Olá ${paciente.nome?.split(' ')[0] || ''}! 😊\n\nJá se passaram 3 dias desde sua consulta. Como você está se sentindo?\n\nSe tiver alguma dúvida ou quiser relatar como está, pode me contar aqui. Estou aqui para ajudar! 🩺`
      
      await supabase.from('whatsapp_mensagens').insert({
        conversa_id: conversa.id,
        tipo: 'enviada',
        conteudo: msg,
        metadata: { ia: true, followup: true, agendamento_id: ag.id }
      })

      // Envia pelo WhatsApp
      const { data: config } = await supabase
        .from('whatsapp_config')
        .select('token, phone_number_id')
        .eq('medico_id', medico_id)
        .single()

      if (config?.token && config?.phone_number_id) {
        await fetch(`https://graph.facebook.com/v20.0/${config.phone_number_id}/messages`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${config.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: paciente.telefone,
            type: 'text',
            text: { body: msg }
          })
        })
      }

      enviados++
    }

    return NextResponse.json({ ok: true, enviados })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const medico_id = req.nextUrl.searchParams.get('medico_id')
  if (!medico_id) return NextResponse.json({ error: 'medico_id required' }, { status: 400 })
  return POST(new NextRequest(req.url, { method: 'POST', body: JSON.stringify({ medico_id }), headers: { 'Content-Type': 'application/json' } }))
}
