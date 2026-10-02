import { NextRequest, NextResponse } from 'next/server'
import { db, erro, ruim, escopoDe, operadorasDoEscopo, operadoraNoEscopo, guiaNoEscopo, proximoNumero, evento } from '@/lib/tiss/servidor'
import { validarGuia } from '@/lib/tiss/validar'
import { totalProcedimentos, type Procedimento } from '@/lib/tiss/tipos'

export const dynamic = 'force-dynamic'

const EDITAVEIS = ['tipo', 'numero_guia_operadora', 'numero_carteira', 'nome_beneficiario', 'data_atendimento', 'cid_principal',
  'procedimentos', 'tipo_consulta', 'tipo_atendimento', 'indicacao_acidente', 'carater_atendimento', 'profissional', 'observacao',
  'paciente_id', 'consulta_id', 'agendamento_id', 'medico_id'] as const

function limpar(b: any) {
  const o: Record<string, any> = {}
  for (const k of EDITAVEIS) if (k in b) o[k] = typeof b[k] === 'string' ? b[k].trim() || null : b[k]
  if (o.cid_principal) o.cid_principal = String(o.cid_principal).toUpperCase()
  if (o.numero_carteira) o.numero_carteira = String(o.numero_carteira).replace(/\s/g, '')
  if (Array.isArray(o.procedimentos)) {
    o.procedimentos = (o.procedimentos as Procedimento[]).map(p => ({
      codigo_tuss: String(p.codigo_tuss || '').replace(/\D/g, ''),
      descricao: String(p.descricao || '').trim(),
      quantidade: Number(p.quantidade) || 0,
      valor_unitario: Math.round((Number(p.valor_unitario) || 0) * 100) / 100,
    }))
    o.valor_total = totalProcedimentos(o.procedimentos)
  }
  return o
}

// GET /api/tiss/guias?clinica_id=|medico_id=&status=&operadora_id=&competencia=yyyy-mm&id=
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const esc = escopoDe(sp)
  const { ids, erro: e0 } = await operadorasDoEscopo(esc)
  if (e0) return erro(e0)
  if (!ids.length) return NextResponse.json({ guias: [] })
  let q = db.from('guias_tiss').select('*').in('operadora_id', ids).order('data_atendimento', { ascending: false }).limit(1000)
  const id = sp.get('id'); if (id) q = q.eq('id', id)
  const st = sp.get('status'); if (st) q = q.in('status', st.split(','))
  const op = sp.get('operadora_id'); if (op) q = q.eq('operadora_id', op)
  const comp = sp.get('competencia')
  if (comp && /^\d{4}-\d{2}$/.test(comp)) {
    const [a, m] = comp.split('-').map(Number)
    const fim = new Date(Date.UTC(a, m, 1)).toISOString().slice(0, 10)
    q = q.gte('data_atendimento', `${comp}-01`).lt('data_atendimento', fim)
  }
  const { data, error } = await q
  if (error) return erro(error)
  return NextResponse.json({ guias: data || [] })
}

// POST — guia manual (rascunho): { operadora_id, ...campos, clinica_id|medico_id }
export async function POST(req: NextRequest) {
  try {
    const b = await req.json()
    if (!b.operadora_id) return ruim('Selecione a operadora.')
    const r = await operadoraNoEscopo(b.operadora_id, escopoDe(b))
    if (r.erro) return erro(r.erro, r.status)
    const dados = limpar(b)
    const n = await proximoNumero(b.operadora_id, 'ultimo_numero_guia')
    const { data, error } = await db.from('guias_tiss').insert({
      tipo: 'consulta', procedimentos: [], valor_total: 0, ...dados,
      operadora_id: b.operadora_id, numero_guia_prestador: String(n), status: 'rascunho',
      historico: [evento('criada', 'Guia criada manualmente')],
    }).select().single()
    if (error) return erro(error)
    return NextResponse.json({ guia: data })
  } catch (e) { return erro(e) }
}

/**
 * PATCH — { id, ...campos, acao?: 'pronta' | 'rascunho', clinica_id|medico_id }
 * Campos só podem mudar em rascunho/pronta. `acao: 'pronta'` valida antes.
 */
export async function PATCH(req: NextRequest) {
  try {
    const b = await req.json()
    if (!b.id) return ruim('id obrigatório')
    const r = await guiaNoEscopo(b.id, escopoDe(b))
    if (r.erro) return erro(r.erro, r.status)
    const atual = r.guia
    const dados = limpar(b)
    if (b.operadora_id && b.operadora_id !== atual.operadora_id) return ruim('Para trocar a operadora, exclua o rascunho e gere outro.', 422)
    if (Object.keys(dados).length && !['rascunho', 'pronta'].includes(atual.status)) {
      return ruim('Guia já está em lote/enviada — não pode ser editada. Para corrigir, desfaça o lote (se ainda aberto).', 409)
    }
    const upd: Record<string, any> = { ...dados, atualizado_em: new Date().toISOString() }
    const hist = [...(atual.historico || [])]
    if (b.acao === 'pronta') {
      const v = validarGuia({ ...atual, ...dados }, { operadora: r.operadora })
      if (!v.ok) return NextResponse.json({ error: 'A guia tem pendências.', erros: v.erros, avisos: v.avisos }, { status: 422 })
      upd.status = 'pronta'
      hist.push(evento('pronta', 'Validada e pronta para lote'))
    } else if (b.acao === 'rascunho') {
      if (atual.status !== 'pronta') return ruim('Só guias prontas voltam para rascunho.', 409)
      upd.status = 'rascunho'
    } else if (atual.status === 'pronta' && Object.keys(dados).length) {
      // editou uma guia pronta: revalida; se quebrou, volta para rascunho
      const v = validarGuia({ ...atual, ...dados }, { operadora: r.operadora })
      if (!v.ok) upd.status = 'rascunho'
    }
    upd.historico = hist
    const { data, error } = await db.from('guias_tiss').update(upd).eq('id', b.id).select().single()
    if (error) return erro(error)
    return NextResponse.json({ guia: data })
  } catch (e) { return erro(e) }
}

// DELETE ?id= — só rascunho/pronta
export async function DELETE(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const r = await guiaNoEscopo(sp.get('id') || '', escopoDe(sp))
  if (r.erro) return erro(r.erro, r.status)
  if (!['rascunho', 'pronta'].includes(r.guia.status)) return ruim('Só é possível excluir guias em rascunho ou prontas.', 409)
  const { error } = await db.from('guias_tiss').delete().eq('id', r.guia.id)
  if (error) return erro(error)
  return NextResponse.json({ ok: true })
}
