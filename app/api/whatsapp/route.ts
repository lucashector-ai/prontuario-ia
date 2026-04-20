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

const PROMPT_SOFIA = `Voce e Sofia, assistente virtual da clinica. Seja calorosa, simpatica e objetiva. Responda SEMPRE em portugues brasileiro.

IDENTIFICACAO DO PACIENTE:
- O paciente JA esta identificado pelo numero de telefone — voce ja sabe o nome dele se estiver no contexto
- Se nao souber o nome: pergunte APENAS o nome completo (NUNCA peca CPF, email ou outros dados na primeira mensagem)
- Se o nome estiver disponivel no contexto: chame-o pelo primeiro nome

REGRA CRITICA - BOTOES OBRIGATORIOS:
Sempre que houver opcoes para escolher, inclua OBRIGATORIAMENTE:
[BOTOES: opcao1|opcao2|opcao3]
Maximo 3 botoes. Maximo 20 caracteres cada. Sem acentos nos botoes.

MENU INICIAL (primeira mensagem ou quando digitar menu/oi/ola):
Ola! Sou a Sofia da clinica. Como posso te ajudar?
[BOTOES: Agendar consulta|Meus agendamentos|Falar com alguem]

FLUXO DE AGENDAMENTO:
1. Se nao souber o nome: pergunte o nome
2. Mostre os HORARIOS DISPONIVEIS que estao no contexto (nao invente horarios)
3. Pergunte qual horario prefere entre os disponiveis
4. Confirme: "Confirma [data] as [hora]? [BOTOES: Sim confirmar|Escolher outro]"
5. Se confirmar: [AGENDAR:{"data":"YYYY-MM-DDTHH:mm:00","motivo":"consulta"}]
IMPORTANTE: NUNCA agende em horario que o paciente simplesmente mencionar. Sempre ofereca opcoes dos horarios disponiveis.

REGRAS:
- Para transferir: [HUMANO]
- NUNCA dar diagnosticos ou receitas
- Emergencias: ligue 192 (SAMU)
- Sempre oferecer proxima acao clara`

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
      
      if (diaSemana >= 1 && diaSemana <= 5 && hora >= 8 && hora <= 17) {
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

    // Roteia Instagram DM (object: "instagram") 
    if (body.object === 'instagram') {
      for (const entry of body.entry || []) {
        for (const event of entry.messaging || []) {
          if (!event.message || event.message.is_echo) continue
          const senderId = event.sender?.id
          const texto = event.message?.text || ''
          if (!texto.trim() || !senderId) continue

          const MEDICO_ID = await getMedicoIdFromDB()
          if (!MEDICO_ID) continue

          console.log('IG_MSG:', senderId, texto.substring(0,50))

          let { data: conversa } = await supabase.from('whatsapp_conversas')
            .select('*').eq('telefone', senderId).eq('medico_id', MEDICO_ID).eq('canal', 'instagram').maybeSingle()

          if (!conversa) {
            const { data: nova } = await supabase.from('whatsapp_conversas').insert({
              medico_id: MEDICO_ID, telefone: senderId,
              nome_contato: entry.messaging?.[0]?.sender?.name || senderId,
              modo: 'ia', status: 'ativa', canal: 'instagram',
              ultimo_contato: new Date().toISOString()
            }).select().single()
            conversa = nova
          }
          if (!conversa) continue

          if (conversa.status === 'encerrada') {
            await supabase.from('whatsapp_conversas').update({ status: 'ativa', modo: 'ia' }).eq('id', conversa.id)
            conversa.status = 'ativa'; conversa.modo = 'ia'
          }

          await supabase.from('whatsapp_mensagens').insert({
            conversa_id: conversa.id, tipo: 'recebida', conteudo: texto,
            metadata: { canal: 'instagram' }
          })
          await supabase.from('whatsapp_conversas').update({ ultimo_contato: new Date().toISOString() }).eq('id', conversa.id)

          if (conversa.modo === 'humano') continue

          const historico = await getHistorico(conversa.id)
          const { texto: resposta } = await processarIA(texto, historico)
          const respostaLimpa = resposta.replace(/\[BOTOES:[^\]]+\]/g,'').replace('[HUMANO]','').replace('[ENCERRAR]','').trim()

          await supabase.from('whatsapp_mensagens').insert({
            conversa_id: conversa.id, tipo: 'enviada', conteudo: respostaLimpa,
            metadata: { ia: true, canal: 'instagram' }
          })

          // Envia pelo Instagram
          const igToken = process.env.INSTAGRAM_TOKEN || ''
          const igTokenPreview = igToken ? igToken.substring(0,15)+'...(len:'+igToken.length+')' : 'VAZIO'
          console.log('IG_TOKEN_DEBUG:', igTokenPreview, 'pageId:', igPageId)
          const igPageId = process.env.INSTAGRAM_PAGE_ID || ''
          if (igToken && igPageId) {
            const igRes = await fetch(`https://graph.facebook.com/v20.0/${igPageId}/messages`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                recipient: { id: senderId },
                message: { text: respostaLimpa },
                messaging_type: 'RESPONSE',
                access_token: igToken
              })
            })
            const igData = await igRes.json()
            if (igData.error) console.error('IG_SEND_ERROR:', JSON.stringify(igData.error))
            else console.log('IG_SEND_OK:', senderId)
          } else {
            console.error('IG: INSTAGRAM_TOKEN ou INSTAGRAM_PAGE_ID nao configurados')
          }
        }
      }
      return NextResponse.json({ ok: true })
    }

    const value = body.entry?.[0]?.changes?.[0]?.value
    if (!value || value.statuses) return NextResponse.json({ ok: true })

    const messages = value?.messages
    if (!messages?.length) return NextResponse.json({ ok: true })

    const phoneNumberId = value.metadata?.phone_number_id
    const MEDICO_ID = await getMedicoId(phoneNumberId)
    if (!MEDICO_ID) { console.log('Nenhum medico para phone_number_id:', phoneNumberId); return NextResponse.json({ ok: true }) }

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
      if (msg.type !== 'text' && msg.type !== 'interactive') continue
      
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

      if (conversa.modo === 'humano') continue

      const historico = await getHistorico(conversa.id)
      // Enriquece contexto para a Sofia
      let contextoExtra = ''
      
      // Adiciona nome do paciente se identificado
      if (conversa.nome_contato && conversa.nome_contato !== telefone) {
        contextoExtra += `\nNOME DO PACIENTE: ${conversa.nome_contato}`
      }
      
      // Se mensagem é sobre agendamento, busca horários disponíveis
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

        const { data: agCreated, error: agError } = await supabase.from('agendamentos').insert({
          medico_id: MEDICO_ID,
          paciente_id: pacienteId,
          data_hora: agendarData.data,
          tipo: agendarData.tipo || 'consulta',
          motivo: agendarData.motivo || 'Consulta via WhatsApp',
          status: 'agendado',
          observacoes: `Agendado pela Sofia IA via WhatsApp — ${conversa.nome_contato || telefone}`
        }).select().single()

        if (agError) {
          console.error('AGENDAR_ERRO:', agError.message)
        } else {
          console.log('AGENDADO:', agCreated?.id, agendarData.data)
        }
      }

      if (humano) {
        await supabase.from('whatsapp_conversas').update({ modo: 'humano' }).eq('id', conversa.id)
      }

      if (encerrar) {
        await supabase.from('whatsapp_conversas').update({ status: 'encerrada' }).eq('id', conversa.id)
        console.log('CONVERSA_ENCERRADA:', conversa.id)
        
        // Envia pesquisa de satisfação
        const msgNps = 'Fico feliz em ter ajudado! 😊 Antes de encerrar, posso pedir um feedback rápido sobre o atendimento?'
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
