import { NextRequest, NextResponse } from 'next/server'
import { supabaseServidor as db } from '@/lib/servidor'
import { sessaoDaRequisicao } from '@/lib/sessao-servidor'
import { TERMOS_MEDICOS_BASE } from '@/lib/transcricao/termos'

/** Vocabulário para a transcrição: termos do médico (dicionário clínico) primeiro, depois a base. */
export async function GET(req: NextRequest) {
  const s = await sessaoDaRequisicao(req)
  const medicoId = req.nextUrl.searchParams.get('medico_id') || s?.medico_id
  let proprios: string[] = []
  if (medicoId) {
    const { data } = await db.from('dicionario_clinico').select('termo').eq('medico_id', medicoId).limit(60)
    proprios = (data || []).map((d: any) => String(d.termo || '')).filter(Boolean)
  }
  return NextResponse.json({ termos: [...proprios, ...TERMOS_MEDICOS_BASE] })
}
