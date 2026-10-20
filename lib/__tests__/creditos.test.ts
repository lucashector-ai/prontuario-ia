import { describe, it, expect } from 'vitest'
import { custoConsulta, calcularSaldo, creditosDoPlano, contarPalavras } from '@/lib/creditos'

describe('créditos', () => {
  it('consulta curta custa 1; cada ~20 min a mais, +1; texto ao vivo +1', () => {
    expect(custoConsulta({ palavras: 800 })).toBe(1)
    expect(custoConsulta({ palavras: 2200 })).toBe(1)
    expect(custoConsulta({ palavras: 2201 })).toBe(2)
    expect(custoConsulta({ palavras: 5000, aoVivo: true })).toBe(4)
  })
  it('texto digitado custa meio crédito', () => {
    expect(custoConsulta({ palavras: 9000, digitado: true })).toBe(0.5)
  })
  it('saldo soma plano e pacotes e desconta o uso; sem plano não tem limite', () => {
    expect(calcularSaldo('solo', 100, 50).disponivel).toBe(200)
    expect(calcularSaldo('gratis', 12, 0).disponivel).toBe(0)
    expect(calcularSaldo(null, 999, 0).disponivel).toBeNull()
    expect(creditosDoPlano('pro')).toBe(1000)
  })
  it('conta palavras', () => { expect(contarPalavras('  Médico: bom dia\nPaciente: oi ')).toBe(5) })
})
