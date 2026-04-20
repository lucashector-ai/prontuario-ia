import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export type Pergunta = {
  chave: string          // ex: "queixa_principal", "tempo_sintoma"
  texto: string          // ex: "O que mais está te incomodando?"
  contexto?: string      // opcional: "entender sintoma principal"
}

/**
 * Gera 3-6 perguntas adaptativas baseadas no motivo da consulta.
 * Retorna perguntas estruturadas com chave identificadora para agrupamento posterior.
 */
export async function gerarPerguntasAdaptativas(
  motivoConsulta: string,
  promptExtraClinica?: string | null
): Promise<Pergunta[]> {
  const systemPrompt = `Você é um assistente clínico que gera perguntas de pré-consulta personalizadas.

Objetivo: dado o motivo de uma consulta médica, gere entre 3 e 6 perguntas simples, curtas e empáticas para o paciente responder pelo WhatsApp ANTES da consulta. Essas respostas ajudarão o médico a chegar na consulta já com contexto.

REGRAS:
- Perguntas em português brasileiro, tom leve e acolhedor
- UMA pergunta por vez (o paciente vai responder mensagem por mensagem)
- Evite jargão médico
- Nunca pergunte CPF, RG, email ou dados que a clínica já tem
- Nunca peça diagnóstico ou opine sobre a condição
- Sempre adapte as perguntas ao motivo específico

EXEMPLOS de mapeamento:
- "Dor de cabeça" → queixa, tempo, intensidade, gatilhos, medicamentos em uso, alergias
- "Consulta de rotina" → queixas atuais, medicamentos em uso, histórico familiar relevante, alergias, últimos exames
- "Retorno" → evolução desde a última consulta, aderência ao tratamento, efeitos colaterais, novas queixas
- "Pediátrica" → febre, alimentação, sono, humor, vacinas em dia

${promptExtraClinica ? `\nINSTRUÇÕES EXTRAS DA CLÍNICA:\n${promptExtraClinica}\n` : ''}

Retorne APENAS um JSON válido no formato:
{"perguntas":[{"chave":"queixa_principal","texto":"O que mais está te incomodando hoje?","contexto":"queixa principal"},{"chave":"tempo_sintoma","texto":"Há quanto tempo está sentindo isso?","contexto":"duração"}]}

NÃO inclua comentários, markdown, ou texto fora do JSON.`

  try {
    const res = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Motivo da consulta: "${motivoConsulta}"\n\nGere as perguntas de pré-atendimento.`
      }]
    })
    const texto = res.content[0].type === 'text' ? res.content[0].text : ''
    const jsonMatch = texto.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return PERGUNTAS_FALLBACK
    const parsed = JSON.parse(jsonMatch[0])
    const perguntas: Pergunta[] = parsed.perguntas || []
    if (perguntas.length < 2 || perguntas.length > 8) return PERGUNTAS_FALLBACK
    return perguntas
  } catch (e) {
    console.error('gerarPerguntasAdaptativas erro:', e)
    return PERGUNTAS_FALLBACK
  }
}

const PERGUNTAS_FALLBACK: Pergunta[] = [
  { chave: 'queixa_principal', texto: 'O que mais está te incomodando hoje?', contexto: 'queixa' },
  { chave: 'tempo_sintoma', texto: 'Há quanto tempo está sentindo isso?', contexto: 'duração' },
  { chave: 'medicacao_uso', texto: 'Está usando algum medicamento atualmente?', contexto: 'medicamentos' },
  { chave: 'alergias', texto: 'Tem alguma alergia a medicamentos ou alimentos?', contexto: 'alergias' },
]

/**
 * Cria uma pré-consulta nova no banco, no estado "aguardando_permissao".
 * Retorna o id da pré-consulta criada.
 */
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
 * Registra resposta do paciente para a pergunta atual e avança.
 * Retorna próxima pergunta ou null se terminou.
 */
export async function registrarRespostaEAvancar(
  preConsultaId: string,
  resposta: string
): Promise<{ proxima?: Pergunta; completo: boolean }> {
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

/**
 * Busca pré-consulta ativa para uma conversa WhatsApp.
 */
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
