'use client'
/**
 * Texto ao vivo durante a gravação (Deepgram em tempo real) é opcional: custa mais e gasta
 * +1 crédito por consulta. Desligado, a consulta é gravada e transcrita uma vez só, no fim.
 * Preferência guardada por navegador.
 */
const CHAVE = 'c360-ao-vivo'
export function lerAoVivo(): boolean {
  try { return localStorage.getItem(CHAVE) === '1' } catch { return false }
}
export function salvarAoVivo(v: boolean) {
  try { localStorage.setItem(CHAVE, v ? '1' : '0') } catch {}
}
