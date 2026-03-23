import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const audioFile = formData.get('audio') as File

    if (!audioFile || audioFile.size < 1000) {
      return NextResponse.json({ texto: '' })
    }

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'pt',
      response_format: 'verbose_json',
      temperature: 0,
      prompt:
        'Consulta médica em português brasileiro. Médico falando com paciente. ' +
        'Medicamentos: losartana, metformina, omeprazol, atenolol, sinvastatina, ' +
        'amoxicilina, azitromicina, dipirona, ibuprofeno, paracetamol, enalapril, ' +
        'anlodipino, hidroclorotiazida, levotiroxina, AAS, prednisona, captopril. ' +
        'Exames: hemograma, glicemia, HbA1c, TSH, T4 livre, creatinina, ureia, ' +
        'TGO, TGP, colesterol, triglicerídeos, PSA, EAS, ecocardiograma, ECG. ' +
        'Termos: pressão arterial, frequência cardíaca, saturação de oxigênio, ' +
        'dor epigástrica, dispneia, cefaleia, tontura, edema, palpitação, ' +
        'hipertensão arterial, diabetes mellitus, hipotireoidismo, dislipidemia, ' +
        'insuficiência cardíaca, DPOC, asma, retorno, encaminhamento.',
    })

    const texto = (transcription as any).text || ''

    // Filtra alucinações conhecidas do Whisper
    const alucinacoes = [
      'www.', 'acesse o site', 'visite o nosso site', 'para mais informações, visite',
      'inscreva-se', 'obrigado por assistir', 'marcoparet', 'opusdei',
      '♪', 'subtitle', 'legenda', 'transcrição automática',
    ]
    const ehAlucinacao = alucinacoes.some(p => texto.toLowerCase().includes(p))
    if (ehAlucinacao) return NextResponse.json({ texto: '' })

    return NextResponse.json({ texto })
  } catch (error: any) {
    console.error('Erro Whisper:', error?.error?.message || error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
