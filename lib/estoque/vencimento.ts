/**
 * Utilitários de validade ANVISA. Datas vencidas e <30 dias = alerta vermelho;
 * <90 dias = atenção (laranja); >=90 = ok (verde).
 */

export type StatusVencimento = 'vencido' | 'critico' | 'atencao' | 'ok'

export function statusValidade(validade: string | null | undefined): StatusVencimento | null {
  if (!validade) return null
  try {
    const data = new Date(validade.length === 10 ? validade + 'T00:00:00' : validade)
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const diasMs = data.getTime() - hoje.getTime()
    const dias = Math.floor(diasMs / 86_400_000)
    if (dias < 0) return 'vencido'
    if (dias < 30) return 'critico'
    if (dias < 90) return 'atencao'
    return 'ok'
  } catch {
    return null
  }
}

export function diasAteValidade(validade: string | null | undefined): number | null {
  if (!validade) return null
  try {
    const data = new Date(validade.length === 10 ? validade + 'T00:00:00' : validade)
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    return Math.floor((data.getTime() - hoje.getTime()) / 86_400_000)
  } catch {
    return null
  }
}

export function labelValidade(validade: string | null | undefined): string {
  const dias = diasAteValidade(validade)
  if (dias === null) return 'Sem validade'
  if (dias < 0) return `Vencido há ${Math.abs(dias)} dia${Math.abs(dias) === 1 ? '' : 's'}`
  if (dias === 0) return 'Vence hoje'
  if (dias === 1) return 'Vence amanhã'
  if (dias < 30) return `Vence em ${dias} dias`
  if (dias < 60) return `Vence em ~1 mês`
  if (dias < 365) return `Vence em ${Math.floor(dias / 30)} meses`
  return `Vence em ${Math.floor(dias / 365)} ano${Math.floor(dias / 365) === 1 ? '' : 's'}`
}
