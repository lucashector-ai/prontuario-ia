import { NextRequest, NextResponse } from 'next/server'
import { db, erro, ruim, proximoNumero, evento } from '@/lib/tiss/servidor'
import { normalizarConvenio } from '@/lib/convenios'
import { chaveNome, profissionalDoMedico } from '@/lib/tiss/tipos'
import { CODIGO_CONSULTA_CONSULTORIO, descricaoTuss } from '@/lib/tiss/tuss'

/**
 * POST /api/tiss/guias/gerar — { consulta_id, operadora_id?, clinica_id?, medico_id? }
 * Cria a guia de consulta (rascunho) a partir de uma consulta: paciente, carteirinha,
 * convênio → operadora (nome normalizado), CID da consulta, procedimento 10101012
 * com o valor da tabela de preços. Idempotente: se já existe guia da consulta, devolve ela.
 */
export async function POST(req: NextRequest) {
  try {
    const b = await req.json()
    if (!b.consulta_id) return ruim('consulta_id obrigatório')

    const { data: existente, error: e0 } = await db.from('guias_tiss').select('*').eq('consulta_id', b.consulta_id).limit(1).maybeSingle()
    if (e0) return erro(e0)
    if (existente) return NextResponse.json({ guia: existente, existente: true })

    const { data: consulta, error: e1 } = await db.from('consultas').select('*').eq('id', b.consulta_id).maybeSingle()
    if (e1) return erro(e1)
    if (!consulta) return ruim('Consulta não encontrada.', 404)

    const [{ data: paciente }, { data: medico }] = await Promise.all([
      db.from('pacientes').select('*').eq('id', consulta.paciente_id).maybeSingle(),
      db.from('medicos').select('*').eq('id', consulta.medico_id).maybeSingle(),
    ])
    if (!paciente) return ruim('Paciente da consulta não encontrado.', 404)

    // Escopo: clínica do médico (ou o próprio médico autônomo). Confere com o que veio do cliente.
    const clinicaId = medico?.clinica_id || null
    if (b.clinica_id && clinicaId && b.clinica_id !== clinicaId) return ruim('Consulta de outra clínica.', 403)
    if (!clinicaId && b.medico_id && b.medico_id !== consulta.medico_id) return ruim('Consulta de outro médico.', 403)

    const convenio = normalizarConvenio(paciente.convenio)
    if (convenio === 'Particular') return ruim('Paciente particular — não há guia de convênio a gerar.', 422)

    let q = db.from('operadoras').select('*').eq('ativo', true)
    q = clinicaId ? q.eq('clinica_id', clinicaId) : q.eq('medico_id', consulta.medico_id)
    const { data: ops, error: e2 } = await q
    if (e2) return erro(e2)
    const operadora = b.operadora_id
      ? (ops || []).find((o: any) => o.id === b.operadora_id)
      : (ops || []).find((o: any) => chaveNome(normalizarConvenio(o.nome)) === chaveNome(convenio))
    if (!operadora) {
      return NextResponse.json({
        error: `Cadastre a operadora "${convenio}" em Faturamento › Operadoras antes de gerar a guia.`,
        convenio, operadoras: (ops || []).map((o: any) => ({ id: o.id, nome: o.nome })),
      }, { status: 422 })
    }

    // Primeira consulta ou seguimento (há consulta anterior do mesmo paciente com o médico?)
    const { count } = await db.from('consultas').select('id', { count: 'exact', head: true })
      .eq('paciente_id', consulta.paciente_id).eq('medico_id', consulta.medico_id).lt('criado_em', consulta.criado_em)

    const { data: preco } = await db.from('tabela_precos').select('valor, descricao')
      .eq('operadora_id', operadora.id).eq('codigo_tuss', CODIGO_CONSULTA_CONSULTORIO).maybeSingle()

    const cid = Array.isArray(consulta.cids) && consulta.cids[0]?.codigo ? String(consulta.cids[0].codigo).toUpperCase() : null
    const data = new Date(consulta.criado_em || Date.now()).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
    const valor = Number(preco?.valor) || 0

    const n = await proximoNumero(operadora.id, 'ultimo_numero_guia')
    const { data: guia, error: e3 } = await db.from('guias_tiss').insert({
      operadora_id: operadora.id,
      medico_id: consulta.medico_id,
      paciente_id: consulta.paciente_id,
      consulta_id: consulta.id,
      agendamento_id: consulta.agendamento_id || null,
      tipo: 'consulta',
      numero_guia_prestador: String(n),
      numero_carteira: (paciente.nr_carteirinha || '').replace(/\s/g, '') || null,
      nome_beneficiario: paciente.nome,
      data_atendimento: data,
      cid_principal: cid,
      procedimentos: [{
        codigo_tuss: CODIGO_CONSULTA_CONSULTORIO,
        descricao: preco?.descricao || descricaoTuss(CODIGO_CONSULTA_CONSULTORIO) || 'Consulta em consultório',
        quantidade: 1, valor_unitario: valor,
      }],
      valor_total: valor,
      tipo_consulta: (count || 0) > 0 ? '2' : '1',
      profissional: profissionalDoMedico(medico),
      status: 'rascunho',
      historico: [evento('criada', 'Gerada a partir da consulta')],
    }).select().single()
    if (e3) return erro(e3)

    const avisos: string[] = []
    if (!valor) avisos.push('Sem preço para 10101012 na tabela desta operadora — informe o valor.')
    if (!guia.numero_carteira) avisos.push('Paciente sem carteirinha cadastrada.')
    return NextResponse.json({ guia, avisos })
  } catch (e) { return erro(e) }
}
