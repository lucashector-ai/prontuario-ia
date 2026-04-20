import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const WPP_TOKEN = process.env.WHATSAPP_TOKEN || ''
const WPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID || '1030374870164992'

async function enviarWppComBotoes(para: string, texto: string, botoes: string[], token: string, phoneId: string) {
  const buttons = botoes.slice(0, 3).map((b, i) => ({
    type: 'reply',
    reply: { id: `btn_${i}`, title: b.substring(0, 20) }
  }))
  const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: para,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: texto },
        action: { buttons }
      }
    })
  })
  return res.json()
}

/**
 * Busca agendamentos entre 20h e 28h no futuro que ainda não receberam confirmação
 * e envia a mensagem de confirmação 24h pro paciente.
 * Chamado sob demanda pelo webhook (pra evitar cron no plano Free).
 */
export async function dispararConfirmacoes24h(medico_id: string) {
  try {
    const agora = new Date()
    const daqui20h = new Date(agora.getTime() + 20 * 60 * 60 * 1000)
    const daqui28h = new Date(agora.getTime() + 28 * 60 * 60 * 1000)

    const { data: agendamentos } = await supabase
      .from('agendamentos')
      .select('*, pacientes(nome, telefone)')
      .eq('medico_id', medico_id)
      .eq('confirmacao_24h_enviada', false)
      .gte('data_hora', daqui20h.toISOString())
      .lte('data_hora', daqui28h.toISOString())
      .in('status', ['agendado', 'confirmado'])

    if (!agendamentos || agendamentos.length === 0) return

    for (const ag of agendamentos) {
      if (!ag.pacientes?.telefone) continue

      const telefone = ag.pacientes.telefone.replace(/[^0-9]/g, '')
      const primeiroNome = ag.pacientes.nome.split(' ')[0]
      const dataHora = new Date(ag.data_hora)
      const dataFmt = dataHora.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })
      const horaFmt = dataHora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

      const modalidade = ag.meet_link ? ' (online)' : ''
      const mensagem = `Oi ${primeiroNome}! Lembrete aqui 💜\n\nAmanhã você tem consulta${modalidade} no dia ${dataFmt} às ${horaFmt}.\n\nConfirma que vai comparecer?`

      const botoes = ['Sim confirmo', 'Preciso remarcar', 'Não poderei ir']

      try {
        await enviarWppComBotoes(telefone, mensagem, botoes, WPP_TOKEN, WPP_PHONE_ID)
        await supabase
          .from('agendamentos')
          .update({
            confirmacao_24h_enviada: true,
            confirmacao_24h_status: 'pendente'
          })
          .eq('id', ag.id)

        // Loga na conversa (se existir)
        const { data: conv } = await supabase
          .from('whatsapp_conversas')
          .select('id')
          .eq('telefone', telefone)
          .eq('medico_id', medico_id)
          .maybeSingle()

        if (conv) {
          await supabase.from('whatsapp_mensagens').insert({
            conversa_id: conv.id,
            tipo: 'enviada',
            conteudo: mensagem,
            metadata: { ia: true, confirmacao_24h: true, agendamento_id: ag.id, botoes }
          })
        }

        console.log('CONFIRMACAO_24H enviada:', ag.id, primeiroNome)
      } catch (e: any) {
        console.error('Erro ao enviar confirmação 24h:', ag.id, e.message)
      }
    }
  } catch (e) {
    console.error('dispararConfirmacoes24h erro:', e)
  }
}

/**
 * Cria notificação pro médico quando paciente recusa ou ignora confirmação.
 */
export async function notificarMedico(params: {
  medico_id: string
  tipo: 'confirmacao_recusada' | 'confirmacao_ignorada' | 'reagendamento_solicitado'
  agendamento_id: string
  paciente_id?: string
  titulo: string
  descricao?: string
}) {
  await supabase.from('notificacoes_medico').insert({
    medico_id: params.medico_id,
    tipo: params.tipo,
    agendamento_id: params.agendamento_id,
    paciente_id: params.paciente_id || null,
    titulo: params.titulo,
    descricao: params.descricao || null,
  })
}

/**
 * Detecta se a mensagem do paciente é uma resposta de confirmação 24h.
 * Retorna o agendamento em questão, ou null se não for.
 */
export async function detectarRespostaConfirmacao24h(telefone: string, medico_id: string) {
  const { data: ag } = await supabase
    .from('agendamentos')
    .select('*, pacientes(nome, telefone, id)')
    .eq('medico_id', medico_id)
    .eq('confirmacao_24h_enviada', true)
    .eq('confirmacao_24h_status', 'pendente')
    .order('data_hora', { ascending: true })
    .limit(5)

  if (!ag) return null

  // Filtra pelo telefone do paciente
  const telLimpo = telefone.replace(/[^0-9]/g, '')
  const encontrado = ag.find(a => a.pacientes?.telefone?.replace(/[^0-9]/g, '') === telLimpo)
  return encontrado || null
}
