import { NextRequest, NextResponse } from 'next/server'
import { randomInt } from 'node:crypto'
import { supabaseServidor as db } from '@/lib/servidor'
import { escopoCanais } from '@/lib/meta/escopo'
import { ErroMeta, graph, metaConfigurada, trocarCodigo } from '@/lib/meta/graph'
import { log } from '@/lib/logger'

export const maxDuration = 60

/**
 * Conclusão do "Cadastro incorporado" do WhatsApp (Embedded Signup).
 * O navegador manda o `code` do login da Meta + waba_id (e phone_number_id, quando a Meta
 * informa — na coexistência ela manda só o waba_id; aí buscamos o número na WABA).
 *   1. troca o code por um token do negócio (não expira)
 *   2. inscreve o app na conta do WhatsApp (WABA) para receber mensagens
 *   3. registra o número na Cloud API
 *   4. salva o canal e a configuração usada pelo envio/robô
 */
export async function POST(req: NextRequest) {
  if (!metaConfigurada()) return NextResponse.json({ error: 'Integração com a Meta ainda não configurada no servidor' }, { status: 503 })
  const corpo = await req.json().catch(() => ({}))
  const e = await escopoCanais(req, corpo.medico_id)
  if (!e?.medicoId) return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 })

  const code = String(corpo.code || '')
  const wabaId = String(corpo.waba_id || '')
  let phoneId = String(corpo.phone_number_id || '')
  if (!code || !wabaId) return NextResponse.json({ error: 'Faltaram dados do cadastro. Tente conectar de novo.' }, { status: 400 })

  try {
    const token = await trocarCodigo(code)

    // Coexistência: a Meta não manda o número — pega o da WABA (o que está no app do celular)
    if (!phoneId) {
      const { data: numeros } = await graph<{ data: { id: string; is_on_biz_app?: boolean }[] }>(`${wabaId}/phone_numbers`, {
        token, params: { fields: 'id,display_phone_number,is_on_biz_app,platform_type' },
      })
      phoneId = (numeros.find(n => n.is_on_biz_app) || numeros[0])?.id || ''
      if (!phoneId) throw new Error('A conta do WhatsApp não tem número. Confira se terminou todas as etapas na janela da Meta.')
    }

    await graph(`${wabaId}/subscribed_apps`, { token, metodo: 'POST' })

    // Coexistência (QR code): o número continua no app WhatsApp Business do celular —
    // não registra de novo; pede à Meta para sincronizar contatos e conversas recentes.
    const status = await graph<{ is_on_biz_app?: boolean; platform_type?: string }>(phoneId, { token, params: { fields: 'is_on_biz_app,platform_type' } }).catch(() => ({} as any))
    const coexistencia = corpo.modo === 'coexistencia' || status.is_on_biz_app === true
    const pin = String(randomInt(100000, 999999))
    let avisoRegistro: string | null = null
    if (!coexistencia) {
      // Número novo: registro na Cloud API com PIN de verificação em duas etapas (guardado para reconexões)
      try {
        await graph(`${phoneId}/register`, { token, corpo: { messaging_product: 'whatsapp', pin } })
      } catch (err: any) {
        // Número já registrado (ou com PIN definido pelo cliente) não impede o uso
        avisoRegistro = err?.message || 'registro não confirmado'
        log.warn('[canais/whatsapp] register:', avisoRegistro)
      }
    } else {
      for (const sync_type of ['smb_app_state_sync', 'history']) {
        try { await graph(`${phoneId}/smb_app_data`, { token, corpo: { messaging_product: 'whatsapp', sync_type } }) }
        catch (err: any) { log.warn(`[canais/whatsapp] sync ${sync_type}:`, err?.message) }
      }
    }

    const info = await graph<{ display_phone_number?: string; verified_name?: string; quality_rating?: string }>(
      phoneId, { token, params: { fields: 'display_phone_number,verified_name,quality_rating' } },
    ).catch(() => ({} as any))

    const agora = new Date().toISOString()
    const { error } = await db.from('canais_conectados').upsert({
      clinica_id: e.clinicaId, medico_id: e.medicoId, canal: 'whatsapp', conta_id: phoneId,
      nome: info.display_phone_number || phoneId,
      detalhe: { waba_id: wabaId, verified_name: info.verified_name, quality: info.quality_rating, modo: coexistencia ? 'coexistencia' : 'cloud', ...(coexistencia ? {} : { pin }), aviso_registro: avisoRegistro },
      access_token: token, status: 'ativo', erro: null, atualizado_em: agora,
    }, { onConflict: 'canal,conta_id' })
    if (error) throw new Error(error.message)

    // Configuração lida pelo robô (Sofia), confirmações e envio do Chat
    const { data: existente } = await db.from('whatsapp_config').select('id').eq('medico_id', e.medicoId).maybeSingle()
    const cfg = {
      medico_id: e.medicoId, phone_number_id: phoneId, access_token: token, waba_id: wabaId,
      phone_number: info.display_phone_number || null, nome_exibicao: info.verified_name || null, ativo: true, atualizado_em: agora,
    }
    if (existente) await db.from('whatsapp_config').update(cfg).eq('id', (existente as any).id)
    else await db.from('whatsapp_config').insert(cfg)

    return NextResponse.json({ ok: true, numero: info.display_phone_number || phoneId, nome: info.verified_name || null, coexistencia })
  } catch (err: any) {
    log.error('[canais/whatsapp]', err?.message, err instanceof ErroMeta ? err.detalhe : '')
    return NextResponse.json({ error: traduzir(err) }, { status: 502 })
  }
}

function traduzir(err: any): string {
  const m = String(err?.message || '')
  if (/code has been used|expired|verification code/i.test(m)) return 'O código de conexão expirou. Clique em conectar de novo.'
  if (/permission|permissions/i.test(m)) return 'A Meta não liberou a permissão necessária. Confira se você concluiu todas as etapas na janela da Meta.'
  return m || 'Não foi possível concluir a conexão com o WhatsApp.'
}
