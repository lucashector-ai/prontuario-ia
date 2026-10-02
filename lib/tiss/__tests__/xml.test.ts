import { describe, it, expect } from 'vitest'
import { createHash } from 'crypto'
import { gerarXmlLote, escaparXml, paraLatin1, hashTiss, montarConteudo, valoresConcatenados, xmlParaBytes, type DadosLote } from '../xml'
import { md5Bytes, md5Latin1 } from '../md5'
import type { Guia } from '../tipos'

const op = { registro_ans: '123456', codigo_prestador: 'PRE001', cnes: '1234567', nome_contratado: 'Clínica São José & Filhos', versao_tiss: '4.01.00' }

function guia(p: Partial<Guia> = {}): Guia {
  return {
    id: 'g1', operadora_id: 'o1', tipo: 'consulta', numero_guia_prestador: '1', numero_carteira: '0012345678',
    nome_beneficiario: 'João <Teste>', data_atendimento: '2026-09-15', procedimentos: [
      { codigo_tuss: '10101012', descricao: 'Consulta em consultório', quantidade: 1, valor_unitario: 120 },
    ], valor_total: 120, tipo_consulta: '1', indicacao_acidente: '9', carater_atendimento: '1',
    profissional: { nome: 'Dra. Ana Lúcia', conselho: '06', numero: '123456', uf: '35', cbos: '225125' },
    status: 'pronta', ...p,
  }
}

const agora = new Date('2026-10-01T13:30:05Z') // 10:30:05 em São Paulo
const base = (guias: Guia[], tipo: 'consulta' | 'sp_sadt' = 'consulta'): DadosLote => ({ operadora: op, lote: { numero_lote: 7, tipo_guia: tipo }, guias, agora })

describe('md5', () => {
  it('bate com o crypto do Node (inclusive acentos em Latin-1)', () => {
    for (const s of ['', 'abc', 'São Paulo — ação', 'x'.repeat(1000), 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64)]) {
      const lat = paraLatin1(s)
      expect(md5Latin1(lat)).toBe(createHash('md5').update(Buffer.from(lat, 'latin1')).digest('hex'))
    }
  })
  it('vetor conhecido', () => {
    expect(md5Bytes(new TextEncoder().encode('The quick brown fox jumps over the lazy dog'))).toBe('9e107d9d372bb6826bd81d3542a419d6')
  })
})

describe('escape e texto', () => {
  it('escapa os 5 caracteres especiais', () => {
    expect(escaparXml(`a & b < c > d " e ' f`)).toBe('a &amp; b &lt; c &gt; d &quot; e &apos; f')
  })
  it('restringe ao Latin-1 e normaliza espaços', () => {
    expect(paraLatin1('  Ação\n  “ok” — 😀 ')).toBe('Ação "ok" - ?')
    expect(paraLatin1('abcdef', 3)).toBe('abc')
  })
})

