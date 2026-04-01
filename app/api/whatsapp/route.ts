import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
console.log('SUPABASE_KEY_TYPE:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE_ROLE' : 'ANON')
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseKey
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'media_whatsapp_2026'

const ONBOARDING_STEPS = ['nome', 'nascimento', 'sexo', 'sintoma', 'convenio']

const ONBOARDING_PERGUNTAS: Record<string, string> = {
  nome: 'Ola! Sou a Sofia, assistente virtual da clinica. Para comecar, qual o seu *nome completo*?',
  nascimento: 'Qual a sua *data de nascimento*? (Ex: 15/03/1985)',
  sexo: 'Qual o seu *sexo biologico*?\n\n*1* - Masculino\n*2* - Feminino',
  sintoma: 'Qual o *principal motivo* da sua visita ou duvida hoje?',
  convenio: 'Voce possui *convenio medico*?\n\n*1* - Nao (particular)\n*2* - Sim (me diga qual)',
}

const PROMPT_SOFIA = `Voce e Sofia, assistente virtual inteligente da clinica. Seja calorosa, profissional e acolhedora. Use o nome do paciente. Responda SEMPRE em portugues. Maximo 3 paragrafos.

MENU PRINCIPAL (quando paciente nao souber o que quer):
Como posso te ajudar hoje?
*1* - Agendar consulta
*2* - Ver meus agendamentos
*3* - Cancelar ou remarcar
*4* - Tirar uma duvida
*5* - Falar com atendente

REGRAS:
- Para agendar: use [AGENDAR:{"data":"YYYY-MM-DDTHH:mm:00","motivo":"motivo"}]
- Para transferir: use [HUMANO]
- NUNCA de diagnosticos ou prescreva medicamentos
- Emergencias: "Ligue 192 (SAMU) ou va ao pronto-socorro"
- Use contexto do historico do paciente para personalizar respostas`

async function getConfig(phoneNumberId: string) {
  const { data } = await supabase.from('whatsapp_config').select('*').eq('phone_number_id', phoneNumberId).eq('ativo', true).single()
  return data
}

async function enviarWpp(para: string, texto: string, token: string, phoneId: string) {
  try {
    const r = await fetch('https://graph.facebook.com/v20.0/' + phoneId + '/messages', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: para, type: 'text', text: { body: texto } })
    })
    return await r.json()
  } catch (e) { console.error('Erro WPP:', e); throw e }
}

async function getOuCriarConversa(telefone: string, nome: string, medicoId: string | null) {
  let query = supabase.from('whatsapp_conversas').select('*').eq('telefone', telefone)
  if (medicoId) query = query.eq('medico_id', medicoId)
  const { data: existente } = await query.maybeSingle()

  if (existente) {
    await supabase.from('whatsapp_conversas').update({ ultimo_contato: new Date().toISOString(), nome_contato: nome || existente.nome_contato }).eq('id', existente.id)
    return existente
  }

  const { data: paciente } = medicoId
    ? await supabase.from('pacientes').select('id').eq('telefone', telefone).eq('medico_id', medicoId).maybeSingle()
    : { data: null }

  const isNovo = !paciente
  const { data: nova } = await supabase.from('whatsapp_conversas').insert({
    telefone, nome_contato: nome || telefone,
    paciente_id: paciente?.id, medico_id: medicoId,
    status: 'ativa', modo: 'ia',
    onboarding_completo: !isNovo,
    onboarding_step: isNovo ? 'nome' : null,
    onboarding_dados: isNovo ? {} : null,
  }).select().single()
  return nova
}

async function getHistorico(conversaId: string) {
  const { data } = await supabase.from('whatsapp_mensagens').select('tipo, conteudo').eq('conversa_id', conversaId).order('criado_em', { ascending: false }).limit(20)
  return (data || []).reverse()
}

async function getContextoPaciente(pacienteId: string, medicoId: string | null) {
  const [{ data: paciente }, { data: consultas }, { data: agendamentos }] = await Promise.all([
    supabase.from('pacientes').select('nome, data_nascimento, sexo, alergias, comorbidades, convenio').eq('id', pacienteId).single(),
    supabase.from('consultas').select('data_hora, transcricao, prontuario').eq('paciente_id', pacienteId).order('data_hora', { ascending: false }).limit(3),
    supabase.from('agendamentos').select('data_hora, motivo, status').eq('paciente_id', pacienteId).gte('data_hora', new Date().toISOString()).order('data_hora').limit(3),
  ])
  return { paciente, consultas: consultas || [], agendamentos: agendamentos || [] }
}

