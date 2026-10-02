import { NextRequest, NextResponse } from 'next/server'
import { supabaseServidor as db, agoraSP } from '@/lib/servidor'
import { normalizarTelefone } from '@/lib/whatsapp/enviar'
import { faltaMigration, horarioComercialSP } from '../retornos/comum'
import { atualizarTotais, processarLoteCampanha, PAUSA_MS, LOTE_PADRAO } from './processar'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const erro = (e: any, status = 500) => NextResponse.json(
  { error: faltaMigration(e) ? 'Rode a migration 0011_retornos no Supabase' : (e?.message || String(e)), falta_migration: faltaMigration(e) },
  { status },
)

/** Busca todas as páginas (o Supabase limita a 1000 linhas por consulta). */
async function todas<Tp = any>(fazer: (de: number, ate: number) => PromiseLike<{ data: any[] | null; error: any }>, max = 20000): Promise<Tp[]> {
  const out: Tp[] = []
  for (let de = 0; de < max; de += 1000) {
    const { data, error } = await fazer(de, de + 999)
    if (error) throw error
    out.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return out
}

/**
 * GET /api/reativacao?medico_id=…&meses=3|6|12 → pacientes inativos (sem consulta nem agendamento há N meses,
 *   e sem nada marcado no futuro): { pacientes: [{ id, nome, telefone, ultima_visita, nunca_consultou, janela_aberta }] }
 * GET /api/reativacao?medico_id=…&campanhas=1 → histórico: { campanhas: [... , respostas] }
 * GET /api/reativacao?medico_id=…&campanha_id=… → destinatários da campanha: { envios: [... , paciente_nome] }
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const medicoId = sp.get('medico_id')
  if (!medicoId) return NextResponse.json({ error: 'medico_id obrigatório' }, { status: 400 })
  if (sp.get('campanhas') === '1') return listarCampanhas(medicoId)
  if (sp.get('campanha_id')) return listarEnvios(medicoId, sp.get('campanha_id')!)

  const meses = [3, 6, 12].includes(Number(sp.get('meses'))) ? Number(sp.get('meses')) : 6
  const corte = new Date(); corte.setMonth(corte.getMonth() - meses)
  const agora = Date.now()

  try {
    const pacientes = await todas((de, ate) => db.from('pacientes').select('id, nome, telefone, criado_em').eq('medico_id', medicoId).order('nome').range(de, ate))
    const consultas = await todas((de, ate) => db.from('consultas').select('paciente_id, criado_em').eq('medico_id', medicoId).not('paciente_id', 'is', null).range(de, ate))
    const agends = await todas((de, ate) => db.from('agendamentos').select('paciente_id, data_hora, status').eq('medico_id', medicoId).not('paciente_id', 'is', null).range(de, ate))

    const ultima: Record<string, number> = {}
    const futuro = new Set<string>()
    const marcar = (pid: string, t: number) => { if (!isNaN(t) && t <= agora && t > (ultima[pid] || 0)) ultima[pid] = t }
    consultas.forEach((c: any) => marcar(c.paciente_id, new Date(c.criado_em).getTime()))
    agends.forEach((a: any) => {
      const t = new Date(a.data_hora).getTime()
      if (a.status === 'cancelado') return
      if (t > agora) futuro.add(a.paciente_id)
      else if (a.status !== 'faltou') marcar(a.paciente_id, t)
    })

    const inativos = pacientes
      .filter((p: any) => !futuro.has(p.id))
      .filter((p: any) => {
        const u = ultima[p.id]
        if (u) return u < corte.getTime()
        // nunca consultou: só entra se o cadastro também é antigo
        return p.criado_em && new Date(p.criado_em).getTime() < corte.getTime()
      })
      .map((p: any) => ({
        id: p.id, nome: p.nome, telefone: p.telefone || null,
        ultima_visita: ultima[p.id] ? new Date(ultima[p.id]).toISOString() : null,
        nunca_consultou: !ultima[p.id],
        janela_aberta: false,
      }))
      .sort((a, b) => (b.ultima_visita || '').localeCompare(a.ultima_visita || ''))

    // Quem mandou mensagem nas últimas 24h (janela aberta do WhatsApp → mensagem livre é entregue)
    try {
      const desde = new Date(agora - 24 * 3600_000).toISOString()
      const { data: conv } = await db.from('whatsapp_conversas').select('id, telefone').eq('medico_id', medicoId).gte('ultimo_contato', desde)
      if (conv?.length) {
        const { data: rec } = await db.from('whatsapp_mensagens').select('conversa_id').in('conversa_id', conv.map(c => c.id)).eq('tipo', 'recebida').gte('criado_em', desde)
        const abertas = new Set((rec || []).map(r => conv.find(c => c.id === r.conversa_id)?.telefone).filter(Boolean))
        inativos.forEach(p => { const t = normalizarTelefone(p.telefone); if (t && abertas.has(t)) p.janela_aberta = true })
      }
    } catch {}

    return NextResponse.json({ pacientes: inativos, meses })
  } catch (e) {
    return erro(e)
  }
}

/**
 * POST { medico_id, nome?, mensagem, paciente_ids[], meses? } → cria a campanha e envia o 1º lote.
 * POST { acao: 'continuar', campanha_id } → envia o próximo lote.
 * Resposta: { campanha, enviados, falhas, restantes, concluida, foraHorario?, pausa_ms, lote }
 * O cliente chama 'continuar' enquanto restantes > 0 (o cron diário também retoma campanhas paradas).
 */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  try {
    if (b.acao === 'continuar') {
      if (!b.campanha_id) return NextResponse.json({ error: 'campanha_id obrigatório' }, { status: 400 })
      const r = await processarLoteCampanha(b.campanha_id)
      const { data: campanha } = await db.from('campanhas_reativacao').select('*').eq('id', b.campanha_id).maybeSingle()
      return NextResponse.json({ campanha, ...r, pausa_ms: PAUSA_MS, lote: LOTE_PADRAO })
    }

    const ids: string[] = Array.isArray(b.paciente_ids) ? Array.from(new Set(b.paciente_ids.filter((x: any) => typeof x === 'string'))) : []
    const mensagem = String(b.mensagem || '').trim()
    if (!b.medico_id || !ids.length || mensagem.length < 5) {
      return NextResponse.json({ error: 'medico_id, paciente_ids e mensagem são obrigatórios' }, { status: 400 })
    }
    if (ids.length > 2000) return NextResponse.json({ error: 'Máximo de 2.000 destinatários por campanha' }, { status: 400 })

    // Só pacientes do médico, com telefone válido
    let pacs: any[] = []
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await db.from('pacientes').select('id, telefone').eq('medico_id', b.medico_id).in('id', ids.slice(i, i + 200))
      if (error) throw error
      pacs = pacs.concat(data || [])
    }
    const validos = pacs.map(p => ({ id: p.id, tel: normalizarTelefone(p.telefone) })).filter(p => p.tel)
    if (!validos.length) return NextResponse.json({ error: 'Nenhum paciente selecionado tem telefone válido' }, { status: 400 })

    const nome = String(b.nome || '').trim() || `Reativação · ${new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`
    const { data: campanha, error } = await db.from('campanhas_reativacao').insert({
      medico_id: b.medico_id, nome: nome.slice(0, 120), mensagem: mensagem.slice(0, 1000),
      filtro: { meses: b.meses ?? null, selecionados: ids.length },
      total_destinatarios: validos.length, enviados: 0, falhas: 0, status: 'enviando',
    }).select('*').single()
    if (error) throw error

    for (let i = 0; i < validos.length; i += 500) {
      const { error: e2 } = await db.from('campanhas_envios').insert(validos.slice(i, i + 500).map(p => ({
        campanha_id: campanha.id, paciente_id: p.id, telefone: p.tel, status: 'pendente',
      })))
      if (e2) throw e2
    }

    const r = horarioComercialSP(agoraSP().hora)
      ? await processarLoteCampanha(campanha.id)
      : { enviados: 0, falhas: 0, restantes: validos.length, concluida: false, foraHorario: true }
    const { data: atual } = await db.from('campanhas_reativacao').select('*').eq('id', campanha.id).maybeSingle()
    return NextResponse.json({ campanha: atual || campanha, ...r, sem_telefone: ids.length - validos.length, pausa_ms: PAUSA_MS, lote: LOTE_PADRAO })
  } catch (e) {
    return erro(e)
  }
}

