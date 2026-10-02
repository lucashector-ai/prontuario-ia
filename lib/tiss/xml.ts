/**
 * Gera a mensagem TISS de ENVIO_LOTE_GUIAS (versão 4.01.00) para guias de
 * consulta ou SP/SADT.
 *
 * Como funciona: monta uma árvore de nós (tag + valor) e a partir DELA gera
 * tanto o XML quanto o hash — assim o hash sempre corresponde ao conteúdo.
 *
 * Regra do hash TISS (epílogo): MD5 da concatenação dos VALORES de todos os
 * elementos da mensagem (do <cabecalho> até o fim de <prestadorParaOperadora>),
 * sem tags/atributos, sem espaços entre elementos, com o texto original (não
 * escapado) codificado em ISO-8859-1. Por isso o XML é gerado compacto (sem
 * indentação) e todo texto é restrito ao Latin-1.
 *
 * Importante: o XML segue a estrutura do schema TISS 4.01.00, mas cada operadora
 * pode ter particularidades — valide o primeiro lote no portal/validador da
 * operadora antes de usar em produção.
 */
import { md5Latin1, bytesLatin1 } from './md5'
import type { Guia, Operadora, TipoGuia } from './tipos'
import { totalProcedimentos } from './tipos'

export const VERSAO_TISS = '4.01.00'
export const NS_TISS = 'http://www.ans.gov.br/padroes/tiss/schemas'
const P = 'ans:'

export type No = { tag: string; valor?: string; filhos?: No[] }

// ── Texto ────────────────────────────────────────────────────────────────

/** Restringe ao ISO-8859-1: remove acentos de caracteres fora dele, controles e espaços extras. */
export function paraLatin1(texto: unknown, max?: number): string {
  let s = String(texto ?? '')
  s = s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-')
  let out = ''
  for (const ch of Array.from(s)) {
    const c = ch.codePointAt(0)!
    if (c < 0x20 || (c >= 0x7f && c < 0xa0)) { out += ' '; continue }
    if (c <= 0xff) { out += ch; continue }
    const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '')
    out += Array.from(base).every(b => b.codePointAt(0)! <= 0xff) ? base : '?'
  }
  out = out.replace(/\s+/g, ' ').trim()
  return max ? out.slice(0, max) : out
}

/** Escapa os 5 caracteres especiais do XML. */
export function escaparXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

const dinheiro = (n: unknown) => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2)
const soDigitos = (s: unknown) => String(s ?? '').replace(/\D/g, '')

// ── Árvore ───────────────────────────────────────────────────────────────

function el(tag: string, valor: unknown, max?: number): No | null {
  if (valor === null || valor === undefined) return null
  const v = paraLatin1(valor, max)
  return v === '' ? null : { tag, valor: v }
}
function grupo(tag: string, filhos: Array<No | null | undefined | false>): No {
  return { tag, filhos: filhos.filter(Boolean) as No[] }
}

/** Concatena os valores (texto original, não escapado) em ordem de documento. */
export function valoresConcatenados(no: No): string {
  if (no.filhos) return no.filhos.map(valoresConcatenados).join('')
  return no.valor ?? ''
}

export function serializar(no: No): string {
  if (no.filhos) return `<${P}${no.tag}>${no.filhos.map(serializar).join('')}</${P}${no.tag}>`
  return `<${P}${no.tag}>${escaparXml(no.valor ?? '')}</${P}${no.tag}>`
}

/** Hash TISS: MD5 (hex minúsculo) dos valores concatenados, em ISO-8859-1. */
export function hashTiss(nos: No[]): string {
  return md5Latin1(nos.map(valoresConcatenados).join(''))
}

// ── Blocos ───────────────────────────────────────────────────────────────

export type DadosLote = {
  operadora: Pick<Operadora, 'registro_ans' | 'codigo_prestador' | 'cnes' | 'nome_contratado'> & { versao_tiss?: string | null }
  lote: { numero_lote: number; tipo_guia: TipoGuia }
  guias: Guia[]
  /** Data/hora de registro da transação (padrão: agora, em São Paulo). */
  agora?: Date
}

