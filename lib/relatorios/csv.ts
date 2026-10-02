/** CSV no padrão do Excel pt-BR: separador ";", vírgula decimal, BOM UTF-8. */

export type ValorCsv = string | number | null | undefined

function celula(v: ValorCsv): string {
  if (v === null || v === undefined) return ''
  const s = typeof v === 'number' ? String(Number.isInteger(v) ? v : Math.round(v * 100) / 100).replace('.', ',') : String(v)
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function paraCsv(cabecalho: string[], linhas: ValorCsv[][]): string {
  return [cabecalho, ...linhas].map(l => l.map(celula).join(';')).join('\r\n')
}

/** Dispara o download no navegador. */
export function baixarCsv(nome: string, cabecalho: string[], linhas: ValorCsv[][]) {
  const blob = new Blob(['﻿' + paraCsv(cabecalho, linhas)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome.endsWith('.csv') ? nome : `${nome}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Taxa 0–1 → número em % com 1 casa (para planilha). */
export const pctCsv = (v: number | null) => v === null ? null : Math.round(v * 1000) / 10
