/**
 * Contas com uma ou várias unidades (migration 0024): organização → unidades (clinicas) →
 * pessoas (usuarios, pelo email) → vínculos (papel em cada unidade, apontando para o login
 * que já existe em clinica_admins ou medicos).
 *
 * Tudo aqui é "melhor esforço": se a 0024 ainda não rodou, as funções não fazem nada e o
 * sistema segue como antes (um login = uma clínica).
 */
import { supabaseServidor as db } from '@/lib/servidor'
import { assinarToken } from '@/lib/token'
import { log } from '@/lib/logger'

export type Papel = 'dono' | 'admin' | 'medico' | 'recepcao' | 'enfermagem' | 'atendente'
export type Unidade = {
  vinculo_id: string; papel: Papel; clinica_id: string; nome: string; apelido: string | null
  organizacao_id: string; organizacao: string; tipo_conta: string
  clinica_admin_id: string | null; medico_id: string | null
}

const semTabela = (e: any) => !!e && /(vinculos|usuarios|organizacoes|organizacao_id)/.test(String(e.message || e)) && /(does not exist|schema cache|column)/.test(String(e.message || e))
const norm = (e: string) => String(e || '').trim().toLowerCase()

export function papelDoCargo(cargo: string | null | undefined, autonomo = false): Papel {
  if (cargo === 'recepcionista') return 'recepcao'
  if (cargo === 'enfermagem') return 'enfermagem'
  if (cargo === 'admin') return autonomo ? 'dono' : 'admin'
  return 'medico'
}

/** Organização da unidade (cria se ainda não tem). */
export async function organizacaoDaClinica(clinicaId: string, tipoConta?: 'individual' | 'clinica' | 'rede'): Promise<string | null> {
  const { data: c, error } = await db.from('clinicas').select('id, nome, tipo, organizacao_id').eq('id', clinicaId).maybeSingle()
  if (error) { if (!semTabela(error)) log.warn('[contas] clínica:', error.message); return null }
  if (!c) return null
  if ((c as any).organizacao_id) return (c as any).organizacao_id
  const tipo = tipoConta || ((c as any).tipo === 'autonomo' ? 'individual' : 'clinica')
  const { data: o, error: e2 } = await db.from('organizacoes').insert({ nome: (c as any).nome || 'Clínica', tipo_conta: tipo }).select('id').single()
  if (e2) { if (!semTabela(e2)) log.warn('[contas] organização:', e2.message); return null }
  await db.from('clinicas').update({ organizacao_id: (o as any).id }).eq('id', clinicaId)
  return (o as any).id
}

/** Garante a pessoa (pelo email) e o vínculo dela com a unidade. Nunca quebra o fluxo de quem chama. */
export async function registrarVinculo(p: {
  email: string; nome?: string | null; clinicaId: string | null; papel: Papel
  clinicaAdminId?: string | null; medicoId?: string | null; tipoConta?: 'individual' | 'clinica' | 'rede'
  todasUnidades?: boolean
}) {
  try {
    if (!p.email || !p.clinicaId) return
    const org = await organizacaoDaClinica(p.clinicaId, p.tipoConta)
    if (!org) return
    let { data: u } = await db.from('usuarios').select('id').ilike('email', norm(p.email)).maybeSingle()
    if (!u) {
      const r = await db.from('usuarios').insert({ email: norm(p.email), nome: p.nome || null }).select('id').single()
      if (r.error) { if (!semTabela(r.error)) log.warn('[contas] pessoa:', r.error.message); return }
      u = r.data
    }
    const { error } = await db.from('vinculos').insert({
      usuario_id: (u as any).id, organizacao_id: org, clinica_id: p.todasUnidades ? null : p.clinicaId, papel: p.papel,
      clinica_admin_id: p.clinicaAdminId || null, medico_id: p.medicoId || null,
    })
    if (error && !/duplicate|unique/i.test(error.message) && !semTabela(error)) log.warn('[contas] vínculo:', error.message)
  } catch (e: any) { log.warn('[contas] registrarVinculo:', e?.message) }
}

/** Unidades onde a pessoa pode entrar (vínculos ativos), com nome de cada uma. */
export async function unidadesDaPessoa(email: string): Promise<Unidade[]> {
  const { data: u, error } = await db.from('usuarios').select('id').ilike('email', norm(email)).maybeSingle()
  if (error || !u) return []
  const { data: vs } = await db.from('vinculos').select('id, papel, clinica_id, organizacao_id, clinica_admin_id, medico_id')
    .eq('usuario_id', (u as any).id).eq('ativo', true)
  if (!vs?.length) return []
  const orgs = Array.from(new Set(vs.map((v: any) => v.organizacao_id)))
  const [{ data: clinicas }, { data: organizacoes }] = await Promise.all([
    db.from('clinicas').select('id, nome, apelido_unidade, organizacao_id').in('organizacao_id', orgs),
    db.from('organizacoes').select('id, nome, tipo_conta').in('id', orgs),
  ])
  const org = new Map((organizacoes || []).map((o: any) => [o.id, o]))
  const lista: Unidade[] = []
  for (const v of vs as any[]) {
    // vínculo da organização inteira (clinica_id vazio) vale para todas as unidades dela
    const alvo = (clinicas || []).filter((c: any) => v.clinica_id ? c.id === v.clinica_id : c.organizacao_id === v.organizacao_id)
    for (const c of alvo as any[]) {
      if (lista.some(x => x.clinica_id === c.id && x.papel === v.papel)) continue
      lista.push({
        vinculo_id: v.id, papel: v.papel, clinica_id: c.id, nome: c.nome, apelido: c.apelido_unidade,
        organizacao_id: v.organizacao_id, organizacao: org.get(v.organizacao_id)?.nome || c.nome, tipo_conta: org.get(v.organizacao_id)?.tipo_conta || 'clinica',
        clinica_admin_id: v.clinica_admin_id, medico_id: v.medico_id,
      })
    }
  }
  return lista.sort((a, b) => (a.apelido || a.nome).localeCompare(b.apelido || b.nome))
}

/** Monta a sessão (token + dados que o navegador guarda) para entrar numa unidade. */
export async function sessaoNaUnidade(u: Unidade) {
  const { data: clinica } = await db.from('clinicas').select('id, nome, tipo, email, telefone, apelido_unidade, organizacao_id').eq('id', u.clinica_id).maybeSingle()
  if (u.clinica_admin_id) {
    const { data: a } = await db.from('clinica_admins').select('id, email, nome, role, onboarding_concluido, ativo').eq('id', u.clinica_admin_id).maybeSingle()
    if (!a || (a as any).ativo === false) return null
    const token = await assinarToken({ sub: (a as any).id, tipo: 'clinica', clinica_id: u.clinica_id, medico_id: null })
    return { token, tipo: 'clinica' as const, clinica, admin: { ...(a as any), clinica_id: u.clinica_id, onboarding_concluido: true } }
  }
  if (u.medico_id) {
    const { data: m } = await db.from('medicos').select('*').eq('id', u.medico_id).maybeSingle()
    if (!m || (m as any).ativo === false) return null
    const token = await assinarToken({ sub: (m as any).id, tipo: 'medico', clinica_id: (m as any).clinica_id || u.clinica_id, medico_id: (m as any).id })
    const { senha_hash, senha, token_verificacao, token_expira_em, ...medico } = m as any
    return { token, tipo: 'medico' as const, clinica, medico }
  }
  return null
}