function dataHoraSP(d: Date): { data: string; hora: string } {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(d)
  const g = (t: string) => partes.find(p => p.type === t)?.value || '00'
  const hora = g('hour') === '24' ? '00' : g('hour')
  return { data: `${g('year')}-${g('month')}-${g('day')}`, hora: `${hora}:${g('minute')}:${g('second')}` }
}

function profissionalNo(tag: string, g: Guia): No {
  const p = g.profissional || {}
  return grupo(tag, [
    el('nomeProfissional', p.nome, 70),
    el('conselhoProfissional', p.conselho || '06'),
    el('numeroConselhoProfissional', soDigitos(p.numero), 15),
    el('UF', p.uf),
    el('CBOS', soDigitos(p.cbos)),
  ])
}

function beneficiarioNo(g: Guia): No {
  return grupo('dadosBeneficiario', [
    el('numeroCarteira', (g.numero_carteira || '').replace(/\s/g, ''), 20),
    el('atendimentoRN', 'N'),
  ])
}

function guiaConsultaNo(g: Guia, op: DadosLote['operadora']): No {
  const proc = g.procedimentos[0] || { codigo_tuss: '', valor_unitario: 0, quantidade: 1, descricao: '' }
  return grupo('guiaConsulta', [
    grupo('cabecalhoConsulta', [
      el('registroANS', soDigitos(op.registro_ans)),
      el('numeroGuiaPrestador', g.numero_guia_prestador, 20),
    ]),
    el('numeroGuiaOperadora', g.numero_guia_operadora, 20),
    beneficiarioNo(g),
    grupo('contratadoExecutante', [
      el('codigoPrestadorNaOperadora', op.codigo_prestador, 14),
      el('nomeContratado', op.nome_contratado, 70),
      el('CNES', soDigitos(op.cnes) || '9999999'),
    ]),
    profissionalNo('profissionalExecutante', g),
    el('indicacaoAcidente', g.indicacao_acidente || '9'),
    el('regimeAtendimento', '01'), // 01 = ambulatorial
    grupo('dadosAtendimento', [
      el('dataAtendimento', g.data_atendimento),
      el('tipoConsulta', g.tipo_consulta || '1'),
      grupo('procedimento', [
        el('codigoTabela', '22'),
        el('codigoProcedimento', soDigitos(proc.codigo_tuss)),
        el('valorProcedimento', dinheiro((Number(proc.quantidade) || 1) * (Number(proc.valor_unitario) || 0))),
      ]),
    ]),
    el('observacao', g.observacao, 500),
  ])
}

function guiaSadtNo(g: Guia, op: DadosLote['operadora']): No {
  const contratado = (tag: string) => grupo(tag, [
    el('codigoPrestadorNaOperadora', op.codigo_prestador, 14),
    el('nomeContratado', op.nome_contratado, 70),
  ])
  const total = totalProcedimentos(g.procedimentos)
  const tipoAtend = g.tipo_atendimento || '05'
  return grupo('guiaSP-SADT', [
    grupo('cabecalhoGuia', [
      el('registroANS', soDigitos(op.registro_ans)),
      el('numeroGuiaPrestador', g.numero_guia_prestador, 20),
    ]),
    g.numero_guia_operadora ? grupo('dadosAutorizacao', [el('numeroGuiaOperadora', g.numero_guia_operadora, 20)]) : null,
    beneficiarioNo(g),
    grupo('dadosSolicitante', [contratado('contratadoSolicitante'), profissionalNo('profissionalSolicitante', g)]),
    grupo('dadosSolicitacao', [
      el('dataSolicitacao', g.data_atendimento),
      el('caraterAtendimento', g.carater_atendimento || '1'),
    ]),
    grupo('dadosExecutante', [contratado('contratadoExecutante'), el('CNES', soDigitos(op.cnes) || '9999999')]),
    grupo('dadosAtendimento', [
      el('tipoAtendimento', tipoAtend),
      el('indicacaoAcidente', g.indicacao_acidente || '9'),
      tipoAtend === '04' ? el('tipoConsulta', g.tipo_consulta || '1') : null,
      el('regimeAtendimento', '01'),
    ]),
    grupo('procedimentosExecutados', g.procedimentos.map((p, i) => grupo('procedimentoExecutado', [
      el('sequencialItem', String(i + 1)),
      el('dataExecucao', g.data_atendimento),
      grupo('procedimento', [
        el('codigoTabela', '22'),
        el('codigoProcedimento', soDigitos(p.codigo_tuss)),
        el('descricaoProcedimento', p.descricao, 150),
      ]),
      el('quantidadeExecutada', String(Math.round(Number(p.quantidade) || 1))),
      el('reducaoAcrescimo', '1.00'),
      el('valorUnitario', dinheiro(p.valor_unitario)),
      el('valorTotal', dinheiro((Number(p.quantidade) || 0) * (Number(p.valor_unitario) || 0))),
    ]))),
    el('observacao', g.observacao, 500),
    grupo('valorTotal', [
      el('valorProcedimentos', dinheiro(total)),
      el('valorTotalGeral', dinheiro(total)),
    ]),
  ])
}

