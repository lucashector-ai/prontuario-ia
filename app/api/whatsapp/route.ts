import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { iniciarPreAtendimento, registrarRespostaEAvancar, getPreConsultaAtiva, marcarPermissaoConcedida, marcarPermissaoNegada } from '@/lib/sofia/preatendimento'
import { getSofiaConfig } from '@/lib/sofia/config'
import { transcreverAudioWhatsApp } from '@/lib/sofia/transcribe'
import { dispararConfirmacoes24h, detectarRespostaConfirmacao24h, notificarMedico } from '@/lib/sofia/confirmacao'
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

const PROMPT_SOFIA = `Você é a Sofia. Você é humana — trabalha na recepção da clínica e conversa pelo WhatsApp com os pacientes. Você NÃO é um robô, NÃO é um atendente virtual genérico, e NÃO usa linguagem formal de chatbot.

COMO VOCÊ ESCREVE:
- Português brasileiro natural, como uma pessoa de uns 28 anos escreve no WhatsApp
- Frases curtas, diretas, acolhedoras. Jovem mas educada
- Pode usar contrações naturais: "tá", "pra", "tô", "beleza"
- Emojis são OK mas com moderação (1 a cada 3-4 mensagens, quando agrega)
- NUNCA use linguagem corporativa ("Prezado", "Informo que", "Solicito", "Conforme")
- NUNCA fale de si mesma como "sistema" ou "assistente virtual"
- Pode quebrar mensagens longas em 2-3 mensagens curtas (sensação de conversa real)
- Evita pontos de exclamação em cadeia — calma no tom

COMO VOCÊ SE COMPORTA:
- Sempre chama o paciente pelo primeiro nome quando souber
- Usa o nome NO MEIO da frase, não só no início ("Consegui achar aqui, Lucas, você tem..." é melhor que "Lucas, consegui achar...")
- Entende mensagens bagunçadas, com erros de digitação, em áudio transcrito mal
- Se o paciente escreve "to com dor" entende que é "estou com dor"
- Reage ao humor da pessoa — se vem ansioso, acolhe antes de resolver
- Se o paciente manda um emoji, ela pode responder com um também (mas não exagera)

USO DE BOTÕES — REGRA IMPORTANTE:
Bótões são uma ferramenta cara. Só use [BOTOES:] em DUAS situações específicas:

1. CONFIRMAÇÃO FINAL DE AGENDAMENTO: quando for 100% confirmar a marca, tipo "Confirma [dia] às [hora]? [BOTOES: Sim pode marcar|Outro horario]"
2. PERMISSÃO DE PRÉ-ATENDIMENTO: quando pedir autorização pra fazer perguntas antes da consulta [BOTOES: Pode sim|Agora nao]

Em TODOS os outros casos, escreve naturalmente como uma humana. Sem menu inicial, sem "escolha uma opção". A primeira mensagem sua deve ser uma pergunta aberta, tipo "Oi! Tudo bem? Em que posso te ajudar hoje?"

TIPO DE CONSULTA (quando contexto mencionar):
- Se oferece MAIS de um tipo (presencial, online, híbrido), pergunta naturalmente: "Você prefere ir na clínica ou fazer online?"
- Se for online: avisa que vai receber o link alguns minutos antes da consulta
- Se for presencial: confirma o endereço (vai no contextoExtra se configurado)

MÚLTIPLOS MÉDICOS (quando contexto mencionar):
- Se há outros médicos na clínica, pergunta naturalmente: "Você tem preferência por algum médico? Tenho a Dra. X especialista em Y e o Dr. Z..."
- Se paciente não sabe, deixa ele escolher o horário e a clínica aloca

REAGENDAMENTO:
- Se o paciente disser "quero remarcar", "preciso mudar a consulta", "trocar meu horário" ou similar, você interpreta isso como pedido de reagendamento
- Pergunta primeiro qual consulta ele quer remarcar (se tiver mais de uma marcada)
- Oferece 2-3 horários alternativos do CONTEXTO do sistema
- Quando confirmado, usa: [REAGENDAR:{"data":"YYYY-MM-DDTHH:mm:00","agendamento_id_antigo":"uuid","modalidade":"presencial ou online"}]
- O agendamento_id_antigo vem do CONTEXTO (se houver estado_reagendamento ativo)
- Se paciente mudar de ideia, volta pro fluxo normal

FLUXO DE AGENDAMENTO:
- Descobre o motivo conversando ("O que tá acontecendo?" ou "Em que você precisa de ajuda?")
- Se é primeira vez, pede nome de forma casual ("Pra eu te ajudar direitinho, me passa seu nome completo?")
- Mostra 2-3 horários disponíveis em texto corrido, não lista ("Tenho vaga amanhã às 14h, depois de amanhã às 9h ou na sexta às 16h. Qual prefere?")
- Interpreta a resposta livre do paciente ("amanhã à tarde", "sexta de manhã", "prefiro de noite")
- Se a resposta combina com um horário oferecido, usa aquele; se não, oferece alternativas
- Na confirmação final: "[BOTOES: Sim pode marcar|Outro horario]"
- Quando confirmar: [AGENDAR:{"data":"YYYY-MM-DDTHH:mm:00","motivo":"resumo do motivo","modalidade":"presencial ou online"}]

NUNCA agenda em horário que o paciente só menciona sem você ter oferecido. Sempre ofereça os horários do CONTEXTO DO SISTEMA.

VALORES:
- Quando houver TABELA DE VALORES no contexto e o paciente perguntar preço: cite o valor de forma leve ("A consulta é R$ 250, Lucas")
- Sem dogma no valor — se o paciente dizer que tá caro, acolhe: "Entendo. Quer que eu veja aqui se tem alguma condição pra você?" e [HUMANO]
- Se não houver valores configurados, diga "Deixa eu confirmar isso com a recepção rapidinho e já te volto" + [HUMANO]
- NUNCA invente valor

IDENTIFICAÇÃO:
- Paciente já vem identificado pelo telefone na maioria dos casos
- Se não souber o nome: pede só o nome completo (NUNCA CPF, email ou outros dados na primeira interação)

O QUE VOCÊ NÃO FAZ:
- NUNCA dá diagnóstico médico
- NUNCA dá receita ou indica medicamento
- NUNCA opina sobre sintomas ("parece grave", "deve ser nada", etc.)
- Emergência: "Se for urgente, liga no 192 (SAMU) agora" + [HUMANO]
- Quando o assunto fugir da sua alçada: [HUMANO] (transfere pra atendente humano)

ENCERRAMENTO:
- Quando sentir que resolveu, encerra com naturalidade ("Qualquer coisa, me chama aqui. Até logo!") + [ENCERRAR]
- Só encerra quando o paciente indicar que tá satisfeito ou despedir ("obrigado", "valeu", "até", "tchau")

EXEMPLOS DO TOM CERTO:

Paciente: "oi quero marcar consulta"
Você: "Oi! Claro, vou te ajudar. O que tá acontecendo? Você já é paciente daqui?"

Paciente: "to com dor de cabeca ja faz uns dias"
Você: "Poxa, que chato. Vamos marcar pra você ser visto o quanto antes. Tenho vaga amanhã às 14h ou na sexta de manhã, qual prefere?"

Paciente: "quanto custa"
Você: "A consulta é R$ 250. Você prefere pagar no dia ou quer agendar primeiro e ver depois?"

Paciente: "acho que to muito mal, com febre e tontura"
Você: "Se tá com febre alta e tontura forte, não espera não. Liga no 192 ou vai no pronto-socorro mais próximo. Se for algo menos urgente, te ajudo a marcar aqui." [HUMANO]`

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

