'use client'
/** Trocar de unidade no navegador: pede a sessão nova ao servidor e recarrega no Início. */
import { guardarToken } from '@/lib/sessao'

export type UnidadeResumo = { vinculo_id: string; papel: string; clinica_id: string; nome: string; apelido: string | null; organizacao: string; tipo_conta: string }

export async function listarUnidades(): Promise<{ atual: string | null; unidades: UnidadeResumo[] }> {
  const r = await fetch('/api/sessao/unidades')
  if (!r.ok) return { atual: null, unidades: [] }
  return r.json()
}

export async function trocarDeUnidade(clinicaId: string, papel?: string) {
  const r = await fetch('/api/sessao/unidades', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clinica_id: clinicaId, papel }) })
  const j = await r.json()
  if (!r.ok) throw new Error(j.error || 'Não foi possível trocar de unidade')
  guardarToken(j.token)
  if (j.tipo === 'clinica') { localStorage.setItem('clinica_admin', JSON.stringify(j.admin)); localStorage.removeItem('medico') }
  else { localStorage.setItem('medico', JSON.stringify(j.medico)); localStorage.removeItem('clinica_admin') }
  if (j.clinica) localStorage.setItem('clinica', JSON.stringify(j.clinica))
  try { sessionStorage.removeItem('c360-plano'); localStorage.removeItem('c360-meu-posto') } catch {}
  window.location.href = j.tipo === 'medico' && ['recepcionista', 'enfermagem'].includes(j.medico?.cargo) ? '/atendimento' : '/dashboard'
}
