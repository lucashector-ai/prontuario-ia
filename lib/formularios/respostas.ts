import { log } from '@/lib/logger'
import { supabase } from '@/lib/supabase'
import type { Campo, Resposta } from './types'
import { MODELOS, ANTHROPIC_API_URL, ANTHROPIC_API_VERSION } from '@/lib/ai/models'

/**
 * Salva resposta de um formulário.
 * Retorna o ID da resposta criada (precisa pra vincular ao envio).
 */
export async function salvarResposta(params: {
  envioId: string
  templateId: string
  pacienteId?: string
  agendamentoId?: string
  respostas: Record<string, any>
}): Promise<{ respostaId: string | null; erro: string | null }> {
  try {
    const { data, error } = await supabase
      .from('formularios_respostas')
      .insert({
        envio_id: params.envioId,
        template_id: params.templateId,
        paciente_id: params.pacienteId || null,
        agendamento_id: params.agendamentoId || null,
        respostas: params.respostas,
        preenchido_em: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) return { respostaId: null, erro: error.message }
    return { respostaId: data.id, erro: null }
  } catch (e: any) {
    return { respostaId: null, erro: e.message || 'Erro ao salvar resposta' }
  }
}

/**
 * Formata respostas pra prompt legível (label + valor).
 */
export function formatarRespostasParaPrompt(campos: Campo[], respostas: Record<string, any>): string {
  return campos
    .map(c => {
      const valor = respostas[c.id]
      if (valor === undefined || valor === null || valor === '') return null
      
      let valorFormatado: string
      if (Array.isArray(valor)) {
        valorFormatado = valor.join(', ')
      } else if (typeof valor === 'boolean') {
        valorFormatado = valor ? 'Sim' : 'Não'
      } else {
        valorFormatado = String(valor)
      }
      
      return `${c.label}: ${valorFormatado}`
    })
    .filter(Boolean)
    .join('\n')
}

/**
 * Gera resumo IA das respostas usando Claude.
 * Não bloqueia o salvamento — chama em background.
 */
export async function gerarResumoIA(respostaId: string, campos: Campo[], respostas: Record<string, any>): Promise<void> {
  try {
    const respostasFormatadas = formatarRespostasParaPrompt(campos, respostas)
    if (!respostasFormatadas) return

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      log.warn('ANTHROPIC_API_KEY não configurada, pulando resumo IA')
      return
    }

    const systemPrompt = `Você é um assistente clínico para médicos brasileiros. Recebe respostas de formulário pré-consulta de um paciente e gera um RESUMO ESTRUTURADO conciso (máximo 6 linhas) destacando:

1. Queixa principal (1 linha)
2. Fatores de risco relevantes (se houver)
3. Sinais de alerta (se houver - urgência clínica)
4. Pontos importantes pro médico investigar

Use linguagem técnica médica, seja DIRETO e ÚTIL. NÃO faça diagnóstico. NÃO sugira tratamento. Apenas organize a informação pro médico ler em 30 segundos antes da consulta.

Formato: bullets curtos com "•" no início de cada linha. Sem cabeçalho, sem despedida.`

    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODELOS.apoio,
        max_tokens: 500,
        system: systemPrompt,
        messages: [
          { role: 'user', content: respostasFormatadas }
        ],
      }),
    })

    if (!res.ok) {
      log.error('Erro Claude API:', await res.text())
      return
    }

    const data = await res.json()
    const resumo = data.content?.[0]?.text?.trim()

    if (resumo) {
      await supabase
        .from('formularios_respostas')
        .update({ resumo_ia: resumo })
        .eq('id', respostaId)
    }
  } catch (e: any) {
    log.error('Erro ao gerar resumo IA:', e)
  }
}

/**
 * Busca resposta vinculada a um envio.
 */
export async function buscarRespostaDoEnvio(envioId: string): Promise<Resposta | null> {
  try {
    const { data } = await supabase
      .from('formularios_respostas')
      .select('*')
      .eq('envio_id', envioId)
      .single()
    
    return data as Resposta | null
  } catch {
    return null
  }
}

/**
 * Notifica médico/clínica que um formulário foi preenchido.
 * TODO: integrar com sistema de notificações existente (email/whatsapp)
 * Por ora só insere em notificacoes_medico.
 */
export async function notificarPreenchimento(params: {
  medicoId: string | null
  clinicaId: string
  nomePaciente: string
  envioId: string
}): Promise<void> {
  try {
    if (params.medicoId) {
      await supabase.from('notificacoes_medico').insert({
        medico_id: params.medicoId,
        tipo: 'formulario_preenchido',
        titulo: 'Formulário preenchido',
        mensagem: `${params.nomePaciente} respondeu o formulário pré-consulta.`,
        link: `/formularios/respostas/${params.envioId}`,
        lida: false,
      })
    }
  } catch (e: any) {
    log.error('Erro ao notificar:', e)
  }
}
