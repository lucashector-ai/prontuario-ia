/** Datas de retorno ('YYYY-MM-DD', sem fuso) — utilitários do cliente. */

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

/** Hoje em São Paulo. */
export function hojeISO(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

export function somarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10)
}

export function diffDias(de: string, ate: string): number {
  const p = (s: string) => { const [a, m, d] = s.slice(0, 10).split('-').map(Number); return Date.UTC(a, m - 1, d) }
  return Math.round((p(ate) - p(de)) / 86400000)
}

/** '2026-11-14' → '14 nov' (com ano se for outro ano) */
export function fmtDia(iso: string, comSemana = false): string {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  const ano = a !== Number(hojeISO().slice(0, 4)) ? ` ${a}` : ''
  const sem = comSemana ? DIAS_SEMANA[new Date(Date.UTC(a, m - 1, d)).getUTCDay()] + ', ' : ''
  return `${sem}${d} ${MESES[m - 1]}${ano}`
}

/** "em 3 dias", "hoje", "há 5 dias" */
export function relativo(iso: string): string {
  const n = diffDias(hojeISO(), iso)
  if (n === 0) return 'hoje'
  if (n === 1) return 'amanhã'
  if (n === -1) return 'ontem'
  if (n > 0) return n < 60 ? `em ${n} dias` : `em ${Math.round(n / 30)} meses`
  return -n < 60 ? `há ${-n} dias` : `há ${Math.round(-n / 30)} meses`
}

/** Data de timestamp ISO → '14 nov 2025' */
export function fmtDataHora(ts?: string | null): string {
  if (!ts) return '—'
  const d = new Date(ts)
  if (isNaN(d.getTime())) return '—'
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`
}

export const ATALHOS_DIAS: { dias: number; label: string }[] = [
  { dias: 7, label: '7 dias' }, { dias: 15, label: '15 dias' }, { dias: 30, label: '30 dias' },
  { dias: 60, label: '60 dias' }, { dias: 90, label: '90 dias' }, { dias: 180, label: '6 meses' },
]

export function rotuloDias(dias: number): string {
  if (dias % 365 === 0) return dias === 365 ? '1 ano' : `${dias / 365} anos`
  if (dias >= 60 && dias % 30 === 0) return `${dias / 30} meses`
  if (dias === 30) return '30 dias'
  if (dias % 7 === 0 && dias < 30) return dias === 7 ? '1 semana' : `${dias / 7} semanas`
  return `${dias} dias`
}

export function telefoneBonito(t?: string | null): string {
  let d = (t || '').replace(/\D/g, '')
  if (!d) return 'Sem telefone'
  if (d.length >= 12 && d.startsWith('55')) d = d.slice(2)
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return t || ''
}

export const ehDemo = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === '1'
