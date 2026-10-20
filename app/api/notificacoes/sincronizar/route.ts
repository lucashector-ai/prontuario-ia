import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { contextoDaRequisicao, naoAutenticado } from '@/lib/acesso'
import { FILTRO_APOIO } from '@/lib/cargos'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Endpoint idempotente: gera notificacoes para a clinica baseado na agenda do dia
// Triggers:
//   1. Consultas em <= 10 min (sino antes de cada atendimento)
//   2. Confirmacoes pendentes (proximas 24h, status agendado)
//   3. Resumo do dia (1x por dia, primeira vez que abre)
export async function POST(req: NextRequest) {
  // A clínica vem da SESSÃO (o corpo só servia de dica e permitia gerar avisos em outra clínica)
  const ctx = await contextoDaRequisicao(req)
  if (!ctx) return naoAutenticado()
  const clinica_id = ctx.clinica_id
  if (!clinica_id) return NextResponse.json({ criadas: 0 })
  const medico_id_logado = ctx.tipo === 'medico' ? ctx.medico_id : null

  // Busca medicos ativos da clinica
  const { data: medicos } = await supabase
    .from('medicos').select('id, nome').eq('clinica_id', clinica_id).not('cargo', 'in', FILTRO_APOIO).eq('ativo', true)
  const medicoIds = (medicos || []).map((m: any) => m.id)
  if (medicoIds.length === 0) return NextResponse.json({ criadas: 0 })

  const agora = new Date()
  const em10min = new Date(agora.getTime() + 10 * 60 * 1000)
  const em24h = new Date(agora.getTime() + 24 * 60 * 60 * 1000)
  const inicioHoje = new Date(); inicioHoje.setHours(0, 0, 0, 0)
  const fimHoje = new Date(); fimHoje.setHours(23, 59, 59, 999)

  let criadas = 0

  // ===== TRIGGER 1: Consultas comecando em <= 10 min =====
  const { data: proximas } = await supabase
    .from('agendamentos')
    .select('id, medico_id, paciente_id, data_hora, motivo, meet_link, pacientes:paciente_id(nome)')
    .in('medico_id', medicoIds)
    .gte('data_hora', agora.toISOString())
    .lt('data_hora', em10min.toISOString())

  for (const ag of (proximas || []) as any[]) {
    // Verifica se ja existe notificacao 'consulta_iniciando' para este agendamento
    const { data: existente } = await supabase
      .from('notificacoes_medico')
      .select('id')
      .eq('agendamento_id', ag.id)
      .eq('tipo', 'consulta_iniciando')
      .limit(1)
      .maybeSingle()

    if (!existente) {
      const minutosRestantes = Math.max(1, Math.round((new Date(ag.data_hora).getTime() - agora.getTime()) / 60000))
      const ehOnline = !!ag.meet_link
      await supabase.from('notificacoes_medico').insert({
        medico_id: ag.medico_id,
        agendamento_id: ag.id,
        paciente_id: ag.paciente_id,
        tipo: 'consulta_iniciando',
        titulo: ehOnline ? 'Consulta online em ' + minutosRestantes + ' min' : 'Consulta em ' + minutosRestantes + ' min',
        descricao: (ag.pacientes?.nome || 'Paciente') + ' - ' + (ag.motivo || 'consulta agendada'),
        lida: false,
      })
      criadas++
    }
  }

  // ===== TRIGGER 2: Confirmacoes pendentes (proximas 24h, status agendado) =====
  const { data: pendentes } = await supabase
    .from('agendamentos')
    .select('id, medico_id, paciente_id, data_hora, pacientes:paciente_id(nome)')
    .in('medico_id', medicoIds)
    .eq('status', 'agendado')
    .gte('data_hora', agora.toISOString())
    .lt('data_hora', em24h.toISOString())

  for (const ag of (pendentes || []) as any[]) {
    const { data: existente } = await supabase
      .from('notificacoes_medico')
      .select('id')
      .eq('agendamento_id', ag.id)
      .eq('tipo', 'confirmacao_pendente')
      .limit(1)
      .maybeSingle()

    if (!existente) {
      const dt = new Date(ag.data_hora)
      const horaFmt = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      const dataFmt = dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      await supabase.from('notificacoes_medico').insert({
        medico_id: ag.medico_id,
        agendamento_id: ag.id,
        paciente_id: ag.paciente_id,
        tipo: 'confirmacao_pendente',
        titulo: 'Aguardando confirmação',
        descricao: (ag.pacientes?.nome || 'Paciente') + ' - ' + dataFmt + ' as ' + horaFmt,
        lida: false,
      })
      criadas++
    }
  }

  // ===== TRIGGER 3: Resumo do dia (1x por medico por dia) =====
  if (medico_id_logado) {
    // Verifica se ja existe resumo de hoje para o medico logado
    const { data: jaResumo } = await supabase
      .from('notificacoes_medico')
      .select('id')
      .eq('medico_id', medico_id_logado)
      .eq('tipo', 'resumo_dia')
      .gte('criada_em', inicioHoje.toISOString())
      .limit(1)
      .maybeSingle()

    if (!jaResumo) {
      const { count: totalHoje } = await supabase
        .from('agendamentos')
        .select('*', { count: 'exact', head: true })
        .in('medico_id', medicoIds)
        .gte('data_hora', inicioHoje.toISOString())
        .lte('data_hora', fimHoje.toISOString())

      if ((totalHoje || 0) > 0) {
        const { data: primeira } = await supabase
          .from('agendamentos')
          .select('data_hora, pacientes:paciente_id(nome)')
          .in('medico_id', medicoIds)
          .gte('data_hora', agora.toISOString())
          .lte('data_hora', fimHoje.toISOString())
          .order('data_hora')
          .limit(1)
          .maybeSingle()

        let descricao = 'Bom dia! Voce tem ' + totalHoje + ' consulta' + (totalHoje! > 1 ? 's' : '') + ' agendada' + (totalHoje! > 1 ? 's' : '') + ' hoje.'
        if (primeira) {
          const p: any = primeira
          const horaP = new Date(p.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          descricao += ' Proxima: ' + (p.pacientes?.nome || 'paciente') + ' as ' + horaP + '.'
        }

        await supabase.from('notificacoes_medico').insert({
          medico_id: medico_id_logado,
          tipo: 'resumo_dia',
          titulo: 'Resumo do dia',
          descricao,
          lida: false,
        })
        criadas++
      }
    }
  }

  // ===== TRIGGER 4: Recurso de glosa com prazo em até 5 dias (um aviso por guia) =====
  try {
    const { data: ops } = await supabase.from('operadoras').select('id, nome').eq('clinica_id', clinica_id)
    const opIds = (ops || []).map((o: any) => o.id)
    if (opIds.length) {
      const limite = new Date(agora.getTime() + 5 * 864e5).toISOString().slice(0, 10)
      const { data: guias } = await supabase.from('guias_tiss').select('id, medico_id, operadora_id, numero_guia_prestador, nome_beneficiario, recurso')
        .in('operadora_id', opIds).eq('recurso->>status', 'em_recurso').lte('recurso->>prazo', limite)
      for (const g of (guias || []) as any[]) {
        const link = `/faturamento?aba=recebimentos&guia=${g.id}`
        const { data: ja } = await supabase.from('notificacoes_medico').select('id').eq('tipo', 'recurso_glosa_prazo').eq('link', link).limit(1).maybeSingle()
        if (ja) continue
        const prazo = String(g.recurso?.prazo || '')
        const vencido = prazo < agora.toISOString().slice(0, 10)
        await supabase.from('notificacoes_medico').insert({
          medico_id: g.medico_id || medicoIds[0], paciente_id: null, agendamento_id: null, tipo: 'recurso_glosa_prazo', link, lida: false,
          titulo: vencido ? 'Prazo de recurso de glosa vencido' : 'Prazo de recurso de glosa chegando',
          descricao: `Guia ${g.numero_guia_prestador} · ${g.nome_beneficiario || 'paciente'} · ${(ops || []).find((o: any) => o.id === g.operadora_id)?.nome || 'operadora'} · prazo ${prazo.split('-').reverse().join('/')}`,
        })
        criadas++
      }
    }
  } catch { /* sem a migration 0025: sem aviso */ }

  return NextResponse.json({ criadas })
}
