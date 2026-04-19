import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Reutiliza a lógica do webhook simulando uma mensagem recebida
export async function POST(req: NextRequest) {
  try {
    const { conversa_id, telefone, texto, medico_id } = await req.json()
    if (!conversa_id || !telefone || !texto || !medico_id) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 })
    }

    // Busca config do médico
    const { data: config } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('medico_id', medico_id)
      .single()

    if (!config) return NextResponse.json({ error: 'Config não encontrada' }, { status: 404 })

    // Busca histórico da conversa
    const { data: historico } = await supabase
      .from('whatsapp_mensagens')
      .select('tipo, conteudo, criado_em')
      .eq('conversa_id', conversa_id)
      .order('criado_em', { ascending: true })
      .limit(20)

    const msgs = (historico || []).map((m: any) => ({
      role: m.tipo === 'enviada' ? 'assistant' : 'user',
      content: m.conteudo
    }))

    // Chama Claude com o prompt da Sofia
    const promptSofia = config.sofia_instrucoes || 'Você é Sofia, assistente virtual da clínica. Seja cordial e ajude o paciente.'

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: promptSofia,
        messages: [...msgs, { role: 'user', content: texto }]
      })
    })

    const aiData = await anthropicRes.json()
    let resposta = aiData.content?.[0]?.text || 'Desculpe, não entendi. Pode repetir?'

    // Extrai botões se existirem
    const botoesMatch = resposta.match(/\[BOTOES:([^\]]+)\]/)
    const botoes = botoesMatch ? botoesMatch[1].split('|').map((b: string) => b.trim()) : []
    resposta = resposta.replace(/\[BOTOES:[^\]]+\]/g, '').replace(/\[HUMANO\]/g, '').replace(/\[AGENDAR:[^\]]+\]/g, '').trim()

    // Verifica se precisa transferir para humano
    const humano = aiData.content?.[0]?.text?.includes('[HUMANO]')
    if (humano) {
      await supabase.from('whatsapp_conversas').update({ modo: 'humano' }).eq('id', conversa_id)
    }

    // Verifica agendamento
    const agendarMatch = aiData.content?.[0]?.text?.match(/\[AGENDAR:({[^}]+})\]/)
    if (agendarMatch) {
      try {
        const agendarData = JSON.parse(agendarMatch[1])
        const { data: conv } = await supabase.from('whatsapp_conversas').select('paciente_id').eq('id', conversa_id).single()
        await supabase.from('agendamentos').insert({
          medico_id,
          paciente_id: (conv as any)?.paciente_id,
          data_hora: agendarData.data,
          tipo: 'consulta',
          motivo: agendarData.motivo || 'Consulta via WhatsApp',
          status: 'agendado'
        })
      } catch {}
    }

    // Salva resposta da Sofia
    const metadataMsg: any = { ia: true }
    if (botoes.length > 0) metadataMsg.botoes = botoes

    await supabase.from('whatsapp_mensagens').insert({
      conversa_id,
      tipo: 'enviada',
      conteudo: resposta,
      metadata: metadataMsg
    })

    // Envia pelo WhatsApp real
    if (config.token && config.phone_number_id) {
      const wppPayload: any = botoes.length > 0 ? {
        messaging_product: 'whatsapp',
        to: telefone,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: resposta },
          action: { buttons: botoes.slice(0, 3).map((b: string, i: number) => ({ type: 'reply', reply: { id: `btn_${i}`, title: b.substring(0, 20) } })) }
        }
      } : {
        messaging_product: 'whatsapp',
        to: telefone,
        type: 'text',
        text: { body: resposta }
      }

      await fetch(`https://graph.facebook.com/v20.0/${config.phone_number_id}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${config.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(wppPayload)
      })
    }

    await supabase.from('whatsapp_conversas').update({ ultimo_contato: new Date().toISOString() }).eq('id', conversa_id)

    return NextResponse.json({ ok: true, resposta, botoes })
  } catch (e: any) {
    console.error('SIMULAR_ERROR:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
