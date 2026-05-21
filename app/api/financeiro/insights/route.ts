import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { MODELOS } from '@/lib/ai/models'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const brl = (v: number) => 'R$ ' + (Number(v) || 0).toFixed(2)

// POST /api/financeiro/insights — gera leitura "cockpit" do financeiro via IA
export async function POST(req: NextRequest) {
  try {
    const m = await req.json()

    // sem chave ou sem movimento: devolve vazio (a UI lida com isso)
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ insights: [] })
    }
    const semDados = !m || (!m.faturamentoMes && !m.aReceber && !m.aPagar && !m.recebidoMes)
    if (semDados) {
      return NextResponse.json({
        insights: [{
          texto: 'Ainda não há movimento financeiro registrado. Feche comandas no atendimento para começar a acompanhar os números.',
          tom: 'neutro',
        }],
      })
    }

    const resumo = `
Faturamento do mês: ${brl(m.faturamentoMes)} (mês anterior: ${brl(m.faturamentoMesAnterior)})
Faturamento hoje: ${brl(m.faturamentoHoje)}
Recebido no mês: ${brl(m.recebidoMes)} (mês anterior: ${brl(m.recebidoMesAnterior)})
Lucro do mês (recebido - despesas pagas): ${brl(m.lucroMes)} (mês anterior: ${brl(m.lucroMesAnterior)})
A receber em aberto: ${brl(m.aReceber)}
Inadimplência (vencido e não pago): ${brl(m.inadimplencia)}
A pagar em aberto: ${brl(m.aPagar)}
Despesas vencidas: ${brl(m.painelPagar?.emAtraso || 0)}
Ticket médio: ${brl(m.ticketMedio)}
Comandas fechadas no mês: ${m.comandasFechadasMes || 0}
Receita por categoria: ${(m.categorias || []).map((c: any) => `${c.tipo}=${brl(c.valor)}`).join(', ') || 'sem dados'}
`.trim()

    const message = await anthropic.messages.create({
      model: MODELOS.apoio,
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `Você é o analista financeiro de uma clínica. Com base nos números abaixo, escreva de 2 a 4 insights curtos, diretos e acionáveis, em português brasileiro — estilo "cockpit" de gestão.

Regras:
- Cada insight: no máximo uma frase curta. Sem rodeios.
- Foque no que importa: tendências, riscos, oportunidades. Compare com o mês anterior quando relevante.
- Não invente números: use apenas os fornecidos.
- Classifique o tom de cada um: "positivo", "alerta" ou "neutro".

NÚMEROS:
${resumo}

Responda APENAS com um array JSON válido, sem texto extra, no formato:
[{"texto": "...", "tom": "positivo|alerta|neutro"}]`,
      }],
    })

    const raw = message.content[0]?.type === 'text' ? message.content[0].text : '[]'
    const jsonMatch = raw.match(/\[[\s\S]*\]/)
    let insights: any[] = []
    try {
      insights = JSON.parse(jsonMatch ? jsonMatch[0] : raw)
    } catch {
      insights = []
    }
    insights = (Array.isArray(insights) ? insights : [])
      .filter((i) => i && typeof i.texto === 'string')
      .slice(0, 4)
      .map((i) => ({
        texto: i.texto,
        tom: ['positivo', 'alerta', 'neutro'].includes(i.tom) ? i.tom : 'neutro',
      }))

    return NextResponse.json({ insights })
  } catch (e: any) {
    return NextResponse.json({ insights: [], error: e?.message }, { status: 200 })
  }
}
