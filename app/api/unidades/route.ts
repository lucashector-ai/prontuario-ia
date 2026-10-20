import { NextRequest, NextResponse } from 'next/server'
import { supabaseServidor as db } from '@/lib/servidor'
import { contextoDaRequisicao, naoAutenticado, proibido } from '@/lib/acesso'
import { organizacaoDaClinica } from '@/lib/contas'
import { hojeSP, limitesDoDiaSP } from '@/lib/atendimento/comum'
import { inicioDoMesSP } from '@/lib/planos'

/**
 * Unidades da organização (rede) e a visão consolidada.
 *   GET   → { organizacao, unidades: [{ id, nome, apelido, atual, hoje: {...}, mes: {...} }] }
 *   POST  { nome, apelido?, telefone?, endereco? } → nova unidade (só o dono/administrador da conta)
 */
async function contexto(req: NextRequest) {
  const ctx = await contextoDaRequisicao(req)
  if (!ctx) return { erro: naoAutenticado() }
  if (!ctx.gestor || !ctx.clinica_id) return { erro: proibido('Só o administrador vê as unidades') }
  const org = await organizacaoDaClinica(ctx.clinica_id)
  if (!org) return { erro: NextResponse.json({ error: 'Várias unidades ainda não está ativo nesta conta. Fale com o suporte do Clinical 360 para liberar.' }, { status: 503 }) }
  return { ctx, org }
}

export async function GET(req: NextRequest) {
  const c = await contexto(req); if ('erro' in c) return c.erro
  const [{ data: org }, { data: unidades }] = await Promise.all([
    db.from('organizacoes').select('id, nome, tipo_conta').eq('id', c.org).maybeSingle(),
    db.from('clinicas').select('id, nome, apelido_unidade, telefone, endereco, plano').eq('organizacao_id', c.org).order('criado_em'),
  ])
  const { de, ate } = limitesDoDiaSP(hojeSP())
  const mes = inicioDoMesSP()
  const lista = await Promise.all((unidades || []).map(async (u: any) => {
    const { data: meds } = await db.from('medicos').select('id, cargo').eq('clinica_id', u.id).eq('ativo', true)
    const ids = (meds || []).map((m: any) => m.id)
    const medicos = (meds || []).filter((m: any) => !['recepcionista', 'enfermagem'].includes(m.cargo)).map((m: any) => m.id)
    const nada = ['00000000-0000-0000-0000-000000000000']
    const conta = (r: any) => (r?.error ? null : r?.count ?? 0)
    const [ags, atendidos, consultas, pacientes] = await Promise.all([
      db.from('agendamentos').select('id', { count: 'exact', head: true }).in('medico_id', medicos.length ? medicos : nada).gte('data_hora', de).lte('data_hora', ate).not('status', 'eq', 'cancelado'),
      db.from('atendimentos').select('id', { count: 'exact', head: true }).eq('clinica_id', u.id).eq('dia', hojeSP()).eq('status', 'finalizado'),
      db.from('consultas').select('id', { count: 'exact', head: true }).in('medico_id', medicos.length ? medicos : nada).gte('criado_em', mes),
      db.from('pacientes').select('id', { count: 'exact', head: true }).eq('clinica_id', u.id),
    ])
    return {
      id: u.id, nome: u.nome, apelido: u.apelido_unidade, telefone: u.telefone, endereco: u.endereco, atual: u.id === c.ctx.clinica_id,
      equipe: ids.length, medicos: medicos.length,
      hoje: { agendados: conta(ags), atendidos: conta(atendidos) },
      mes: { consultas: conta(consultas) }, pacientes: conta(pacientes),
    }
  }))
  return NextResponse.json({ organizacao: org, unidades: lista })
}

export async function POST(req: NextRequest) {
  const c = await contexto(req); if ('erro' in c) return c.erro
  if (c.ctx.tipo !== 'clinica') return proibido('Só a conta de administrador da clínica cria unidades')
  const { nome, apelido, telefone, endereco } = await req.json().catch(() => ({}))
  if (!String(nome || '').trim()) return NextResponse.json({ error: 'Dê um nome para a unidade.' }, { status: 400 })
  const { data: atual } = await db.from('clinicas').select('plano, email').eq('id', c.ctx.clinica_id!).maybeSingle()
  if ((atual as any)?.plano === 'gratis') return proibido('Várias unidades fazem parte do plano completo.')
  const { data: nova, error } = await db.from('clinicas').insert({
    nome: String(nome).trim(), apelido_unidade: apelido?.trim() || null, telefone: telefone?.trim() || null, endereco: endereco?.trim() || null,
    tipo: 'clinica', plano: (atual as any)?.plano ?? null, organizacao_id: c.org,
  }).select('id, nome').single()
  if (error) return NextResponse.json({ error: 'Não foi possível criar a unidade. Tente de novo.' }, { status: 500 })
  await db.from('organizacoes').update({ tipo_conta: 'rede' }).eq('id', c.org)
  return NextResponse.json({ unidade: nova })
}
