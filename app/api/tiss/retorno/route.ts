import { NextRequest, NextResponse } from 'next/server'
import { db, erro, ruim, escopoDe, guiaNoEscopo, proximoNumero, evento, numero } from '@/lib/tiss/servidor'
import { statusRetorno, COM_RETORNO } from '@/lib/tiss/lotes'
import { arred2 } from '@/lib/tiss/tipos'

/**
 * POST /api/tiss/retorno — retorno financeiro da operadora, por guia.
 *  { guia_id, valor_pago, motivo_glosa?, clinica_id|medico_id }
 *     → paga | paga_parcial | glosada (glosado = total − pago)
 *  { guia_id, acao: 'reapresentar' }
 *     → cria NOVA guia (rascunho) com o valor glosado para entrar em outro lote;
 *       a original fica como glosada no histórico. (Recurso de glosa formal TISS não incluso.)
 */
export async function POST(req: NextRequest) {
  try {
    const b = await req.json()
    const r = await guiaNoEscopo(b.guia_id || '', escopoDe(b))
    if (r.erro) return erro(r.erro, r.status)
    const g = r.guia

    if (b.acao === 'reapresentar') {
      if (!['glosada', 'paga_parcial'].includes(g.status)) return ruim('Só guias glosadas podem ser reapresentadas.', 409)
      const valor = arred2(Number(g.valor_glosado) || 0)
      if (!(valor > 0)) return ruim('Não há valor glosado a reapresentar.', 422)
      const procs = (g.procedimentos || []) as any[]
      const totalOrig = Number(g.valor_total) || 1
      // proporcional ao glosado (glosa total = mesmos itens; parcial = valores reduzidos)
      const novos = procs.map(p => ({ ...p, valor_unitario: arred2((Number(p.valor_unitario) || 0) * valor / totalOrig) }))
      const n = await proximoNumero(g.operadora_id, 'ultimo_numero_guia')
      const { data: nova, error } = await db.from('guias_tiss').insert({
        operadora_id: g.operadora_id, medico_id: g.medico_id, paciente_id: g.paciente_id, consulta_id: null,
        agendamento_id: g.agendamento_id, tipo: g.tipo, numero_guia_prestador: String(n),
        numero_guia_operadora: g.numero_guia_operadora, numero_carteira: g.numero_carteira, nome_beneficiario: g.nome_beneficiario,
        data_atendimento: g.data_atendimento, cid_principal: g.cid_principal, procedimentos: novos,
        valor_total: novos.reduce((s, p) => s + p.quantidade * p.valor_unitario, 0),
        tipo_consulta: g.tipo_consulta, tipo_atendimento: g.tipo_atendimento, indicacao_acidente: g.indicacao_acidente,
        carater_atendimento: g.carater_atendimento, profissional: g.profissional,
        observacao: `Reapresentação da guia ${g.numero_guia_prestador}${g.motivo_glosa ? ` — glosa: ${g.motivo_glosa}` : ''}`.slice(0, 500),
        status: 'rascunho', historico: [evento('criada', `Reapresentação da guia ${g.numero_guia_prestador}`)],
      }).select().single()
      if (error) return erro(error)
      await db.from('guias_tiss').update({
        historico: [...(g.historico || []), evento('reapresentada', `Nova guia ${n}`)], atualizado_em: new Date().toISOString(),
      }).eq('id', g.id)
      return NextResponse.json({ guia: nova })
    }

    if (!['enviada', ...COM_RETORNO].includes(g.status)) return ruim('Registre o retorno só de guias enviadas.', 409)
    const pago = numero(b.valor_pago)
    if (pago === null || !(pago >= 0)) return ruim('Informe o valor pago (0 se glosa total).', 422)
    if (pago > Number(g.valor_total) + 0.001) return ruim('Valor pago maior que o valor da guia.', 422)
    const { status, valor_glosado } = statusRetorno(Number(g.valor_total), pago)
    const motivo = typeof b.motivo_glosa === 'string' ? b.motivo_glosa.trim() || null : null
    if (valor_glosado > 0 && !motivo) return ruim('Informe o motivo da glosa (código/descrição do demonstrativo).', 422)

    const { data, error } = await db.from('guias_tiss').update({
      status, valor_pago: pago, valor_glosado, motivo_glosa: valor_glosado > 0 ? motivo : null,
      retorno_em: new Date().toISOString(), atualizado_em: new Date().toISOString(),
      historico: [...(g.historico || []), evento(status, valor_glosado > 0 ? `Pago ${pago.toFixed(2)} · glosa ${valor_glosado.toFixed(2)}${motivo ? ` (${motivo})` : ''}` : `Pago ${pago.toFixed(2)}`)],
    }).eq('id', g.id).select().single()
    if (error) return erro(error)

    // Lote processado quando todas as guias tiverem retorno
    if (g.lote_id) {
      const { data: irmas } = await db.from('guias_tiss').select('status').eq('lote_id', g.lote_id)
      if ((irmas || []).every((x: any) => COM_RETORNO.includes(x.status))) {
        await db.from('lotes_tiss').update({ status: 'processado' }).eq('id', g.lote_id)
      }
    }
    return NextResponse.json({ guia: data })
  } catch (e) { return erro(e) }
}
