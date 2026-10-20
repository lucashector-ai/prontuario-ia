import { describe, it, expect } from 'vitest'
import { riscoFalta, riscosDaAgenda } from '@/lib/agenda/riscoFalta'

const agora = new Date('2026-10-20T12:00:00-03:00')
const amanha = '2026-10-21T10:00:00-03:00'
const passado = (dias: number, status: string, id = 'p' + dias) => ({ id, paciente_id: 'pac', data_hora: new Date(agora.getTime() - dias * 86400000).toISOString(), status })

describe('riscoFalta', () => {
  it('ignora agendamentos passados ou cancelados', () => {
    expect(riscoFalta({ id: 'a', data_hora: '2026-10-19T10:00:00-03:00', status: 'agendado' }, [], undefined, agora)).toBeNull()
    expect(riscoFalta({ id: 'a', data_hora: amanha, status: 'cancelado' }, [], undefined, agora)).toBeNull()
  })

  it('paciente que faltou duas vezes é risco alto, com o motivo escrito', () => {
    const r = riscoFalta({ id: 'a', data_hora: amanha, status: 'agendado' }, [passado(30, 'faltou'), passado(60, 'faltou'), passado(90, 'realizado')], undefined, agora)!
    expect(r.nivel).toBe('alto')
    expect(r.motivos[0]).toContain('Faltou 2 vezes')
  })

  it('confirmar presença derruba o risco', () => {
    const r = riscoFalta({ id: 'a', data_hora: amanha, status: 'confirmado' }, [passado(30, 'faltou')], undefined, agora)!
    expect(r.nivel).toBe('baixo')
    expect(r.motivos).toContain('Confirmou presença')
  })

  it('quem avisou que não vai é risco alto', () => {
    const r = riscoFalta({ id: 'a', data_hora: amanha, status: 'agendado', confirmacao_24h_status: 'nao_confirmado' }, [passado(30, 'realizado')], undefined, agora)!
    expect(r.nivel).toBe('alto')
  })

  it('paciente assíduo sem pendências é risco baixo', () => {
    const r = riscoFalta({ id: 'a', data_hora: amanha, status: 'agendado' }, [passado(30, 'realizado'), passado(60, 'realizado')], undefined, agora)!
    expect(r.nivel).toBe('baixo')
    expect(r.motivos).toEqual([])
  })

  it('calcula a agenda inteira agrupando por paciente', () => {
    const m = riscosDaAgenda([passado(30, 'faltou'), passado(60, 'faltou'), { id: 'futuro', paciente_id: 'pac', data_hora: amanha, status: 'agendado' }], agora)
    expect(m.get('futuro')?.nivel).toBe('alto')
    expect(m.has('p30')).toBe(false)
  })
})
