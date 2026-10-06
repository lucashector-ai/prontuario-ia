import { describe, expect, it } from 'vitest'
import { agruparPorData, tempoRelativo, type Notificacao } from '../notificacoes'

const n = (id: string, criada_em: string): Notificacao => ({
  id, tipo: null, titulo: id, descricao: null, link: null, lida: false, criada_em, agendamento_id: null, paciente_id: null,
})

describe('notificações', () => {
  const agora = new Date('2026-10-06T15:00:00')

  it('agrupa em Hoje, Ontem, Esta semana e Anteriores, mantendo a ordem', () => {
    const grupos = agruparPorData([
      n('a', '2026-10-06T14:00:00'), n('b', '2026-10-06T08:00:00'),
      n('c', '2026-10-05T20:00:00'), n('d', '2026-10-02T10:00:00'), n('e', '2026-09-01T10:00:00'),
    ], agora)
    expect(grupos.map(g => [g.titulo, g.itens.map(i => i.id).join('')])).toEqual([
      ['Hoje', 'ab'], ['Ontem', 'c'], ['Esta semana', 'd'], ['Anteriores', 'e'],
    ])
  })

  it('mostra o tempo relativo curto', () => {
    const t = agora.getTime()
    expect(tempoRelativo('2026-10-06T14:59:40', t)).toBe('agora')
    expect(tempoRelativo('2026-10-06T14:30:00', t)).toBe('30 min')
    expect(tempoRelativo('2026-10-06T12:00:00', t)).toBe('3 h')
    expect(tempoRelativo('2026-10-03T15:00:00', t)).toBe('3 d')
    expect(tempoRelativo('2026-09-22T15:00:00', t)).toBe('2 sem')
  })
})
