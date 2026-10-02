import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { MODELOS } from '@/lib/ai/models'
import { log } from '@/lib/logger'
import { frasesDe, montarConversa, promptPapeis } from '@/lib/transcricao/papeis'

export const maxDuration = 60

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/**
 * Identifica quem falou cada frase da consulta (médico, paciente ou acompanhante).
 * Entrada: { texto }  (com ou sem "Falante N:" vindo da separação de vozes)
 * Saída:   { texto: "Médico: …\nPaciente: …", turnos }  — ou o texto original se não der.
 */
export async function POST(req: NextRequest) {
  const { texto } = await req.json().catch(() => ({ texto: '' }))
  const original = String(texto || '').trim()
  const frases = frasesDe(original)
  if (frases.length < 2 || frases.length > 900) return NextResponse.json({ texto: original, identificado: false })

  const prompt = promptPapeis(frases)

  try {
    const r = await anthropic.messages.create({
      model: MODELOS.apoio,
      max_tokens: Math.min(8000, 200 + frases.length * 6),
      messages: [{ role: 'user', content: prompt }],
    })
    const bruto = r.content[0]?.type === 'text' ? r.content[0].text : ''
    const json = JSON.parse(bruto.slice(bruto.indexOf('{'), bruto.lastIndexOf('}') + 1))
    const papeis: string[] = Array.isArray(json.papeis) ? json.papeis.map(String) : []
    if (papeis.length !== frases.length || papeis.some(p => !/^[MPA]$/i.test(p))) {
      log.warn('[papeis] resposta inválida', papeis.length, frases.length)
      return NextResponse.json({ texto: original, identificado: false })
    }
    const conversa = montarConversa(frases, papeis)
    return NextResponse.json({ ...conversa, identificado: true })
  } catch (e: any) {
    log.error('[papeis]', e?.message || e)
    return NextResponse.json({ texto: original, identificado: false })
  }
}
