import { NextRequest, NextResponse } from 'next/server'
import { supabaseServidor as db } from '@/lib/servidor'
import { contextoDaRequisicao, naoAutenticado } from '@/lib/acesso'
import { saldoDaClinica } from '@/lib/creditos-servidor'
import { inicioDoMesSP } from '@/lib/planos'

/** GET → saldo de créditos de IA do mês da clínica da sessão e o uso por tipo. */
export async function GET(req: NextRequest) {
  const ctx = await contextoDaRequisicao(req)
  if (!ctx) return naoAutenticado()
  const chave = ctx.clinica_id || ctx.medico_id
  if (!chave) return NextResponse.json({ saldo: null })
  const [saldo, { data }] = await Promise.all([
    saldoDaClinica(chave),
    db.from('creditos_uso').select('motivo, creditos').eq('clinica_chave', chave).gte('criado_em', inicioDoMesSP()),
  ])
  const porMotivo: Record<string, { vezes: number; creditos: number }> = {}
  for (const r of data || []) {
    const m = (porMotivo[(r as any).motivo] ??= { vezes: 0, creditos: 0 })
    m.vezes++; m.creditos += Number((r as any).creditos) || 0
  }
  return NextResponse.json({ saldo, porMotivo }, { headers: { 'Cache-Control': 'no-store' } })
}
