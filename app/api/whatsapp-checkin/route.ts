import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Chamado por cron job ou manualmente
// Detecta pacientes sem contato ha mais de X dias e envia mensagem
export async function POST(req: NextRequest) {
  try {
    const { medico_id, dias_sem_contato = 7 } = await req.json()
    if (!medico_id) return NextResponse.json({ error: 'medico_id obrigatorio' }, { status: 400 })

    // Busca config do whatsapp do medico
    const { data: config } = await supabase
      .from('whatsapp_config')
      .select('access_token, phone_number_id, nome_exibicao')
      .eq('medico_id', medico_id)
      .eq('ativo', true)
      .single()

    if (!config?.access_token) {
      return NextResponse.json({ error: 'WhatsApp nao configurado' }, { status: 400 })
    }

    const limite = new Date()
    limite.setDate(limite.getDate() - dias_sem_contato)

    // Busca conversas inativas no periodo
    const { data: conversas } = await supabase
      .from('whatsapp_conversas')
      .select('id, telefone, nome_contato, paciente_id, ultimo_contato')
      .eq('medico_id', medico_id)
      .eq('status', 'ativa')
      .eq('modo', 'ia')
      .eq('onboarding_completo', true)
      .lt('ultimo_contato', limite.toISOString())

    if (!conversas?.length) return NextResponse.json({ enviados: 0, mensagem: 'Nenhum paciente inativo' })

    const clinica = config.nome_exibicao || 'Clinica MedIA'
    let enviados = 0

    for (const conv of conversas) {
      const nome = conv.nome_contato?.split(' ')[0] || 'paciente'
      const diasSem = Math.floor((Date.now() - new Date(conv.ultimo_contato).getTime()) / (1000 * 60 * 60 * 24))

      const mensagem = `Oi ${nome}! 👋 Aqui e a Sofia da ${clinica}.

Faz ${diasSem} dias que nao conversamos e queria saber como voce esta! Como tem se sentido?

Posso te ajudar com alguma coisa? 😊`

      try {
        const r = await fetch('https://graph.facebook.com/v20.0/' + config.phone_number_id + '/messages', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + config.access_token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ messaging_product: 'whatsapp', to: conv.telefone, type: 'text', text: { body: mensagem } })
        })
        const d = await r.json()
        if (d.messages?.[0]?.id) {
          await supabase.from('whatsapp_mensagens').insert({
            conversa_id: conv.id, tipo: 'enviada', conteudo: mensagem,
            metadata: { checkin: true, dias_sem_contato: diasSem }
          })
          await supabase.from('whatsapp_conversas').update({ ultimo_contato: new Date().toISOString() }).eq('id', conv.id)
          enviados++
        }
      } catch (e) { console.error('Erro checkin:', conv.telefone, e) }
    }

    return NextResponse.json({ enviados, total: conversas.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET - lista pacientes inativos sem enviar
export async function GET(req: NextRequest) {
  const medicoId = req.nextUrl.searchParams.get('medico_id')
  const dias = parseInt(req.nextUrl.searchParams.get('dias') || '7')
  if (!medicoId) return NextResponse.json({ error: 'medico_id obrigatorio' }, { status: 400 })

  const limite = new Date()
  limite.setDate(limite.getDate() - dias)

  const { data } = await supabase
    .from('whatsapp_conversas')
    .select('id, telefone, nome_contato, ultimo_contato, paciente_id')
    .eq('medico_id', medicoId)
    .eq('status', 'ativa')
    .eq('onboarding_completo', true)
    .lt('ultimo_contato', limite.toISOString())
    .order('ultimo_contato', { ascending: true })

  return NextResponse.json({ inativos: data || [] })
}
