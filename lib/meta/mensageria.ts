/**
 * Mensagens do Instagram e do Messenger — recebimento (webhook) e envio.
 *
 * Cada mensagem é direcionada pela conta que a recebeu (página ou Instagram) para a
 * clínica que conectou essa conta em canais_conectados. Contas antigas configuradas
 * por variável de ambiente continuam funcionando (modo legado), sem misturar clínicas.
 */
import Anthropic from '@anthropic-ai/sdk'
import { MODELOS } from '@/lib/ai/models'
import { log } from '@/lib/logger'
import { supabaseServidor as db } from '@/lib/servidor'
import { GRAPH_IG, canalPorConta, graph, marcarErroCanal } from '@/lib/meta/graph'

export type CanalSocial = 'instagram' | 'messenger'
/** 'instagram' = conta conectada pelo login do Instagram (graph.instagram.com); 'facebook' = pela página */
export type ApiSocial = 'facebook' | 'instagram'
export type AcessoSocial = { token: string; api: ApiSocial }

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/** Conta e token para um canal: conectado pela clínica ou legado (variáveis de ambiente). */
async function resolverConta(canal: CanalSocial, contaId: string) {
  const c = await canalPorConta(canal, contaId)
  if (c?.access_token) return { canalId: c.id, medicoId: c.medico_id, token: c.access_token, api: (c.detalhe?.api === 'instagram' ? 'instagram' : 'facebook') as ApiSocial }
  // Legado: uma conta fixa configurada na Vercel — só se o médico também estiver fixado
  const medicoLegado = process.env.WHATSAPP_MEDICO_ID
  const tokenLegado = canal === 'instagram' ? process.env.INSTAGRAM_TOKEN : (process.env.MESSENGER_TOKEN || process.env.WHATSAPP_TOKEN)
  const paginaLegada = process.env.MESSENGER_PAGE_ID
  if (medicoLegado && tokenLegado && (canal === 'instagram' || !paginaLegada || paginaLegada === contaId)) {
    return { canalId: null, medicoId: medicoLegado, token: tokenLegado, api: 'facebook' as ApiSocial }
  }
  return null
}

/** Envia texto ao contato (PSID do Messenger ou IGSID do Instagram) usando o token da página. */
export async function enviarMensagemSocial(token: string, destinatario: string, texto: string, api: ApiSocial = 'facebook') {
  return graph('me/messages', {
    token, ...(api === 'instagram' ? { base: GRAPH_IG } : {}),
    corpo: { recipient: { id: destinatario }, message: { text: texto.slice(0, 1990) }, messaging_type: 'RESPONSE' },
  })
}

/** Token para responder uma conversa do Chat (pela conta por onde ela chegou). */
export async function tokenDaConversa(conversa: { canal?: string | null; canal_conta_id?: string | null; medico_id: string }): Promise<AcessoSocial | null> {
  const canal = (conversa.canal || '') as CanalSocial
  if (canal !== 'instagram' && canal !== 'messenger') return null
  if (conversa.canal_conta_id) {
    const r = await resolverConta(canal, conversa.canal_conta_id)
    if (r) return { token: r.token, api: r.api }
  }
  // Conversa antiga sem conta registrada: única conta deste canal do médico
  const { data } = await db.from('canais_conectados').select('access_token, detalhe')
    .eq('canal', canal).eq('medico_id', conversa.medico_id).eq('status', 'ativo').limit(2)
  if (data?.length === 1) {
    const c = data[0] as any
    return { token: c.access_token, api: c.detalhe?.api === 'instagram' ? 'instagram' : 'facebook' }
  }
  const legado = canal === 'instagram' ? process.env.INSTAGRAM_TOKEN : (process.env.MESSENGER_TOKEN || process.env.WHATSAPP_TOKEN)
  return legado ? { token: legado, api: 'facebook' } : null
}

async function nomeDoContato(canal: CanalSocial, token: string, id: string, api: ApiSocial) {
  try {
    if (api === 'instagram') {
      const p = await graph<any>(id, { token, base: GRAPH_IG, params: { fields: 'name,username' } })
      return p.name || (p.username ? '@' + p.username : null)
    }
    if (canal === 'messenger') {
      const p = await graph<any>(id, { token, params: { fields: 'first_name,last_name' } })
      return [p.first_name, p.last_name].filter(Boolean).join(' ') || null
    }
    const p = await graph<any>(id, { token, params: { fields: 'name,username' } })
    return p.name || (p.username ? '@' + p.username : null)
  } catch { return null }
}

const SISTEMA: Record<CanalSocial, string> = {
  instagram: 'Voce e Sofia, assistente da clinica. O paciente escreveu pelo Instagram. Responda em portugues, de forma breve e acolhedora. Sem botoes. Para transferir para a equipe humana, inclua [HUMANO].',
  messenger: 'Voce e Sofia, assistente virtual da clinica. O paciente escreveu pelo Messenger. Seja calorosa e objetiva, em portugues. Use texto simples com opcoes numeradas (sem botoes). Para transferir para a equipe humana, inclua [HUMANO].',
}

