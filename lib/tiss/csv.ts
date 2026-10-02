/**
 * Importação simples da tabela de preços: uma linha por item, `codigo;descricao;valor`.
 * Aceita cabeçalho, vírgula como separador decimal ("1.234,56") e separador `;` ou tab.
 */
export type LinhaPreco = { codigo_tuss: string; descricao: string; valor: number }

export function interpretarValor(bruto: string): number {
  let s = (bruto || '').replace(/[R$\s]/g, '')
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  const n = Number(s)
  return isFinite(n) ? Math.round(n * 100) / 100 : NaN
}

export function interpretarCsvPrecos(texto: string): { itens: LinhaPreco[]; ignorados: Array<{ linha: number; motivo: string }> } {
  const itens: LinhaPreco[] = []
  const ignorados: Array<{ linha: number; motivo: string }> = []
  const vistos = new Map<string, number>()
  ;(texto || '').replace(/^﻿/, '').split(/\r?\n/).forEach((l, i) => {
    const linha = i + 1
    if (!l.trim()) return
    const partes = l.split(/;|\t/).map(p => p.trim().replace(/^"|"$/g, ''))
    const codigo = (partes[0] || '').replace(/[.\-\s]/g, '')
    if (i === 0 && !/^\d+$/.test(codigo)) return // cabeçalho
    if (partes.length < 3) { ignorados.push({ linha, motivo: 'use codigo;descricao;valor' }); return }
    if (!/^\d{8}$/.test(codigo)) { ignorados.push({ linha, motivo: `código "${partes[0]}" não tem 8 dígitos` }); return }
    const valor = interpretarValor(partes[partes.length - 1])
    if (!(valor > 0)) { ignorados.push({ linha, motivo: `valor "${partes[partes.length - 1]}" inválido` }); return }
    const descricao = partes.slice(1, -1).join(' ').trim() || codigo
    if (vistos.has(codigo)) itens[vistos.get(codigo)!] = { codigo_tuss: codigo, descricao, valor } // última linha vence
    else { vistos.set(codigo, itens.length); itens.push({ codigo_tuss: codigo, descricao, valor }) }
  })
  return { itens, ignorados }
}
