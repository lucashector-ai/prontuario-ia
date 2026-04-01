import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Chamado por cron (a cada hora) ou manualmente
// Envia confirmacao para consultas nas proximas 24h
export async function POST(req: NextRequest) {
  try {
    const { medico_id } = await req.json()
    if (!medico_id) return NextResponse.json({ error: 'medico_id obrigatorio' }, { status: 400 })

    const { data: config } = await supabase
      .from('whatsapp_config')
      .select('access_token, phone_number_id, nome_exibicao')
      .eq('medico_id', medico_id)
      .eq('ativo', true)
      .single()

    if (!config?.access_token) {
      return NextResponse.json({ error: 'WhatsApp nao configurado' }, { status: 400 })
    }

    const agora = new Date()
    const em24h = new Date(agora.getTime() + 24 * 60 * 60 * 1000)
    const em25h = new Date(agora.getTime() + 25 * 60 * 60 * 1000)

    // Busca agendamentos nas proximas 24-25h que ainda nao receberam confirmacao
    const { data: agendamentos } = await supabase
      .from('agendamentos')
      .select('id, data_hora, motivo, status, pacientes(id, nome, telefone)')
      .eq('medico_id', medico_id)
      .eq('status', 'agendado')
      .gte('data_hora', em24h.toISOString())
      .lte('data_hora', em25h.toISOString())

    if (!agendamentos?.length) {
      return NextResponse.json({ enviados: 0, mensagem: 'Nenhum agendamento para confirmar' })
    }

    let enviados = 0
    const clinica = config.nome_exibicao || 'Clinica MedIA'

    for (const ag of agendamentos) {
      const paciente = ag.pacientes as any
      if (!paciente?.telefone) continue

      const nome = paciente.nome?.split(' ')[0] || 'paciente'
      const dataHora = new Date(ag.data_hora).toLocaleString('pt-BR', {
        weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit'
      })

      const mensagem = `Ola, ${nome}! 😊 Aqui e a Sofia da ${clinica}.

Sua consulta esta marcada para *${dataHora}*.

Voce confirma o comparecimento?

*1* - Sim, confirmo
*2* - Preciso remarcar
*3* - Nao poderei comparecer`

      try {
        // Busca ou cria conversa do paciente
        const { data: conversa } = await supabase
          .from('whatsapp_conversas')
          .select('id')
          .eq('telefone', paciente.telefone)
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
              metadata: { confirmacao_agendamento: ag.id }
            })
            await supabase.from('agendamentos').update({ status: 'confirmacao_enviada' }).eq('id', ag.id)
            enviados++
          }
        }
      } catch (e) { console.error('Erro confirmacao:', paciente.telefone, e) }
    }

    return NextResponse.json({ enviados, total: agendamentos.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET - lista agendamentos que precisam de confirmacao
export async function GET(req: NextRequest) {
  const medicoId = req.nextUrl.searchParams.get('medico_id')
  if (!medicoId) return NextResponse.json({ error: 'medico_id obrigatorio' }, { status: 400 })

  const agora = new Date()
  const em48h = new Date(agora.getTime() + 48 * 60 * 60 * 1000)

  const { data } = await supabase
    .from('agendamentos')
    .select('id, data_hora, motivo, status, pacientes(nome, telefone)')
    .eq('medico_id', medicoId)
    .in('status', ['agendado', 'confirmacao_enviada'])
    .gte('data_hora', agora.toISOString())
    .lte('data_hora', em48h.toISOString())
    .order('data_hora')

  return NextResponse.json({ agendamentos: data || [] })
}
