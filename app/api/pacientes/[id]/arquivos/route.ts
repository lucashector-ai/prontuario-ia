import { NextRequest, NextResponse } from 'next/server'
import { supabaseServidor as db } from '@/lib/servidor'
import { contextoDaRequisicao, medicoDaClinica, naoAutenticado, proibido } from '@/lib/acesso'
import { anexosDoPaciente, documentosLiberados } from '@/lib/portal/arquivos'

/** GET → arquivos enviados pelo paciente (com link de 5 min) e documentos liberados no portal. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await contextoDaRequisicao(req)
  if (!ctx) return naoAutenticado()
  if (ctx.tipo === 'atendente') return proibido()
  const { data: p } = await db.from('pacientes').select('clinica_id, medico_id').eq('id', params.id).maybeSingle()
  const pa: any = p
  const ok = pa && ((ctx.clinica_id && pa.clinica_id === ctx.clinica_id) || (ctx.medico_id && pa.medico_id === ctx.medico_id)
    || (ctx.clinica_id && pa.medico_id && (await medicoDaClinica(pa.medico_id, ctx.clinica_id))))
  if (!ok) return NextResponse.json({ error: 'Paciente não encontrado.' }, { status: 404 })
  const [anexos, documentos] = await Promise.all([anexosDoPaciente(params.id, true).catch(() => []), documentosLiberados(params.id).catch(() => [])])
  return NextResponse.json({ anexos, documentos }, { headers: { 'Cache-Control': 'no-store' } })
}