/** Nós de conteúdo da mensagem (cabeçalho + prestadorParaOperadora), base do hash. */
export function montarConteudo(d: DadosLote): No[] {
  const tipos = new Set(d.guias.map(g => g.tipo))
  if (tipos.size > 1 || (tipos.size === 1 && !tipos.has(d.lote.tipo_guia))) {
    throw new Error('Um lote TISS só pode ter guias de um único tipo (consulta ou SP/SADT).')
  }
  if (!d.guias.length) throw new Error('O lote não tem guias.')
  const { data, hora } = dataHoraSP(d.agora || new Date())
  const cabecalho = grupo('cabecalho', [
    grupo('identificacaoTransacao', [
      el('tipoTransacao', 'ENVIO_LOTE_GUIAS'),
      el('sequencialTransacao', String(d.lote.numero_lote)),
      el('dataRegistroTransacao', data),
      el('horaRegistroTransacao', hora),
    ]),
    grupo('origem', [grupo('identificacaoPrestador', [el('codigoPrestadorNaOperadora', d.operadora.codigo_prestador, 14)])]),
    grupo('destino', [el('registroANS', soDigitos(d.operadora.registro_ans))]),
    el('Padrao', d.operadora.versao_tiss || VERSAO_TISS),
  ])
  const guias = d.guias.map(g => g.tipo === 'consulta' ? guiaConsultaNo(g, d.operadora) : guiaSadtNo(g, d.operadora))
  const corpo = grupo('prestadorParaOperadora', [
    grupo('loteGuias', [
      el('numeroLote', String(d.lote.numero_lote)),
      grupo('guiasTISS', guias),
    ]),
  ])
  return [cabecalho, corpo]
}

/**
 * Gera o XML do lote. Retorna o texto (declarado ISO-8859-1), o hash do
 * epílogo e o nome de arquivo no padrão TISS: <sequencial 20 dígitos>_<hash>.xml
 */
export function gerarXmlLote(d: DadosLote): { xml: string; hash: string; nomeArquivo: string } {
  const conteudo = montarConteudo(d)
  const hash = hashTiss(conteudo)
  const xml =
    '<?xml version="1.0" encoding="ISO-8859-1"?>' +
    `<${P}mensagemTISS xmlns:ans="${NS_TISS}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"` +
    ` xsi:schemaLocation="${NS_TISS} ${NS_TISS}/tissV${(d.operadora.versao_tiss || VERSAO_TISS).replace(/\./g, '_')}.xsd">` +
    conteudo.map(serializar).join('') +
    serializar(grupo('epilogo', [el('hash', hash)])) +
    `</${P}mensagemTISS>`
  const nomeArquivo = `${String(d.lote.numero_lote).padStart(20, '0')}_${hash}.xml`
  return { xml, hash, nomeArquivo }
}

/** Bytes ISO-8859-1 do XML, prontos para download (`new Blob([bytes])`). */
export const xmlParaBytes = (xml: string) => bytesLatin1(xml)
