import type { Intervalo } from './tipos'

export type PeriodoId = 'mes' | 'mes_passado' | '3m' | 'ano' | 'custom'

export const PERIODOS: { value: PeriodoId; label: string }[] = [
  { value: 'mes', label: 'Este mês' },
  { value: 'mes_passado', label: 'Mês passado' },
  { value: '3m', label: 'Últimos 3 meses' },
  { value: 'ano', label: 'Este ano' },
  { value: 'custom', label: 'Personalizado' },
]

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
export const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const inicioMes = (d: Date, delta = 0) => new Date(d.getFullYear(), d.getMonth() + delta, 1)

/** "2026-03-05" → Date local às 00:00 (evita o deslocamento UTC de new Date(string)). */
export function dataLocal(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, (m || 1) - 1, d || 1)
}

export function paraInputData(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function intervaloPeriodo(p: PeriodoId, hoje: Date, custom?: { ini: string; fim: string }): Intervalo {
  if (p === 'mes') return { ini: inicioMes(hoje), fim: inicioMes(hoje, 1) }
  if (p === 'mes_passado') return { ini: inicioMes(hoje, -1), fim: inicioMes(hoje) }
  if (p === '3m') return { ini: inicioMes(hoje, -2), fim: inicioMes(hoje, 1) }
  if (p === 'ano') return { ini: new Date(hoje.getFullYear(), 0, 1), fim: new Date(hoje.getFullYear() + 1, 0, 1) }
  const ini = custom?.ini ? dataLocal(custom.ini) : inicioMes(hoje)
  let fim = custom?.fim ? dataLocal(custom.fim) : new Date(hoje)
  fim = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate() + 1) // fim do dia, exclusivo
  return fim > ini ? { ini, fim } : { ini, fim: new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() + 1) }
}

/** Período imediatamente anterior, do mesmo tamanho (em meses quando o intervalo é de meses cheios). */
export function intervaloAnterior(i: Intervalo): Intervalo {
  const mesesCheios = i.ini.getDate() === 1 && i.fim.getDate() === 1 && i.ini.getHours() === 0 && i.fim.getHours() === 0
  if (mesesCheios) {
    const n = (i.fim.getFullYear() - i.ini.getFullYear()) * 12 + (i.fim.getMonth() - i.ini.getMonth())
    return { ini: inicioMes(i.ini, -n), fim: new Date(i.ini) }
  }
  const dias = Math.round((i.fim.getTime() - i.ini.getTime()) / 86400000)
  return { ini: new Date(i.ini.getFullYear(), i.ini.getMonth(), i.ini.getDate() - dias), fim: new Date(i.ini) }
}

export function rotuloIntervalo(i: Intervalo): string {
  const ult = new Date(i.fim.getFullYear(), i.fim.getMonth(), i.fim.getDate() - 1)
  const mesesCheios = i.ini.getDate() === 1 && i.fim.getDate() === 1
  if (mesesCheios) {
    const n = (i.fim.getFullYear() - i.ini.getFullYear()) * 12 + (i.fim.getMonth() - i.ini.getMonth())
    if (n === 1) return `${cap(MESES[i.ini.getMonth()])} ${i.ini.getFullYear()}`
    if (n === 12 && i.ini.getMonth() === 0) return String(i.ini.getFullYear())
    return `${MESES_CURTOS[i.ini.getMonth()]} ${i.ini.getFullYear() !== ult.getFullYear() ? i.ini.getFullYear() + ' ' : ''}– ${MESES_CURTOS[ult.getMonth()]} ${ult.getFullYear()}`
  }
  const f = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  return `${f(i.ini)} – ${f(ult)}`
}

/** Texto curto da comparação para os KPIs. */
export function rotuloComparacao(p: PeriodoId): string {
  return p === 'mes' || p === 'mes_passado' ? 'vs. mês anterior'
    : p === '3m' ? 'vs. 3 meses anteriores'
    : p === 'ano' ? 'vs. ano anterior'
    : 'vs. período anterior'
}

/** Meses (intervalos) que cobrem os últimos `n` meses até o fim do intervalo. */
export function mesesAte(fim: Date, n: number): Intervalo[] {
  const ultimo = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate() - 1)
  return Array.from({ length: n }, (_, k) => {
    const ini = new Date(ultimo.getFullYear(), ultimo.getMonth() - (n - 1 - k), 1)
    return { ini, fim: new Date(ini.getFullYear(), ini.getMonth() + 1, 1) }
  })
}

/** Converte texto do banco em Date; datas puras ("2026-03-05") viram meia-noite local. */
export function paraData(s: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? dataLocal(s) : new Date(s)
}

export const dentro = (d: Date, i: Intervalo) => d >= i.ini && d < i.fim

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
