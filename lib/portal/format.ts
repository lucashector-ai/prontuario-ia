export function formatDataLonga(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return '—'
  }
}

export function formatDataCurta(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
  } catch {
    return '—'
  }
}

export function formatHora(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export function formatRelativo(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    const data = new Date(iso)
    const agora = new Date()
    const diff = agora.getTime() - data.getTime()
    const seg = Math.floor(diff / 1000)
    if (seg < 60) return 'agora'
    if (seg < 3600) return `há ${Math.floor(seg / 60)} min`
    if (seg < 86400) return `há ${Math.floor(seg / 3600)} h`
    const dias = Math.floor(seg / 86400)
    if (dias < 7) return `há ${dias} dia${dias > 1 ? 's' : ''}`
    if (dias < 30) return `há ${Math.floor(dias / 7)} sem`
    if (dias < 365) return `há ${Math.floor(dias / 30)} mes`
    return `há ${Math.floor(dias / 365)} ano${Math.floor(dias / 365) > 1 ? 's' : ''}`
  } catch {
    return '—'
  }
}

export function formatMoeda(valor: number | null | undefined): string {
  if (valor == null || isNaN(valor)) return 'R$ —'
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
