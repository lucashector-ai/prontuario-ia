import { NextResponse } from 'next/server'
import { semSessao } from '@/lib/sessao-servidor'

export async function POST() {
  return semSessao(NextResponse.json({ ok: true }))
}
