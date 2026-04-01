import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(req: NextRequest) {
  const medicoId = req.nextUrl.searchParams.get('medico_id')
  if (!medicoId) return NextResponse.json({ error: 'medico_id obrigatorio' }, { status: 400 })

  const agora = new Date()
  const seteDias = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000)
  const trintaDias = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [
    { count: totalConversas },
    { count: conversasAtivas },
    { count: novasSemana },
    { count: alertasPendentes },
    { count: pacientesInativos },
    { data: mensagensSemana },
  ] = await Promise.all([
    supabase.from('whatsapp_conversas').select('*', { count: 'exact', head: true }).eq('medico_id', medicoId),
    supabase.from('whatsapp_conversas').select('*', { count: 'exact', head: true }).eq('medico_id', medicoId).eq('status', 'ativa'),
    supabase.from('whatsapp_conversas').select('*', { count: 'exact', head: true }).eq('medico_id', medicoId).gte('criado_em', seteDias.toISOString()),
    supabase.from('whatsapp_alertas').select('*', { count: 'exact', head: true }).eq('medico_id', medicoId).eq('lido', false),
    supabase.from('whatsapp_conversas').select('*', { count: 'exact', head: true }).eq('medico_id', medicoId).eq('onboarding_completo', true).lt('ultimo_contato', seteDias.toISOString()),
    supabase.from('whatsapp_mensagens').select('tipo, criado_em').gte('criado_em', seteDias.toISOString()),
  ])

  const enviadas = mensagensSemana?.filter(m => m.tipo === 'enviada').length || 0
  const recebidas = mensagensSemana?.filter(m => m.tipo === 'recebida').length || 0
  const taxaResposta = recebidas > 0 ? Math.round((enviadas / recebidas) * 100) : 100

  return NextResponse.json({
    total_conversas: totalConversas || 0,
    conversas_ativas: conversasAtivas || 0,
    novas_semana: novasSemana || 0,
    alertas_pendentes: alertasPendentes || 0,
    pacientes_inativos: pacientesInativos || 0,
    mensagens_semana: { enviadas, recebidas },
    taxa_resposta: taxaResposta,
  })
}
