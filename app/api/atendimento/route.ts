/**
 * Fila de atendimento do dia.
 *
 *   GET  ?dia=YYYY-MM-DD&medico_id=…      → { dia, atendimentos, esperados, medicos }
 *   POST { acao: 'checkin', agendamento_id | (paciente_id + medico_id), prioridade? }
 *   POST { acao: 'chamar', medico_id, consultorio_id, atendimento_id?, rechamar? }
 *   POST { acao: 'mudar', id, para: iniciar|finalizar|ausente|voltar_fila|cancelar|prioridade, prioridade?, retorno? }
 *   POST { acao: 'novo_paciente', nome, telefone?, cpf?, data_nascimento?, convenio?, medico_id? }
 *   POST { acao: 'atualizar_paciente', paciente_id, telefone?, cpf?, data_nascimento?, convenio?, nr_carteirinha? }
 *   POST { acao: 'faltou', agendamento_id }
 *   POST { acao: 'resolver_saida' | 'whatsapp_retorno', id }   (saída do consultório)
 *   POST { acao: 'chamar_triagem', consultorio_id, atendimento_id?, rechamar? } · { acao: 'triagem', id, dados }
 *   GET  ?triagem=<atendimento_id>  → última triagem do atendimento
 *   POST { acao: 'chamar_balcao', id?, guiche? } · { acao: 'concluir_balcao', id, status } · { acao: 'senha_balcao', prioridade }
 *   GET  ?ficha=<paciente_id>&agendamento_id=…  → ficha do paciente para o consultório
 *   GET  ?ficha360=<paciente_id>  → histórico completo (gaveta da ficha e exportação)
 */
import { NextRequest, NextResponse } from 'next/server'
import { log } from '@/lib/logger'
import {
  ErroAtendimento, atualizarPaciente, chamar, contextoAtendimento, faltaMigration, fazerCheckin, fichaDoPaciente, filaDoDia,
  chamarTriagem, definirConsultorio, fichaCompleta, marcarFalta, registrarTriagem, triagemDoAtendimento, mudarAtendimento, novoPaciente, resolverSaida, whatsappRetorno,
  type AcaoAtendimento,
} from '@/lib/atendimento/servidor'
import { PRIORIDADES } from '@/lib/atendimento/comum'
import { balcaoDoDia, chamarBalcao, concluirBalcao, senhaBalcaoManual } from '@/lib/atendimento/totem'

export const dynamic = 'force-dynamic'

const ACOES: AcaoAtendimento[] = ['iniciar', 'finalizar', 'ausente', 'voltar_fila', 'cancelar', 'prioridade']
const ehPrioridade = (p: any) => PRIORIDADES.some(x => x.valor === p)

function erro(e: any) {
  if (e instanceof ErroAtendimento) return NextResponse.json({ error: e.message }, { status: e.status })
  if (faltaMigration(e)) return NextResponse.json({ error: 'Rode a migration 0018_atendimento_fila no Supabase', falta_migration: true }, { status: 503 })
  log.error('[atendimento]', e?.message || e)
  return NextResponse.json({ error: 'Erro inesperado. Tente de novo.' }, { status: 500 })
}

