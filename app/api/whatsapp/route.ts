import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'media_whatsapp_2026'

// Valores fixos das env vars - nao depende do banco
const WPP_TOKEN = process.env.WHATSAPP_TOKEN || ''
const WPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID || '1030374870164992'
const MEDICO_ID_FALLBACK = process.env.WHATSAPP_MEDICO_ID || ''

const PROMPT_SOFIA = `Voce e Sofia, assistente da clinica. Seja calorosa e objetiva. Responda SEMPRE em portugues.

REGRA CRITICA - BOTOES OBRIGATORIOS:
Sempre que houver opcoes para o paciente escolher, voce OBRIGATORIAMENTE deve incluir ao final:
[BOTOES: opcao1|opcao2|opcao3]
Maximo 3 botoes. Cada botao com no maximo 20 caracteres. Sem acentos nos botoes.

MENU INICIAL (primeira mensagem ou quando paciente digitar menu/oi/ola):
Ola! Sou a Sofia da clinica. Como posso te ajudar hoje?
[BOTOES: Agendar consulta|Ver agendamentos|Falar com atendente]

FLUXO DE AGENDAMENTO:
1. Perguntar nome completo
2. Perguntar data e horario preferido
3. Confirmar: "Confirma agendamento para [data] as [hora]? [BOTOES: Sim confirmar|Nao cancelar]"
4. Se confirmar: usar [AGENDAR:{"data":"YYYY-MM-DDTHH:mm:00","motivo":"consulta"}]

IDENTIFICACAO:
- Se nao sabe quem e o paciente: perguntar nome e CPF ou email
- Se identificado: chamar pelo nome

OUTRAS REGRAS:
- Para transferir para atendente humano: usar [HUMANO]
- NUNCA dar diagnosticos ou prescrever remedios
- Emergencias: orientar ligar 192 (SAMU)
- Sempre terminar com acao clara para o paciente`Voce e Sofia, assistente virtual da clinica. Seja calorosa, empatica e profissional. Responda SEMPRE em portugues.

IDENTIFICACAO DO PACIENTE:
- Se nao souber quem e o paciente (primeira mensagem ou sem historico de identificacao), pergunte o nome completo e CPF ou email cadastrado
- Quando o paciente informar CPF ou email, o sistema identifica automaticamente. Se identificado, chame-o pelo nome
- Se nao encontrar no cadastro, pergunte se quer se cadastrar como novo paciente

BOTOES INTERATIVOS:
- Quando apresentar opcoes numeradas, use tambem [BOTOES: opcao1|opcao2|opcao3] ao final da mensagem
- Exemplo: "Como posso ajudar? [BOTOES: Agendar consulta|Ver agendamentos|Falar com atendente]"
- Use botoes sempre que o paciente precisar escolher entre opcoes claras (maximo 3 opcoes)
- Nao use botoes para perguntas abertas

Como posso te ajudar hoje?
*1* - Agendar consulta
*2* - Ver meus agendamentos
*3* - Tirar uma duvida
*4* - Falar com atendente

