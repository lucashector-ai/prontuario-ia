import { describe, it, expect } from 'vitest'
import { alertasDoItem, sugestaoReposicao } from '@/lib/estoque/calculos'

describe('estoque', () => {
  it('sugere o consumo da cobertura mais a agenda, menos o saldo útil', () => {
    // 60 em 30 dias = 2/dia × 30 = 60; + 10 da agenda = 70; saldo 30 → comprar 40
    expect(sugestaoReposicao({ saldo: 30, minimo: 0, consumo30: 60, previsto14: 10, vencendo: 0 }).sugerido).toBe(40)
  })
  it('lote que vence dentro da cobertura não conta como saldo', () => {
    expect(sugestaoReposicao({ saldo: 30, minimo: 0, consumo30: 60, previsto14: 0, vencendo: 20 }).sugerido).toBe(50)
  })
  it('sem consumo, garante ao menos o mínimo', () => {
    const r = sugestaoReposicao({ saldo: 2, minimo: 10, consumo30: 0, previsto14: 0, vencendo: 0 })
    expect(r.sugerido).toBe(8)
    expect(r.porque.join(' ')).toContain('mínimo')
  })
  it('nada a comprar quando sobra', () => {
    expect(sugestaoReposicao({ saldo: 500, minimo: 10, consumo30: 30, previsto14: 5, vencendo: 0 }).sugerido).toBe(0)
  })
  it('alertas de saldo e validade', () => {
    expect(alertasDoItem({ saldo: 0, minimo: 5, proximaValidade: null }, '2026-10-20')).toEqual(['zerado'])
    expect(alertasDoItem({ saldo: 3, minimo: 5, proximaValidade: '2026-10-25' }, '2026-10-20')).toEqual(['abaixo_minimo', 'vence_7'])
    expect(alertasDoItem({ saldo: 9, minimo: 5, proximaValidade: '2026-10-01' }, '2026-10-20')).toEqual(['vencido'])
  })
})
