// Cálculos financeiros puros — sem I/O, cobertos por testes unitários.
// Mantidos isolados de Supabase para serem testáveis sem banco/ambiente.

// Divide um total em N parcelas, jogando o resto de centavos na última.
export function distribuirParcelas(total: number, n: number): number[] {
  if (n <= 1) return [total]
  const base = Math.floor((total / n) * 100) / 100
  const parcelas = Array(n).fill(base)
  parcelas[n - 1] = Math.round((total - base * (n - 1)) * 100) / 100
  return parcelas
}

// Vencimento da parcela `indice` (0-based): 1ª no ato, demais a cada 30 dias.
export function vencimentoParcela(indice: number, base: Date = new Date()): string {
  const d = new Date(base)
  d.setDate(d.getDate() + indice * 30)
  return d.toISOString().slice(0, 10)
}

// Recebimento pendente/parcial vencido conta como 'atrasado'.
export function statusEfetivoRecebimento(
  r: { status: string; vencimento: string | null },
  hoje: string = new Date().toISOString().slice(0, 10),
): string {
  if ((r.status === 'pendente' || r.status === 'parcial') && r.vencimento) {
    if (r.vencimento.slice(0, 10) < hoje) return 'atrasado'
  }
  return r.status
}

// Despesa pendente vencida conta como 'atrasado'.
export function statusEfetivoDespesa(
  d: { status: string; vencimento: string | null },
  hoje: string = new Date().toISOString().slice(0, 10),
): string {
  if (d.status === 'pendente' && d.vencimento) {
    if (d.vencimento.slice(0, 10) < hoje) return 'atrasado'
  }
  return d.status
}
