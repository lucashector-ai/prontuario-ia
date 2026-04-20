import { NextRequest, NextResponse } from 'next/server'
import { getSofiaConfig, updateSofiaConfig } from '@/lib/sofia/config'

export async function GET(req: NextRequest) {
  const medico_id = req.nextUrl.searchParams.get('medico_id')
  if (!medico_id) return NextResponse.json({ error: 'medico_id obrigatorio' }, { status: 400 })
  const config = await getSofiaConfig(medico_id)
  return NextResponse.json({ config })
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { medico_id, ...patch } = body
  if (!medico_id) return NextResponse.json({ error: 'medico_id obrigatorio' }, { status: 400 })
  const { data, error } = await updateSofiaConfig(medico_id, patch)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ config: data })
}
