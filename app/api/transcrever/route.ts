import { NextRequest, NextResponse } from 'next/server'

const DEEPGRAM_KEY = process.env.DEEPGRAM_API_KEY || ''

const KEYTERMS = [
  'losartana', 'metformina', 'omeprazol', 'atenolol', 'sinvastatina',
  'amoxicilina', 'dipirona', 'ibuprofeno', 'paracetamol', 'enalapril',
  'anlodipino', 'hidroclorotiazida', 'levotiroxina', 'prednisona',
  'hemograma', 'creatinina', 'HbA1c', 'hipertensão', 'diabetes',
].map(t => `keyterm=${encodeURIComponent(t)}`).join('&')

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const audioFile = formData.get('audio') as File

    if (!audioFile || audioFile.size < 1000) {
      return NextResponse.json({ texto: '' })
    }

    const params = `model=nova-3-medical&language=pt-BR&smart_format=true&punctuate=true&${KEYTERMS}`

    const res = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${DEEPGRAM_KEY}`,
        'Content-Type': 'audio/wav',
      },
      body: await audioFile.arrayBuffer(),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Deepgram error:', err)
      return NextResponse.json({ texto: '', error: err }, { status: 500 })
    }

    const data = await res.json()
    const texto = data.results?.channels?.[0]?.alternatives?.[0]?.transcript || ''

    return NextResponse.json({ texto })
  } catch (e: any) {
    console.error('Transcrever error:', e)
    return NextResponse.json({ texto: '', error: e.message }, { status: 500 })
  }
}
