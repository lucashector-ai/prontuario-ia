import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * Rodado pelo Vercel Cron (vercel.json).
 * Busca todos os médicos com relatorio_diario_ativo=true e cujo horario
 * bate com o momento atual (+/- 30 min), e dispara /api/sofia/relatorio-diario pra cada.
 */
export async function GET(req: NextRequest) {
  // Verifica secret do Vercel Cron (opcional, mas recomendado)
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  const agora = new Date()
  const horaAtual = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })

  // Busca todos os médicos com relatório ativo
  const { data: configs } = await supabase
    .from('sofia_config')
    .select('medico_id, relatorio_diario_ativo, relatorio_diario_horario')
    .eq('relatorio_diario_ativo', true)

  if (!configs || configs.length === 0) {
    return NextResponse.json({ ok: true, processados: 0 })
  }

  // Filtra os que têm horário dentro de +/- 30 min do momento atual
  const [hH, hM] = horaAtual.split(':').map(Number)
  const minsAgora = hH * 60 + hM

  const candidatos = configs.filter((c: any) => {
    const hora = c.relatorio_diario_horario || '07:00'
    const [h, m] = hora.split(':').map(Number)
    const mins = h * 60 + m
    return Math.abs(mins - minsAgora) <= 30
  })

  const resultados: any[] = []
  for (const c of candidatos) {
    // Verifica se já enviou hoje (evita duplicação)
    const hojeKey = agora.toISOString().substring(0, 10)
    const { data: jaEnviado } = await supabase
      .from('sofia_relatorios_log')
      .select('id')
      .eq('medico_id', c.medico_id)
      .eq('data_referencia', hojeKey)
      .limit(1)
      .maybeSingle()

    if (jaEnviado) {
      resultados.push({ medico_id: c.medico_id, pulado: 'ja_enviado_hoje' })
      continue
    }

    // Dispara relatório
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://prontuario-ia-five.vercel.app'
      const r = await fetch(`${baseUrl}/api/sofia/relatorio-diario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medico_id: c.medico_id }),
      })
      const data = await r.json()
      resultados.push({ medico_id: c.medico_id, ...data })
    } catch (e: any) {
      resultados.push({ medico_id: c.medico_id, erro: e.message })
    }
  }

  return NextResponse.json({ ok: true, hora: horaAtual, candidatos: candidatos.length, resultados })
}
