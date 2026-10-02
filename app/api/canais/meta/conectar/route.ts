import { NextRequest, NextResponse } from 'next/server'
import { supabaseServidor as db } from '@/lib/servidor'
import { escopoCanais } from '@/lib/meta/escopo'
import { graph, metaConfigurada } from '@/lib/meta/graph'
import { buscarPaginas } from '@/lib/meta/paginas'
import { log } from '@/lib/logger'

export const maxDuration = 60

/**
 * Conecta Messenger e/ou Instagram de uma página escolhida pelo usuário.
 * Corpo: { token_usuario, page_id, canais: ['messenger','instagram'], medico_id? }
 */
export async function POST(req: NextRequest) {
  if (!metaConfigurada()) return NextResponse.json({ error: 'Integração com a Meta ainda não configurada no servidor' }, { status: 503 })
  const corpo = await req.json().catch(() => ({}))
  const e = await escopoCanais(req, corpo.medico_id)
  if (!e?.medicoId) return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 })
  const canais: string[] = Array.isArray(corpo.canais) ? corpo.canais : ['messenger', 'instagram']

  try {
    const paginas = await buscarPaginas(String(corpo.token_usuario || ''))
    const p = paginas.find(x => x.id === String(corpo.page_id))
    if (!p || !p.token) return NextResponse.json({ error: 'Página não encontrada nesta conta da Meta' }, { status: 404 })

    // Inscreve a página no app: as mensagens (Messenger e Instagram) passam a chegar no webhook
    await graph(`${p.id}/subscribed_apps`, {
      token: p.token, metodo: 'POST',
      params: { subscribed_fields: 'messages,messaging_postbacks,message_reads,message_echoes' },
    })

    const agora = new Date().toISOString()
    const conectados: string[] = []
    const base = { clinica_id: e.clinicaId, medico_id: e.medicoId, access_token: p.token, status: 'ativo', erro: null, atualizado_em: agora }

    if (canais.includes('messenger')) {
      const { error } = await db.from('canais_conectados').upsert({
        ...base, canal: 'messenger', conta_id: p.id, nome: p.nome, foto_url: p.foto, detalhe: {},
      }, { onConflict: 'canal,conta_id' })
      if (error) throw new Error(error.message)
      conectados.push('messenger')
    }
    if (canais.includes('instagram')) {
      if (!p.instagram) {
        return NextResponse.json({ error: `A página "${p.nome}" não tem uma conta profissional do Instagram vinculada.`, conectados }, { status: 400 })
      }
      const { error } = await db.from('canais_conectados').upsert({
        ...base, canal: 'instagram', conta_id: p.instagram.id, nome: '@' + p.instagram.username, foto_url: p.instagram.foto,
        detalhe: { page_id: p.id, username: p.instagram.username },
      }, { onConflict: 'canal,conta_id' })
      if (error) throw new Error(error.message)
      conectados.push('instagram')
    }
    return NextResponse.json({ ok: true, conectados, pagina: p.nome, instagram: p.instagram?.username || null })
  } catch (err: any) {
    log.error('[canais/conectar]', err?.message)
    return NextResponse.json({ error: err?.message || 'Não foi possível conectar' }, { status: 502 })
  }
}
