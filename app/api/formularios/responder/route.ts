import { log } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { buscarEnvioPorToken, marcarComoPreenchido } from '@/lib/formularios/envios'
import { salvarResposta, gerarResumoIA, notificarPreenchimento } from '@/lib/formularios/respostas'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { token, respostas } = body

    if (!token || !respostas || typeof respostas !== 'object') {
      return NextResponse.json({ erro: 'Dados incompletos' }, { status: 400 })
    }

    const resultado = await buscarEnvioPorToken(token)
    if (resultado.erro || !resultado.envio || !resultado.template) {
      return NextResponse.json({ erro: resultado.erro || 'Link invalido' }, { status: 404 })
    }

    const campos = resultado.template.campos || []
    for (const campo of campos) {
      if (campo.obrigatorio) {
        const val = respostas[campo.id]
        if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) {
          return NextResponse.json({ erro: 'Campo obrigatorio nao preenchido: ' + campo.label }, { status: 400 })
        }
      }
    }

    const { respostaId, erro: erroResposta } = await salvarResposta({
      envioId: resultado.envio.id,
      templateId: resultado.template.id,
      pacienteId: resultado.envio.paciente_id || undefined,
      agendamentoId: resultado.envio.agendamento_id || undefined,
      respostas,
    })

    if (erroResposta || !respostaId) {
      return NextResponse.json({ erro: erroResposta || 'Erro ao salvar' }, { status: 500 })
    }

    await marcarComoPreenchido(resultado.envio.id, respostaId)

    gerarResumoIA(respostaId, campos, respostas).catch((e: any) => log.error('Resumo IA falhou:', e))

    notificarPreenchimento({
      medicoId: resultado.envio.medico_id,
      clinicaId: resultado.envio.clinica_id,
      nomePaciente: resultado.envio.nome_paciente,
      envioId: resultado.envio.id,
    }).catch((e: any) => log.error('Notificacao falhou:', e))

    return NextResponse.json({ sucesso: true })
  } catch (e: any) {
    return NextResponse.json({ erro: e.message || 'Erro interno' }, { status: 500 })
  }
}
