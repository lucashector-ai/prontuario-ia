import { NextRequest, NextResponse } from 'next/server'
import { supabaseServidor as db } from '@/lib/servidor'
import { log } from '@/lib/logger'
import { inscreverWebhookInstagram, lerEstado, perfilInstagram, trocarCodigoInstagram } from '@/lib/meta/instagram'

export const maxDuration = 60

/** Volta do login do Instagram: troca o código, guarda a conta e inscreve no webhook. */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  const voltar = new URL('/minha-clinica?aba=canais', req.nextUrl.origin)
  const falhar = (msg: string) => { voltar.searchParams.set('erro', msg); return NextResponse.redirect(voltar) }

  if (p.get('error')) return falhar(p.get('error_reason') === 'user_denied' ? 'Login do Instagram cancelado' : (p.get('error_description') || 'O Instagram não autorizou'))
  const estado = lerEstado(p.get('state'))
  if (!estado) return falhar('O link de conexão expirou. Tente de novo.')
  const code = p.get('code')
  if (!code) return falhar('O Instagram não devolveu a autorização')

  try {
    const redirectUri = `${req.nextUrl.origin}/api/canais/instagram/callback`
    const { token, expiraEm } = await trocarCodigoInstagram(code, redirectUri)
    const perfil = await perfilInstagram(token)
    const contaId = String(perfil.user_id || perfil.id)
    try { await inscreverWebhookInstagram(token) } catch (e: any) { log.warn('[instagram] inscrever webhook:', e?.message) }

    const { error } = await db.from('canais_conectados').upsert({
      clinica_id: estado.clinicaId, medico_id: estado.medicoId, canal: 'instagram', conta_id: contaId,
      nome: '@' + perfil.username, foto_url: perfil.profile_picture_url || null,
      detalhe: { api: 'instagram', username: perfil.username, expira_em: expiraEm, tipo_conta: perfil.account_type || null },
      access_token: token, status: 'ativo', erro: null, atualizado_em: new Date().toISOString(),
    }, { onConflict: 'canal,conta_id' })
    if (error) throw new Error(error.message)

    voltar.searchParams.set('conectado', 'instagram')
    voltar.searchParams.set('conta', '@' + perfil.username)
    return NextResponse.redirect(voltar)
  } catch (e: any) {
    log.error('[instagram/callback]', e?.message)
    return falhar(e?.message || 'Não foi possível conectar o Instagram')
  }
}