async function getHorariosDisponiveis(medicoId: string) {
  const agora = new Date()
  const em7dias = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000)
  const { data: ocupados } = await supabase.from('agendamentos').select('data_hora').eq('medico_id', medicoId).gte('data_hora', agora.toISOString()).lte('data_hora', em7dias.toISOString()).neq('status', 'cancelado')
  const ocupadosSet = new Set((ocupados || []).map((a: any) => a.data_hora.substring(0, 16)))
  const horarios: string[] = []
  for (let d = 1; d <= 7; d++) {
    const dia = new Date(agora); dia.setDate(dia.getDate() + d)
    if (dia.getDay() === 0) continue
    for (const hora of [8, 9, 10, 11, 14, 15, 16, 17]) {
      dia.setHours(hora, 0, 0, 0)
      if (!ocupadosSet.has(dia.toISOString().substring(0, 16))) {
        horarios.push(dia.toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }))
        if (horarios.length >= 6) break
      }
    }
    if (horarios.length >= 6) break
  }
  return horarios
}

async function transcreverAudio(mediaId: string, token: string): Promise<string> {
  try {
    const mediaRes = await fetch('https://graph.facebook.com/v20.0/' + mediaId, { headers: { 'Authorization': 'Bearer ' + token } })
    const mediaData = await mediaRes.json()
    if (!mediaData.url) return ''
    const audioRes = await fetch(mediaData.url, { headers: { 'Authorization': 'Bearer ' + token } })
    const audioBuffer = await audioRes.arrayBuffer()
    const audioBlob = new Blob([audioBuffer], { type: mediaData.mime_type || 'audio/ogg' })
    const formData = new FormData()
    formData.append('file', audioBlob, 'audio.ogg')
    formData.append('model', 'whisper-1')
    formData.append('language', 'pt')
    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY }, body: formData
    })
    const whisperData = await whisperRes.json()
    return whisperData.text || ''
  } catch (e) { console.error('Erro transcricao:', e); return '' }
}

