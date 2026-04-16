import { NextResponse } from "next/server"

export async function GET() {
  const key = process.env.DEEPGRAM_API_KEY
  if (!key) return NextResponse.json({ error: "Sem key" }, { status: 500 })
  // Retorna a key como token temporário
  // Em produção ideal seria um token de curta duração via Deepgram API
  return NextResponse.json({ token: key })
}