REGRAS:
- Para agendar: use [AGENDAR:{"data":"YYYY-MM-DDTHH:mm:00","motivo":"motivo"}]
- Para transferir: use [HUMANO]
- NUNCA de diagnosticos ou prescreva medicamentos
- Emergencias: ligue 192 (SAMU)`

function normalizarTel(tel: string): string {
  return tel.replace(/[^0-9]/g, '')
}

async function getWppCredentials(medicoId: string): Promise<{token: string, phoneId: string}> {
  try {
    const { data } = await supabaseAdmin.from('whatsapp_config').select('access_token, phone_number_id').eq('medico_id', medicoId).single()
    const token = (data as any)?.access_token || WPP_TOKEN
    const phoneId = (data as any)?.phone_number_id || WPP_PHONE_ID
    return { token, phoneId }
  } catch (e) {
    console.error('getWppCredentials error:', e)
    return { token: WPP_TOKEN, phoneId: WPP_PHONE_ID }
  }
}

async function enviarWpp(para: string, texto: string, token?: string, phoneId?: string) {
  const t = token || WPP_TOKEN
  const pid = phoneId || WPP_PHONE_ID
  try {
    const r = await fetch('https://graph.facebook.com/v20.0/' + pid + '/messages', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + t, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: para, type: 'text', text: { body: texto } })
    })
    const d = await r.json()
    console.log('WPP_SEND:', JSON.stringify(d).substring(0, 100))
    return d
  } catch (e) { console.error('WPP_ERR:', e) }
}

async function reconhecerPaciente(telefone: string, medicoId: string): Promise<any | null> {
  try {
    const tel = normalizarTel(telefone)
    const { data } = await supabaseAdmin
      .from('pacientes')
      .select('id, nome, email, cpf, data_nascimento, telefone, foto_url')
      .eq('medico_id', medicoId)
      .or(`telefone.eq.${tel},telefone.eq.+${tel},telefone.eq.55${tel}`)
      .maybeSingle()
    return data || null
  } catch { return null }
}

async function buscarPacientePorCpfOuEmail(busca: string, medicoId: string): Promise<any | null> {
  try {
    const termo = busca.trim().replace(/[.\-\/]/g, '')
    const { data } = await supabaseAdmin
      .from('pacientes')
      .select('id, nome, email, cpf, telefone, foto_url')
      .eq('medico_id', medicoId)
      .or(`email.ilike.${busca.trim()},cpf.eq.${termo}`)
      .maybeSingle()
    return data || null
  } catch { return null }
}

async function criarPacienteWhatsApp(nome: string, telefone: string, medicoId: string): Promise<any> {
  const tel = normalizarTel(telefone)
  const { data } = await supabaseAdmin
    .from('pacientes')
    .insert({ nome, telefone: tel, medico_id: medicoId })
    .select()
    .single()
  return data
}

async function buscarFotoPaciente(telefone: string, medicoId: string): Promise<string | null> {
  try {
    const tel = normalizarTel(telefone)
    // Busca paciente com esse telefone cadastrado na plataforma
    const { data } = await supabaseAdmin
      .from('pacientes')
      .select('foto_url, telefone')
      .eq('medico_id', medicoId)
      .or(`telefone.eq.${tel},telefone.eq.+${tel},telefone.eq.55${tel}`)
      .maybeSingle()
    return (data as any)?.foto_url || null
  } catch { return null }
}

async function getOuCriarConversa(telefone: string, nome: string, MEDICO_ID: string) {
  const tel = normalizarTel(telefone)
  const { data: existente } = await supabase
    .from('whatsapp_conversas')
    .select('*')
    .eq('telefone', tel)
    .eq('medico_id', MEDICO_ID)
    .maybeSingle()

  if (existente) {
    // Atualiza foto se ainda não tem
    const updates: any = { ultimo_contato: new Date().toISOString(), nome_contato: nome || existente.nome_contato }
    if (!existente.foto_url) {
      const foto = await buscarFotoPaciente(telefone, MEDICO_ID)
      if (foto) updates.foto_url = foto
    }
    await supabase.from('whatsapp_conversas').update(updates).eq('id', existente.id)
    console.log('CONVERSA_EXISTENTE:', existente.id)
    return { ...existente, ...updates }
  }

  const foto = await buscarFotoPaciente(telefone, MEDICO_ID)
  const { data: nova, error } = await supabase.from('whatsapp_conversas').insert({
    telefone: tel, nome_contato: nome || tel,
    medico_id: MEDICO_ID, status: 'ativa', modo: 'ia',
    onboarding_completo: true, onboarding_step: null,
    foto_url: foto || null,
  }).select().single()

  console.log('CONVERSA_NOVA:', nova?.id, 'erro:', error?.message, 'code:', error?.code)
  if (error) {
    // Tenta buscar novamente caso seja conflito de unique
    const { data: retry } = await supabase.from('whatsapp_conversas').select('*').eq('telefone', tel).eq('medico_id', MEDICO_ID).maybeSingle()
    console.log('RETRY_BUSCA:', retry?.id || 'null')
    return retry
  }
  return nova
}

async function getHistorico(conversaId: string) {
  const { data } = await supabase.from('whatsapp_mensagens')
    .select('tipo, conteudo')
    .eq('conversa_id', conversaId)
    .order('criado_em', { ascending: false })
    .limit(15)
  return (data || []).reverse()
}

async function salvarEEnviar(conversaId: string, texto: string, telefone: string, medicoId?: string) {
  await supabase.from('whatsapp_mensagens').insert({
    conversa_id: conversaId, tipo: 'enviada', conteudo: texto, metadata: { ia: true }
  })
  await supabase.from('whatsapp_conversas')
    .update({ ultimo_contato: new Date().toISOString() })
    .eq('id', conversaId)
  const creds = medicoId ? await getWppCredentials(medicoId) : { token: WPP_TOKEN, phoneId: WPP_PHONE_ID }
  await enviarWpp(telefone, texto, creds.token, creds.phoneId)
}

async function processarIA(mensagem: string, historico: any[]) {
  const msgs = historico.slice(-10).map((h: any) => ({
    role: h.tipo === 'recebida' ? 'user' as const : 'assistant' as const,
    content: h.conteudo
  }))
  msgs.push({ role: 'user', content: mensagem })

  const res = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514', max_tokens: 400,
    system: PROMPT_SOFIA, messages: msgs
  })

  const texto = res.content[0].type === 'text' ? res.content[0].text : ''
  const humano = texto.includes('[HUMANO]')
  const agendarMatch = texto.match(/\[AGENDAR:({[^}]+})\]/)

  // Extrai botões [BOTOES: Sim|Não|Talvez]
  const botoesMatch = texto.match(/\[BOTOES:([^\]]+)\]/)
  const botoes = botoesMatch ? botoesMatch[1].split('|').map((b: string) => b.trim()) : []

  return {
    texto: texto.replace(/\[AGENDAR:[^\]]+\]/g, '').replace('[HUMANO]', '').replace(/\[BOTOES:[^\]]+\]/g, '').trim(),
    humano,
    agendarData: agendarMatch ? JSON.parse(agendarMatch[1]) : null,
    botoes,
  }
}

async function getMedicoId(phoneNumberId: string): Promise<string> {
  if (!phoneNumberId) return MEDICO_ID_FALLBACK
  try {
    const { data } = await supabaseAdmin
      .from('whatsapp_config')
      .select('medico_id')
      .eq('phone_number_id', phoneNumberId)
      .maybeSingle()
    console.log('getMedicoId:', phoneNumberId, '->', (data as any)?.medico_id)
    return (data as any)?.medico_id || MEDICO_ID_FALLBACK
  } catch (e) {
    console.error('getMedicoId error:', e)
    return MEDICO_ID_FALLBACK
  }
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  if (p.get('hub.mode') === 'subscribe' && p.get('hub.verify_token') === VERIFY_TOKEN)
    return new NextResponse(p.get('hub.challenge'), { status: 200 })
  return new NextResponse('Forbidden', { status: 403 })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const value = body.entry?.[0]?.changes?.[0]?.value
    if (!value || value.statuses) return NextResponse.json({ ok: true })

    const messages = value?.messages
    if (!messages?.length) return NextResponse.json({ ok: true })

    const phoneNumberId = value.metadata?.phone_number_id
    const MEDICO_ID = await getMedicoId(phoneNumberId)
    if (!MEDICO_ID) { console.log('Nenhum medico para phone_number_id:', phoneNumberId); return NextResponse.json({ ok: true }) }

    console.log('WEBHOOK_OK medico:', MEDICO_ID, 'msgs:', messages.length)

    for (const msg of messages) {
      if (msg.type !== 'text') continue
      const telefone = msg.from
      const texto = msg.text?.body || ''
      const nome = value.contacts?.[0]?.profile?.name || telefone

      console.log('MSG:', telefone, texto.substring(0, 50))

      const conversa = await getOuCriarConversa(telefone, nome, MEDICO_ID)
      if (!conversa) { console.log('ERRO: sem conversa'); continue }

      // Reconhecimento de paciente pelo telefone
      if (!conversa.paciente_id) {
        const pacienteExistente = await reconhecerPaciente(telefone, MEDICO_ID)
        if (pacienteExistente) {
          // Vincula paciente à conversa automaticamente
          await supabaseAdmin.from('whatsapp_conversas').update({
            paciente_id: pacienteExistente.id,
            nome_contato: pacienteExistente.nome,
            foto_url: pacienteExistente.foto_url || conversa.foto_url
          }).eq('id', conversa.id)
          conversa.paciente_id = pacienteExistente.id
          conversa.nome_contato = pacienteExistente.nome
          console.log('PACIENTE_RECONHECIDO:', pacienteExistente.nome)
        } else {
          // Verifica se a mensagem contém CPF ou email para identificar
          const cpfRegex = /\d{3}[\.\-]?\d{3}[\.\-]?\d{3}[\.\-]?\d{2}/
          const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
          const cpfMatch = texto.match(cpfRegex)
          const emailMatch = texto.match(emailRegex)
          if (cpfMatch || emailMatch) {
            const busca = emailMatch ? emailMatch[0] : cpfMatch![0]
            const pacienteBuscado = await buscarPacientePorCpfOuEmail(busca, MEDICO_ID)
            if (pacienteBuscado) {
              // Atualiza telefone e vincula
              await supabaseAdmin.from('pacientes').update({ telefone: normalizarTel(telefone) }).eq('id', pacienteBuscado.id)
              await supabaseAdmin.from('whatsapp_conversas').update({
                paciente_id: pacienteBuscado.id,
                nome_contato: pacienteBuscado.nome,
                foto_url: pacienteBuscado.foto_url || null
              }).eq('id', conversa.id)
              conversa.paciente_id = pacienteBuscado.id
              conversa.nome_contato = pacienteBuscado.nome
              console.log('PACIENTE_IDENTIFICADO_POR_CPF_EMAIL:', pacienteBuscado.nome)
            }
          }
        }
      }

      // Salva mensagem recebida
      await supabase.from('whatsapp_mensagens').insert({
        conversa_id: conversa.id, tipo: 'recebida', conteudo: texto,
        metadata: { wamid: msg.id }
      })

      // Acumula respostas de pre-consulta no proximo agendamento do paciente
      const { data: agPre } = await supabase
        .from('agendamentos')
        .select('id, pre_consulta_contexto')
        .eq('medico_id', MEDICO_ID)
        .eq('pre_consulta_enviada', true)
        .gte('data_hora', new Date().toISOString())
        .order('data_hora')
        .limit(1)
        .maybeSingle()

      if (agPre) {
        const atual = (agPre as any).pre_consulta_contexto || ''
        await supabase.from('agendamentos')
          .update({ pre_consulta_contexto: atual ? atual + '\n' + texto : texto })
          .eq('id', (agPre as any).id)
      }

      // Verifica se tem agendamento com pré-consulta enviada para este paciente
      const { data: agendPreConsulta } = await supabase
        .from('agendamentos')
        .select('id, pre_consulta_contexto')
        .eq('medico_id', MEDICO_ID)
        .eq('pre_consulta_enviada', true)
        .gte('data_hora', new Date().toISOString())
        .order('data_hora')
        .limit(1)
        .maybeSingle()

      if (agendPreConsulta) {
        const contextoAtual = agendPreConsulta.pre_consulta_contexto || ''
        const novoContexto = contextoAtual + (contextoAtual ? '\n' : '') + texto
        await supabase.from('agendamentos')
          .update({ pre_consulta_contexto: novoContexto })
          .eq('id', agendPreConsulta.id)
      }

      if (conversa.modo === 'humano') continue

      const historico = await getHistorico(conversa.id)
      const { texto: resposta, humano, agendarData, botoes } = await processarIA(texto, historico)
      const creds = await getWppCredentials(MEDICO_ID)

      if (agendarData) {
        await supabase.from('agendamentos').insert({
          medico_id: MEDICO_ID, paciente_id: conversa.paciente_id,
          data_hora: agendarData.data, tipo: 'consulta',
          motivo: agendarData.motivo, status: 'agendado'
        })
      }

      if (humano) {
        await supabase.from('whatsapp_conversas').update({ modo: 'humano' }).eq('id', conversa.id)
      }

      // Salva resposta com botões se existirem
      const metadataMsg: any = { ia: true }
      if (botoes && botoes.length > 0) metadataMsg.botoes = botoes

      await supabase.from('whatsapp_mensagens').insert({
        conversa_id: conversa.id, tipo: 'enviada', conteudo: resposta,
        metadata: metadataMsg
      })
      await supabase.from('whatsapp_conversas').update({ ultimo_contato: new Date().toISOString() }).eq('id', conversa.id)
      const creds2 = await getWppCredentials(MEDICO_ID)
      await enviarWpp(telefone, resposta, creds2.token, creds2.phoneId)
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('WEBHOOK_ERROR:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
