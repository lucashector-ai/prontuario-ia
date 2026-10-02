import { tokens } from '@/lib/design-tokens'

/**
 * Convênios — fonte única para lista, nome normalizado e cor.
 * A mesma operadora tem SEMPRE a mesma cor em qualquer tela (selo, gráfico, ficha).
 */
export const CONVENIOS = [
  'Particular', 'Unimed', 'Amil', 'Bradesco Saúde', 'SulAmérica', 'Hapvida', 'NotreDame Intermédica',
  'Porto Seguro', 'Cassi', 'GEAP', 'Prevent Senior', 'Outro',
] as const

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

// Apelidos comuns digitados → nome oficial
const APELIDOS: Record<string, string> = {
  'bradesco': 'Bradesco Saúde', 'bradesco saude': 'Bradesco Saúde', 'sul america': 'SulAmérica', 'sulamerica': 'SulAmérica',
  'notredame': 'NotreDame Intermédica', 'notre dame': 'NotreDame Intermédica', 'intermedica': 'NotreDame Intermédica', 'gndi': 'NotreDame Intermédica',
  'porto': 'Porto Seguro', 'prevent': 'Prevent Senior', 'sem convenio': 'Particular', 'nenhum': 'Particular', 'particular': 'Particular',
}

/** "unimed " → "Unimed"; vazio → "Particular"; desconhecido → texto original aparado. */
export function normalizarConvenio(nome?: string | null): string {
  const bruto = (nome || '').trim()
  if (!bruto) return 'Particular'
  const k = semAcento(bruto)
  const oficial = CONVENIOS.find(c => semAcento(c) === k)
  if (oficial) return oficial
  if (APELIDOS[k]) return APELIDOS[k]
  const parcial = Object.keys(APELIDOS).find(a => k.startsWith(a))
  return parcial ? APELIDOS[parcial] : bruto
}

const D = tokens.data
const CORES: Record<string, string> = {
  'Unimed': D.green,
  'Amil': D.blue,
  'Bradesco Saúde': D.pink,
  'SulAmérica': D.orange,
  'Hapvida': 'oklch(0.62 0.16 25)',
  'NotreDame Intermédica': 'oklch(0.6 0.12 200)',
  'Porto Seguro': 'oklch(0.58 0.14 255)',
  'Cassi': 'oklch(0.7 0.13 95)',
  'GEAP': 'oklch(0.55 0.12 320)',
  'Prevent Senior': 'oklch(0.6 0.13 140)',
}
const EXTRAS = [D.purple, 'oklch(0.62 0.14 300)', 'oklch(0.66 0.12 190)', 'oklch(0.7 0.12 45)', 'oklch(0.6 0.12 270)']

/** Cor fixa do convênio (oklch da paleta de dados). Particular/Outros = cinza. */
export function corConvenio(nome?: string | null): string {
  const n = normalizarConvenio(nome)
  if (n === 'Particular' || n === 'Outro' || n === 'Outros') return 'oklch(0.7 0.01 285)'
  if (CORES[n]) return CORES[n]
  let h = 0
  for (const ch of n) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return EXTRAS[h % EXTRAS.length]
}
