import { describe, it, expect } from 'vitest'
import { agruparParaLote, statusRetorno } from '../lotes'
import type { Guia } from '../tipos'

const g = (id: string, op: string, tipo: 'consulta' | 'sp_sadt', data: string, valor: number) =>
  ({ id, operadora_id: op, tipo, data_atendimento: data, valor_total: valor, procedimentos: [], numero_guia_prestador: id, status: 'pronta' }) as Guia

describe('lotes', () => {
  it('separa por operadora, tipo de guia e competência', () => {
    const grupos = agruparParaLote([
      g('1', 'a', 'consulta', '2026-09-01', 100), g('2', 'a', 'consulta', '2026-09-20', 50.5),
      g('3', 'a', 'sp_sadt', '2026-09-02', 30), g('4', 'b', 'consulta', '2026-09-03', 10), g('5', 'a', 'consulta', '2026-10-01', 1),
    ])
    expect(grupos).toHaveLength(4)
    expect(grupos[0]).toMatchObject({ operadora_id: 'a', tipo_guia: 'consulta', competencia: '2026-09', valor_total: 150.5 })
    expect(grupos[0].guias.map(x => x.id)).toEqual(['1', '2'])
  })
  it('statusRetorno', () => {
    expect(statusRetorno(100, 100)).toEqual({ status: 'paga', valor_glosado: 0 })
    expect(statusRetorno(100, 0)).toEqual({ status: 'glosada', valor_glosado: 100 })
    expect(statusRetorno(100, 72.3)).toEqual({ status: 'paga_parcial', valor_glosado: 27.7 })
  })
})
