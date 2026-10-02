import { NextRequest, NextResponse } from 'next/server'
import { supabaseServidor as db } from '@/lib/servidor'
import { escopoCanais } from '@/lib/meta/escopo'
import { graph, metaConfigurada } from '@/lib/meta/graph'
import { instagramConfigurado } from '@/lib/meta/instagram'
import { log } from '@/lib/logger'

/** Canais conectados da clínica (sem tokens) + se a integração com a Meta está configurada. */
export async function GET(req: NextRequest) {
  const e = await escopoCanais(req)
  if (!e) return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 })
  const { data, error } = await db.from('canais_conectados')
    .select('id, canal, conta_id, nome, foto_url, status, erro, conectado_em, medico_id, detalhe')
    .in('medico_id', e.medicoIds.length ? e.medicoIds : ['00000000-0000-0000-0000-000000000000'])
    .neq('status', 'desconectado')
    .order('conectado_em')
  const tabelaAusente = !!error && /canais_conectados/.test(error.message)

  // WhatsApp configurado do jeito antigo (direto em whatsapp_config, sem passar pelo botão)
  const conectados = (data || []) as any[]
  const { data: legados } = await db.from('whatsapp_config').select('medico_id, phone_number_id, phone_number, ativo')
    .in('medico_id', e.medicoIds.length ? e.medicoIds : ['00000000-0000-0000-0000-000000000000'])
  for (const w of (legados || []) as any[]) {
    if (!w.phone_number_id || w.ativo === false) continue
    if (conectados.some(c => c.canal === 'whatsapp' && c.conta_id === w.phone_number_id)) continue
    conectados.push({ id: 'legado-' + w.phone_number_id, canal: 'whatsapp', conta_id: w.phone_number_id, nome: w.phone_number || 'Número configurado', foto_url: null, status: 'ativo', erro: null, conectado_em: null, medico_id: w.medico_id, detalhe: { legado: true } })
  }
  return NextResponse.json({
    canais: conectados.map((c: any) => ({ ...c, detalhe: { waba_id: c.detalhe?.waba_id, page_id: c.detalhe?.page_id, username: c.detalhe?.username, legado: !!c.detalhe?.legado } })),
    medicos: e.medicos,
    configurado: metaConfigurada(),
    app_id: process.env.NEXT_PUBLIC_META_APP_ID || null,
    config_whatsapp: process.env.NEXT_PUBLIC_META_CONFIG_WHATSAPP || null,
    config_paginas: process.env.NEXT_PUBLIC_META_CONFIG_PAGINAS || null,
    instagram_login: instagramConfigurado(),
    ...(tabelaAusente ? { aviso: 'Rode a migration 0017_canais_conectados.sql' } : {}),
  })
}

/** Desconecta um canal (cancela a inscrição do app na página/número e para de receber mensagens). */
export async function DELETE(req: NextRequest) {
  const e = await escopoCanais(req)
  if (!e) return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id') || ''
  if (id.startsWith('legado-')) {
    // WhatsApp antigo: desliga a configuração
    await db.from('whatsapp_config').update({ ativo: false }).eq('phone_number_id', id.slice(7)).in('medico_id', e.medicoIds)
    return NextResponse.json({ ok: true })
  }
  const { data: c } = await db.from('canais_conectados').select('*').eq('id', id).maybeSingle()
  if (!c || !e.medicoIds.includes((c as any).medico_id)) return NextResponse.json({ error: 'Canal não encontrado' }, { status: 404 })
  const canal = c as any
  try {
    if (canal.canal === 'messenger' && canal.access_token) {
      await graph(`${canal.conta_id}/subscribed_apps`, { token: canal.access_token, metodo: 'DELETE' })
    }
    if (canal.canal === 'whatsapp') {
      await db.from('whatsapp_config').update({ ativo: false }).eq('phone_number_id', canal.conta_id)
    }
  } catch (err: any) {
    log.warn('[canais] desconectar na Meta falhou (seguindo):', err?.message)
  }
  await db.from('canais_conectados').update({ status: 'desconectado', access_token: null, atualizado_em: new Date().toISOString() }).eq('id', canal.id)
  return NextResponse.json({ ok: true })
}
