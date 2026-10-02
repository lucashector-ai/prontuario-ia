/**
 * Envio de WhatsApp pelo servidor — use em rotas /api e crons (NUNCA no cliente: usa token).
 *
 *   await enviarWhatsApp({ medicoId, telefone, texto })
 *   await enviarWhatsApp({ medicoId, telefone, texto, botoes: ['Confirmo', 'Remarcar'] })
 *   await enviarWhatsApp({ ..., registrar: { nome: 'Maria', metadata: { lembrete_48h: true } } })
 *
 * `registrar` grava a mensagem na conversa do Chat (cria a conversa se não existir),
 * para a equipe ver no /chat tudo o que foi enviado automaticamente.
 */
import { supabaseServidor as db } from '@/lib/servidor'
import { log } from '@/lib/logger'

export type ResultadoEnvio = { ok: boolean; erro?: string; wamid?: string; codigo?: number; viaTemplate?: boolean }

async function postar(cred: { token: string; phoneId: string }, corpo: any): Promise<ResultadoEnvio> {
  try {
    const r = await fetch(`https://graph.facebook.com/v20.0/${cred.phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cred.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    })
    const j = await r.json().catch(() => ({}))
    return r.ok
      ? { ok: true, wamid: j?.messages?.[0]?.id }
      : { ok: false, erro: j?.error?.message || `HTTP ${r.status}`, codigo: j?.error?.code }
  } catch (e: any) {
    return { ok: false, erro: e?.message || 'Falha de rede' }
  }
}

/** Normaliza para o formato do WhatsApp: só dígitos, com DDI 55 quando faltar. */
export function normalizarTelefone(tel?: string | null): string | null {
  const d = (tel || '').replace(/\D/g, '')
  if (d.length < 10) return null
  if (d.length <= 11) return '55' + d
  return d
}

async function credenciais(medicoId: string) {
  const { data } = await db.from('whatsapp_config')
    .select('access_token, token, phone_number_id').eq('medico_id', medicoId).maybeSingle()
  const token = data?.access_token || data?.token || process.env.WHATSAPP_TOKEN
  const phoneId = data?.phone_number_id || process.env.WHATSAPP_PHONE_ID
  return token && phoneId ? { token, phoneId } : null
}

export async function enviarWhatsApp(p: {
  medicoId: string
  telefone: string
  texto: string
  botoes?: string[]
  registrar?: { nome?: string | null; pacienteId?: string | null; metadata?: Record<string, any> }
}): Promise<ResultadoEnvio> {
  const tel = normalizarTelefone(p.telefone)
  if (!tel) return { ok: false, erro: 'Telefone inválido' }
  const cred = await credenciais(p.medicoId)
  if (!cred) return { ok: false, erro: 'WhatsApp não configurado' }

  const corpo = p.botoes?.length
    ? {
        messaging_product: 'whatsapp', to: tel, type: 'interactive',
        interactive: {
          type: 'button', body: { text: p.texto },
          action: { buttons: p.botoes.slice(0, 3).map((b, i) => ({ type: 'reply', reply: { id: `btn_${i}`, title: b.substring(0, 20) } })) },
        },
      }
    : { messaging_product: 'whatsapp', to: tel, type: 'text', text: { body: p.texto } }

  // Fora da janela de 24h (paciente não escreveu nas últimas 24h) a Meta só entrega
  // template aprovado. Com WHATSAPP_TEMPLATE_GENERICO (template com 1 variável no corpo: {{1}})
  // o mesmo texto vai dentro do template. Os botões viram resposta livre do paciente.
  const template = process.env.WHATSAPP_TEMPLATE_GENERICO
  const corpoTemplate = template ? {
    messaging_product: 'whatsapp', to: tel, type: 'template',
    template: {
      name: template, language: { code: process.env.WHATSAPP_TEMPLATE_IDIOMA || 'pt_BR' },
      components: [{ type: 'body', parameters: [{ type: 'text', text: p.texto.replace(/\s*\n+\s*/g, ' · ').replace(/ {4,}/g, ' ').slice(0, 1000) }] }],
    },
  } : null

  let resultado: ResultadoEnvio
  if (corpoTemplate && !(await janelaAberta(p.medicoId, tel))) {
    resultado = await postar(cred, corpoTemplate)
    if (resultado.ok) resultado.viaTemplate = true
  } else {
    resultado = await postar(cred, corpo)
    // Erro síncrono de janela (131047): tenta o template, ou explica o motivo.
    if (!resultado.ok && resultado.codigo === 131047) {
      if (corpoTemplate) {
        resultado = await postar(cred, corpoTemplate)
        if (resultado.ok) resultado.viaTemplate = true
      } else {
        resultado.erro = 'Paciente sem conversa nas últimas 24h — a Meta exige template aprovado (configure WHATSAPP_TEMPLATE_GENERICO)'
      }
    }
  }

  if (p.registrar) {
    try { await registrarNaConversa(p.medicoId, tel, p.texto, p.registrar, resultado, p.botoes) } catch (e) { log.error('registrarNaConversa', e) }
  }
  return resultado
}

/** O paciente mandou mensagem nas últimas 24h? (janela de atendimento da Meta) */
async function janelaAberta(medicoId: string, tel: string): Promise<boolean> {
  try {
    const { data: conv } = await db.from('whatsapp_conversas').select('id').eq('medico_id', medicoId).eq('telefone', tel).maybeSingle()
    if (!conv) return false
    const desde = new Date(Date.now() - 23.5 * 3600e3).toISOString()
    const { data } = await db.from('whatsapp_mensagens').select('id')
      .eq('conversa_id', conv.id).eq('tipo', 'recebida').gte('criado_em', desde).limit(1)
    return !!data?.length
  } catch { return true } // na dúvida, tenta texto livre (o fallback síncrono cobre)
}

/** Grava a mensagem enviada na conversa do Chat (cria a conversa se preciso). */
async function registrarNaConversa(
  medicoId: string, tel: string, texto: string,
  reg: { nome?: string | null; pacienteId?: string | null; metadata?: Record<string, any> },
  resultado: ResultadoEnvio, botoes?: string[],
) {
  let { data: conv } = await db.from('whatsapp_conversas').select('id').eq('medico_id', medicoId).eq('telefone', tel).maybeSingle()
  if (!conv) {
    const { data: nova } = await db.from('whatsapp_conversas').insert({
      medico_id: medicoId, telefone: tel, nome_contato: reg.nome || null, paciente_id: reg.pacienteId || null,
      modo: 'ia', status: 'ativa', ultimo_contato: new Date().toISOString(), canal: 'whatsapp',
    }).select('id').single()
    conv = nova
  }
  if (!conv) return
  await db.from('whatsapp_mensagens').insert({
    conversa_id: conv.id, tipo: 'enviada', conteudo: texto, lida: true,
    metadata: { ia: true, automatica: true, ...(botoes?.length ? { botoes } : {}), ...(resultado.ok ? { wamid: resultado.wamid, ...(resultado.viaTemplate ? { template: true } : {}) } : { falhou: true, erro: resultado.erro }), ...(reg.metadata || {}) },
  })
  await db.from('whatsapp_conversas').update({ ultimo_contato: new Date().toISOString() }).eq('id', conv.id)
}

/** Preenche {nome}, {data}, {hora}, {medico}, {clinica} num modelo de mensagem. */
export function preencherModelo(modelo: string, v: Record<string, string | undefined | null>) {
  return modelo.replace(/\{(\w+)\}/g, (_, k) => (v[k] ?? '').toString())
}
