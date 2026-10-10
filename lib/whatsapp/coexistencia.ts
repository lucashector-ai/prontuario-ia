/**
 * Coexistência (WhatsApp Business app + Clinical 360 no mesmo número): importa o que
 * a Meta manda depois da conexão.
 *
 *   history             conversas dos últimos 180 dias (em partes, fases 0, 1 e 2)
 *   smb_app_state_sync  contatos salvos no celular (nome) — adicionados/editados/removidos
 *
 * Tudo idempotente: a mesma mensagem (wamid) nunca entra duas vezes.
 */
import { supabaseServidor as db } from '@/lib/servidor'
import { log } from '@/lib/logger'

const digitos = (s: any) => String(s || '').replace(/\D/g, '')

async function conversaDe(medicoId: string, telefone: string, nome?: string | null) {
  const { data: existente } = await db.from('whatsapp_conversas').select('id, nome_contato').eq('medico_id', medicoId).eq('telefone', telefone).maybeSingle()
  if (existente) return existente as { id: string; nome_contato: string | null }
  const { data: nova } = await db.from('whatsapp_conversas').insert({
    medico_id: medicoId, telefone, nome_contato: nome || telefone, canal: 'whatsapp',
    // Histórico importado: a equipe já conversava pelo celular — não liga a Sofia sozinha
    modo: 'humano', status: 'ativa', ultimo_contato: new Date().toISOString(),
  }).select('id, nome_contato').single()
  return nova as { id: string; nome_contato: string | null } | null
}

/** Webhook "history": grava as conversas antigas do celular no Chat. */
export async function importarHistorico(medicoId: string, value: any) {
  const negocio = digitos(value?.metadata?.display_phone_number)
  let importadas = 0
  for (const bloco of value?.history || []) {
    if (bloco?.errors?.length) {
      // 2593109 = a clínica não quis compartilhar o histórico no app — segue normal
      log.info('[coexistencia] histórico não compartilhado:', bloco.errors.map((e: any) => e.code).join(','))
      continue
    }
    for (const thread of bloco?.threads || []) {
      const contato = digitos(thread.id)
      if (!contato) continue
      const msgs = (thread.messages || []).filter((m: any) => m?.id)
      if (!msgs.length) continue
      const conv = await conversaDe(medicoId, contato)
      if (!conv) continue
      const ids = msgs.map((m: any) => m.id)
      const { data: ja } = await db.from('whatsapp_mensagens').select('metadata').eq('conversa_id', conv.id).in('metadata->>wamid', ids)
      const vistos = new Set((ja || []).map((x: any) => x.metadata?.wamid))
      const linhas = msgs.filter((m: any) => !vistos.has(m.id)).map((m: any) => {
        const enviada = digitos(m.from) === negocio || (!!m.to && digitos(m.from) !== contato)
        const quando = Number(m.timestamp) ? new Date(Number(m.timestamp) * 1000).toISOString() : new Date().toISOString()
        return {
          conversa_id: conv.id, tipo: enviada ? 'enviada' : 'recebida', lida: true, criado_em: quando,
          conteudo: m.text?.body || (m.type === 'media_placeholder' ? '[mídia]' : `[${m.type || 'mensagem'}]`),
          metadata: { wamid: m.id, historico: true, celular: enviada },
        }
      })
      if (!linhas.length) continue
      const { error } = await db.from('whatsapp_mensagens').insert(linhas)
      if (error) { log.warn('[coexistencia] histórico:', error.message); continue }
      importadas += linhas.length
      const ultima = linhas.map((l: { criado_em: string }) => l.criado_em).sort().at(-1)
      if (ultima) await db.from('whatsapp_conversas').update({ ultimo_contato: ultima }).eq('id', conv.id).lt('ultimo_contato', ultima)
    }
  }
  return importadas
}

/** Webhook "smb_app_state_sync": nomes dos contatos salvos no celular. */
export async function sincronizarContatos(medicoId: string, value: any) {
  let atualizados = 0
  for (const s of value?.state_sync || []) {
    if (s?.type !== 'contact' || s.action !== 'add') continue
    const tel = digitos(s.contact?.phone_number)
    const nome = s.contact?.full_name || s.contact?.first_name
    if (!tel || !nome) continue
    // Só dá nome a quem já conversa com a clínica (não cria conversa para cada contato da agenda)
    const { data } = await db.from('whatsapp_conversas').update({ nome_contato: nome })
      .eq('medico_id', medicoId).eq('telefone', tel).select('id')
    atualizados += (data || []).length
  }
  return atualizados
}
