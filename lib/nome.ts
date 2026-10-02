/**
 * Primeiro nome para saudações, mantendo o título quando houver:
 *   "Dra. Ana Lima" → "Dra. Ana" · "Dr Paulo" → "Dr Paulo" · "Ricardo Almeida" → "Ricardo"
 */
export function primeiroNome(nome?: string | null, padrao = ''): string {
  const partes = (nome || '').trim().split(/\s+/).filter(Boolean)
  if (!partes.length) return padrao
  return /^(dra?|dr|prof|profa)\.?$/i.test(partes[0]) ? partes.slice(0, 2).join(' ') : partes[0]
}
