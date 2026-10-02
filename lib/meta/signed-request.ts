import { createHmac, timingSafeEqual } from 'node:crypto'

/** Lê o "signed_request" que a Meta envia em desautorização/exclusão de dados. */
export function lerSignedRequest(sr: string | null): Record<string, any> | null {
  if (!sr) return null
  const [sig, corpo] = sr.split('.')
  if (!sig || !corpo) return null
  for (const segredo of [process.env.INSTAGRAM_APP_SECRET, process.env.META_APP_SECRET].filter(Boolean) as string[]) {
    const esperado = createHmac('sha256', segredo).update(corpo).digest('base64url')
    const a = Buffer.from(sig), b = Buffer.from(esperado)
    if (a.length === b.length && timingSafeEqual(a, b)) {
      try { return JSON.parse(Buffer.from(corpo, 'base64url').toString()) } catch { return null }
    }
  }
  return null
}