export async function GET(req: NextRequest) {
  try {
    const ctx = await contextoAtendimento(req)
    const sp = req.nextUrl.searchParams
    if (sp.get('ficha')) return NextResponse.json(await fichaDoPaciente(ctx, sp.get('ficha')!, sp.get('agendamento_id')))
    if (sp.get('ficha360')) return NextResponse.json(await fichaCompleta(ctx, sp.get('ficha360')!))
    if (sp.get('triagem')) return NextResponse.json({ triagem: await triagemDoAtendimento(ctx, sp.get('triagem')!) })
    const dia = sp.get('dia')
    const fila = await filaDoDia(ctx, {
      dia: dia && /^\d{4}-\d{2}-\d{2}$/.test(dia) ? dia : undefined,
      medicoId: sp.get('medico_id'),
    })
    return NextResponse.json({ ...fila, balcao: sp.get('medico_id') ? [] : await balcaoDoDia(ctx) })
  } catch (e) { return erro(e) }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await contextoAtendimento(req)
    const b = await req.json().catch(() => ({}))

    if (b.acao === 'checkin') {
      const r = await fazerCheckin(ctx, {
        agendamentoId: b.agendamento_id || null, pacienteId: b.paciente_id || null, medicoId: b.medico_id || null,
        prioridade: ehPrioridade(b.prioridade) ? b.prioridade : null, observacao: b.observacao || null,
        origem: b.agendamento_id ? 'recepcao' : 'encaixe',
      })
      return NextResponse.json({ atendimento: r.atendimento, ja_existia: r.jaExistia })
    }

    if (b.acao === 'chamar') {
      if (!b.medico_id) throw new ErroAtendimento('medico_id obrigatório')
      const at = await chamar(ctx, {
        medicoId: b.medico_id, consultorioId: b.consultorio_id || null,
        atendimentoId: b.atendimento_id || null, rechamar: !!b.rechamar,
      })
      return NextResponse.json({ atendimento: at, fila_vazia: !at })
    }

    if (b.acao === 'mudar') {
      if (!b.id || !ACOES.includes(b.para)) throw new ErroAtendimento('Ação inválida')
      const dias = Number(b.retorno?.dias)
      const at = await mudarAtendimento(ctx, b.id, b.para, {
        prioridade: ehPrioridade(b.prioridade) ? b.prioridade : undefined,
        retorno: dias > 0 && dias <= 730 ? { dias, motivo: b.retorno?.motivo || null } : null,
        saida: b.saida ? { itens: Array.isArray(b.saida.itens) ? b.saida.itens.map(String) : [], obs: b.saida.obs ? String(b.saida.obs) : null } : null,
      })
      return NextResponse.json({ atendimento: at })
    }

    if (b.acao === 'novo_paciente') {
      const r = await novoPaciente(ctx, { ...b, medicoId: b.medico_id || null })
      return NextResponse.json({ paciente: r.paciente, ja_existia: r.jaExistia })
    }

    if (b.acao === 'atualizar_paciente') {
      if (!b.paciente_id) throw new ErroAtendimento('paciente_id obrigatório')
      const { acao, paciente_id, ...dados } = b
      await atualizarPaciente(ctx, paciente_id, dados)
      return NextResponse.json({ ok: true })
    }

    if (b.acao === 'chamar_triagem') {
      const at = await chamarTriagem(ctx, { consultorioId: b.consultorio_id || null, atendimentoId: b.atendimento_id || null, rechamar: !!b.rechamar })
      return NextResponse.json({ atendimento: at, fila_vazia: !at })
    }

    if (b.acao === 'triagem') {
      if (!b.id) throw new ErroAtendimento('id obrigatório')
      return NextResponse.json({ atendimento: await registrarTriagem(ctx, b.id, b.dados || {}) })
    }

    if (b.acao === 'chamar_balcao') {
      const senha = await chamarBalcao(ctx, { id: b.id || null, guiche: b.guiche || null })
      return NextResponse.json({ senha, fila_vazia: !senha })
    }

    if (b.acao === 'concluir_balcao') {
      if (!b.id || !['atendido', 'desistiu'].includes(b.status)) throw new ErroAtendimento('id e status obrigatórios')
      await concluirBalcao(ctx, b.id, b.status)
      return NextResponse.json({ ok: true })
    }

    if (b.acao === 'senha_balcao') return NextResponse.json(await senhaBalcaoManual(ctx, String(b.prioridade || 'normal')))

    if (b.acao === 'definir_consultorio') {
      if (!b.medico_id || !b.consultorio_id) throw new ErroAtendimento('medico_id e consultorio_id obrigatórios')
      await definirConsultorio(ctx, b.medico_id, b.consultorio_id)
      return NextResponse.json({ ok: true })
    }

    if (b.acao === 'resolver_saida') {
      if (!b.id) throw new ErroAtendimento('id obrigatório')
      await resolverSaida(ctx, b.id)
      return NextResponse.json({ ok: true })
    }

    if (b.acao === 'whatsapp_retorno') {
      if (!b.id) throw new ErroAtendimento('id obrigatório')
      await whatsappRetorno(ctx, b.id)
      return NextResponse.json({ ok: true })
    }

    if (b.acao === 'faltou') {
      if (!b.agendamento_id) throw new ErroAtendimento('agendamento_id obrigatório')
      await marcarFalta(ctx, b.agendamento_id)
      return NextResponse.json({ ok: true })
    }

    throw new ErroAtendimento('Ação desconhecida')
  } catch (e) { return erro(e) }
}
