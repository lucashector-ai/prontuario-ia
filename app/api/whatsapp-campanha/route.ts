import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function enviarWpp(para: string, texto: string, token: string, phoneId: string) {
  const r = await fetch('https://graph.facebook.com/v20.0/' + phoneId + '/messages', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: para, type: 'text', text: { body: texto } })
  })
  return r.json()
}

// POST - dispara campanha
export async function POST(req: NextRequest) {
  try {
    const { medico_id, mensagem, filtro } = await req.json()
    // filtro: { convenio?, dias_sem_consulta?, tag? }

    if (!medico_id || !mensagem) {
      return NextResponse.json({ error: 'medico_id e mensagem obrigatorios' }, { status: 400 })
    }

    const { data: config } = await supabase
      .from('whatsapp_config')
      .select('access_token, phone_number_id')
      .eq('medico_id', medico_id)
      .eq('ativo', true)
      .single()

    if (!config?.access_token) {
      return NextResponse.json({ error: 'WhatsApp nao configurado' }, { status: 400 })
    }

    // Busca conversas ativas com onboarding completo
    let query = supabase
      .from('whatsapp_conversas')
      .select('id, telefone, nome_contato, paciente_id')
      .eq('medico_id', medico_id)
      .eq('status', 'ativa')
      .eq('onboarding_completo', true)

    const { data: conversas } = await query

    if (!conversas?.length) {
      return NextResponse.json({ enviados: 0, mensagem: 'Nenhum destinatario encontrado' })
    }

    let enviados = 0
    const erros: string[] = []

    for (const conv of conversas) {
      const nome = conv.nome_contato?.split(' ')[0] || 'paciente'
      const msgPersonalizada = mensagem.replace('{{nome}}', nome)

      try {
        const d = await enviarWpp(conv.telefone, msgPersonalizada, config.access_token, config.phone_number_id)
        if (d.messages?.[0]?.id) {
          await supabase.from('whatsapp_mensagens').insert({
            conversa_id: conv.id, tipo: 'enviada', conteudo: msgPersonalizada,
            metadata: { campanha: true, medico_id }
          })
          await supabase.from('whatsapp_conversas').update({ ultimo_contato: new Date().toISOString() }).eq('id', conv.id)
          enviados++
        }
      } catch (e: any) {
        erros.push(conv.telefone + ': ' + e.message)
      }
    }

    // Salva log da campanha
    await supabase.from('whatsapp_campanhas').insert({
      medico_id, mensagem, filtro: filtro || {},
      total_enviado: enviados, total_destino: conversas.length,
      status: 'concluida'
    })

    return NextResponse.json({ enviados, total: conversas.length, erros })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET - lista campanhas anteriores
export async function GET(req: NextRequest) {
  const medicoId = req.nextUrl.searchParams.get('medico_id')
  if (!medicoId) return NextResponse.json({ error: 'medico_id obrigatorio' }, { status: 400 })

  const { data } = await supabase
    .from('whatsapp_campanhas')
    .select('*')
    .eq('medico_id', medicoId)
    .order('criado_em', { ascending: false })
    .limit(20)

  return NextResponse.json({ campanhas: data || [] })
}
