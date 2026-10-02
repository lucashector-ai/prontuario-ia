/**
 * Regras de montagem de lote e de retorno financeiro — usadas pela API e pelo
 * modo demonstração da página (mesma lógica nos dois lados).
 */
import type { Guia, StatusGuia, TipoGuia } from './tipos'
import { arred2, competenciaDe } from './tipos'

export type GrupoLote = { operadora_id: string; tipo_guia: TipoGuia; competencia: string; guias: Guia[]; valor_total: number }

/** TISS: um lote = uma operadora + um tipo de guia. Separamos também por competência. */
export function agruparParaLote(guias: Guia[]): GrupoLote[] {
  const mapa = new Map<string, GrupoLote>()
  for (const g of guias) {
    const comp = competenciaDe(g.data_atendimento)
    const k = `${g.operadora_id}|${g.tipo}|${comp}`
    if (!mapa.has(k)) mapa.set(k, { operadora_id: g.operadora_id, tipo_guia: g.tipo, competencia: comp, guias: [], valor_total: 0 })
    const grp = mapa.get(k)!
    grp.guias.push(g)
    grp.valor_total = arred2(grp.valor_total + (Number(g.valor_total) || 0))
  }
  return Array.from(mapa.values())
}

/** Status a partir do valor pago: tudo → paga; nada → glosada; parte → paga_parcial. */
export function statusRetorno(valorTotal: number, valorPago: number): { status: StatusGuia; valor_glosado: number } {
  const total = arred2(valorTotal)
  const pago = arred2(Math.max(0, valorPago))
  const glosado = arred2(Math.max(0, total - pago))
  if (glosado <= 0) return { status: 'paga', valor_glosado: 0 }
  if (pago <= 0) return { status: 'glosada', valor_glosado: glosado }
  return { status: 'paga_parcial', valor_glosado: glosado }
}

export const COM_RETORNO: StatusGuia[] = ['paga', 'glosada', 'paga_parcial']
