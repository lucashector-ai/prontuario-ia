import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export type Pergunta = {
  chave: string
  texto: string
  contexto?: string
}

/**
 * Gera perguntas de pré-atendimento com tom CASUAL — parecem conversa, não formulário.
 * O objetivo é que o paciente nem perceba que tá preenchendo algo estruturado.
 */
export async function gerarPerguntasAdaptativas(
  motivoConsulta: string,
  promptExtraClinica?: string | null
): Promise<Pergunta[]> {
  const systemPrompt = `Você é uma IA que escreve perguntas de WhatsApp como se fosse uma pessoa real da recepção de uma clínica conversando com um paciente — jovem, descontraída, calorosa, profissional.

IMPORTANTE: as perguntas que você gera NÃO podem parecer formulário, checklist ou anamnese médica. Elas têm que soar como conversa casual.

REGRAS DO TOM:
- Português brasileiro natural, como pessoa de uns 28 anos
- Pode usar contrações leves: "tá", "pra", "tô"
- Perguntas CURTAS, diretas, acolhedoras
- NUNCA use linguagem corporativa: "Gostaríamos de saber", "Por favor informe", "Você pode responder"
- NUNCA numere nem enumere ("Pergunta 1:", "Próxima:")
- NUNCA diga "para fins de pré-atendimento" ou explique o objetivo
- Evite jargão médico — "dor" em vez de "álgia", "há quanto tempo" em vez de "duração"
- Emojis com parcimônia (1 a cada 2-3 perguntas, e só quando agregar calor)

EXEMPLOS DO QUE EU QUERO (boa):
- "Me conta, o que tá te incomodando exatamente?"
- "E já faz quanto tempo que começou?"
- "Você tá tomando algum remédio no momento?"
- "Tem alergia a alguma coisa?"
- "Algo em específico que piora ou melhora?"

EXEMPLOS DO QUE EU NÃO QUERO (ruim):
- "Por favor, descreva sua queixa principal" ❌
- "Pergunta 1: Qual o motivo da consulta?" ❌
- "Para melhor atendimento, responda: há quanto tempo está sentindo os sintomas?" ❌
- "Liste os medicamentos em uso contínuo" ❌

MAPEAMENTO POR TIPO DE MOTIVO:
- "Dor" (cabeça, barriga, costas, etc.) → o que sente, tempo, intensidade, o que piora/melhora, medicamentos
- "Rotina/check-up" → se tem alguma queixa, medicamentos atuais, alergias, último exame
- "Retorno" → evolução desde última consulta, aderência ao tratamento, novas queixas
- "Infantil" (criança) → sintoma, tempo, febre, alimentação, humor
- "Emocional/psicológico" → tom extra gentil, perguntas mais abertas
- Motivo genérico ("consulta", "agendamento") → perguntas amplas mas naturais

QUANTIDADE: 3 a 5 perguntas. Nem mais, nem menos. Mais que 5 cansa.

${promptExtraClinica ? `\nINSTRUÇÕES ESPECIAIS DA CLÍNICA:\n${promptExtraClinica}\n` : ''}

FORMATO DE SAÍDA:
Retorne APENAS um JSON válido no formato:
{"perguntas":[{"chave":"queixa","texto":"Me conta, o que tá te incomodando?"},{"chave":"tempo","texto":"Já faz quanto tempo que começou?"}]}

A chave deve ser curta e descritiva (ex: "queixa", "tempo", "medicacao", "alergia", "gatilho"). Não use camelCase nem espaços.

NUNCA inclua comentários, markdown, ou texto fora do JSON.`

  try {
    const res = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Motivo da consulta que o paciente mencionou: "${motivoConsulta}"\n\nGere as perguntas.`
      }]
    })
    const texto = res.content[0].type === 'text' ? res.content[0].text : ''
    const jsonMatch = texto.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return PERGUNTAS_FALLBACK
    const parsed = JSON.parse(jsonMatch[0])
    const perguntas: Pergunta[] = parsed.perguntas || []
    if (perguntas.length < 2 || perguntas.length > 6) return PERGUNTAS_FALLBACK
    return perguntas
  } catch (e) {
    console.error('gerarPerguntasAdaptativas erro:', e)
    return PERGUNTAS_FALLBACK
  }
}

const PERGUNTAS_FALLBACK: Pergunta[] = [
  { chave: 'queixa', texto: 'Me conta, o que tá te incomodando?' },
  { chave: 'tempo', texto: 'Já faz quanto tempo que começou?' },
  { chave: 'medicacao', texto: 'Tá tomando algum remédio no momento?' },
  { chave: 'alergia', texto: 'Tem alergia a algum medicamento ou alimento?' },
]

/**
 * Avalia se a resposta do paciente preenche a pergunta ou se precisa de follow-up.
 * Retorna null se tá OK, ou uma mensagem de follow-up gentil se faltou info.
 */
export async function avaliarRespostaERedigirFollowup(
  pergunta: Pergunta,
  resposta: string
): Promise<string | null> {
  // Se resposta muito curta ou claramente evasiva, pede complemento
  const respostaLimpa = resposta.trim().toLowerCase()
  const vazias = ['sim', 'nao', 'não', 'ok', 'talvez', 'pode ser', 'não sei', 'nao sei', '.', '?', 'hm']

  if (respostaLimpa.length < 3 || vazias.includes(respostaLimpa)) {
    // Resposta claramente insuficiente — pede complemento natural
    const systemPrompt = `Você é uma assistente de clínica conversando no WhatsApp. A pessoa respondeu de forma muito curta ou evasiva a uma pergunta. Reformule a pergunta de forma mais acolhedora, sem parecer insistente. Seja jovem, descontraída, curta e natural. Máximo 1 frase, sem parecer formulário.`
    try {
      const res = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Pergunta original: "${pergunta.texto}"\nResposta do paciente: "${resposta}"\n\nReformule de forma mais aberta e acolhedora. Se a resposta foi "não sei" ou similar, aceita e faz uma pergunta que facilite.`
        }]
      })
      return res.content[0].type === 'text' ? res.content[0].text.trim() : null
    } catch {
      return null
    }
  }

  return null // resposta OK, pode avançar
}

