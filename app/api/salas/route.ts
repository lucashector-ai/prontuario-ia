import { NextRequest, NextResponse } from 'next/server'
import { log } from '@/lib/logger'
import { contextoDaRequisicao, naoAutenticado, proibido } from '@/lib/acesso'
import { ErroAtendimento } from '@/lib/atendimento/servidor'
import {
  dadosSalas, definirSalaPadrao, encerrarManutencao, excluirEquipamento, planejar, registrarManutencao,
  reservar, reservasDoDia, salvarEquipamento, salvarSala,
} from '@/lib/salas/servidor'

/**
 * Salas e equipamentos da clínica da sessão.
 *   GET                       → salas, setores, equipamentos, salas padrão, manutenções
 *   GET ?dia=yyyy-mm-dd       → + reservas do dia (visão por sala)
 *   POST { acao: 'planejar', medico_id, procedimento_id?, inicio, duracao, agendamento_id? } → sala/equipamentos ou conflito
 *   POST { acao: 'reservar', agendamento_id, procedimento_id? }
 *   Configuração (dono/gestor e enfermagem para manutenção):
 *   POST { acao: 'sala', id, tipo, descricao_local } · { acao: 'equipamento', ... } · { acao: 'excluir_equipamento', id }
 *   POST { acao: 'padrao', medico_id, consultorio_id|null } · { acao: 'manutencao', equipamento_id|consultorio_id, inicio, fim, observacao }
 *   POST { acao: 'fim_manutencao', id }
 */
const falha = (e: any) => {
  if (e instanceof ErroAtendimento) return NextResponse.json({ error: e.message }, { status: e.status || 400 })
  log.error('[salas]', e)
  return NextResponse.json({ error: 'Não foi possível concluir. Tente de novo.' }, { status: 500 })
}

async function escopo(req: NextRequest) {
  const ctx = await contextoDaRequisicao(req)
  if (!ctx) return { erro: naoAutenticado() }
  if (ctx.tipo === 'atendente') return { erro: proibido() }
  const chave = ctx.clinica_id || ctx.medico_id
  if (!chave) return { erro: proibido() }
  return { ctx, chave }
}

export async function GET(req: NextRequest) {
  const { chave, erro } = await escopo(req)
  if (erro) return erro
  try {
    const dia = req.nextUrl.searchParams.get('dia')
    return NextResponse.json(dia && /^\d{4}-\d{2}-\d{2}$/.test(dia) ? await reservasDoDia(chave!, dia) : await dadosSalas(chave!), { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) { return falha(e) }
}

export async function POST(req: NextRequest) {
  const { ctx, chave, erro } = await escopo(req)
  if (erro) return erro
  try {
    const b = await req.json()
    if (b.acao === 'planejar') return NextResponse.json(await planejar(chave!, { medicoId: b.medico_id, procedimentoId: b.procedimento_id, inicio: b.inicio, duracao: Number(b.duracao) || 30, ignorarAgendamento: b.agendamento_id }))
    if (b.acao === 'reservar') return NextResponse.json(await reservar(chave!, { agendamentoId: String(b.agendamento_id || ''), procedimentoId: b.procedimento_id }))
    if (b.acao === 'manutencao') return NextResponse.json(await registrarManutencao(chave!, { equipamentoId: b.equipamento_id, consultorioId: b.consultorio_id, inicio: b.inicio, fim: b.fim, observacao: b.observacao }))
    if (b.acao === 'fim_manutencao') return NextResponse.json(await encerrarManutencao(chave!, String(b.id || '')))
    // Daqui para baixo é configuração: só dono/gestor (ou autônomo)
    if (!ctx!.gestor && ctx!.clinica_id) return proibido('Só o administrador da clínica muda salas e equipamentos.')
    if (b.acao === 'sala') return NextResponse.json(await salvarSala(chave!, b))
    if (b.acao === 'equipamento') return NextResponse.json(await salvarEquipamento(chave!, b))
    if (b.acao === 'excluir_equipamento') return NextResponse.json(await excluirEquipamento(chave!, String(b.id || '')))
    if (b.acao === 'padrao') return NextResponse.json(await definirSalaPadrao(chave!, String(b.medico_id || ''), b.consultorio_id || null))
    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
  } catch (e) { return falha(e) }
}
