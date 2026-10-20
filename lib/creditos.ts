/**
 * Créditos de IA por plano. 1 crédito ≈ 1 consulta com IA de até ~20 minutos.
 * Os créditos do plano renovam todo mês (não acumulam); pacotes extras valem 60 dias.
 * Contas sem plano definido (antigas) não têm limite, mas o uso fica registrado.
 */

export const CREDITOS_DO_PLANO: Record<string, number> = { gratis: 10, solo: 250, clinica: 400, pro: 1000 }

/** Créditos do plano por mês; null = sem limite (conta antiga, sem plano). */
export function creditosDoPlano(plano: string | null | undefined): number | null {
  if (!plano) return null
  return CREDITOS_DO_PLANO[plano] ?? null
}

export type MotivoCredito = 'consulta' | 'exame' | 'assistente' | 'sofia'

export const CUSTO = {
  consulta: 1,          // prontuário pela IA, até ~20 min de conversa
  bloco_extra: 1,       // a cada ~20 min a mais
  ao_vivo: 1,           // texto ao vivo durante a gravação
  digitado: 0.5,        // prontuário a partir de texto digitado/ditado (sem gravação da consulta)
  exame: 1,             // análise de exame
  assistente: 0.34,     // pergunta ao assistente de IA (3 perguntas ≈ 1 crédito)
  sofia: 0.5,           // conversa atendida pela Sofia
} as const

/** ~20 min de conversa em consulta ≈ 2.200 palavras transcritas. */
export const PALAVRAS_POR_BLOCO = 2200

export function custoConsulta(p: { palavras: number; aoVivo?: boolean; digitado?: boolean }): number {
  if (p.digitado) return CUSTO.digitado
  const blocos = Math.max(1, Math.ceil(Math.max(0, p.palavras) / PALAVRAS_POR_BLOCO))
  return CUSTO.consulta + (blocos - 1) * CUSTO.bloco_extra + (p.aoVivo ? CUSTO.ao_vivo : 0)
}

export const contarPalavras = (t: string) => (String(t || '').trim().match(/\S+/g) || []).length

/** Mostra 12,5 → "12,5" e 12 → "12". */
export const fmtCreditos = (n: number) => (Math.round(n * 10) / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 })

export type Saldo = {
  plano: string | null
  limite: number | null      // créditos do plano no mês (null = sem limite)
  extras: number             // pacotes válidos
  usados: number             // usados no mês
  disponivel: number | null  // null = sem limite
}

export function calcularSaldo(plano: string | null, usados: number, extras: number): Saldo {
  const limite = creditosDoPlano(plano)
  return { plano, limite, extras, usados, disponivel: limite === null ? null : Math.max(0, limite + extras - usados) }
}

/** Pacotes extras e profissional adicional (preços de venda). */
export const PACOTES = [
  { id: 'p100', creditos: 100, preco: 89 },
  { id: 'p300', creditos: 300, preco: 249 },
] as const
export const PROFISSIONAL_EXTRA = { preco: 97, creditos: 100 }
