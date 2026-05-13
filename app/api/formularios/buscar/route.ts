import { NextRequest, NextResponse } from 'next/server'
import { buscarEnvioPorToken } from '@/lib/formularios/envios'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')
    const clinicaSlug = searchParams.get('clinica') || undefined

    if (!token) {
      return NextResponse.json({ erro: 'Token não informado' }, { status: 400 })
    }

    const resultado = await buscarEnvioPorToken(token, clinicaSlug)

    if (resultado.erro) {
      const status = resultado.erro === 'Formulário já preenchido' ? 409 : 404
      return NextResponse.json({ erro: resultado.erro }, { status })
    }

    return NextResponse.json({
      envio: {
        id: resultado.envio?.id,
        nome_paciente: resultado.envio?.nome_paciente,
        expira_em: resultado.envio?.expira_em,
      },
      template: {
        id: resultado.template?.id,
        nome: resultado.template?.nome,
        descricao: resultado.template?.descricao,
        campos: resultado.template?.campos,
      },
      clinica: {
        nome: resultado.clinica?.nome,
        logo_url: resultado.clinica?.logo_url,
      },
      medico: resultado.medico ? {
        nome: resultado.medico.nome,
        especialidade: resultado.medico.especialidade,
      } : null,
    })
  } catch (e: any) {
    return NextResponse.json({ erro: e.message || 'Erro interno' }, { status: 500 })
  }
}
