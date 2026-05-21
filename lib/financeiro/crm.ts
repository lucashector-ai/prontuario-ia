import { supabase } from '@/lib/supabase'
import type { Resultado } from './types'

export interface ClienteFinanceiro {
  pacienteId: string
  nome: string
  faturado: number
  recebido: number
  emAberto: number
  inadimplencia: number
  nComandas: number
  ticketMedio: number
  ultimaComanda: string | null
}

// CRM financeiro: agrega comandas e recebimentos por paciente para visão de LTV.
export async function obterCrmFinanceiro(clinicaId: string): Promise<Resultado<ClienteFinanceiro[]>> {
  try {
    const hoje = new Date().toISOString().slice(0, 10)

    const [comandasR, recebR] = await Promise.all([
      supabase.from('comandas')
        .select('paciente_id, valor_final, fechado_em, status, pacientes:paciente_id(nome)')
        .eq('clinica_id', clinicaId)
        .in('status', ['fechada', 'paga'])
        .not('paciente_id', 'is', null),
      supabase.from('recebimentos')
        .select('paciente_id, valor, valor_pago, status, vencimento')
        .eq('clinica_id', clinicaId)
        .not('paciente_id', 'is', null),
    ])

    const mapa: Record<string, ClienteFinanceiro> = {}
    const garante = (id: string, nome: string): ClienteFinanceiro => {
      if (!mapa[id]) {
        mapa[id] = {
          pacienteId: id, nome: nome || 'Paciente',
          faturado: 0, recebido: 0, emAberto: 0, inadimplencia: 0,
          nComandas: 0, ticketMedio: 0, ultimaComanda: null,
        }
      }
      return mapa[id]
    }

    for (const c of comandasR.data || []) {
      const id = (c as any).paciente_id
      if (!id) continue
      const cli = garante(id, (c as any).pacientes?.nome)
      cli.faturado += Number(c.valor_final || 0)
      cli.nComandas += 1
      const f = (c.fechado_em || '').slice(0, 10)
      if (f && (!cli.ultimaComanda || f > cli.ultimaComanda)) cli.ultimaComanda = f
    }

    for (const r of recebR.data || []) {
      const id = (r as any).paciente_id
      if (!id || !mapa[id]) continue
      const cli = mapa[id]
      if (r.status === 'pago') {
        cli.recebido += Number(r.valor_pago || 0)
      } else if (['pendente', 'parcial', 'atrasado'].includes(r.status)) {
        const v = Number(r.valor || 0)
        cli.emAberto += v
        const venc = (r.vencimento || '').slice(0, 10)
        if (venc && venc < hoje) cli.inadimplencia += v
      }
    }

    const lista = Object.values(mapa).map((c) => ({
      ...c,
      ticketMedio: c.nComandas > 0 ? c.faturado / c.nComandas : 0,
    }))
    lista.sort((a, b) => b.recebido - a.recebido)

    return { data: lista, error: null }
  } catch (e: any) {
    return { data: null, error: e?.message || 'erro ao montar CRM financeiro' }
  }
}
