import { NextRequest, NextResponse } from 'next/server'
import { supabaseServidor as db } from '@/lib/servidor'
import { enviarWhatsApp } from '@/lib/whatsapp/enviar'
import { carregarConfigConfirmacao, nomesMedicoClinica } from '@/lib/sofia/confirmacao'
import {
  BOTOES_CONFIRMACAO_24H, dataHoraSP, ehErroDeSchema, mesclarConfig, preencher,
} from '@/components/confirmacoes/modelos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Configuração das confirmações automáticas (aba "Confirmações" em Minha clínica → Automações).
 *   GET  ?medico_id=…[&so_config=1] → { config, estatisticas, tem_whatsapp, tem_telefone, aviso? }
 *   PUT  { medico_id, lembrete_48h, confirmacao_24h, lembrete_2h, oferecer_vaga_lista, modelo_48h, modelo_24h, modelo_2h }
 *   POST { medico_id, acao: 'teste', tipo: '48h'|'24h'|'2h', modelo } → envia o exemplo ao celular do médico
 */
export async function GET(req: NextRequest) {
  const medicoId = req.nextUrl.searchParams.get('medico_id')
  if (!medicoId) return NextResponse.json({ error: 'medico_id obrigatório' }, { status: 400 })

  let aviso: string | undefined
  const { data: linha, error } = await db.from('confirmacao_config').select('*').eq('medico_id', medicoId).maybeSingle()
  if (error && ehErroDeSchema(error)) aviso = 'Rode a migration 0010 para salvar as configurações.'
  const config = mesclarConfig(error ? null : linha)
  if (req.nextUrl.searchParams.get('so_config') === '1') return NextResponse.json({ config, aviso })

  const [{ data: wpp }, nomes] = await Promise.all([
    db.from('whatsapp_config').select('medico_id, ativo').eq('medico_id', medicoId).maybeSingle(),
    nomesMedicoClinica(medicoId),
  ])

  // Estatísticas dos últimos 30 dias (inclui envios para consultas das próximas 48h)
  const agora = Date.now()
  const de = new Date(agora - 30 * 864e5).toISOString()
  const ate = new Date(agora + 2 * 864e5).toISOString()
  let ags: any[] = []
  const r1 = await db.from('agendamentos')
    .select('status, data_hora, confirmacao_24h_enviada, confirmacao_24h_status, lembrete_48h_enviado, lembrete_2h_enviado, confirmado_em')
    .eq('medico_id', medicoId).gte('data_hora', de).lte('data_hora', ate)
  if (r1.error) {
    const r2 = await db.from('agendamentos')
      .select('status, data_hora, confirmacao_24h_enviada, confirmacao_24h_status')
      .eq('medico_id', medicoId).gte('data_hora', de).lte('data_hora', ate)
    ags = r2.data || []
    if (!aviso && ehErroDeSchema(r1.error)) aviso = 'Rode a migration 0010 para ver os lembretes de 48h e 2h.'
  } else ags = r1.data || []

  const passados = ags.filter(a => new Date(a.data_hora).getTime() <= agora)
  const realizados = passados.filter(a => a.status === 'realizado').length
  const faltas = passados.filter(a => a.status === 'faltou').length
  const estatisticas = {
    enviados: ags.reduce((n, a) => n + (a.lembrete_48h_enviado ? 1 : 0) + (a.confirmacao_24h_enviada ? 1 : 0) + (a.lembrete_2h_enviado ? 1 : 0), 0),
    confirmados: ags.filter(a => a.confirmacao_24h_status === 'confirmado' || a.confirmado_em).length,
    sem_resposta: ags.filter(a => a.confirmacao_24h_enviada && a.confirmacao_24h_status === 'pendente').length,
    faltas,
    taxa_comparecimento: realizados + faltas > 0 ? Math.round((realizados / (realizados + faltas)) * 100) : null,
  }

  return NextResponse.json({
    config, estatisticas, aviso,
    tem_whatsapp: !!wpp && (wpp as any).ativo !== false,
    tem_telefone: !!nomes.telefoneMedico,
  })
}

export async function PUT(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  if (!b.medico_id) return NextResponse.json({ error: 'medico_id obrigatório' }, { status: 400 })
  const linha: Record<string, any> = { medico_id: b.medico_id, atualizado_em: new Date().toISOString() }
  for (const k of ['lembrete_48h', 'confirmacao_24h', 'lembrete_2h', 'oferecer_vaga_lista']) {
    if (typeof b[k] === 'boolean') linha[k] = b[k]
  }
  for (const k of ['modelo_48h', 'modelo_24h', 'modelo_2h']) {
    if (typeof b[k] === 'string') linha[k] = b[k].trim() ? b[k].slice(0, 1000) : null
  }
  const { data, error } = await db.from('confirmacao_config').upsert(linha, { onConflict: 'medico_id' }).select('*').single()
  if (error) {
    const status = ehErroDeSchema(error) ? 409 : 500
    return NextResponse.json({ error: ehErroDeSchema(error) ? 'Rode a migration 0010 para salvar as configurações.' : error.message }, { status })
  }
  return NextResponse.json({ config: mesclarConfig(data) })
}

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  if (!b.medico_id || b.acao !== 'teste') return NextResponse.json({ error: 'Requisição inválida' }, { status: 400 })
  const nomes = await nomesMedicoClinica(b.medico_id)
  if (!nomes.telefoneMedico) {
    return NextResponse.json({ error: 'sem_telefone', mensagem: 'Cadastre seu celular no perfil para receber o teste.' }, { status: 422 })
  }
  const cfg = await carregarConfigConfirmacao(b.medico_id)
  const tipo = (['48h', '24h', '2h'].includes(b.tipo) ? b.tipo : '24h') as '48h' | '24h' | '2h'
  const modelo: string = typeof b.modelo === 'string' && b.modelo.trim() ? b.modelo : cfg[`modelo_${tipo}`]
  const quando = new Date(Date.now() + (tipo === '48h' ? 48 : tipo === '24h' ? 24 : 2) * 3600e3)
  const { data, hora } = dataHoraSP(quando)
  const texto = '[Teste] ' + preencher(modelo, { nome: 'Maria', data, hora, medico: nomes.medico, clinica: nomes.clinica, online: '' })
  // Mensagem de teste vai para o próprio médico: não é registrada no Chat
  const r = await enviarWhatsApp({
    medicoId: b.medico_id, telefone: nomes.telefoneMedico, texto,
    botoes: tipo === '24h' ? BOTOES_CONFIRMACAO_24H : undefined,
  })
  if (!r.ok) return NextResponse.json({ error: r.erro || 'Falha ao enviar' }, { status: 502 })
  return NextResponse.json({ ok: true })
}
