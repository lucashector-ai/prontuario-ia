import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { medico_id, paciente_id } = await req.json()
    if (!medico_id) return NextResponse.json({ error: 'medico_id obrigatorio' }, { status: 400 })

    const semanaAtras = new Date()
    semanaAtras.setDate(semanaAtras.getDate() - 7)

    // Se paciente especifico, gera relatorio individual
    if (paciente_id) {
      return gerarRelatorioIndividual(medico_id, paciente_id, semanaAtras)
    }

    // Relatorio geral da semana
    const [{ data: consultas }, { data: agendamentos }, { data: alertas }, { data: novosWpp }] = await Promise.all([
      supabase.from('consultas').select('id, data_hora, pacientes(nome)').eq('medico_id', medico_id).gte('data_hora', semanaAtras.toISOString()),
      supabase.from('agendamentos').select('id, data_hora, status, pacientes(nome)').eq('medico_id', medico_id).gte('data_hora', new Date().toISOString()).order('data_hora').limit(10),
      supabase.from('whatsapp_alertas').select('id, nivel, mensagem, pacientes(nome), criado_em').eq('medico_id', medico_id).eq('lido', false),
      supabase.from('whatsapp_conversas').select('id, nome_contato, criado_em').eq('medico_id', medico_id).gte('criado_em', semanaAtras.toISOString()),
    ])

    const relatorio = {
      periodo: { inicio: semanaAtras.toLocaleDateString('pt-BR'), fim: new Date().toLocaleDateString('pt-BR') },
      consultas_semana: consultas?.length || 0,
      proximos_agendamentos: agendamentos || [],
      alertas_pendentes: alertas || [],
      novos_pacientes_wpp: novosWpp?.length || 0,
      resumo_ia: ''
    }

    // Gera resumo com IA
    const prompt = `Voce e um assistente medico. Gere um resumo executivo semanal conciso para o medico baseado nos dados abaixo. Use bullet points. Maximo 200 palavras. Seja objetivo e destaque o mais importante.

Dados da semana:
- Consultas realizadas: ${relatorio.consultas_semana}
- Novos pacientes via WhatsApp: ${relatorio.novos_pacientes_wpp}
- Alertas de risco pendentes: ${relatorio.alertas_pendentes.length}
- Proximos agendamentos: ${relatorio.proximos_agendamentos.length}
${relatorio.alertas_pendentes.length > 0 ? '- Alertas: ' + relatorio.alertas_pendentes.map((a: any) => a.pacientes?.nome + ' (' + a.nivel + ')').join(', ') : ''}`

    const res = await anthropic.messages.create({
      model: 'claude-opus-4-5', max_tokens: 300,
      messages: [{ role: 'user', content: prompt }]
    })
    relatorio.resumo_ia = res.content[0].type === 'text' ? res.content[0].text : ''

    return NextResponse.json({ relatorio })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

async function gerarRelatorioIndividual(medicoId: string, pacienteId: string, desde: Date) {
  const [{ data: paciente }, { data: mensagens }, { data: consultas }] = await Promise.all([
    supabase.from('pacientes').select('nome, data_nascimento, comorbidades, alergias').eq('id', pacienteId).single(),
    supabase.from('whatsapp_mensagens').select('tipo, conteudo, criado_em').eq('conversa_id',
      supabase.from('whatsapp_conversas').select('id').eq('paciente_id', pacienteId).single() as any
    ).gte('criado_em', desde.toISOString()).order('criado_em'),
    supabase.from('consultas').select('data_hora, prontuario').eq('paciente_id', pacienteId).order('data_hora', { ascending: false }).limit(3),
  ])

  const resumoConsultas = consultas?.map((c: any) => new Date(c.data_hora).toLocaleDateString('pt-BR') + ': ' + (c.prontuario?.avaliacao || '')).join('') || 'Sem consultas recentes'

  const prompt = `Analise o historico deste paciente e gere um relatorio de evolucao semanal para o medico. Seja clinico e objetivo.

Paciente: ${paciente?.nome}
Comorbidades: ${paciente?.comorbidades || 'nenhuma'}
Ultimas consultas: ${resumoConsultas}
Mensagens recentes: ${mensagens?.filter((m: any) => m.tipo === 'recebida').slice(-10).map((m: any) => m.conteudo).join(' | ') || 'Sem mensagens'}

Gere: 1) Resumo do estado atual 2) Sinais de alerta (se houver) 3) Recomendacao de acompanhamento. Maximo 150 palavras.`

  const res = await anthropic.messages.create({
    model: 'claude-opus-4-5', max_tokens: 250,
    messages: [{ role: 'user', content: prompt }]
  })

  return NextResponse.json({
    paciente: paciente?.nome,
    relatorio: res.content[0].type === 'text' ? res.content[0].text : ''
  })
}
