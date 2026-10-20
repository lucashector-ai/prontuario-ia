/**
 * Contas do estoque (sem banco). Reposição por regra auditável, sem IA:
 *   sugerido = consumo médio/dia (30 dias) × dias de cobertura + previsto pela agenda (14 dias)
 *              − (saldo − o que vence dentro da cobertura), e nunca abaixo do estoque mínimo.
 * Cada número aparece no "porquê".
 */
export type EntradaReposicao = {
  saldo: number
  minimo: number
  consumo30: number          // saídas dos últimos 30 dias
  previsto14: number         // insumos dos procedimentos agendados nos próximos 14 dias
  vencendo: number           // saldo de lotes que vencem dentro da cobertura
  cobertura?: number         // dias que a compra deve cobrir (padrão 30)
}

const fmt = (n: number) => (Math.round(n * 10) / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 })

export function sugestaoReposicao(e: EntradaReposicao): { sugerido: number; porque: string[] } {
  const cobertura = e.cobertura ?? 30
  const porDia = Math.max(0, e.consumo30) / 30
  const util = Math.max(0, e.saldo - Math.max(0, e.vencendo))
  const necessidade = porDia * cobertura + Math.max(0, e.previsto14)
  let sugerido = Math.max(0, necessidade - util)
  if (util + sugerido < e.minimo) sugerido = e.minimo - util
  sugerido = Math.ceil(sugerido)
  const porque = [
    `${fmt(e.consumo30)} usados nos últimos 30 dias (${fmt(porDia)}/dia × ${cobertura} dias = ${fmt(porDia * cobertura)})`,
    ...(e.previsto14 > 0 ? [`${fmt(e.previsto14)} previstos pela agenda dos próximos 14 dias`] : []),
    `saldo de ${fmt(e.saldo)}${e.vencendo > 0 ? `, dos quais ${fmt(e.vencendo)} vencem antes de ${cobertura} dias` : ''}`,
    ...(e.minimo > 0 ? [`estoque mínimo de ${fmt(e.minimo)}`] : []),
  ]
  return { sugerido, porque }
}

export type Alerta = 'zerado' | 'abaixo_minimo' | 'vence_7' | 'vence_30' | 'vencido'

export function alertasDoItem(i: { saldo: number; minimo: number; proximaValidade: string | null }, hoje: string): Alerta[] {
  const a: Alerta[] = []
  if (i.saldo <= 0) a.push('zerado')
  else if (i.saldo < i.minimo) a.push('abaixo_minimo')
  if (i.proximaValidade && i.saldo > 0) {
    const dias = Math.floor((new Date(i.proximaValidade + 'T12:00:00').getTime() - new Date(hoje + 'T12:00:00').getTime()) / 864e5)
    if (dias < 0) a.push('vencido')
    else if (dias <= 7) a.push('vence_7')
    else if (dias <= 30) a.push('vence_30')
  }
  return a
}
