import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * Salva a consulta com o prontuário gerado pela IA.
 * O corpo traz campos da IA que podem não existir em bancos mais antigos (ex.: `secoes`
 * antes da migration 0014). Se o banco recusar uma coluna desconhecida, ela é retirada
 * e o insert é refeito — o prontuário nunca deixa de ser salvo por isso.
 */
export async function POST(req: NextRequest) {
  try {
    const body: Record<string, any> = await req.json()
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