async function listarCampanhas(medicoId: string) {
  const { data: camps, error } = await db.from('campanhas_reativacao').select('*').eq('medico_id', medicoId).order('criado_em', { ascending: false }).limit(50)
  if (error) return erro(error)
  if (!camps?.length) return NextResponse.json({ campanhas: [] })

  const ids = camps.map(c => c.id)
  const envios = await todas((de, ate) => db.from('campanhas_envios').select('id, campanha_id, telefone, status, enviado_em').in('campanha_id', ids).range(de, ate)).catch(() => [] as any[])

  // Marca 'respondeu' quem mandou mensagem depois do envio (últimos 60 dias)
  try {
    const limite = Date.now() - 60 * 86400_000
    const candidatos = envios.filter((e: any) => e.status === 'enviado' && e.enviado_em && new Date(e.enviado_em).getTime() > limite)
    if (candidatos.length) {
      const tels = Array.from(new Set(candidatos.map((e: any) => e.telefone).filter(Boolean)))
      let conv: any[] = []
      for (let i = 0; i < tels.length; i += 200) {
        const { data } = await db.from('whatsapp_conversas').select('id, telefone').eq('medico_id', medicoId).in('telefone', tels.slice(i, i + 200))
        conv = conv.concat(data || [])
      }
      if (conv.length) {
        const desde = candidatos.reduce((m: string, e: any) => e.enviado_em < m ? e.enviado_em : m, candidatos[0].enviado_em)
        let rec: any[] = []
        const cids = conv.map(c => c.id)
        for (let i = 0; i < cids.length; i += 200) {
          const { data } = await db.from('whatsapp_mensagens').select('conversa_id, criado_em').in('conversa_id', cids.slice(i, i + 200)).eq('tipo', 'recebida').gte('criado_em', desde)
          rec = rec.concat(data || [])
        }
        const ultimaRec: Record<string, string> = {}
        rec.forEach(m => {
          const tel = conv.find(c => c.id === m.conversa_id)?.telefone
          if (tel && (!ultimaRec[tel] || m.criado_em > ultimaRec[tel])) ultimaRec[tel] = m.criado_em
        })
        const responderam = candidatos.filter((e: any) => ultimaRec[e.telefone] && new Date(ultimaRec[e.telefone]) > new Date(e.enviado_em))
        for (let i = 0; i < responderam.length; i += 200) {
          await db.from('campanhas_envios').update({ status: 'respondeu' }).in('id', responderam.slice(i, i + 200).map((e: any) => e.id))
        }
        responderam.forEach((e: any) => { e.status = 'respondeu' })
      }
    }
  } catch {}

  const porCamp = (id: string) => envios.filter((e: any) => e.campanha_id === id)
  // Campanhas paradas fora do horário continuam como 'enviando' — os totais são recalculados aqui
  const lista = await Promise.all(camps.map(async c => {
    const es = porCamp(c.id)
    const respostas = es.filter((e: any) => e.status === 'respondeu').length
    const pendentes = es.filter((e: any) => e.status === 'pendente' || e.status === 'processando').length
    if (c.status === 'enviando' && es.length && pendentes === 0) await atualizarTotais(c.id).catch(() => {})
    return {
      ...c,
      enviados: es.length ? es.filter((e: any) => e.status === 'enviado' || e.status === 'respondeu').length : c.enviados,
      falhas: es.length ? es.filter((e: any) => e.status === 'falhou').length : c.falhas,
      respostas, pendentes,
      status: c.status === 'enviando' && es.length && pendentes === 0 ? 'concluida' : c.status,
    }
  }))
  return NextResponse.json({ campanhas: lista })
}

async function listarEnvios(medicoId: string, campanhaId: string) {
  const { data: camp, error } = await db.from('campanhas_reativacao').select('id').eq('id', campanhaId).eq('medico_id', medicoId).maybeSingle()
  if (error) return erro(error)
  if (!camp) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })
  try {
    const envios = await todas((de, ate) => db.from('campanhas_envios').select('*').eq('campanha_id', campanhaId).range(de, ate))
    const ids = Array.from(new Set(envios.map((e: any) => e.paciente_id).filter(Boolean)))
    const nomes: Record<string, string> = {}
    for (let i = 0; i < ids.length; i += 200) {
      const { data } = await db.from('pacientes').select('id, nome').in('id', ids.slice(i, i + 200))
      ;(data || []).forEach(p => { nomes[p.id] = p.nome })
    }
    return NextResponse.json({ envios: envios.map((e: any) => ({ ...e, paciente_nome: nomes[e.paciente_id] || null })) })
  } catch (e) {
    return erro(e)
  }
}
