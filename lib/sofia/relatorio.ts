import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export type RelatorioData = {
  medico_id: string
  medico_nome: string
  data: string
  total_consultas: number
  consultas: Array<{
    horario: string
    paciente: string
    motivo: string
    tipo: string
    status: string
    tem_preatendimento: boolean
    pre_respostas?: Record<string, string>
    observacoes?: string
  }>
  alertas: string[]
}

/**
 * Monta dados completos do relatório do dia pro médico.
 */
export async function montarRelatorioDia(medico_id: string, data?: Date): Promise<RelatorioData | null> {
  const hoje = data || new Date()
  const inicio = new Date(hoje); inicio.setHours(0, 0, 0, 0)
  const fim = new Date(hoje); fim.setHours(23, 59, 59, 999)

  const [{ data: medico }, { data: agendamentos }] = await Promise.all([
    supabase.from('medicos').select('nome').eq('id', medico_id).single(),
    supabase.from('agendamentos')
      .select('*, pacientes(id, nome)')
      .eq('medico_id', medico_id)
      .gte('data_hora', inicio.toISOString())
      .lte('data_hora', fim.toISOString())
      .in('status', ['agendado', 'confirmado'])
      .order('data_hora', { ascending: true }),
  ])

  if (!medico) return null

  const alertas: string[] = []
  const consultas = await Promise.all((agendamentos || []).map(async (ag: any) => {
    // Busca pré-atendimento completo pra esse agendamento
    const { data: preConsulta } = await supabase
      .from('pre_consultas')
      .select('respostas, status')
      .eq('agendamento_id', ag.id)
      .eq('status', 'completo')
      .maybeSingle()

    const horario = new Date(ag.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

    return {
      horario,
      paciente: ag.pacientes?.nome || 'Paciente não identificado',
      motivo: ag.motivo || 'Consulta',
      tipo: ag.tipo || 'consulta',
      status: ag.status,
      tem_preatendimento: !!preConsulta,
      pre_respostas: preConsulta?.respostas as Record<string, string> | undefined,
      observacoes: ag.observacoes,
    }
  }))

  // Detecta alertas úteis
  const semPreatendimento = consultas.filter(c => !c.tem_preatendimento).length
  if (semPreatendimento > 0 && consultas.length > 0) {
    alertas.push(`${semPreatendimento} paciente${semPreatendimento > 1 ? 's' : ''} sem pré-atendimento preenchido`)
  }
  if (consultas.length === 0) {
    alertas.push('Nenhuma consulta agendada hoje — dia livre')
  }

  return {
    medico_id,
    medico_nome: medico.nome,
    data: hoje.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }),
    total_consultas: consultas.length,
    consultas,
    alertas,
  }
}

/**
 * Formata relatório para mensagem de WhatsApp (texto puro, emojis leves).
 */
export function formatarRelatorioWhatsApp(r: RelatorioData): string {
  const linhas: string[] = []
  linhas.push(`Bom dia, ${r.medico_nome.split(' ')[0]}! ☀️`)
  linhas.push(`Resumo de hoje (${r.data}):`)
  linhas.push('')

  if (r.total_consultas === 0) {
    linhas.push('Nenhuma consulta agendada. Bom descanso! 💜')
    return linhas.join('\n')
  }

  linhas.push(`📋 *${r.total_consultas} consulta${r.total_consultas > 1 ? 's' : ''}* agendada${r.total_consultas > 1 ? 's' : ''}:`)
  linhas.push('')

  r.consultas.forEach((c, i) => {
    linhas.push(`${i + 1}. *${c.horario}* · ${c.paciente}`)
    linhas.push(`   ${c.motivo}${c.tipo !== 'consulta' ? ` (${c.tipo})` : ''}`)
    if (c.tem_preatendimento && c.pre_respostas) {
      const resumo = Object.entries(c.pre_respostas).slice(0, 2)
        .map(([k, v]) => `"${String(v).substring(0, 60)}"`)
        .join(' · ')
      linhas.push(`   💜 Pré-atendimento: ${resumo}`)
    }
    linhas.push('')
  })

  if (r.alertas.length > 0) {
    linhas.push('⚠️ *Alertas:*')
    r.alertas.forEach(a => linhas.push(`• ${a}`))
  }

  linhas.push('')
  linhas.push('_Bom dia de trabalho! 💜_')
  return linhas.join('\n')
}

/**
 * Formata relatório para email (HTML simples).
 */
export function formatarRelatorioEmail(r: RelatorioData): { assunto: string; html: string } {
  const assunto = `Resumo do dia — ${r.data} (${r.total_consultas} consulta${r.total_consultas !== 1 ? 's' : ''})`

  const consultasHtml = r.consultas.map((c, i) => {
    const preHtml = c.tem_preatendimento && c.pre_respostas
      ? `<div style="margin-top:6px;padding:8px;background:#f0fdf4;border-left:3px solid #16a34a;border-radius:4px;font-size:12px">
           <b>Pré-atendimento:</b><br>
           ${Object.entries(c.pre_respostas).map(([k, v]) => `<b>${k.replace(/_/g, ' ')}:</b> ${v}`).join('<br>')}
         </div>`
      : ''
    return `
      <tr>
        <td style="padding:10px 6px;vertical-align:top;width:60px;font-weight:700;color:#6043C1">${c.horario}</td>
        <td style="padding:10px 6px;vertical-align:top">
          <div style="font-weight:600;color:#111827">${c.paciente}</div>
          <div style="font-size:13px;color:#6b7280">${c.motivo}${c.tipo !== 'consulta' ? ' · ' + c.tipo : ''}</div>
          ${preHtml}
        </td>
      </tr>
    `
  }).join('')

  const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${assunto}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#F5F5F5;padding:20px;margin:0">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;border:1px solid #f3f4f6">
    <div style="background:#6043C1;padding:20px 24px;color:white">
      <h1 style="margin:0;font-size:18px;font-weight:700">Bom dia, ${r.medico_nome.split(' ')[0]}!</h1>
      <p style="margin:4px 0 0;font-size:13px;opacity:0.9">Seu resumo de ${r.data}</p>
    </div>
    <div style="padding:24px">
      ${r.total_consultas === 0 ? `
        <p style="font-size:14px;color:#6b7280">Nenhuma consulta agendada para hoje. Bom descanso!</p>
      ` : `
        <p style="font-size:13px;color:#6b7280;margin:0 0 16px">${r.total_consultas} consulta${r.total_consultas > 1 ? 's' : ''} agendada${r.total_consultas > 1 ? 's' : ''}:</p>
        <table style="width:100%;border-collapse:collapse">${consultasHtml}</table>
      `}
      ${r.alertas.length > 0 ? `
        <div style="margin-top:20px;padding:12px 14px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px">
          <b style="color:#92400e;font-size:13px">Alertas:</b>
          <ul style="margin:4px 0 0;padding-left:18px;color:#78350f;font-size:13px">
            ${r.alertas.map(a => `<li>${a}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
    </div>
    <div style="padding:16px 24px;background:#F5F5F5;font-size:11px;color:#9ca3af;text-align:center">
      Sofia · Assistente IA da MedIA
    </div>
  </div>
</body></html>`

  return { assunto, html }
}
