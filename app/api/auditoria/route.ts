import { NextRequest, NextResponse } from 'next/server'
import { supabaseServidor } from '@/lib/servidor'

/**
 * Registro de acessos ao prontuário (tabela auditoria_acessos — migration 0013).
 *
 * POST  grava um acesso (chamado por lib/auditoria.ts → registrarAcesso).
 *       IP e user-agent vêm dos headers, nunca do corpo.
 * GET   lista com filtros. Exige ao menos um escopo: clinica_id, medico_id ou paciente_id.
 *       ?paciente_id= &usuario_id= &usuario_tipo= &acao= &recurso= &de=YYYY-MM-DD &ate=YYYY-MM-DD
 *       &pagina=1 &por_pagina=50 (máx. 1000)
 *       Resposta: { registros, total, pagina, por_pagina, tabela_ausente? }
 */

const ACOES = ['visualizou', 'editou', 'exportou', 'imprimiu', 'excluiu']
const RECURSOS = ['paciente', 'consulta', 'prontuario', 'exame', 'conversa']
const TIPOS = ['medico', 'admin', 'recepcionista', 'atendente']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const uuidOuNull = (v: any) => (typeof v === 'string' && UUID.test(v) ? v : null)
const texto = (v: any, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

/** Tabela/coluna inexistente (migration 0013 não rodou). */
function ehTabelaAusente(err: any): boolean {
  const c = err?.code || ''
  const m = String(err?.message || '')
  return c === '42P01' || c === 'PGRST205' || c === '42703' || /does not exist|schema cache/i.test(m)
}

function ipDe(req: NextRequest): string | null {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim().slice(0, 64)
  return (req.headers.get('x-real-ip') || req.ip || null)?.slice(0, 64) ?? null
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json().catch(() => null)
    if (!b || !ACOES.includes(b.acao) || !RECURSOS.includes(b.recurso)) {
      return NextResponse.json({ ok: false, error: 'acao/recurso inválidos' }, { status: 400 })
    }
    let detalhes = b.detalhes && typeof b.detalhes === 'object' && !Array.isArray(b.detalhes) ? b.detalhes : {}
    if (JSON.stringify(detalhes).length > 4000) detalhes = { truncado: true }

    const { error } = await supabaseServidor.from('auditoria_acessos').insert({
      clinica_id: uuidOuNull(b.clinica_id),
      medico_id: uuidOuNull(b.medico_id),
      usuario_id: uuidOuNull(b.usuario_id),
      usuario_nome: texto(b.usuario_nome, 160),
      usuario_tipo: TIPOS.includes(b.usuario_tipo) ? b.usuario_tipo : 'medico',
      acao: b.acao,
      recurso: b.recurso,
      recurso_id: texto(b.recurso_id, 120),
      paciente_id: uuidOuNull(b.paciente_id),
      detalhes,
      ip: ipDe(req),
      user_agent: texto(req.headers.get('user-agent'), 400),
    })
    // Falha de auditoria nunca deve virar erro na tela: responde 200 com o motivo.
    if (error) return NextResponse.json({ ok: false, tabela_ausente: ehTabelaAusente(error), error: error.message })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'erro' })
  }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const clinicaId = uuidOuNull(sp.get('clinica_id'))
  const medicoId = uuidOuNull(sp.get('medico_id'))
  const pacienteId = uuidOuNull(sp.get('paciente_id'))
  if (!clinicaId && !medicoId && !pacienteId) {
    return NextResponse.json({ error: 'Informe clinica_id, medico_id ou paciente_id' }, { status: 400 })
  }
  const pagina = Math.max(1, parseInt(sp.get('pagina') || '1') || 1)
  const porPagina = Math.min(1000, Math.max(1, parseInt(sp.get('por_pagina') || '50') || 50))

  let q = supabaseServidor.from('auditoria_acessos').select('*', { count: 'exact' })
  // Clínica + médico: vê os registros da clínica E os do médico (autônomo sem clinica_id).
  if (clinicaId && medicoId) q = q.or(`clinica_id.eq.${clinicaId},medico_id.eq.${medicoId}`)
  else if (clinicaId) q = q.eq('clinica_id', clinicaId)
  else if (medicoId) q = q.eq('medico_id', medicoId)
  if (pacienteId) q = q.eq('paciente_id', pacienteId)

  const usuarioId = uuidOuNull(sp.get('usuario_id'))
  if (usuarioId) q = q.eq('usuario_id', usuarioId)
  const tipo = sp.get('usuario_tipo'); if (tipo && TIPOS.includes(tipo)) q = q.eq('usuario_tipo', tipo)
  const acao = sp.get('acao'); if (acao && ACOES.includes(acao)) q = q.eq('acao', acao)
  const recurso = sp.get('recurso'); if (recurso && RECURSOS.includes(recurso)) q = q.eq('recurso', recurso)
  const de = sp.get('de'); if (de && /^\d{4}-\d{2}-\d{2}/.test(de)) q = q.gte('criado_em', new Date(de + 'T00:00:00-03:00').toISOString())
  const ate = sp.get('ate'); if (ate && /^\d{4}-\d{2}-\d{2}/.test(ate)) q = q.lte('criado_em', new Date(ate + 'T23:59:59.999-03:00').toISOString())

  const ini = (pagina - 1) * porPagina
  const { data, error, count } = await q.order('criado_em', { ascending: false }).range(ini, ini + porPagina - 1)
  if (error) {
    if (ehTabelaAusente(error)) {
      return NextResponse.json({ registros: [], total: 0, pagina, por_pagina: porPagina, tabela_ausente: true })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Nome do paciente (sem FK de propósito — busca à parte)
  const registros: any[] = data || []
  const ids = Array.from(new Set(registros.map(r => r.paciente_id).filter(Boolean)))
  if (ids.length) {
    const { data: pacs } = await supabaseServidor.from('pacientes').select('id, nome').in('id', ids)
    const mapa = new Map((pacs || []).map((p: any) => [p.id, p.nome]))
    registros.forEach(r => { r.paciente_nome = r.paciente_id ? mapa.get(r.paciente_id) ?? null : null })
  }

  return NextResponse.json({ registros, total: count ?? registros.length, pagina, por_pagina: porPagina })
}
