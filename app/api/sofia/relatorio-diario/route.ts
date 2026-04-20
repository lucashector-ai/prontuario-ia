import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { montarRelatorioDia, formatarRelatorioWhatsApp, formatarRelatorioEmail } from '@/lib/sofia/relatorio'
import { getSofiaConfig } from '@/lib/sofia/config'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const WPP_TOKEN = process.env.WHATSAPP_TOKEN || ''
const WPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID || '1030374870164992'

async function enviarWpp(para: string, texto: string, token: string, phoneId: string) {
  const r = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: para, type: 'text', text: { body: texto } }),
  })
  return r.json()
}

async function enviarEmail(para: string, assunto: string, html: string) {
  // Usa Resend se configurado, senão loga e simula
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    console.log('[EMAIL não configurado]', { para, assunto })
    return { simulado: true }
  }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || 'Sofia <sofia@resend.dev>',
      to: [para],
      subject: assunto,
      html,
    }),
  })
  return r.json()
}

export async function POST(req: NextRequest) {
  try {
    const { medico_id, data_iso } = await req.json()
    if (!medico_id) return NextResponse.json({ error: 'medico_id obrigatorio' }, { status: 400 })

    const dataRef = data_iso ? new Date(data_iso) : new Date()
    const dataKey = dataRef.toISOString().substring(0, 10)

    const cfg = await getSofiaConfig(medico_id)
    if (!cfg.relatorio_diario_ativo && !data_iso) {
      return NextResponse.json({ error: 'relatorio desativado para este medico' }, { status: 400 })
    }

    const relatorio = await montarRelatorioDia(medico_id, dataRef)
    if (!relatorio) return NextResponse.json({ error: 'falha ao montar relatorio' }, { status: 500 })

    const canais: string[] = (cfg as any).relatorio_diario_canais || ['whatsapp']
    const resultados: any = { whatsapp: null, email: null }

    // WhatsApp
    if (canais.includes('whatsapp')) {
      const tel = (cfg as any).relatorio_whatsapp
      if (!tel) {
        resultados.whatsapp = { erro: 'numero WhatsApp nao configurado' }
      } else {
        const texto = formatarRelatorioWhatsApp(relatorio)
        const telLimpo = tel.replace(/[^0-9]/g, '')
        try {
          await enviarWpp(telLimpo, texto, WPP_TOKEN, WPP_PHONE_ID)
          await supabase.from('sofia_relatorios_log').upsert({
            medico_id, data_referencia: dataKey, canal: 'whatsapp',
            destinatario: telLimpo, conteudo: texto.substring(0, 500), sucesso: true,
          }, { onConflict: 'medico_id,data_referencia,canal' })
          resultados.whatsapp = { ok: true }
        } catch (e: any) {
          resultados.whatsapp = { erro: e.message }
        }
      }
    }

    // Email
    if (canais.includes('email')) {
      const email = (cfg as any).relatorio_email
      if (!email) {
        resultados.email = { erro: 'email nao configurado' }
      } else {
        const { assunto, html } = formatarRelatorioEmail(relatorio)
        try {
          await enviarEmail(email, assunto, html)
          await supabase.from('sofia_relatorios_log').upsert({
            medico_id, data_referencia: dataKey, canal: 'email',
            destinatario: email, conteudo: assunto, sucesso: true,
          }, { onConflict: 'medico_id,data_referencia,canal' })
          resultados.email = { ok: true }
        } catch (e: any) {
          resultados.email = { erro: e.message }
        }
      }
    }

    return NextResponse.json({ ok: true, relatorio, resultados })
  } catch (e: any) {
    console.error('relatorio-diario erro:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
