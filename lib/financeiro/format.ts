export function moeda(valor: number | null | undefined): string {
  if (valor == null || isNaN(valor)) return 'R$ —'
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function moedaCompacta(valor: number | null | undefined): string {
  if (valor == null || isNaN(valor)) return 'R$ —'
  const abs = Math.abs(valor)
  if (abs >= 1_000_000) return `R$ ${(valor / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `R$ ${(valor / 1_000).toFixed(1)}k`
  return moeda(valor)
}

export function percentual(valor: number, casas = 1): string {
  if (isNaN(valor)) return '—'
  const s = valor.toFixed(casas)
  return `${valor > 0 ? '+' : ''}${s}%`
}

export function dataBR(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso)
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return '—'
  }
}

export function dataCurta(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso)
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  } catch {
    return '—'
  }
}
