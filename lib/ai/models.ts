/**
 * Configuração central dos modelos da Anthropic usados no projeto.
 *
 * IMPORTANTE: nunca hardcodar nome de modelo direto no código — trocar AQUI.
 *
 * Escolha por custo (ver estudo de custos, out/2026):
 * - raciocinioClinico (Opus 5.5): análise de exames e assistente médico — erro tem consequência clínica
 * - apoio (Sonnet 5.5): prontuário estruturado, Sofia no WhatsApp, textos para o paciente
 * - rapido (Haiku 5.5): tarefas simples e repetitivas — quem falou na consulta, sugestões,
 *   copiloto, retorno, resumos internos e relatórios
 */
export const MODELOS = {
  /** Modelo mais capaz — usar quando o erro tem consequência clínica real */
  raciocinioClinico: 'claude-opus-5-5',

  /** Equilíbrio custo/qualidade — prontuário e conversas com o paciente */
  apoio: 'claude-sonnet-5-5',

  /** Mais barato e rápido — classificação, sugestões, resumos internos */
  rapido: 'claude-haiku-5-5',
} as const

/** Endpoint da Messages API */
export const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

/** Versão da API */
export const ANTHROPIC_API_VERSION = '2023-06-01'

/** Texto da resposta do Claude, juntando os blocos de texto (a resposta pode começar com outro tipo de bloco). */
export function textoDaResposta(msg: { content: Array<{ type: string }> }, padrao = ''): string {
  const t = msg.content.filter((b): b is { type: 'text'; text: string } => b.type === 'text').map(b => b.text).join('')
  return t || padrao
}

/**
 * Tarefas simples (resumos, JSON curto): sem o raciocínio prévio que os modelos 5.5 fazem por padrão.
 * O raciocínio gastava o max_tokens e a resposta saía cortada. Use: messages.create({ ...SEM_RACIOCINIO, ... }).
 * (SDK 0.24 não tem o tipo, por isso o cast.)
 */
export const SEM_RACIOCINIO = { thinking: { type: 'disabled' } } as any