function parseDataNascimento(str: string): string | null {
  if (!str) return null
  try {
    const parts = str.replace(/[\/\-\.]/g, '/').split('/')
    if (parts.length === 3) {
      const [d, m, a] = parts
      return `${a.length === 2 ? '19' + a : a}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
    }
  } catch {}
  return null
}

async function temMensagensEnviadas(conversaId: string): Promise<boolean> {
  const { data } = await supabase.from('whatsapp_mensagens').select('id').eq('conversa_id', conversaId).eq('tipo', 'enviada').limit(1)
  return (data?.length || 0) > 0
}

async function salvarEEnviar(conversaId: string, texto: string, telefone: string, token: string, phoneId: string, meta?: any) {
  await supabase.from('whatsapp_mensagens').insert({ conversa_id: conversaId, tipo: 'enviada', conteudo: texto, metadata: meta || {} })
  await supabase.from('whatsapp_conversas').update({ ultimo_contato: new Date().toISOString() }).eq('id', conversaId)
  await enviarWpp(telefone, texto, token, phoneId)
}

async function processarOnboarding(conversa: any, resposta: string, medicoId: string | null) {
  const step = conversa.onboarding_step
  const dados = conversa.onboarding_dados || {}

  if (step === 'nome') dados.nome = resposta.trim()
  else if (step === 'nascimento') dados.nascimento = resposta.trim()
  else if (step === 'sexo') dados.sexo = resposta.includes('1') || resposta.toLowerCase().includes('masc') ? 'M' : 'F'
  else if (step === 'sintoma') dados.sintoma = resposta.trim()
  else if (step === 'convenio') dados.convenio = resposta.includes('1') || resposta.toLowerCase().includes('nao') ? 'Particular' : resposta.replace(/^2[\s-]*/, '').trim()

  const currentIdx = ONBOARDING_STEPS.indexOf(step)
  const nextStep = ONBOARDING_STEPS[currentIdx + 1]

  if (nextStep) {
    await supabase.from('whatsapp_conversas').update({ onboarding_step: nextStep, onboarding_dados: dados }).eq('id', conversa.id)
    let pergunta = ONBOARDING_PERGUNTAS[nextStep]
    if (nextStep === 'sintoma') pergunta = `Obrigada, ${dados.nome?.split(' ')[0]}! ` + pergunta
    return pergunta
  }

  let pacienteId = conversa.paciente_id
  if (!pacienteId && medicoId) {
    const { data: novoPaciente } = await supabase.from('pacientes').insert({
      medico_id: medicoId, nome: dados.nome || conversa.nome_contato,
      telefone: conversa.telefone, data_nascimento: parseDataNascimento(dados.nascimento),
      sexo: dados.sexo, convenio: dados.convenio || 'Particular',
      observacoes: `Primeiro contato via WhatsApp. Motivo: ${dados.sintoma || 'Nao informado'}`,
    }).select('id').single()
    pacienteId = novoPaciente?.id
  }

  await supabase.from('whatsapp_conversas').update({
    onboarding_completo: true, onboarding_step: null,
    onboarding_dados: dados, paciente_id: pacienteId,
  }).eq('id', conversa.id)

  const nome = dados.nome?.split(' ')[0] || 'paciente'
  return `Perfeito, ${nome}! Seus dados foram cadastrados com sucesso \n\nAgora posso te ajudar muito melhor! O que voce precisa?\n\n*1* - Agendar consulta\n*2* - Tirar uma duvida\n*3* - Falar com atendente`
}

async function processarIA(mensagem: string, historico: any[], contexto: any, config: any) {
  const prompt = config?.sofia_prompt || PROMPT_SOFIA
  const nomeClinica = config?.nome_exibicao || 'Clinica MedIA'
  const paciente = contexto?.paciente
  const consultas = contexto?.consultas || []
  const agendamentos = contexto?.agendamentos || []
  const horarios = contexto?.horarios || []

  let contextStr = `Clinica: ${nomeClinica}\n`
  if (paciente) {
    contextStr += `Paciente: ${paciente.nome}`
    if (paciente.data_nascimento) {
      const idade = Math.floor((Date.now() - new Date(paciente.data_nascimento).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      contextStr += ` (${idade} anos)`
    }
    if (paciente.convenio) contextStr += ` | Convenio: ${paciente.convenio}`
    if (paciente.alergias) contextStr += `\nAlergias: ${paciente.alergias}`
    if (paciente.comorbidades) contextStr += `\nComorbidades: ${paciente.comorbidades}`
    contextStr += '\n'
  }
  if (consultas.length) {
    contextStr += `\nUltimas consultas:\n`
    consultas.forEach((c: any) => {
      const data = new Date(c.data_hora).toLocaleDateString('pt-BR')
      const resumo = c.prontuario?.avaliacao || (c.transcricao || '').substring(0, 100)
      contextStr += `- ${data}: ${resumo}\n`
    })
  }
  if (agendamentos.length) {
    contextStr += `\nProximos agendamentos:\n`
    agendamentos.forEach((a: any) => { contextStr += `- ${new Date(a.data_hora).toLocaleString('pt-BR')}: ${a.motivo}\n` })
  }
  if (horarios.length) contextStr += `\nHorarios disponiveis: ${horarios.join(', ')}\n`

  const system = prompt + `\n\nCONTEXTO:\n${contextStr}`
  const msgs = historico.slice(-15).map((h: any) => ({ role: h.tipo === 'recebida' ? 'user' as const : 'assistant' as const, content: h.conteudo }))
  msgs.push({ role: 'user', content: mensagem })

  const res = await anthropic.messages.create({ model: 'claude-opus-4-5', max_tokens: 500, system, messages: msgs })
  const texto = res.content[0].type === 'text' ? res.content[0].text : ''
  const agendarMatch = texto.match(/\[AGENDAR:({[^}]+})\]/)
  const humano = texto.includes('[HUMANO]')
  const alertas = ['emergencia', 'urgente', 'muito mal', 'dor forte', 'piorou muito', 'desmaiei', 'febre alta', 'parei de tomar', 'abandonei']
  const temRisco = alertas.some(a => mensagem.toLowerCase().includes(a))

  return {
    texto: texto.replace(/\[AGENDAR:[^\]]+\]/g, '').replace('[HUMANO]', '').trim(),
    agendarData: agendarMatch ? JSON.parse(agendarMatch[1]) : null,
    humano, temRisco,
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
    console.log('WPP_PAYLOAD:', JSON.stringify(body).substring(0, 500))
    const value = body.entry?.[0]?.changes?.[0]?.value
    if (value?.statuses) { console.log('WPP_STATUS descartado'); return NextResponse.json({ ok: true }) }
    const messages = value?.messages
    if (!messages?.length) { console.log('WPP_SEM_MESSAGES value:', JSON.stringify(value).substring(0,300)); return NextResponse.json({ ok: true }) }

    const phoneNumberId = value?.metadata?.phone_number_id
    const config = await getConfig(phoneNumberId)
    const token = config?.access_token || process.env.WHATSAPP_TOKEN || ''
    const phoneId = config?.phone_number_id || phoneNumberId || process.env.WHATSAPP_PHONE_ID || ''
    const medicoId = config?.medico_id || null

    console.log('WPP_MESSAGES count:', messages.length, 'tipos:', messages.map((m:any)=>m.type))
    for (const msg of messages) {
      const telefone = msg.from
      const nomeContato = value.contacts?.[0]?.profile?.name || telefone
      let textoMensagem = ''
      const tipoOriginal = msg.type

      if (msg.type === 'text') {
        textoMensagem = msg.text?.body || ''
      } else if (msg.type === 'audio' || msg.type === 'voice') {
        const mediaId = msg.audio?.id || msg.voice?.id
        if (mediaId && token) {
          textoMensagem = await transcreverAudio(mediaId, token)
          if (!textoMensagem) {
            const conversa = await getOuCriarConversa(telefone, nomeContato, medicoId)
            if (conversa) await salvarEEnviar(conversa.id, 'Desculpe, nao consegui entender o audio. Pode digitar sua mensagem?', telefone, token, phoneId)
            continue
          }
        }
      } else {
        continue
      }

      if (!textoMensagem) continue
      const conversa = await getOuCriarConversa(telefone, nomeContato, medicoId)
      if (!conversa) continue

      await supabase.from('whatsapp_mensagens').insert({
        conversa_id: conversa.id, tipo: 'recebida', conteudo: textoMensagem,
        metadata: { wamid: msg.id, timestamp: msg.timestamp, tipo_original: tipoOriginal }
      })

      if (conversa.modo === 'humano') continue
      if (config?.sofia_ativo === false) continue

      if (!conversa.onboarding_completo && conversa.onboarding_step) {
        const jaEnviou = await temMensagensEnviadas(conversa.id)
        if (!jaEnviou) {
          await salvarEEnviar(conversa.id, ONBOARDING_PERGUNTAS['nome'], telefone, token, phoneId)
          continue
        }
        const respOnboarding = await processarOnboarding(conversa, textoMensagem, medicoId)
        await salvarEEnviar(conversa.id, respOnboarding, telefone, token, phoneId)
        continue
      }

      const [historico, contextoCompleto, horarios] = await Promise.all([
        getHistorico(conversa.id),
        conversa.paciente_id ? getContextoPaciente(conversa.paciente_id, medicoId) : Promise.resolve(null),
        medicoId ? getHorariosDisponiveis(medicoId) : Promise.resolve([]),
      ])

      const { texto: resposta, agendarData, humano, temRisco } = await processarIA(
        textoMensagem, historico, { ...contextoCompleto, horarios }, config
      )

      if (agendarData && medicoId) {
        await supabase.from('agendamentos').insert({
          medico_id: medicoId, paciente_id: conversa.paciente_id,
          data_hora: agendarData.data, tipo: 'consulta',
          motivo: agendarData.motivo, status: 'agendado'
        })
      }

      if (humano) await supabase.from('whatsapp_conversas').update({ modo: 'humano' }).eq('id', conversa.id)

      if (temRisco && conversa.paciente_id) {
        try { await supabase.from('whatsapp_alertas').insert({ conversa_id: conversa.id, paciente_id: conversa.paciente_id, medico_id: medicoId, mensagem: textoMensagem, nivel: 'atencao', lido: false }) } catch (_e) {}
      }

      // Captura resposta de NPS (numero de 0 a 10)
      const notaNps = textoMensagem.trim().match(/^([0-9]|10)$/)
      if (notaNps && conversa.paciente_id) {
        try {
          await supabase.from('whatsapp_nps').insert({
            conversa_id: conversa.id, paciente_id: conversa.paciente_id,
            medico_id: medicoId, nota: parseInt(notaNps[1])
          })
        } catch (_e) {}
      }

      await salvarEEnviar(conversa.id, resposta, telefone, token, phoneId, { ia: true, agendou: !!agendarData })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('Webhook error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
