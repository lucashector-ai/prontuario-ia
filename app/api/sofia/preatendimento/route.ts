import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { iniciarPreAtendimento } from '@/lib/sofia/preatendimento'
import { getSofiaConfig } from '@/lib/sofia/config'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const WPP_TOKEN = process.env.WHATSAPP_TOKEN || ''
const WPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID || '1030374870164992'

async function getWppCredentials(medico_id: string) {
  const { data } = await supabase.from('whatsapp_config').select('access_token, phone_number_id').eq('medico_id', medico_id).maybeSingle()
  return { token: (data as any)?.access_token || WPP_TOKEN, phoneId: (data as any)?.phone_number_id || WPP_PHONE_ID }
}

async function enviarWppBotoes(para: string, texto: string, botoes: string[], token: string, phoneId: string) {
  const body = {
    messaging_product: 'whatsapp', to: para, type: 'interactive',
    interactive: {
      type: 'button', body: { text: texto },
      action: { buttons: botoes.slice(0, 3).map((b, i) => ({ type: 'reply', reply: { id: `btn_${i}`, title: b.substring(0, 20) } })) }
    }
  }
  const r = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  return r.json()
}

export async function POST(req: NextRequest) {
  try {
    const { agendamento_id } = await req.json()
    if (!agendamento_id) return NextResponse.json({ error: 'agendamento_id obrigatorio' }, { status: 400 })

    // Busca agendamento + paciente
    const { data: ag } = await supabase
      .from('agendamentos')
      .select('*, pacientes(id, nome, telefone)')
      .eq('id', agendamento_id)
      .single()

    if (!ag) return NextResponse.json({ error: 'agendamento nao encontrado' }, { status: 404 })
    if (!ag.pacientes?.telefone) return NextResponse.json({ error: 'paciente sem telefone' }, { status: 400 })

    const cfg = await getSofiaConfig(ag.medico_id)
    if (!cfg.pre_atendimento_ativo) {
      return NextResponse.json({ error: 'pre-atendimento desativado nas configuracoes' }, { status: 400 })
    }

    // Busca/cria conversa
    const tel = ag.pacientes.telefone.replace(/[^0-9]/g, '')
    const { data: conversa } = await supabase
      .from('whatsapp_conversas')
      .select('*')
      .eq('telefone', tel)
      .eq('medico_id', ag.medico_id)
      .maybeSingle()

    if (!conversa) return NextResponse.json({ error: 'sem conversa ativa com este paciente' }, { status: 400 })

    // Cria pré-consulta adaptativa
    const pre = await iniciarPreAtendimento({
      medico_id: ag.medico_id,
      paciente_id: ag.paciente_id,
      agendamento_id: ag.id,
      conversa_id: conversa.id,
      motivo_consulta: ag.motivo || 'consulta',
      prompt_extra: cfg.pre_atendimento_prompt_extra,
    })

    if (!pre) return NextResponse.json({ error: 'falha ao criar pre-consulta' }, { status: 500 })

    // Pergunta permissão no WhatsApp
    const creds = await getWppCredentials(ag.medico_id)
    const msg = `Olá ${ag.pacientes.nome.split(' ')[0]}! Você tem consulta marcada. Posso te fazer ${pre.perguntas.length} perguntas rápidas agora para agilizar seu atendimento?`
    const botoes = ['Pode sim', 'Agora não']

    await supabase.from('whatsapp_mensagens').insert({
      conversa_id: conversa.id, tipo: 'enviada', conteudo: msg, metadata: { ia: true, pre_consulta: true, botoes }
    })

    await enviarWppBotoes(tel, msg, botoes, creds.token, creds.phoneId)

    // Atualiza flag no agendamento
    await supabase.from('agendamentos').update({ pre_consulta_enviada: true }).eq('id', ag.id)

    return NextResponse.json({ ok: true, pre_consulta_id: pre.id, total_perguntas: pre.perguntas.length })
  } catch (e: any) {
    console.error('preatendimento/iniciar erro:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
