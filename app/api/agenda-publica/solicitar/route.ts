import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { calcularSlotsDisponiveis, parseConfig } from '@/lib/agenda-publica/slots'
import { criarEnvio, urlFormularioPublico } from '@/lib/formularios/envios'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { medicoSlug, clinicaSlug, dataHora, nome, telefone, email, motivo, primeiraConsulta } = body

    if (!medicoSlug || !dataHora || !nome || !telefone) {
      return NextResponse.json({ erro: 'Dados incompletos' }, { status: 400 })
    }

    const { data: medico } = await supabase
      .from('medicos')
      .select('id, clinica_id, agenda_publica_ativa, agenda_publica_config')
      .eq('slug_publico', medicoSlug)
      .single()

    if (!medico) return NextResponse.json({ erro: 'Médico não encontrado' }, { status: 404 })
    if (!medico.agenda_publica_ativa) return NextResponse.json({ erro: 'Agenda desativada' }, { status: 403 })

    let clinicaId: string | null = medico.clinica_id || null
    if (clinicaSlug) {
      const { data: clinica } = await supabase
        .from('clinicas')
        .select('id')
        .eq('slug_publico', clinicaSlug)
        .single()
      if (!clinica) return NextResponse.json({ erro: 'Clínica não encontrada' }, { status: 404 })
      if (clinica.id !== medico.clinica_id) {
        return NextResponse.json({ erro: 'Médico não pertence a essa clínica' }, { status: 400 })
      }
      clinicaId = clinica.id
    }

    const config = parseConfig(medico.agenda_publica_config)

    const dataObj = new Date(dataHora)
    const dataISO = dataObj.toISOString().split('T')[0]
    const hhmm = String(dataObj.getHours()).padStart(2, '0') + ':' + String(dataObj.getMinutes()).padStart(2, '0')
    const slotsDisponiveis = await calcularSlotsDisponiveis(medico.id, dataISO, config)
    if (!slotsDisponiveis.includes(hhmm)) {
      return NextResponse.json({ erro: 'Horário não está mais disponível' }, { status: 409 })
    }

    const statusInicial = config.modo_aprovacao === 'automatico' ? 'confirmado' : 'aguardando_confirmacao'

    const { data: solicitacao, error: erroSolicitacao } = await supabase
      .from('agenda_publica_solicitacoes')
      .insert({
        medico_id: medico.id,
        clinica_id: clinicaId,
        nome_paciente: nome,
        telefone,
        email: email || null,
        data_hora: dataHora,
        motivo: motivo || null,
        primeira_consulta: primeiraConsulta !== false,
        status: statusInicial,
      })
      .select()
      .single()

    if (erroSolicitacao) {
      return NextResponse.json({ erro: erroSolicitacao.message }, { status: 500 })
    }

    if (statusInicial === 'confirmado') {
      const observacoes = 'Agendado via link público. Paciente: ' + nome + ' · ' + telefone + (email ? ' · ' + email : '')
      
      const { data: agendamento } = await supabase
        .from('agendamentos')
        .insert({
          medico_id: medico.id,
          data_hora: dataHora,
          tipo: 'consulta',
          status: 'agendado',
          motivo: motivo || null,
          duracao: String(config.duracao_consulta_min),
          observacoes,
        })
        .select()
        .single()

      if (agendamento) {
        await supabase
          .from('agenda_publica_solicitacoes')
          .update({ agendamento_id: agendamento.id })
          .eq('id', solicitacao.id)
      }
    }

    return NextResponse.json({ 
      sucesso: true,
      status: statusInicial,
      solicitacaoId: solicitacao.id
    })
  } catch (e: any) {
    return NextResponse.json({ erro: e.message || 'Erro interno' }, { status: 500 })
  }
}
