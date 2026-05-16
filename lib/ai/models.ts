/**
 * Configuração central dos modelos da Anthropic usados no projeto.
 *
 * IMPORTANTE: nunca hardcodar nome de modelo direto no código.
 * Quando a Anthropic lançar modelo novo ou aposentar um antigo,
 * basta atualizar AQUI — um lugar só.
 *
 * Status em maio/2026:
 * - claude-opus-4-7  : modelo mais capaz. Uso: raciocínio clínico (chat médico).
 * - claude-sonnet-4-6: equilíbrio custo/qualidade. Uso: tarefas de apoio (resumos).
 * - claude-sonnet-4-20250514: APOSENTADO em jun/2026 — não usar mais.
 */

export const MODELOS = {
  /** Modelo mais capaz — usar quando o erro tem consequência clínica real */
  raciocinioClinico: 'claude-opus-4-7',

  /** Modelo equilibrado — tarefas de apoio (resumir formulário, classificar) */
  apoio: 'claude-sonnet-4-6',
} as const

/** Endpoint da Messages API */
export const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

/** Versão da API */
export const ANTHROPIC_API_VERSION = '2023-06-01'