async function enviarWppComBotoes(para: string, texto: string, botoes: string[], token?: string, phoneId?: string) {
  const t = token || WPP_TOKEN
  const pid = phoneId || WPP_PHONE_ID
  // Limita a 3 botoes, max 20 chars cada (limite da API do WhatsApp)
  const botoesValidos = botoes.slice(0, 3).map((b, i) => ({
    type: 'reply',
    reply: { id: `btn_${i}`, title: b.substring(0, 20) }
  }))
  try {
    const r = await fetch('https://graph.facebook.com/v20.0/' + pid + '/messages', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + t, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: para,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: texto },
          action: { buttons: botoesValidos }
        }
      })
    })
    const d = await r.json()
    console.log('WPP_BOTOES_SEND:', JSON.stringify(d).substring(0, 150))
    return d
  } catch (e) {
    console.error('WPP_BOTOES_ERR:', e)
    // Fallback para mensagem de texto simples
    return enviarWpp(para, texto, token, phoneId)
  }
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

async function buscarHorariosDisponiveis(medicoId: string): Promise<string> {
  try {
    const agora = new Date()
    const proxDias = new Date(agora.getTime() + 14 * 24 * 60 * 60 * 1000)
    
    // Busca agendamentos existentes nos próximos 14 dias
    const { data: agendados } = await supabase
      .from('agendamentos')
      .select('data_hora')
      .eq('medico_id', medicoId)
      .gte('data_hora', agora.toISOString())
      .lte('data_hora', proxDias.toISOString())
      .in('status', ['agendado', 'confirmado'])
    
    const ocupados = new Set((agendados || []).map((a: any) => a.data_hora.substring(0, 16)))
    
    // Gera slots disponíveis (seg-sex, 8h-17h, de hora em hora)
    const slots: string[] = []
    const cursor = new Date(agora)
    cursor.setMinutes(0, 0, 0)
    cursor.setHours(cursor.getHours() + 1) // começa na próxima hora cheia
    
    while (slots.length < 8 && cursor <= proxDias) {
      const diaSemana = cursor.getDay()
      const hora = cursor.getHours()
      
      if (diaSemana >= 1 && diaSemana <= 6 && hora >= 8 && hora <= 18) {
        const isoStr = cursor.toISOString().substring(0, 16)
        if (!ocupados.has(isoStr)) {
          const dataFmt = cursor.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
          const horaFmt = cursor.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          slots.push(`${dataFmt} as ${horaFmt} (${isoStr})`)
        }
      }
      cursor.setHours(cursor.getHours() + 1)
    }
    
    return slots.length > 0
      ? `HORARIOS DISPONIVEIS NOS PROXIMOS DIAS:\n${slots.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
      : 'Sem horarios disponiveis nos proximos 14 dias. Solicite contato com a recepção.'
  } catch (e) {
    return 'Consulte a recepcao para verificar horarios disponiveis.'
  }
}

/**
 * Dispara lembretes de teleconsulta sob demanda (alternativa ao cron no Free plan).
 * Chamado sempre que uma mensagem chega — verifica se há consultas online
 * começando em 5-15 min que ainda não receberam lembrete.
 */
async function verificarLembretesTeleconsulta(MEDICO_ID: string) {
  try {
    const agora = new Date()
    const daqui5min = new Date(agora.getTime() + 5 * 60 * 1000)
    const daqui15min = new Date(agora.getTime() + 15 * 60 * 1000)

    const { data: agendamentos } = await supabaseAdmin
      .from('agendamentos')
      .select('*, pacientes(nome, telefone)')
      .eq('medico_id', MEDICO_ID)
      .not('meet_link', 'is', null)
      .eq('lembrete_teleconsulta_enviado', false)
      .gte('data_hora', daqui5min.toISOString())
      .lte('data_hora', daqui15min.toISOString())
      .in('status', ['agendado', 'confirmado'])

    if (!agendamentos || agendamentos.length === 0) return

    for (const ag of agendamentos) {
      if (!ag.pacientes?.telefone || !ag.meet_link) continue

      const minutos = Math.round((new Date(ag.data_hora).getTime() - agora.getTime()) / 60000)
      const telefone = ag.pacientes.telefone.replace(/[^0-9]/g, '')
      const primeiroNome = ag.pacientes.nome.split(' ')[0]

      const mensagem = 'Oi ' + primeiroNome + '! Tua consulta online começa em ' + minutos + ' minutos.\n\n🔗 Link da sala: ' + ag.meet_link + '\n\nQualquer coisa me chama 💜'

      const creds = await getWppCredentials(MEDICO_ID)
      await enviarWpp(telefone, mensagem, creds.token, creds.phoneId)

      await supabaseAdmin
        .from('agendamentos')
        .update({ lembrete_teleconsulta_enviado: true })
        .eq('id', ag.id)

      console.log('LEMBRETE_TELECONSULTA enviado:', ag.id, primeiroNome)
    }
  } catch (e) {
    console.error('verificarLembretes erro:', e)
  }
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
    texto: texto.replace(/\[AGENDAR:[^\]]+\]/g, '').replace('[HUMANO]', '').replace('[ENCERRAR]', '').replace(/\[BOTOES:[^\]]+\]/g, '').trim(),
    humano,
    agendarData: agendarMatch ? JSON.parse(agendarMatch[1]) : null,
    botoes,
    encerrar: texto.includes('[ENCERRAR]'),
  }
}

async function getMedicoIdFromDB(): Promise<string> {
  if (MEDICO_ID_FALLBACK) return MEDICO_ID_FALLBACK
  const { data } = await supabaseAdmin.from('medicos').select('id').eq('ativo', true).limit(1).maybeSingle()
  return (data as any)?.id || ''
}

async function getMedicoId(phoneNumberId: string): Promise<string> {
  try {
    // Tenta achar pelo phone_number_id exato no banco
    if (phoneNumberId) {
      const { data } = await supabaseAdmin
        .from('whatsapp_config')
        .select('medico_id')
        .eq('phone_number_id', phoneNumberId)
        .maybeSingle()
      if ((data as any)?.medico_id) {
        console.log('getMedicoId by phoneId:', phoneNumberId, '->', (data as any).medico_id)
        return (data as any).medico_id
      }
    }

    // Fallback 1: env var WHATSAPP_MEDICO_ID
    if (MEDICO_ID_FALLBACK) {
      console.log('getMedicoId fallback env:', MEDICO_ID_FALLBACK)
      return MEDICO_ID_FALLBACK
    }

    // Fallback 2: busca médico pelo WPP_PHONE_ID nas env vars
    if (WPP_PHONE_ID) {
      const { data } = await supabaseAdmin
        .from('whatsapp_config')
        .select('medico_id')
        .eq('phone_number_id', WPP_PHONE_ID)
        .maybeSingle()
      if ((data as any)?.medico_id) return (data as any).medico_id
    }

    // Fallback 3: busca médicos diretamente — pega o primeiro ativo
    const { data: medicos } = await supabaseAdmin
      .from('medicos')
      .select('id')
      .eq('ativo', true)
      .limit(1)
      .maybeSingle()
    if ((medicos as any)?.id) {
      console.log('getMedicoId by medicos table:', (medicos as any).id)
      return (medicos as any).id
    }

    console.error('getMedicoId: nenhum medico encontrado')
    return ''
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

    // Dispara lembretes de teleconsulta pendentes em background (non-blocking)
    verificarLembretesTeleconsulta(MEDICO_ID).catch(e => console.error('lembrete bg erro:', e))
    dispararConfirmacoes24h(MEDICO_ID).catch(e => console.error('conf24h bg erro:', e))

    console.log('WEBHOOK_OK medico:', MEDICO_ID, 'msgs:', messages.length, 'phoneId:', phoneNumberId)
    if (!MEDICO_ID) {
      console.error('MEDICO_ID VAZIO — phoneNumberId:', phoneNumberId)
      // Tenta fallback direto pela env
      const fallback = process.env.WHATSAPP_MEDICO_ID || ''
      if (!fallback) {
        console.error('WHATSAPP_MEDICO_ID nao configurado no Vercel')
        return NextResponse.json({ ok: true, aviso: 'medico_id nao encontrado' })
      }
    }

    for (const msg of messages) {
      // Processa texto normal E cliques em botões interativos
      if (msg.type !== 'text' && msg.type !== 'interactive' && msg.type !== 'audio' && msg.type !== 'voice') continue
      
      const telefone = msg.from
      const nome = value.contacts?.[0]?.profile?.name || telefone
      
      // Extrai o texto — de mensagem normal ou de botão clicado
      let texto = ''
      if (msg.type === 'text') {
        texto = msg.text?.body || ''
      } else if (msg.type === 'interactive') {
        // Botão clicado pelo paciente
        if (msg.interactive?.type === 'button_reply') {
          texto = msg.interactive.button_reply?.title || ''
        } else if (msg.interactive?.type === 'list_reply') {
          texto = msg.interactive.list_reply?.title || ''
        }
      } else if (msg.type === 'audio' || msg.type === 'voice') {
        // Áudio enviado pelo paciente — transcreve via Whisper
        const mediaId = msg.audio?.id || msg.voice?.id
        if (mediaId) {
          console.log('AUDIO_RECEBIDO:', mediaId)
          const transcrito = await transcreverAudioWhatsApp(mediaId)
          if (transcrito) {
            texto = transcrito
            console.log('AUDIO_TRANSCRITO:', transcrito.substring(0, 100))
          } else {
            // Falha na transcrição — avisa paciente
            texto = '__audio_falha__'
          }
        }
      }
      
      if (!texto.trim()) continue
      console.log('MSG:', telefone, msg.type, texto.substring(0, 50))

      const conversa = await getOuCriarConversa(telefone, nome, MEDICO_ID)
      if (!conversa) { console.log('ERRO: sem conversa'); continue }
      
      // Se conversa estava encerrada — verifica se é resposta de NPS
      if (conversa.status === 'encerrada') {
        const isAvaliacao = texto.includes('⭐') || texto === '⭐ Avaliar' || /^[1-5]$/.test(texto.trim())
        const isRecusa = texto === 'Não obrigado' || texto.toLowerCase().includes('não obrigado')
        
        if (isAvaliacao || texto === '⭐ Avaliar') {
          // Pede a nota
          const msgNota = 'De 1 a 5, como você avalia nosso atendimento? (1 = ruim, 5 = excelente)'
          const botoesNota = ['⭐ 1', '⭐⭐ 2', '⭐⭐⭐ 3', '⭐⭐⭐⭐ 4', '⭐⭐⭐⭐⭐ 5']
          await supabase.from('whatsapp_mensagens').insert({
            conversa_id: conversa.id, tipo: 'enviada', conteudo: msgNota,
            metadata: { ia: true, botoes: botoesNota.slice(0,3) }
          })
          const creds4 = await getWppCredentials(MEDICO_ID)
          await enviarWppComBotoes(telefone, msgNota, ['1 - Ruim', '3 - Regular', '5 - Excelente'], creds4.token, creds4.phoneId)
          continue
        } else if (/^[1-5⭐]/.test(texto.trim())) {
          // Salva a nota
          const nota = texto.match(/[1-5]/)?.[0]
          if (nota) {
            await supabase.from('whatsapp_conversas').update({ nps_nota: parseInt(nota) }).eq('id', conversa.id)
            const msgFim = `Obrigado pela avaliação ${'⭐'.repeat(parseInt(nota))}! Até a próxima. 😊`
            await supabase.from('whatsapp_mensagens').insert({
              conversa_id: conversa.id, tipo: 'enviada', conteudo: msgFim, metadata: { ia: true }
            })
            const creds5 = await getWppCredentials(MEDICO_ID)
            await enviarWpp(telefone, msgFim, creds5.token, creds5.phoneId)
          }
          continue
        } else if (isRecusa) {
          const msgFim = 'Tudo bem! Até a próxima. 😊'
          await supabase.from('whatsapp_mensagens').insert({
            conversa_id: conversa.id, tipo: 'enviada', conteudo: msgFim, metadata: { ia: true }
          })
          const creds6 = await getWppCredentials(MEDICO_ID)
          await enviarWpp(telefone, msgFim, creds6.token, creds6.phoneId)
          continue
        }
        
        // Outra mensagem em conversa encerrada — reativa
        await supabaseAdmin.from('whatsapp_conversas')
          .update({ status: 'ativa', modo: 'ia' })
          .eq('id', conversa.id)
        conversa.status = 'ativa'
        conversa.modo = 'ia'
        console.log('CONVERSA_REATIVADA:', conversa.id)
      }

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

      // === INTERCEPTADOR PRÉ-ATENDIMENTO ADAPTATIVO ===
      const preAtiva = await getPreConsultaAtiva(conversa.id)
      if (preAtiva) {
        const credsPre = await getWppCredentials(MEDICO_ID)
        if (preAtiva.status === 'aguardando_permissao') {
          const rl = texto.toLowerCase().trim()
          const aceitou = ['pode sim', 'sim', 'pode', 'claro', 'ok', 'manda', 'vamos'].some(p => rl.includes(p))
          const recusou = ['agora não', 'agora nao', 'nao', 'não', 'depois', 'mais tarde'].some(p => rl.includes(p))
          if (aceitou) {
            await marcarPermissaoConcedida(preAtiva.id)
            const primeira = (preAtiva.perguntas as any[])[0]
            const msg = `Boaa, valeu! 💜\n\n${primeira.texto}`
            await supabase.from('whatsapp_mensagens').insert({ conversa_id: conversa.id, tipo: 'enviada', conteudo: msg, metadata: { ia: true, pre_consulta: true } })
            await enviarWpp(telefone, msg, credsPre.token, credsPre.phoneId)
            continue
          }
          if (recusou) {
            await marcarPermissaoNegada(preAtiva.id)
            const msg = 'Sem problema, a gente conversa no dia 💜 Até lá!'
            await supabase.from('whatsapp_mensagens').insert({ conversa_id: conversa.id, tipo: 'enviada', conteudo: msg, metadata: { ia: true } })
            await enviarWpp(telefone, msg, credsPre.token, credsPre.phoneId)
            continue
          }
        }
        if (preAtiva.status === 'em_andamento') {
          const r = await registrarRespostaEAvancar(preAtiva.id, texto) as any
          let msg: string
          if (r.completo) {
            msg = 'Valeu! Anotei tudinho aqui 💜 O médico já vai olhar isso antes da consulta. Até lá!'
          } else if (r.followup) {
            msg = r.followup
          } else if (r.proxima) {
            msg = r.proxima.texto
          } else {
            msg = 'Entendido!'
          }
          await supabase.from('whatsapp_mensagens').insert({ conversa_id: conversa.id, tipo: 'enviada', conteudo: msg, metadata: { ia: true, pre_consulta: true } })
          await enviarWpp(telefone, msg, credsPre.token, credsPre.phoneId)
          await supabase.from('whatsapp_conversas').update({ ultimo_contato: new Date().toISOString() }).eq('id', conversa.id)
          continue
        }
      }
      
      // === INTERCEPTADOR CONFIRMAÇÃO 24H ===
      try {
        const agConf = await detectarRespostaConfirmacao24h(telefone, MEDICO_ID)
        if (agConf) {
          const textoLower = texto.toLowerCase().trim()
          const confirmou = ['sim', 'confirmo', 'confirmado', 'pode sim', 'vou', 'tô indo', 'to indo', 'estarei', 'sim confirmo'].some(p => textoLower.includes(p))
          const recusou = ['não poderei', 'nao poderei', 'não vou', 'nao vou', 'não posso', 'nao posso', 'cancelar'].some(p => textoLower.includes(p))
          const querRemarcar = ['remarcar', 'reagendar', 'outro dia', 'outro horario', 'outro horário', 'mudar', 'trocar'].some(p => textoLower.includes(p))

          if (confirmou) {
            await supabaseAdmin
              .from('agendamentos')
              .update({ 
                confirmacao_24h_status: 'confirmado', 
                status: 'confirmado',
                confirmacao_24h_resposta_em: new Date().toISOString() 
              })
              .eq('id', agConf.id)

            const credsC = await getWppCredentials(MEDICO_ID)
            const msgC = 'Show! Tá confirmado então 💜 Até amanhã!'
            await supabase.from('whatsapp_mensagens').insert({
              conversa_id: conversa.id, tipo: 'enviada', conteudo: msgC,
              metadata: { ia: true, confirmacao_24h: true, resposta: 'confirmado' }
            })
            await enviarWpp(telefone, msgC, credsC.token, credsC.phoneId)
            continue
          }

          if (recusou) {
            await supabaseAdmin
              .from('agendamentos')
              .update({ 
                confirmacao_24h_status: 'nao_confirmado',
                confirmacao_24h_resposta_em: new Date().toISOString()
              })
              .eq('id', agConf.id)

            await notificarMedico({
              medico_id: MEDICO_ID,
              tipo: 'confirmacao_recusada',
              agendamento_id: agConf.id,
              paciente_id: agConf.pacientes?.id,
              titulo: `${agConf.pacientes?.nome} não poderá comparecer`,
              descricao: `Consulta em ${new Date(agConf.data_hora).toLocaleString('pt-BR')}`
            })

            const credsR = await getWppCredentials(MEDICO_ID)
            const msgR = 'Tudo bem! Vou avisar a clínica. Se quiser remarcar, é só me mandar uma mensagem 💜'
            await supabase.from('whatsapp_mensagens').insert({
              conversa_id: conversa.id, tipo: 'enviada', conteudo: msgR,
              metadata: { ia: true, confirmacao_24h: true, resposta: 'recusou' }
            })
            await enviarWpp(telefone, msgR, credsR.token, credsR.phoneId)
            continue
          }

          if (querRemarcar) {
            await supabaseAdmin
              .from('agendamentos')
              .update({ 
                confirmacao_24h_status: 'reagendou',
                confirmacao_24h_resposta_em: new Date().toISOString()
              })
              .eq('id', agConf.id)

            // Marca estado de reagendamento na conversa pra continuar o fluxo
            await supabase
              .from('whatsapp_conversas')
              .update({ 
                estado_reagendamento: { 
                  etapa: 'aguardando_horario', 
                  agendamento_id_antigo: agConf.id 
                } 
              })
              .eq('id', conversa.id)

            // Deixa o fluxo normal da Sofia continuar — ela vai oferecer horários
            // através do prompt (que já detecta intent de agendar)
          }
        }
      } catch (e) {
        console.error('Interceptador confirmação 24h erro:', e)
      }
      // === FIM INTERCEPTADOR CONFIRMAÇÃO 24H ===

      // === FIM INTERCEPTADOR ===

      if (conversa.modo === 'humano') continue

      const historico = await getHistorico(conversa.id)
      // Enriquece contexto para a Sofia
      let contextoExtra = ''
      
      // Adiciona nome do paciente se identificado
      if (conversa.nome_contato && conversa.nome_contato !== telefone) {
        contextoExtra += `\nNOME DO PACIENTE: ${conversa.nome_contato}`
      }
      
      // Se mensagem é sobre agendamento, busca horários disponíveis
      // Contexto: se paciente está em fluxo de reagendamento
      try {
        const estadoReag = (conversa as any).estado_reagendamento
        if (estadoReag?.etapa === 'aguardando_horario' && estadoReag?.agendamento_id_antigo) {
          const { data: agAntigo } = await supabase
            .from('agendamentos')
            .select('data_hora, motivo')
            .eq('id', estadoReag.agendamento_id_antigo)
            .single()
          if (agAntigo) {
            const dataFmt = new Date(agAntigo.data_hora).toLocaleString('pt-BR')
            contextoExtra += `\n\nREAGENDAMENTO ATIVO: paciente quer remarcar consulta marcada para ${dataFmt} (motivo: ${agAntigo.motivo || 'consulta'}). Ofereça horários alternativos. agendamento_id_antigo: ${estadoReag.agendamento_id_antigo}`
          }
        }
      } catch {}

      // Contexto extra: tipos de consulta aceitos pela clínica
      try {
        const cfgPara = await getSofiaConfig(MEDICO_ID)
        const tiposAceitos = (cfgPara as any).tipos_consulta_aceitos || ['presencial']
        if (tiposAceitos.length > 1) {
          contextoExtra += `\n\nTIPOS DE CONSULTA OFERECIDOS: ${tiposAceitos.join(', ')}. Pergunte ao paciente qual ele prefere quando for agendar.`
        } else if (tiposAceitos[0] === 'online') {
          contextoExtra += `\n\nATENDIMENTO: apenas online (teleconsulta). Link da sala será enviado antes da consulta.`
        } else if (tiposAceitos[0] === 'hibrido') {
          contextoExtra += `\n\nATENDIMENTO: híbrido (pode ser presencial ou online, paciente escolhe).`
        }
      } catch {}

      // Contexto: lista de médicos ativos da clínica (multi-médico)
      try {
        const { data: medicosDaClinica } = await supabase
          .from('medicos')
          .select('id, nome, especialidade')
          .eq('ativo', true)
        const outros = (medicosDaClinica || []).filter((m: any) => m.id !== MEDICO_ID)
        if (outros.length > 0) {
          const listaMedicos = outros.map((m: any) => `${m.nome}${m.especialidade ? ' (' + m.especialidade + ')' : ''}`).join(', ')
          contextoExtra += `\n\nOUTROS MÉDICOS DA CLÍNICA: ${listaMedicos}. Se o paciente tiver preferência por algum médico específico, mencione os disponíveis.`
        }
      } catch {}

      // Palavras que disparam contexto de preços
      const palavrasPreco = ['preço', 'preco', 'valor', 'custa', 'quanto', 'quanto custa', 'valores', 'cobra', 'cobram']
      const mencionaPreco = palavrasPreco.some(p => texto.toLowerCase().includes(p))
      if (mencionaPreco) {
        try {
          const cfgSofia = await getSofiaConfig(MEDICO_ID)
          const linhas: string[] = []
          if (cfgSofia.preco_consulta) linhas.push(`Consulta padrão: R$ ${cfgSofia.preco_consulta}`)
          const outros = Object.entries(cfgSofia.precos_tipos || {})
          outros.forEach(([k, v]) => linhas.push(`${k}: R$ ${v}`))
          if (linhas.length > 0) {
            contextoExtra += `\n\nTABELA DE VALORES DA CLÍNICA:\n${linhas.join('\n')}\n(Cite os valores quando o paciente perguntar)`
          } else {
            contextoExtra += `\n\nNOTA: valores não configurados. Se o paciente perguntar valor, diga que vai verificar com a recepção.`
          }
        } catch {}
      }

      const palavrasAgendamento = ['agendar', 'consulta', 'horario', 'horários', 'marcar', 'disponivel', 'data', 'agenda']
      const mencionaAgendamento = palavrasAgendamento.some(p => texto.toLowerCase().includes(p)) ||
        historico.slice(-4).some((h: any) => palavrasAgendamento.some(p => h.conteudo?.toLowerCase().includes(p)))
      
      if (mencionaAgendamento) {
        const horarios = await buscarHorariosDisponiveis(MEDICO_ID)
        contextoExtra += `\n\n${horarios}`
      }
      
      const textoComContexto = contextoExtra ? `${texto}\n\n[CONTEXTO DO SISTEMA: ${contextoExtra}]` : texto
      const { texto: resposta, humano, agendarData, botoes, encerrar } = await processarIA(textoComContexto, historico)
      const creds = await getWppCredentials(MEDICO_ID)

      if (agendarData) {
        let pacienteId = conversa.paciente_id

        // Se não tem paciente vinculado, cria um pelo telefone
        if (!pacienteId) {
          const tel = normalizarTel(telefone)
          const { data: pacExistente } = await supabaseAdmin
            .from('pacientes')
            .select('id')
            .eq('medico_id', MEDICO_ID)
            .or(`telefone.eq.${tel},telefone.eq.+${tel},telefone.eq.55${tel}`)
            .maybeSingle()

          if (pacExistente) {
            pacienteId = pacExistente.id
          } else {
            const { data: novoPac } = await supabaseAdmin
              .from('pacientes')
              .insert({ medico_id: MEDICO_ID, nome: conversa.nome_contato || tel, telefone: tel })
              .select()
              .single()
            if (novoPac) pacienteId = novoPac.id
          }

          // Vincula paciente à conversa
          if (pacienteId) {
            await supabaseAdmin.from('whatsapp_conversas')
              .update({ paciente_id: pacienteId })
              .eq('id', conversa.id)
          }
        }

        // Ajusta timezone — agendarData.data vem em hora local mas Postgres interpreta como UTC
        // Adiciona offset do Brasil (UTC-3) para compensar
        const dataLocal = new Date(agendarData.data)
        const offsetMs = dataLocal.getTimezoneOffset() * 60 * 1000
        // Como estamos no servidor (UTC), a data já está correta se vier com offset
        // Usa a string diretamente com timezone explícito
        const dataHoraFinal = agendarData.data.includes('+') || agendarData.data.includes('Z')
          ? agendarData.data
          : agendarData.data + '-03:00'  // Assume Brasil UTC-3

        // Verifica se já existe agendamento próximo para evitar duplicata
        const { data: existente } = await supabase.from('agendamentos')
          .select('id')
          .eq('medico_id', MEDICO_ID)
          .eq('paciente_id', pacienteId || '')
          .gte('data_hora', new Date(dataLocal.getTime() - 30*60*1000).toISOString())
          .lte('data_hora', new Date(dataLocal.getTime() + 30*60*1000).toISOString())
          .maybeSingle()

        if (existente) {
          console.log('AGENDAR: já existe agendamento próximo, ignorando duplicata')
        }

        const { data: agCreated, error: agError } = existente
          ? { data: existente, error: null }
          : await supabase.from('agendamentos').insert({
              medico_id: MEDICO_ID,
              paciente_id: pacienteId,
              data_hora: dataHoraFinal,
              tipo: agendarData.tipo || 'consulta',
              motivo: agendarData.motivo || 'Consulta via WhatsApp',
              status: 'agendado',
              observacoes: `Agendado pela Sofia IA via WhatsApp — ${conversa.nome_contato || telefone}${agendarData.modalidade ? ' · ' + agendarData.modalidade : ''}`,
              meet_link: agendarData.modalidade === 'online' ? `https://prontuario-ia-five.vercel.app/sala/${Math.random().toString(36).substring(2, 10)}` : null,
              meet_code: agendarData.modalidade === 'online' ? Math.random().toString(36).substring(2, 10) : null,
            }).select().single()

        if (agError) {
          console.error('AGENDAR_ERRO:', agError.message)
        } else {
          console.log('AGENDADO:', agCreated?.id, agendarData.data)
          // Envia mensagem de confirmação com instruções de pré-consulta
          const dataFmt = new Date(agendarData.data).toLocaleDateString('pt-BR', {weekday:'long',day:'2-digit',month:'long',hour:'2-digit',minute:'2-digit'})
          // Envia pré-consulta integrada junto com a confirmação (mesma mensagem)
          // === 3 perguntas fixas removidas — Sofia agora usa pré-atendimento adaptativo ===
          await supabase.from('whatsapp_conversas').update({
            ultimo_contato: new Date().toISOString()
          }).eq('id', conversa.id)
        }
      }

      if (humano) {
        await supabase.from('whatsapp_conversas').update({ modo: 'humano' }).eq('id', conversa.id)
      }

      if (encerrar) {
        await supabase.from('whatsapp_conversas').update({ status: 'encerrada' }).eq('id', conversa.id)
        console.log('CONVERSA_ENCERRADA:', conversa.id)
        
        // Envia pesquisa de satisfação
        const msgNps = 'Fico feliz em ter ajudado! Posso pedir um feedback rapidinho?'
        const botoesNps = ['⭐ Avaliar', 'Não obrigado']
        await supabase.from('whatsapp_mensagens').insert({
          conversa_id: conversa.id, tipo: 'enviada', conteudo: msgNps,
          metadata: { ia: true, botoes: botoesNps }
        })
        const creds3 = await getWppCredentials(MEDICO_ID)
        await enviarWppComBotoes(telefone, msgNps, botoesNps, creds3.token, creds3.phoneId)
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
      // Se tem botões, envia como mensagem interativa no WhatsApp
      if (botoes && botoes.length > 0) {
        await enviarWppComBotoes(telefone, resposta, botoes, creds2.token, creds2.phoneId)
      } else {
        await enviarWpp(telefone, resposta, creds2.token, creds2.phoneId)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('WEBHOOK_ERROR:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
