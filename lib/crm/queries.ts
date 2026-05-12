import { supabase } from '@/lib/supabase'
import type { Campanha, CampoForm, CrmForm, Lead, StatusLead } from './types'

async function safeList<T>(promise: any): Promise<T[]> {
  try {
    const { data, error } = await promise
    if (error) {
      if (typeof console !== 'undefined') console.warn('[crm queries]', error.message)
      return []
    }
    return (data as T[]) || []
  } catch (err: any) {
    if (typeof console !== 'undefined') console.warn('[crm queries]', err?.message || err)
    return []
  }
}

async function safeOne<T>(promise: any): Promise<T | null> {
  try {
    const { data, error } = await promise
    if (error) return null
    return data
  } catch {
    return null
  }
}

// ── Leads ──────────────────────────────────────────────────────────────────

export async function listarLeads(clinicaId: string): Promise<Lead[]> {
  return safeList<Lead>(
    supabase
      .from('crm_leads')
      .select('*')
      .eq('clinica_id', clinicaId)
      .order('atualizado_em', { ascending: false })
      .limit(500),
  )
}

export async function criarLead(input: Omit<Lead, 'id' | 'criado_em' | 'atualizado_em' | 'paciente_id' | 'origem_form_id'> & { origem_form_id?: string | null }): Promise<Lead | null> {
  return safeOne<Lead>(
    supabase.from('crm_leads').insert(input).select().single(),
  )
}

export async function atualizarStatusLead(id: string, status: StatusLead): Promise<void> {
  await supabase
    .from('crm_leads')
    .update({ status, atualizado_em: new Date().toISOString() })
    .eq('id', id)
}

export async function atualizarLead(id: string, patch: Partial<Lead>): Promise<void> {
  await supabase
    .from('crm_leads')
    .update({ ...patch, atualizado_em: new Date().toISOString() })
    .eq('id', id)
}

// ── Campanhas ──────────────────────────────────────────────────────────────

export async function listarCampanhas(clinicaId: string): Promise<Campanha[]> {
  return safeList<Campanha>(
    supabase
      .from('crm_campanhas')
      .select('*')
      .eq('clinica_id', clinicaId)
      .order('criada_em', { ascending: false }),
  )
}

export async function salvarCampanha(input: Partial<Campanha> & { clinica_id: string; id?: string }): Promise<Campanha | null> {
  if (input.id) {
    return safeOne<Campanha>(supabase.from('crm_campanhas').update(input).eq('id', input.id).select().single())
  }
  return safeOne<Campanha>(supabase.from('crm_campanhas').insert(input).select().single())
}

// ── Forms ──────────────────────────────────────────────────────────────────

export async function listarForms(clinicaId: string): Promise<CrmForm[]> {
  return safeList<CrmForm>(
    supabase
      .from('crm_forms')
      .select('*')
      .eq('clinica_id', clinicaId)
      .order('criado_em', { ascending: false }),
  )
}

export async function buscarFormPorSlug(slug: string): Promise<CrmForm | null> {
  return safeOne<CrmForm>(
    supabase.from('crm_forms').select('*').eq('slug', slug).eq('ativo', true).maybeSingle(),
  )
}

export async function salvarForm(input: Partial<CrmForm> & { clinica_id: string; id?: string }): Promise<CrmForm | null> {
  if (input.id) {
    return safeOne<CrmForm>(supabase.from('crm_forms').update(input).eq('id', input.id).select().single())
  }
  return safeOne<CrmForm>(supabase.from('crm_forms').insert(input).select().single())
}

export async function inativarForm(id: string): Promise<void> {
  await supabase.from('crm_forms').update({ ativo: false }).eq('id', id)
}

// ── Score de paciente ──────────────────────────────────────────────────────

export type ScorePaciente = {
  pacienteId: string
  nome: string
  consultas: number
  ticketMedio: number
  ultimaVisita: string | null
  total: number
}

export async function calcularScorePacientes(clinicaId: string): Promise<ScorePaciente[]> {
  const [pacientes, movs] = await Promise.all([
    safeList<{ id: string; nome: string; criado_em?: string }>(
      supabase.from('pacientes').select('id, nome, criado_em').eq('clinica_id', clinicaId),
    ),
    safeList<{ paciente_id: string; valor: number; data_movimentacao: string; tipo: string; status: string }>(
      supabase
        .from('financeiro_movimentacoes')
        .select('paciente_id, valor, data_movimentacao, tipo, status')
        .eq('clinica_id', clinicaId)
        .eq('tipo', 'receita'),
    ),
  ])

  const idx = new Map<string, ScorePaciente>()
  for (const p of pacientes) {
    idx.set(p.id, {
      pacienteId: p.id,
      nome: p.nome,
      consultas: 0,
      ticketMedio: 0,
      ultimaVisita: null,
      total: 0,
    })
  }

  for (const m of movs) {
    if (!m.paciente_id) continue
    const cur = idx.get(m.paciente_id)
    if (!cur) continue
    cur.consultas++
    cur.total += Number(m.valor) || 0
    if (!cur.ultimaVisita || m.data_movimentacao > cur.ultimaVisita) cur.ultimaVisita = m.data_movimentacao
  }
  const arr = Array.from(idx.values())
  for (const v of arr) {
    v.ticketMedio = v.consultas > 0 ? v.total / v.consultas : 0
  }
  return arr.sort((a, b) => b.total - a.total)
}

// ── Submissão pública de form ──────────────────────────────────────────────

export async function submeterForm(slug: string, dados: Record<string, string>): Promise<{ ok: boolean; error?: string }> {
  const form = await buscarFormPorSlug(slug)
  if (!form) return { ok: false, error: 'Formulário não encontrado.' }

  // Valida campos obrigatórios
  for (const c of form.campos as CampoForm[]) {
    if (c.obrigatorio && !(dados[c.nome] || '').trim()) {
      return { ok: false, error: `Campo "${c.label}" é obrigatório.` }
    }
  }

  // Nome / email / telefone / interesse mapeados quando existirem
  const nome = dados['nome'] || dados['nome_completo'] || dados['name'] || 'Lead via formulário'
  const email = dados['email'] || null
  const telefone = dados['telefone'] || dados['whatsapp'] || dados['celular'] || null
  const interesse = dados['interesse'] || dados['assunto'] || dados['mensagem'] || dados['comentarios'] || null

  // Salva como observação tudo que veio no form (JSON)
  const obs = `Formulário: ${form.titulo}\n` + Object.entries(dados).map(([k, v]) => `${k}: ${v}`).join('\n')

  await supabase.from('crm_leads').insert({
    clinica_id: form.clinica_id,
    nome,
    email,
    telefone,
    interesse,
    origem: 'site',
    status: 'novo',
    observacoes: obs,
    origem_form_id: form.id,
  })

  await supabase
    .from('crm_forms')
    .update({ total_submissoes: form.total_submissoes + 1 })
    .eq('id', form.id)

  return { ok: true }
}
