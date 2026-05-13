import { NextRequest, NextResponse } from 'next/server'
import { criarEnvio, urlFormularioPublico } from '@/lib/formularios/envios'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      templateId,
      clinicaId,
      medicoId,
      agendamentoId,
      pacienteId,
      nomePaciente,
      telefone,
      email,
      origem,
      diasValidade,
    } = body

    if (!templateId || !clinicaId || !nomePaciente) {
      return NextResponse.json({ erro: 'Dados incompletos' }, { status: 400 })
    }

    const { data: clinica } = await supabase
      .from('clinicas')
      .select('slug_publico')
      .eq('id', clinicaId)
      .single()

    if (!clinica?.slug_publico) {
      return NextResponse.json({ erro: 'Clínica sem slug público configurado' }, { status: 400 })
    }

    const { envio, erro } = await criarEnvio({
      templateId,
      clinicaId,
      medicoId,
      agendamentoId,
      pacienteId,
      nomePaciente,
      telefone,
      email,
      origem,
      diasValidade,
    })

    if (erro || !envio) {
      return NextResponse.json({ erro: erro || 'Erro ao criar envio' }, { status: 500 })
    }

    const url = urlFormularioPublico(clinica.slug_publico, envio.token)
    return NextResponse.json({
      sucesso: true,
      envio,
      url,
    })
  } catch (e: any) {
    return NextResponse.json({ erro: e.message || 'Erro interno' }, { status: 500 })
  }
}
