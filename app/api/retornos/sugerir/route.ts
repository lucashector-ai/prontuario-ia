import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { MODELOS } from '@/lib/ai/models'
import { log } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * POST { plano?, avaliacao? } → { dias: number | null, motivo: string, fonte: 'texto' | 'ia' | null }
 * 1) procura no texto ("retorno em 30 dias", "retornar em 2 semanas", "reavaliação em 3 meses",
 *    "retorno com exames", "retorno semestral"…); 2) só se não achar, pergunta à IA (curto, JSON).
 */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const plano = String(b.plano || '').slice(0, 4000)
  const avaliacao = String(b.avaliacao || '').slice(0, 2000)
  const motivo = motivoDaAvaliacao(avaliacao)

  const dias = diasDoTexto(plano) ?? diasDoTexto(avaliacao)
  if (dias !== null) return NextResponse.json({ dias, motivo, fonte: 'texto' })

  if (!process.env.ANTHROPIC_API_KEY || (!plano.trim() && !avaliacao.trim())) {
    return NextResponse.json({ dias: null, motivo, fonte: null })
  }
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await anthropic.messages.create({
      model: MODELOS.apoio,
      max_tokens: 120,
      messages: [{
        role: 'user',
        content: [
          'Você recebe a avaliação e o plano de uma consulta médica. Diga em quantos dias o paciente deveria voltar para retorno.',
          'Se o texto não indicar e não for clinicamente habitual haver retorno, use null.',
          'Responda APENAS com JSON: {"dias": número inteiro ou null, "motivo": "até 6 palavras, ex.: Controle de hipertensão"}',
          '', 'AVALIAÇÃO:', avaliacao || '(vazio)', '', 'PLANO:', plano || '(vazio)',
        ].join('\n'),
      }],
    })
    const txt = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
    const i = txt.indexOf('{'), f = txt.lastIndexOf('}')
    const j = JSON.parse(i >= 0 && f > i ? txt.slice(i, f + 1) : '{}')
    const d = Number(j.dias)
    const diasIA = Number.isFinite(d) && d > 0 && d <= 730 ? Math.round(d) : null
    const motivoIA = typeof j.motivo === 'string' && j.motivo.trim() ? j.motivo.trim().slice(0, 80) : motivo
    return NextResponse.json({ dias: diasIA, motivo: motivoIA, fonte: diasIA ? 'ia' : null })
  } catch (e: any) {
    log.warn('[retornos/sugerir] IA falhou', e?.message)
    return NextResponse.json({ dias: null, motivo, fonte: null })
  }
}

const NUMEROS: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
  onze: 11, doze: 12, quinze: 15, vinte: 20, trinta: 30, quarenta: 40, quarenta_e_cinco: 45, sessenta: 60, noventa: 90,
}
const UNIDADE = (u: string) => u.startsWith('dia') ? 1 : u.startsWith('sem') ? 7 : u.startsWith('m') ? 30 : u.startsWith('ano') ? 365 : 0

function semAcento(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Extrai o prazo de retorno em dias de um texto em pt-BR. */
function diasDoTexto(texto: string): number | null {
  const t = semAcento(texto).replace(/quarenta e cinco/g, 'quarenta_e_cinco')
  if (!t.trim()) return null
  const gatilho = '(?:retorno|retornar|retorne|reavaliacao|reavaliar|reavalie|revisao|revisar|controle|reconsulta|nova consulta|voltar|seguimento|acompanhamento)'
  const num = '(\\d{1,3}|' + Object.keys(NUMEROS).join('|') + ')'
  const unid = '(dias?|semanas?|mes|meses|anos?)'
  // "retorno em 30 dias", "retornar em 2 semanas", "reavaliação após 3 meses", "retorno (30 dias)"
  const re1 = new RegExp(gatilho + '[^.\\n]{0,40}?\\b(?:em|apos|daqui a|dentro de|com|de|para)?\\s*\\(?\\s*' + num + '\\s*(?:a\\s*\\d{1,3}\\s*)?' + unid, 'i')
  // "em 30 dias, retorno", "30 dias para reavaliação"
  const re2 = new RegExp(num + '\\s*' + unid + '[^.\\n]{0,25}?' + gatilho, 'i')
  for (const re of [re1, re2]) {
    const m = t.match(re)
    if (m) {
      const n = /^\d+$/.test(m[1]) ? Number(m[1]) : NUMEROS[m[1]]
      const d = n * UNIDADE(m[2])
      if (d > 0 && d <= 730) return d
    }
  }
  const periodicos: [RegExp, number][] = [
    [/retorno\s+(?:em\s+)?quinzena|retorno quinzenal/, 15], [/retorno mensal/, 30], [/retorno bimestral/, 60],
    [/retorno trimestral/, 90], [/retorno semestral/, 180], [/retorno anual/, 365],
  ]
  for (const [re, d] of periodicos) if (re.test(t)) return d
  // "retorno com exames / com resultados" sem prazo → 30 dias
  if (/(retorno|retornar|reavaliacao)[^.\n]{0,20}\b(com|apos|para mostrar|para avaliar)\b[^.\n]{0,15}(exames?|resultados?|laudos?)/.test(t)) return 30
  return null
}

/** Motivo curto a partir da avaliação: 1º diagnóstico/hipótese, sem prefixos. */
function motivoDaAvaliacao(avaliacao: string): string {
  const linha = avaliacao.split(/\n/).map(l => l.trim()).find(l => l.replace(/[-*•\d.)\s]/g, '').length > 2) || ''
  let m = linha
    .replace(/^[-*•\d.)\s]+/, '')
    .replace(/^(hip[oó]teses?( diagn[oó]sticas?)?|diagn[oó]sticos?|hd|impress[aã]o|avalia[cç][aã]o)\s*[:\-–]\s*/i, '')
    .split(/[.;,]|\s[-–]\s/)[0]
    .replace(/\s*\(?\b[A-Z]\d{2}(\.\d)?\)?\s*$/, '') // CID no fim
    .trim()
  if (m.length > 60) m = m.slice(0, 57).trimEnd() + '…'
  return m ? m.charAt(0).toUpperCase() + m.slice(1) : ''
}
