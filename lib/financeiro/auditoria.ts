import { supabase } from '@/lib/supabase'
import type { Resultado } from './types'

export interface LogAuditoria {
  id: string
  clinica_id: string
  usuario_id: string | null
  acao: string
  entidade: string | null
  entidade_id: string | null
  detalhe: string | null
  valor: number | null
  created_at: string
}

interface LogInput {
  clinica_id: string | null | undefined
  usuario_id?: string | null
  acao: string
  entidade?: string
  entidade_id?: string | null
  detalhe?: string
  valor?: number | null
}

// Registra uma ação na trilha de auditoria. À prova de falha: nunca lança —
// um erro de log jamais deve quebrar a operação financeira em si.
export async function registrarLog(input: LogInput): Promise<void> {
  try {
    if (!input.clinica_id) return
    await supabase.from('financeiro_auditoria').insert({
      clinica_id: input.clinica_id,
      usuario_id: input.usuario_id || null,
      acao: input.acao,
      entidade: input.entidade || null,
      entidade_id: input.entidade_id || null,
      detalhe: input.detalhe || null,
      valor: input.valor ?? null,
    })
  } catch {
    /* silencioso de propósito */
  }
}

export async function listarLogs(
  clinicaId: string,
  limite = 200,
): Promise<Resultado<LogAuditoria[]>> {
  const { data, error } = await supabase
    .from('financeiro_auditoria')
    .select('*')
    .eq('clinica_id', clinicaId)
    .order('created_at', { ascending: false })
    .limit(limite)
  return { data: (data as LogAuditoria[]) || [], error: error?.message || null }
}