describe('gerarXmlLote — consulta', () => {
  const { xml, hash, nomeArquivo } = gerarXmlLote(base([guia(), guia({ id: 'g2', numero_guia_prestador: '2' })]))

  it('declara ISO-8859-1 e o namespace TISS', () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="ISO-8859-1"?>')).toBe(true)
    expect(xml).toContain('xmlns:ans="http://www.ans.gov.br/padroes/tiss/schemas"')
    expect(xml).toContain('tissV4_01_00.xsd')
  })

  it('tem cabeçalho, lote, guias e epílogo na ordem certa', () => {
    const ordem = ['<ans:cabecalho>', '<ans:tipoTransacao>ENVIO_LOTE_GUIAS</ans:tipoTransacao>', '<ans:sequencialTransacao>7<',
      '<ans:dataRegistroTransacao>2026-10-01<', '<ans:horaRegistroTransacao>10:30:05<',
      '<ans:codigoPrestadorNaOperadora>PRE001<', '<ans:registroANS>123456<', '<ans:Padrao>4.01.00<',
      '<ans:prestadorParaOperadora>', '<ans:loteGuias>', '<ans:numeroLote>7<', '<ans:guiasTISS>', '<ans:guiaConsulta>',
      '<ans:epilogo>', '<ans:hash>']
    let pos = -1
    for (const t of ordem) {
      const i = xml.indexOf(t, pos + 1)
      expect(i, t).toBeGreaterThan(pos)
      pos = i
    }
    expect((xml.match(/<ans:guiaConsulta>/g) || []).length).toBe(2)
    expect(xml).toContain('<ans:codigoTabela>22</ans:codigoTabela><ans:codigoProcedimento>10101012</ans:codigoProcedimento><ans:valorProcedimento>120.00</ans:valorProcedimento>')
    expect(xml).toContain('<ans:numeroCarteira>0012345678</ans:numeroCarteira><ans:atendimentoRN>N</ans:atendimentoRN>')
    expect(xml).toContain('<ans:CNES>1234567</ans:CNES>')
    expect(xml.endsWith('</ans:mensagemTISS>')).toBe(true)
  })

  it('escapa o conteúdo no XML', () => {
    expect(xml).toContain('<ans:nomeContratado>Clínica São José &amp; Filhos</ans:nomeContratado>')
    expect(xml).not.toContain('São José & Filhos')
  })

  it('hash = MD5 dos valores concatenados (sem tags, texto não escapado, Latin-1)', () => {
    const conteudo = montarConteudo(base([guia(), guia({ id: 'g2', numero_guia_prestador: '2' })]))
    const concat = conteudo.map(valoresConcatenados).join('')
    expect(concat).toContain('Clínica São José & Filhos') // valor original, não escapado
    expect(concat.startsWith('ENVIO_LOTE_GUIAS72026-10-0110:30:05PRE0011234564.01.00')).toBe(true)
    const esperado = createHash('md5').update(Buffer.from(concat, 'latin1')).digest('hex')
    expect(hash).toBe(esperado)
    expect(hashTiss(conteudo)).toBe(esperado)
    expect(xml).toContain(`<ans:hash>${esperado}</ans:hash>`)
  })

  it('hash recalculado a partir do próprio XML (removendo tags) confere', () => {
    const semEpilogo = xml.replace(/<ans:epilogo>.*<\/ans:epilogo>/, '').replace(/^<\?xml[^>]*\?>/, '')
    const texto = semEpilogo.replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
    expect(createHash('md5').update(Buffer.from(texto, 'latin1')).digest('hex')).toBe(hash)
  })

  it('muda o hash quando um valor muda', () => {
    const outro = gerarXmlLote(base([guia({ numero_carteira: '999' }), guia({ id: 'g2', numero_guia_prestador: '2' })]))
    expect(outro.hash).not.toBe(hash)
  })

  it('nome do arquivo no padrão sequencial_hash.xml', () => {
    expect(nomeArquivo).toBe(`00000000000000000007_${hash}.xml`)
  })

  it('bytes em ISO-8859-1 (1 byte por caractere)', () => {
    const bytes = xmlParaBytes(xml)
    expect(bytes.length).toBe(xml.length)
    expect(Buffer.from(bytes).toString('latin1')).toBe(xml)
  })
})

describe('gerarXmlLote — SP/SADT', () => {
  const g = guia({
    tipo: 'sp_sadt', tipo_atendimento: '05', procedimentos: [
      { codigo_tuss: '40304361', descricao: 'Hemograma', quantidade: 1, valor_unitario: 15.5 },
      { codigo_tuss: '40302040', descricao: 'Glicose', quantidade: 2, valor_unitario: 8 },
    ],
  })
  const { xml } = gerarXmlLote(base([g], 'sp_sadt'))

  it('gera itens sequenciais e totais', () => {
    expect(xml).toContain('<ans:guiaSP-SADT>')
    expect(xml).toContain('<ans:sequencialItem>1</ans:sequencialItem>')
    expect(xml).toContain('<ans:sequencialItem>2</ans:sequencialItem>')
    expect(xml).toContain('<ans:quantidadeExecutada>2</ans:quantidadeExecutada>')
    expect(xml).toContain('<ans:valorTotal>16.00</ans:valorTotal>')
    expect(xml).toContain('<ans:valorProcedimentos>31.50</ans:valorProcedimentos><ans:valorTotalGeral>31.50</ans:valorTotalGeral>')
    expect(xml).toContain('<ans:tipoAtendimento>05</ans:tipoAtendimento>')
    expect(xml).not.toContain('<ans:tipoConsulta>') // só quando tipoAtendimento = 04
  })

  it('recusa lote com tipos misturados', () => {
    expect(() => gerarXmlLote(base([g, guia()], 'sp_sadt'))).toThrow(/único tipo/)
    expect(() => gerarXmlLote(base([], 'consulta'))).toThrow(/não tem guias/)
  })
})
