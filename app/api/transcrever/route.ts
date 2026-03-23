import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const audioFile = formData.get('audio') as File

    if (!audioFile) {
      return NextResponse.json({ error: 'Nenhum áudio enviado' }, { status: 400 })
    }

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'pt',
      temperature: 0,
      prompt:
        'Consulta médica em português brasileiro. ' +
        'Medicamentos: losartana, metformina, omeprazol, atenolol, sinvastatina, ' +
        'amoxicilina, azitromicina, dipirona, ibuprofeno, paracetamol, ' +
        'enalapril, anlodipino, hidroclorotiazida, levotiroxina, AAS. ' +
        'Exames: hemograma, glicemia, HbA1c, TSH, T4 livre, creatinina, ' +
        'ureia, TGO, TGP, colesterol total, triglicerídeos, PSA, EAS. ' +
        'Termos: pressão arterial, frequência cardíaca, saturação, ' +
        'dor epigástrica, dispneia, cefaleia, tontura, edema, ' +
        'hipertensão, diabetes mellitus, hipotireoidismo, dislipidemia, ' +
        'CID, SOAP, retorno, encaminhamento, solicitação de exame.',
    })

    return NextResponse.json({ texto: transcription.text })
  } catch (error: any) {
    console.error('Erro Whisper:', error?.error?.message || error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