export async function iniciarPreAtendimento(params: {
  medico_id: string
  paciente_id: string
  agendamento_id?: string
  conversa_id?: string
  motivo_consulta: string
  prompt_extra?: string | null
}): Promise<{ id: string; perguntas: Pergunta[] } | null> {
  const perguntas = await gerarPerguntasAdaptativas(params.motivo_consulta, params.prompt_extra)

  const { data, error } = await supabase
    .from('pre_consultas')
    .insert({
      medico_id: params.medico_id,
      paciente_id: params.paciente_id,
      agendamento_id: params.agendamento_id || null,
      conversa_id: params.conversa_id || null,
      motivo_consulta: params.motivo_consulta,
      perguntas,
      respostas: {},
      pergunta_atual_index: 0,
      status: 'aguardando_permissao',
      canal: 'whatsapp',
    })
    .select()
    .single()

  if (error || !data) {
    console.error('iniciarPreAtendimento erro:', error)
    return null
  }
  return { id: data.id, perguntas }
}

/**
 * Registra resposta e avança. Agora também avalia se a resposta faz sentido.
 */
export async function registrarRespostaEAvancar(
  preConsultaId: string,
  resposta: string
): Promise<{ proxima?: Pergunta; completo: boolean; followup?: string }> {
  const { data: pre } = await supabase
    .from('pre_consultas')
    .select('*')
    .eq('id', preConsultaId)
    .single()

  if (!pre) return { completo: true }

  const perguntas: Pergunta[] = pre.perguntas || []
  const idx = pre.pergunta_atual_index || 0
  const perguntaAtual = perguntas[idx]
  if (!perguntaAtual) return { completo: true }

  // Verifica se precisa de follow-up ANTES de avançar
  const followup = await avaliarRespostaERedigirFollowup(perguntaAtual, resposta)
  if (followup) {
    // NÃO avança — salva a resposta atual como parcial e pede complemento
    const respostasParciais = { ...pre.respostas, [perguntaAtual.chave + '_parcial']: resposta }
    await supabase
      .from('pre_consultas')
      .update({ respostas: respostasParciais })
      .eq('id', preConsultaId)
    return { followup, completo: false }
  }

  const novasRespostas = { ...pre.respostas, [perguntaAtual.chave]: resposta }
  const novoIdx = idx + 1
  const terminou = novoIdx >= perguntas.length

  await supabase
    .from('pre_consultas')
    .update({
      respostas: novasRespostas,
      pergunta_atual_index: novoIdx,
      status: terminou ? 'completo' : 'em_andamento',
      completado_em: terminou ? new Date().toISOString() : null,
    })
    .eq('id', preConsultaId)

  return terminou
    ? { completo: true }
    : { proxima: perguntas[novoIdx], completo: false }
}

export async function getPreConsultaAtiva(conversa_id: string) {
  const { data } = await supabase
    .from('pre_consultas')
    .select('*')
    .eq('conversa_id', conversa_id)
    .in('status', ['aguardando_permissao', 'em_andamento'])
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

export async function marcarPermissaoConcedida(id: string) {
  await supabase
    .from('pre_consultas')
    .update({ status: 'em_andamento' })
    .eq('id', id)
}

export async function marcarPermissaoNegada(id: string) {
  await supabase
    .from('pre_consultas')
    .update({ status: 'recusado', completado_em: new Date().toISOString() })
    .eq('id', id)
}
