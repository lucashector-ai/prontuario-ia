import { describe, it, expect } from 'vitest'
import {
  distribuirParcelas, vencimentoParcela,
  statusEfetivoRecebimento, statusEfetivoDespesa,
} from './calculos'

describe('distribuirParcelas', () => {
  it('à vista devolve o total inteiro', () => {
    expect(distribuirParcelas(150, 1)).toEqual([150])
  })

  it('divide igualmente quando não há resto', () => {
    expect(distribuirParcelas(300, 3)).toEqual([100, 100, 100])
  })

  it('joga o resto de centavos na última parcela', () => {
    const p = distribuirParcelas(100, 3)
    expect(p).toEqual([33.33, 33.33, 33.34])
  })

  it('a soma das parcelas sempre bate com o total', () => {
    for (const [total, n] of [[100, 3], [99.99, 2], [1234.57, 7], [50, 6]] as const) {
      const soma = distribuirParcelas(total, n).reduce((s, v) => s + v, 0)
      expect(Math.round(soma * 100) / 100).toBe(total)
    }
  })
})

describe('vencimentoParcela', () => {
  it('a 1ª parcela vence na data base', () => {
    const base = new Date(2026, 4, 21)
    expect(vencimentoParcela(0, base)).toBe('2026-05-21')
  })

  it('cada parcela seguinte vence ~30 dias depois', () => {
    const base = new Date(2026, 4, 21)
    const d0 = new Date(vencimentoParcela(0, base))
    const d1 = new Date(vencimentoParcela(1, base))
    const dias = (d1.getTime() - d0.getTime()) / 86400000
    expect(dias).toBe(30)
  })
})

describe('statusEfetivoRecebimento', () => {
  const hoje = '2026-05-21'

  it('pendente vencido vira atrasado', () => {
    expect(statusEfetivoRecebimento({ status: 'pendente', vencimento: '2026-05-10' }, hoje)).toBe('atrasado')
  })

  it('parcial vencido vira atrasado', () => {
    expect(statusEfetivoRecebimento({ status: 'parcial', vencimento: '2026-05-01' }, hoje)).toBe('atrasado')
  })

  it('pendente a vencer continua pendente', () => {
    expect(statusEfetivoRecebimento({ status: 'pendente', vencimento: '2026-06-10' }, hoje)).toBe('pendente')
  })

  it('pago nunca vira atrasado', () => {
    expect(statusEfetivoRecebimento({ status: 'pago', vencimento: '2026-01-01' }, hoje)).toBe('pago')
  })

  it('sem vencimento mantém o status', () => {
    expect(statusEfetivoRecebimento({ status: 'pendente', vencimento: null }, hoje)).toBe('pendente')
  })
})

describe('statusEfetivoDespesa', () => {
  const hoje = '2026-05-21'

  it('pendente vencida vira atrasado', () => {
    expect(statusEfetivoDespesa({ status: 'pendente', vencimento: '2026-05-01' }, hoje)).toBe('atrasado')
  })

  it('pendente a vencer continua pendente', () => {
    expect(statusEfetivoDespesa({ status: 'pendente', vencimento: '2026-06-01' }, hoje)).toBe('pendente')
  })

  it('paga não vira atrasado mesmo vencida', () => {
    expect(statusEfetivoDespesa({ status: 'pago', vencimento: '2026-01-01' }, hoje)).toBe('pago')
  })
})
