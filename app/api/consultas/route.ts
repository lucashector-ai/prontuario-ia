import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { contextoDaRequisicao, medicoDaClinica, naoAutenticado, proibido } from '@/lib/acesso'

/**
 * Salva a consulta com o prontuário gerado pela IA.
 * O corpo traz campos da IA que podem não existir em bancos mais antigos (ex.: `secoes`
 * antes da migration 0014). Se o banco recusar uma coluna desconhecida, ela é retirada
 * e o insert é refeito — o prontuário nunca deixa de ser salvo por isso.
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await contextoDaRequisicao(req)
    if (!ctx) return naoAutenticado()
    if (ctx.tipo === 'atendente') return proibido()
    const body: Record<string, any> = await req.json()
    delete body.id; delete body.criado_em
    // Médico: da sessão (médico) ou da clínica da sessão; paciente: da mesma clínica
    if (ctx.tipo === 'medico' && !ctx.clinica_id) body.medico_id = ctx.medico_id
    else if (!body.medico_id || !(await medicoDaClinica(body.medico_id, ctx.clinica_id))) {
      if (ctx.tipo === 'medico' && ctx.medico_id) body.medico_id = ctx.medico_id
      else return proibido('Profissional de outra clínica.')
    }
    if (body.paciente_id) {
      const { data: pac } = await supabase.from('pacientes').select('clinica_id, medico_id').eq('id', body.paciente_id).maybeSingle()
      const ok = pac && (ctx.clinica_id ? ((pac as any).clinica_id === ctx.clinica_id || !!(await medicoDaClinica((pac as any).medico_id, ctx.clinica_id))) : (pac as any).medico_id === ctx.medico_id)
      if (!ok) return proibido('Paciente de outra clínica.')
    }
    const removidas: string[] = []
    for (let tentativa = 0; tentativa < 8; tentativa++) {
      const { data, error } = await supabase.from('consultas').insert([body]).select('id').single()
      if (!error) return NextResponse.json({ id: data.id, ...(removidas.length ? { colunas_ignoradas: removidas } : {}) })
      // PGRST204: "Could not find the 'xyz' column of 'consultas' in the schema cache"
      const coluna = /'([^']+)' column/.exec(error.message || '')?.[1]
      if (error.code === 'PGRST204' && coluna && coluna in body) {
        delete body[coluna]
        removidas.push(coluna)
        continue
      }
      throw error
    }
    throw new Error('Não foi possível salvar a consulta')
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
