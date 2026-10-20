import { describe, it, expect } from 'vitest'
import { statusVisivel, totalDe } from '@/lib/orcamentos/calculos'

describe('orçamentos', () => {
  it('soma itens e aplica desconto sem ficar negativo', () => {
    expect(totalDe([{ descricao: 'A', quantidade: 2, valor_unitario: 150.5 }, { descricao: 'B', quantidade: 1, valor_unitario: 99.9 }], 50)).toEqual({ bruto: 400.9, total: 350.9 })
    expect(totalDe([{ descricao: 'A', quantidade: 1, valor_unitario: 10 }], 99).total).toBe(0)
  })
  it('enviado com validade vencida aparece como expirado; respondido não muda', () => {
    expect(statusVisivel({ status: 'enviado', validade: '2000-01-01' })).toBe('expirado')
    expect(statusVisivel({ status: 'aprovado', validade: '2000-01-01' })).toBe('aprovado')
    expect(statusVisivel({ status: 'visto', validade: '2999-01-01' })).toBe('visto')
  })
})
