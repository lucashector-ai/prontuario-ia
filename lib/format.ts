// Formatação de campos brasileiros (telefone, CPF)
// Padrão: state guarda LIMPO, UI formata na hora de mostrar/digitar.

export function cleanTelefone(v: string | null | undefined): string {
  return (v || '').replace(/\D/g, '').slice(0, 11)
}

export function formatTelefone(v: string | null | undefined): string {
  const nums = cleanTelefone(v)
  if (nums.length === 0) return ''
  if (nums.length <= 2) return `(${nums}`
  if (nums.length <= 6) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`
  if (nums.length <= 10) return `(${nums.slice(0, 2)}) ${nums.slice(2, 6)}-${nums.slice(6)}`
  return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7)}`
}

export function cleanCPF(v: string | null | undefined): string {
  return (v || '').replace(/\D/g, '').slice(0, 11)
}

export function formatCPF(v: string | null | undefined): string {
  const nums = cleanCPF(v)
  if (nums.length === 0) return ''
  if (nums.length <= 3) return nums
  if (nums.length <= 6) return `${nums.slice(0, 3)}.${nums.slice(3)}`
  if (nums.length <= 9) return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6)}`
  return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6, 9)}-${nums.slice(9)}`
}
