import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// POST - calcula score de aderencia de um paciente
export async function POST(req: NextRequest) {
  try {
    const { paciente_id, medico_id } = await req.json()
    if (!paciente_id) return NextResponse.json({ error: 'paciente_id obrigatorio' }, { status: 400 })

    const trintaDiasAtras = new Date()
    trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30)

    const [{ data: paciente }, { data: conversa }, { data: consultas }, { data: agendamentos }] = await Promise.all([
      supabase.from('pacientes').select('nome, comorbidades, alergias').eq('id', paciente_id).single(),
      supabase.from('whatsapp_conversas').select('id').eq('paciente_id', paciente_id).maybeSingle(),
      supabase.from('consultas').select('data_hora, prontuario').eq('paciente_id', paciente_id).order('data_hora', { ascending: false }).limit(3),
      supabase.from('agendamentos').select('status, data_hora').eq('paciente_id', paciente_id).gte('data_hora', trintaDiasAtras.toISOString()),
    ])

    // Mensagens recentes do paciente
    let mensagensRecentes: string[] = []
    if (conversa?.id) {
      const { data: msgs } = await supabase
        .from('whatsapp_mensagens')
        .select('conteudo, tipo, criado_em')
        .eq('conversa_id', conversa.id)
        .eq('tipo', 'recebida')
        .gte('criado_em', trintaDiasAtras.toISOString())
        .order('criado_em', { ascending: false })
        .limit(20)
      mensagensRecentes = msgs?.map(m => m.conteudo) || []
    }

    // Calcula metricas basicas
    const totalAg = agendamentos?.length || 0
    const agCancelados = agendamentos?.filter(a => a.status === 'cancelado').length || 0
    const taxaPresenca = totalAg > 0 ? Math.round((1 - agCancelados / totalAg) * 100) : 100
    const diasUltimoContato = conversa ? Math.floor((Date.now() - new Date(consultas?.[0]?.data_hora || trintaDiasAtras).getTime()) / (1000 * 60 * 60 * 24)) : 999

    // Score de aderencia com IA
    const prompt = `Analise os dados deste paciente e calcule um score de aderencia ao tratamento de 0 a 100.

Paciente: ${paciente?.nome}
Comorbidades: ${paciente?.comorbidades || 'nenhuma'}
Ultima consulta: ${consultas?.[0]?.data_hora ? new Date(consultas[0].data_hora).toLocaleDateString('pt-BR') : 'nenhuma'}
Plano do medico: ${consultas?.[0]?.prontuario?.plano || 'nao registrado'}
Taxa de presenca em consultas: ${taxaPresenca}%
Mensagens recentes (30 dias): ${mensagensRecentes.slice(0, 10).join(' | ') || 'nenhuma'}

Responda APENAS com JSON no formato:
{"score": 0-100, "nivel": "alto|medio|baixo", "pontos_positivos": ["..."], "pontos_atencao": ["..."], "recomendacao": "..."}`

    const res = await anthropic.messages.create({
      model: 'claude-opus-4-5', max_tokens: 400,
      messages: [{ role: 'user', content: prompt }]
    })

    const texto = res.content[0].type === 'text' ? res.content[0].text : '{}'
    let analise: any = {}
    try {
      analise = JSON.parse(texto.replace(/```json|```/g, '').trim())
    } catch {}

    const resultado = {
      paciente_id, paciente: paciente?.nome,
      score: analise.score || taxaPresenca,
      nivel: analise.nivel || (taxaPresenca >= 80 ? 'alto' : taxaPresenca >= 50 ? 'medio' : 'baixo'),
      taxa_presenca: taxaPresenca,
      dias_ultimo_contato: diasUltimoContato,
      pontos_positivos: analise.pontos_positivos || [],
      pontos_atencao: analise.pontos_atencao || [],
      recomendacao: analise.recomendacao || '',
      calculado_em: new Date().toISOString()
    }

    // Salva o score
    await supabase.from('whatsapp_aderencia').upsert({
      medico_id, ...resultado
    }, { onConflict: 'paciente_id' })

    return NextResponse.json({ aderencia: resultado })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET - lista scores de aderencia do medico
export async function GET(req: NextRequest) {
  const medicoId = req.nextUrl.searchParams.get('medico_id')
  if (!medicoId) return NextResponse.json({ error: 'medico_id obrigatorio' }, { status: 400 })

  const { data } = await supabase
    .from('whatsapp_aderencia')
    .select('*, pacientes(nome, telefone)')
    .eq('medico_id', medicoId)
    .order('score', { ascending: true })
    .limit(50)

  return NextResponse.json({ aderencia: data || [] })
}
