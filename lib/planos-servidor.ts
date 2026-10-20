/** Plano da clínica no servidor (créditos de IA: lib/creditos-servidor.ts). */
import { supabaseServidor as db } from '@/lib/servidor'

export async function planoDaClinica(clinicaId: string | null | undefined): Promise<string | null> {
  if (!clinicaId) return null
  const { data } = await db.from('clinicas').select('plano').eq('id', clinicaId).maybeSingle()
  return (data as any)?.plano ?? null
}
