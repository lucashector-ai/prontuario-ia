import { describe, it, expect } from 'vitest'
import { validarGuia, validarOperadora, validarGuias, errosDoCampo } from '../validar'
import { interpretarCrm, cbosDaEspecialidade, totalProcedimentos } from '../tipos'
import { buscarTuss } from '../tuss'
import type { Guia } from '../tipos'

const hoje = '2026-10-02'
const op = { id: 'o1', nome: 'Unimed', registro_ans: '123456', codigo_prestador: 'PRE001', cnes: '9999999' }

function guia(p: Partial<Guia> = {}): Partial<Guia> {
  return {
    operadora_id: 'o1', tipo: 'consulta', numero_guia_prestador: '15', numero_carteira: '0 0123 4567',
    nome_beneficiario: 'Maria Souza', data_atendimento: '2026-09-30', tipo_consulta: '2',
    procedimentos: [{ codigo_tuss: '10101012', descricao: 'Consulta', quantidade: 1, valor_unitario: 110 }],
    profissional: { nome: 'Dr. Paulo', conselho: '06', numero: '98765', uf: '35', cbos: '225125' },
    ...p,
  }
}
const campos = (r: ReturnType<typeof validarGuia>) => r.erros.map(e => e.campo)

describe('validarOperadora', () => {
  it('aceita operadora completa', () => expect(validarOperadora(op).ok).toBe(true))
  it('exige registro ANS com 6 dígitos e código do prestador', () => {
    const r = validarOperadora({ nome: 'X', registro_ans: '12345', codigo_prestador: '' })
    expect(r.erros.map(e => e.campo)).toEqual(['registro_ans', 'codigo_prestador'])
  })
  it('CNES com 7 dígitos', () => expect(validarOperadora({ ...op, cnes: '12' }).erros[0].campo).toBe('cnes'))
})

describe('validarGuia', () => {
  it('guia correta passa', () => {
    const r = validarGuia(guia(), { hoje, operadora: op })
    expect(r.erros).toEqual([])
    expect(r.ok).toBe(true)
  })

  it('carteirinha obrigatória e com caracteres válidos', () => {
    expect(campos(validarGuia(guia({ numero_carteira: '' }), { hoje }))).toContain('numero_carteira')
    expect(campos(validarGuia(guia({ numero_carteira: '123/45' }), { hoje }))).toContain('numero_carteira')
    expect(campos(validarGuia(guia({ numero_carteira: '1'.repeat(21) }), { hoje }))).toContain('numero_carteira')
  })

  it('registro ANS da operadora vira erro da guia', () => {
    const r = validarGuia(guia(), { hoje, operadora: { ...op, registro_ans: 'ABC' } })
    expect(r.ok).toBe(false)
    expect(r.erros[0].mensagem).toMatch(/Registro ANS/)
  })

  it('código TUSS com 8 dígitos', () => {
    const r = validarGuia(guia({ procedimentos: [{ codigo_tuss: '1010101', descricao: '', quantidade: 1, valor_unitario: 10 }] }), { hoje })
    expect(campos(r)).toContain('procedimentos.0.codigo_tuss')
    const r2 = validarGuia(guia({ procedimentos: [{ codigo_tuss: '1010-1012', descricao: '', quantidade: 1, valor_unitario: 10 }] }), { hoje })
    expect(campos(r2)).toContain('procedimentos.0.codigo_tuss')
  })

  it('valores e quantidades maiores que zero', () => {
    const r = validarGuia(guia({ procedimentos: [{ codigo_tuss: '10101012', descricao: '', quantidade: 0, valor_unitario: 0 }] }), { hoje })
    expect(campos(r)).toEqual(expect.arrayContaining(['procedimentos.0.quantidade', 'procedimentos.0.valor_unitario', 'valor_total']))
  })

  it('CID no formato A00 / A00.0', () => {
    expect(validarGuia(guia({ cid_principal: 'J06.9' }), { hoje }).ok).toBe(true)
    expect(validarGuia(guia({ cid_principal: 'I10' }), { hoje }).ok).toBe(true)
    expect(campos(validarGuia(guia({ cid_principal: '10J' }), { hoje }))).toContain('cid_principal')
  })

  it('datas: inválida, futura e antiga (aviso)', () => {
    expect(campos(validarGuia(guia({ data_atendimento: '2026-02-30' }), { hoje }))).toContain('data_atendimento')
    expect(campos(validarGuia(guia({ data_atendimento: '2026-10-03' }), { hoje }))).toContain('data_atendimento')
    const antiga = validarGuia(guia({ data_atendimento: '2026-05-01' }), { hoje })
    expect(antiga.ok).toBe(true)
    expect(antiga.avisos.map(a => a.campo)).toContain('data_atendimento')
  })

  it('guia de consulta aceita só um procedimento', () => {
    const p = { codigo_tuss: '10101012', descricao: '', quantidade: 1, valor_unitario: 10 }
    expect(campos(validarGuia(guia({ procedimentos: [p, p] }), { hoje }))).toContain('procedimentos')
    expect(validarGuia(guia({ tipo: 'sp_sadt', procedimentos: [p, p] }), { hoje }).ok).toBe(true)
  })

  it('profissional: CRM, UF e CBO-S', () => {
    const r = validarGuia(guia({ profissional: { numero: '', uf: 'SP', cbos: '22512' } }), { hoje })
    expect(campos(r)).toEqual(expect.arrayContaining(['profissional.numero', 'profissional.uf', 'profissional.cbos']))
  })

  it('validarGuias devolve só as com problema; errosDoCampo filtra', () => {
    const res = validarGuias([guia(), guia({ numero_carteira: '' })], { o1: op }, hoje)
    expect(res).toHaveLength(1)
    expect(errosDoCampo(res[0].r, 'numero_carteira')[0]).toMatch(/carteirinha/)
  })
})

