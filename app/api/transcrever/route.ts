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

    // Força extensão mp4 que o Mac usa nativamente
    const nomeArquivo = audioFile.name.endsWith('.mp4') || audioFile.name.endsWith('.webm') || audioFile.name.endsWith('.ogg')
      ? audioFile.name
      : audioFile.name + '.mp4'

    const arquivoCorrigido = new File([audioFile], nomeArquivo, { type: audioFile.type })

    const transcription = await openai.audio.transcriptions.create({
      file: arquivoCorrigido,
      model: 'whisper-1',
      language: 'pt',
      prompt:
        'Transcrição de consulta médica em português brasileiro. ' +
        'Termos comuns: hipertensão, diabetes, pressão arterial, glicemia, ' +
        'hemograma, colesterol, triglicerídeos, amoxicilina, losartana, ' +
        'metformina, omeprazol, dor epigástrica, dispneia, cefaleia.',
    })

    return NextResponse.json({ texto: transcription.text })
  } catch (error: any) {
    console.error('Erro Whisper:', error?.error?.message || error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
