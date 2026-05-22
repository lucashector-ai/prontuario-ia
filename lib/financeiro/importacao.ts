import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import type { Resultado } from './types'

export interface PlanilhaParseada {
  colunas: string[]
  linhas: Record<string, any>[]
}

// Lê um arquivo XLSX/CSV e devolve colunas + linhas como objetos.
export function parsePlanilha(buffer: ArrayBuffer): PlanilhaParseada {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const linhas: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })
  const colunas = linhas.length ? Object.keys(linhas[0]) : []
  return { colunas, linhas }
}

// Converte valores no padrão brasileiro ("R$ 1.234,56") ou numérico para number.
export function normalizarValor(v: any): number {
  if (typeof v === 'number') return v
  if (!v) return 0
  let s = String(v).replace(/[^\d,.-]/g, '')
  // formato BR: ponto = milhar, vírgula = decimal
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  return Number(s) || 0
}

// Converte datas (objeto Date, serial Excel já tratado, ou texto dd/mm/aaaa) para ISO.
export function normalizarData(v: any): string | null {
  if (!v) return null
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10)
  const s = String(v).trim()
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  return null
}

// ─── Importação em lote ─────────────────────────────────────────────────────

export async function importarDespesas(
  clinicaId: string,
  registros: { descricao: string; valor: number; vencimento?: string | null; categoria?: string | null; fornecedor?: string | null }[],
): Promise<Resultado<number>> {
  if (!registros.length) return { data: 0, error: null }
  const linhas = registros.map((r) => ({
    clinica_id: clinicaId,
    descricao: r.descricao,
    valor: r.valor,
    vencimento: r.vencimento || null,
    categoria: r.categoria || null,
    fornecedor: r.fornecedor || null,
    status: 'pendente',
  }))
  const { error } = await supabase.from('despesas').insert(linhas)
  return { data: error ? null : linhas.length, error: error?.message || null }
}

export async function importarRecebimentos(
  clinicaId: string,
  registros: { valor: number; vencimento?: string | null; observacoes?: string | null }[],
): Promise<Resultado<number>> {
  if (!registros.length) return { data: 0, error: null }
  const linhas = registros.map((r) => ({
    clinica_id: clinicaId,
    valor: r.valor,
    vencimento: r.vencimento || null,
    observacoes: r.observacoes || null,
    status: 'pendente',
  }))
  const { error } = await supabase.from('recebimentos').insert(linhas)
  return { data: error ? null : linhas.length, error: error?.message || null }
}
