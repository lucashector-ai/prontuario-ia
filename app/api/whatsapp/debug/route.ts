import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  // Busca todas as configs
  const { data: configs } = await supabase
    .from('whatsapp_config')
    .select('medico_id, phone_number_id, nome_exibicao, token')
  
  // Busca últimas conversas
  const { data: conversas } = await supabase
    .from('whatsapp_conversas')
    .select('id, telefone, nome_contato, modo, ultimo_contato, medico_id, status, atendente_nome')
    .order('ultimo_contato', { ascending: false })
    .limit(5)

  // Busca últimas mensagens
  const { data: msgs } = await supabase
    .from('whatsapp_mensagens')
    .select('id, conversa_id, tipo, conteudo, criado_em')
    .order('criado_em', { ascending: false })
    .limit(10)

  return NextResponse.json({
    configs: configs?.map((c:any) => ({
      medico_id: c.medico_id,
      phone_number_id: c.phone_number_id,
      nome: c.nome_exibicao,
      tem_token: !!c.token
    })),
    conversas,
    ultimas_mensagens: msgs
  })
}
