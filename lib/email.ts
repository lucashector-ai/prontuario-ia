/** Envio de email pelo Resend (RESEND_API_KEY + RESEND_FROM). Sem chave, só registra no log. */
import { log } from '@/lib/logger'

export async function enviarEmail(para: string | string[], assunto: string, html: string): Promise<{ ok: boolean; simulado?: boolean }> {
  const chave = process.env.RESEND_API_KEY
  if (!chave) { log.info('[email] RESEND_API_KEY ausente — não enviado', { para, assunto }); return { ok: false, simulado: true } }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.RESEND_FROM || 'Clinical 360 <onboarding@resend.dev>', to: Array.isArray(para) ? para : [para], subject: assunto, html }),
    })
    if (!r.ok) log.warn('[email] Resend recusou:', r.status, (await r.text()).slice(0, 300))
    return { ok: r.ok }
  } catch (e: any) { log.warn('[email] falhou:', e?.message); return { ok: false } }
}

export const escaparHtml = (s: any) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
