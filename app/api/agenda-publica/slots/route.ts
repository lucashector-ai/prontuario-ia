import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { calcularSlotsDisponiveis, calcularDisponibilidadeMes, parseConfig } from '@/lib/agenda-publica/slots'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const medicoSlug = searchParams.get('medico')
    const dataISO = searchParams.get('data')
    const mes = searchParams.get('mes')

    if (!medicoSlug) {
      return NextResponse.json({ erro: 'Médico não informado' }, { status: 400 })
    }

    const { data: medico, error } = await supabase
      .from('medicos')
      .select('id, nome, especialidade, agenda_publica_ativa, agenda_publica_config')
      .eq('slug_publico', medicoSlug)
      .single()

    if (error || !medico) {
      return NextResponse.json({ erro: 'Médico não encontrado' }, { status: 404 })
    }

    if (!medico.agenda_publica_ativa) {
      return NextResponse.json({ erro: 'Agenda pública desativada' }, { status: 403 })
    }

    const config = parseConfig(medico.agenda_publica_config)

    if (mes) {
      const partes = mes.split('-').map(Number)
      const ano = partes[0]
      const m = partes[1]
      const disponibilidade = await calcularDisponibilidadeMes(medico.id, ano, m, config)
      return NextResponse.json({ disponibilidade, config })
    }

    if (dataISO) {
      const slots = await calcularSlotsDisponiveis(medico.id, dataISO, config)
      return NextResponse.json({ slots, config })
    }

    return NextResponse.json({ erro: 'Informe data ou mes' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ erro: e.message || 'Erro interno' }, { status: 500 })
  }
}