/** Processa uma mensagem recebida: conversa, histórico, resposta da IA (se a conversa estiver com a IA). */
export async function receberMensagemSocial(p: { canal: CanalSocial; contaId: string; remetente: string; texto: string; mid?: string }) {
  const conta = await resolverConta(p.canal, p.contaId)
  if (!conta) { log.warn(`[${p.canal}] mensagem para conta não conectada:`, p.contaId); return }

  let { data: conversa } = await db.from('whatsapp_conversas').select('*')
    .eq('telefone', p.remetente).eq('medico_id', conta.medicoId).eq('canal', p.canal).maybeSingle()

  if (!conversa) {
    const nome = await nomeDoContato(p.canal, conta.token, p.remetente, conta.api)
    const nova_ = {
      medico_id: conta.medicoId, telefone: p.remetente, nome_contato: nome || p.remetente,
      modo: 'ia', status: 'ativa', canal: p.canal, canal_conta_id: p.contaId, ultimo_contato: new Date().toISOString(),
    }
    let { data: nova, error } = await db.from('whatsapp_conversas').insert(nova_).select().single()
    if (error && /canal_conta_id/.test(error.message)) {
      const { canal_conta_id, ...semConta } = nova_   // banco sem a migration 0017
      ;({ data: nova, error } = await db.from('whatsapp_conversas').insert(semConta).select().single())
    }
    if (error) { log.error(`[${p.canal}] criar conversa`, error.message); return }
    conversa = nova
  } else if ('canal_conta_id' in (conversa as any) && !(conversa as any).canal_conta_id) {
    await db.from('whatsapp_conversas').update({ canal_conta_id: p.contaId }).eq('id', (conversa as any).id)
  }
  const conv = conversa as any

  await db.from('whatsapp_mensagens').insert({
    conversa_id: conv.id, tipo: 'recebida', conteudo: p.texto, lida: false,
    metadata: { canal: p.canal, ...(p.mid ? { mid: p.mid } : {}) },
  })
  await db.from('whatsapp_conversas').update({ ultimo_contato: new Date().toISOString() }).eq('id', conv.id)

  if (conv.modo === 'humano' || conv.bloqueada) return

  const { data: hist } = await db.from('whatsapp_mensagens').select('tipo, conteudo')
    .eq('conversa_id', conv.id).order('criado_em', { ascending: false }).limit(16)
  const mensagens = (hist || []).reverse().map((h: any) => ({
    role: (h.tipo === 'enviada' ? 'assistant' : 'user') as 'user' | 'assistant', content: String(h.conteudo || ''),
  })).filter(m => m.content)
  // a API exige começar pelo usuário e alternar papéis
  while (mensagens.length && mensagens[0].role !== 'user') mensagens.shift()
  const alternadas = mensagens.reduce<typeof mensagens>((acc, m) => {
    const ult = acc[acc.length - 1]
    if (ult && ult.role === m.role) ult.content += '\n' + m.content
    else acc.push({ ...m })
    return acc
  }, [])
  if (!alternadas.length) return

  const ia = await anthropic.messages.create({ model: MODELOS.apoio, max_tokens: 600, system: SISTEMA[p.canal], messages: alternadas })
  let resposta = ia.content[0]?.type === 'text' ? ia.content[0].text : ''
  const humano = resposta.includes('[HUMANO]')
  resposta = resposta.replace(/\[HUMANO\]/g, '').replace(/\[BOTOES:[^\]]+\]/g, '').trim()
  if (humano) await db.from('whatsapp_conversas').update({ modo: 'humano' }).eq('id', conv.id)
  if (!resposta) return

  let erroEnvio: string | null = null
  try {
    await enviarMensagemSocial(conta.token, p.remetente, resposta, conta.api)
  } catch (e: any) {
    erroEnvio = e?.message || 'falha ao enviar'
    log.error(`[${p.canal}] envio`, erroEnvio)
    if (conta.canalId && /token|session|permission|OAuth/i.test(erroEnvio!)) await marcarErroCanal(conta.canalId, erroEnvio!)
  }
  await db.from('whatsapp_mensagens').insert({
    conversa_id: conv.id, tipo: 'enviada', conteudo: resposta, lida: true,
    metadata: { ia: true, canal: p.canal, ...(erroEnvio ? { falhou: true, erro: erroEnvio } : {}) },
  })
}

/**
 * Lê o corpo de um webhook da Meta (objeto "page" ou "instagram") e processa cada mensagem.
 * Ignora ecos (mensagens enviadas pela própria página) e eventos sem texto.
 */
export async function processarWebhookSocial(corpo: any) {
  const objeto = corpo?.object
  if (objeto !== 'page' && objeto !== 'instagram') return 0
  let n = 0
  for (const entry of corpo.entry || []) {
    for (const ev of entry.messaging || []) {
      if (!ev.message || ev.message.is_echo || ev.message.is_deleted) continue
      const texto = String(ev.message.text || '').trim() || (ev.message.attachments?.length ? '[anexo]' : '')
      const remetente = ev.sender?.id
      if (!texto || !remetente) continue
      // Instagram: entry.id = conta do Instagram. Messenger: entry.id = página.
      const canal: CanalSocial = objeto === 'instagram' ? 'instagram' : 'messenger'
      const contaId = String(entry.id || ev.recipient?.id || '')
      try {
        await receberMensagemSocial({ canal, contaId, remetente: String(remetente), texto, mid: ev.message.mid })
        n++
      } catch (e: any) {
        log.error(`[${canal}] evento`, e?.message || e)
      }
    }
  }
  return n
}
