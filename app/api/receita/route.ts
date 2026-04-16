import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { prontuario, paciente_id, medico_id } = await req.json()
    if (!prontuario) return NextResponse.json({ error: 'Prontuário obrigatório' }, { status: 400 })

    // Busca histórico de medicamentos do paciente para checar interações
    let medicamentosHistorico: string[] = []
    if (paciente_id) {
      const { data: consultas } = await supabase
        .from('consultas')
        .select('plano, receita')
        .eq('paciente_id', paciente_id)
        .order('criado_em', { ascending: false })
        .limit(5)
      if (consultas) {
        medicamentosHistorico = consultas
          .flatMap(c => [c.plano || '', c.receita || ''])
          .filter(Boolean)
      }
    }

    const historicoCtx = medicamentosHistorico.length > 0
      ? `\n\nHISTÓRICO DE MEDICAMENTOS DO PACIENTE (últimas consultas):\n${medicamentosHistorico.join('\n').slice(0, 1000)}`
      : ''

    const prompt = `Você é um assistente médico especializado em prescrição clínica brasileira.

Com base no prontuário SOAP abaixo, gere uma receita médica estruturada.${historicoCtx}

PRONTUÁRIO:
Subjetivo: ${prontuario.subjetivo || ''}
Objetivo: ${prontuario.objetivo || ''}
Avaliação: ${prontuario.avaliacao || ''}
Plano: ${prontuario.plano || ''}

INSTRUÇÕES:
- Extraia os medicamentos mencionados no plano
- Para cada medicamento inclua: nome, dose, via, frequência e duração
- Se houver histórico de medicamentos, verifique interações importantes
- Sinalize interações graves com flag "ALERTA DE INTERAÇÃO"
- Responda APENAS em JSON válido, sem markdown

JSON esperado:
{
  "medicamentos": [
    {
      "nome": "Nome do medicamento",
      "dose": "dose",
      "via": "oral/IM/IV/tópico",
      "frequencia": "ex: 1x ao dia",
      "duracao": "ex: 7 dias",
      "instrucoes": "ex: tomar após refeição"
    }
  ],
  "alertas_interacao": ["descrição do alerta se houver"],
  "orientacoes_gerais": "orientações ao paciente",
  "retorno": "prazo de retorno sugerido"
}`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const clean = text.replace(/```json|```/g, '').trim()
    const receita = JSON.parse(clean)

    return NextResponse.json({ receita })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