describe('auxiliares', () => {
  it('interpretarCrm', () => {
    expect(interpretarCrm('CRM-SP 123.456')).toEqual({ numero: '123456', uf: '35' })
    expect(interpretarCrm('54321/RJ')).toEqual({ numero: '54321', uf: '33' })
    expect(interpretarCrm('')).toEqual({ numero: '', uf: '' })
  })
  it('cbosDaEspecialidade', () => {
    expect(cbosDaEspecialidade('Cardiologia')).toBe('225120')
    expect(cbosDaEspecialidade(null)).toBe('225125')
  })
  it('totalProcedimentos arredonda centavos', () => {
    expect(totalProcedimentos([{ codigo_tuss: '', descricao: '', quantidade: 3, valor_unitario: 0.1 }])).toBe(0.3)
  })
  it('buscarTuss por código e por palavras, priorizando a tabela da operadora', () => {
    expect(buscarTuss('101010')[0].codigo).toBe('10101012')
    expect(buscarTuss('hemograma')[0].codigo).toBe('40304361')
    const r = buscarTuss('consulta', [{ codigo: '10101012', descricao: 'Consulta eletiva', valor: 150 }])
    expect(r[0]).toMatchObject({ codigo: '10101012', valor: 150, daTabela: true })
    expect(r.filter(x => x.codigo === '10101012')).toHaveLength(1)
  })
})

import { interpretarCsvPrecos, interpretarValor } from '../csv'

describe('importar CSV de preços', () => {
  it('lê cabeçalho, vírgula decimal e ignora linhas ruins', () => {
    const csv = 'codigo;descricao;valor\n10101012;Consulta em consultório;150,00\n40304361;Hemograma;R$ 1.234,56\n123;X;10\n40302040;Glicose;abc\n\n40302040;Glicose;9.90'
    const r = interpretarCsvPrecos(csv)
    expect(r.itens).toEqual([
      { codigo_tuss: '10101012', descricao: 'Consulta em consultório', valor: 150 },
      { codigo_tuss: '40304361', descricao: 'Hemograma', valor: 1234.56 },
      { codigo_tuss: '40302040', descricao: 'Glicose', valor: 9.9 },
    ])
    expect(r.ignorados.map(i => i.linha)).toEqual([4, 5])
  })
  it('interpretarValor', () => {
    expect(interpretarValor('150.5')).toBe(150.5)
    expect(interpretarValor('1.500,00')).toBe(1500)
  })
})
