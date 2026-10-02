/**
 * POST /api/resumo-pre-consulta  { paciente_id, medico_id, forcar? }
 *
 * Junta o que se sabe do paciente (cadastro, últimas consultas, pré-consulta,
 * retornos pendentes, WhatsApp) e pede à IA um resumo objetivo para o médico.
 * - Sem histórico → resposta montada sem IA ("Primeira consulta…").
 * - Erro de IA → resumo montado só com os dados.
 * - Cache em memória por paciente/médico/dia (`forcar: true` ignora o cache).
 */
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseServidor as supabase } from '@/lib/servidor'
import { MODELOS } from '@/lib/ai/models'
import { log } from '@/lib/logger'
import type { ResumoPreConsulta, RespostaResumoPreConsulta } from './tipos'

export const dynamic = 'force-dynamic'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 25_000, maxRetries: 1 })

const cache = new Map<string, RespostaResumoPreConsulta>()
const MAX_CACHE = 500

const hojeSP = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

function lista(v: any): string[] {
  if (!v) return []
  if (Array.isArray(v)) return v.map(x => (typeof x === 'string' ? x : x?.nome || x?.descricao || '')).map(s => String(s).trim()).filter(Boolean)
  return String(v).split(/[,;\n]/).map(s => s.replace(/^[•\-\*]\s*/, '').trim()).filter(Boolean)
}

function idade(dataNasc?: string | null): number | null {
  if (!dataNasc) return null
  const d = new Date(dataNasc)
  if (isNaN(d.getTime())) return null
  const h = new Date()
  let a = h.getFullYear() - d.getFullYear()
  if (h.getMonth() < d.getMonth() || (h.getMonth() === d.getMonth() && h.getDate() < d.getDate())) a--
  return a >= 0 && a < 130 ? a : null
}

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '')
const corta = (t: any, n = 400) => { const s = String(t ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n) + '…' : s }

/** Consulta que tolera tabela/coluna inexistente (retorna null em vez de quebrar). */
async function seguro<T>(p: PromiseLike<{ data: T | null; error: any }>): Promise<T | null> {
  try {
    const { data, error } = await p
    if (error) return null
    return data
  } catch { return null }
}

export async function POST(req: NextRequest) {
  let body: any = {}
  try { body = await req.json() } catch {}
  const { paciente_id, medico_id, forcar } = body || {}
  if (!paciente_id) return NextResponse.json({ error: 'paciente_id obrigatório' }, { status: 400 })

  const chave = `${paciente_id}:${medico_id || ''}:${hojeSP()}`
  if (!forcar && cache.has(chave)) return NextResponse.json({ ...cache.get(chave)!, cache: true })

  try {
    // ── Coleta ──────────────────────────────────────────────────────────────
    const [paciente, consultas, preConsultas, formularios, retornos, conversas] = await Promise.all([
      seguro<any>(supabase.from('pacientes').select('*').eq('id', paciente_id).maybeSingle()),
      seguro<any[]>(supabase.from('consultas').select('criado_em, subjetivo, avaliacao, plano, cids').eq('paciente_id', paciente_id).order('criado_em', { ascending: false }).limit(5)),
      seguro<any[]>(supabase.from('pre_consultas').select('*').eq('paciente_id', paciente_id).order('criado_em', { ascending: false }).limit(1)),
      seguro<any[]>(supabase.from('formularios_respostas').select('respostas, resumo_ia, preenchido_em').eq('paciente_id', paciente_id).order('preenchido_em', { ascending: false }).limit(1)),
      seguro<any[]>(supabase.from('retornos').select('*').eq('paciente_id', paciente_id).limit(10)),
      seguro<any[]>(supabase.from('whatsapp_conversas').select('id').eq('paciente_id', paciente_id).limit(3)),
    ])

    let mensagens: any[] = []
    if (conversas && conversas.length) {
      mensagens = (await seguro<any[]>(supabase.from('whatsapp_mensagens').select('tipo, conteudo, criado_em')
        .in('conversa_id', conversas.map(c => c.id)).order('criado_em', { ascending: false }).limit(15))) || []
    }

    const p = paciente || {}
    const alergias = lista(p.alergias)
    const comorbidades = lista(p.comorbidades)
    const medicacoes = lista(p.medicamentos_uso)
    const id = idade(p.data_nascimento)
    const cs = consultas || []
    const pre = preConsultas?.[0] || null
    const form = formularios?.[0] || null
    const FECHADOS = /realiz|conclu|cancel|feito|agendad/i
    const pendentes = (retornos || []).filter(r => !FECHADOS.test(String(r.status || '')))
    const msgsPaciente = mensagens.filter(m => m.tipo === 'recebida' && m.conteudo)

    const baseResposta = {
      paciente: { nome: p.nome || '', idade: id, sexo: p.sexo || null, convenio: p.convenio || null },
      gerado_em: new Date().toISOString(),
    }

    // ── Sem histórico → sem IA ──────────────────────────────────────────────
    const temHistorico = cs.length > 0 || !!pre || !!form || pendentes.length > 0 || msgsPaciente.length > 0
    if (!temHistorico) {
      const r: RespostaResumoPreConsulta = {
        ...baseResposta,
        fonte: 'primeira',
        resumo: {
          destaque: 'Primeira consulta — sem histórico registrado no sistema.',
          pontos: [
            ...(comorbidades.length ? ['Comorbidades cadastradas: ' + comorbidades.join(', ')] : []),
            ...(medicacoes.length ? ['Em uso: ' + medicacoes.slice(0, 4).join(', ')] : []),
          ],
          alertas: alergias.map(a => 'Alergia: ' + a),
          perguntas_sugeridas: [
            'Qual o principal motivo da consulta hoje?',
            'Usa alguma medicação contínua ou tem alergias?',
            'Tem doenças crônicas ou cirurgias anteriores?',
          ],
        },
      }
      guardar(chave, r)
      return NextResponse.json(r)
    }

    // ── Contexto para a IA ──────────────────────────────────────────────────
    const linhas: string[] = []
    linhas.push('PACIENTE: ' + [p.nome, id != null ? id + ' anos' : '', p.sexo, p.convenio ? 'convênio ' + p.convenio : 'particular'].filter(Boolean).join(', '))
    linhas.push('Alergias: ' + (alergias.join(', ') || 'nenhuma registrada'))
    linhas.push('Comorbidades: ' + (comorbidades.join(', ') || 'nenhuma registrada'))
    linhas.push('Medicações em uso: ' + (medicacoes.join(', ') || 'nenhuma registrada'))
    if (cs.length) {
      linhas.push('', 'ÚLTIMAS CONSULTAS (mais recente primeiro):')
      cs.forEach(c => {
        const cids = Array.isArray(c.cids) ? c.cids.map((x: any) => x?.codigo ? `${x.codigo} ${x.descricao || ''}`.trim() : String(x)).join('; ') : ''
        linhas.push(`- ${fmt(c.criado_em)} | Queixa: ${corta(c.subjetivo, 200)} | Avaliação: ${corta(c.avaliacao, 300)} | Plano: ${corta(c.plano, 300)}${cids ? ' | CIDs: ' + cids : ''}`)
      })
    }
    if (pre) linhas.push('', `PRÉ-CONSULTA (${fmt(pre.criado_em)}): ${corta(JSON.stringify(pre.respostas || pre.conteudo || {}), 1200)}`)
    if (form) linhas.push('', `FORMULÁRIO RESPONDIDO (${fmt(form.preenchido_em)}): ${corta(form.resumo_ia || JSON.stringify(form.respostas || {}), 1200)}`)
    if (pendentes.length) {
      linhas.push('', 'RETORNOS PENDENTES:')
      pendentes.forEach(r => linhas.push(`- ${fmt(r.data_prevista || r.data_retorno || r.data || r.prazo)} ${corta(r.motivo || r.descricao || r.observacoes || '', 160)}`))
    }
    if (msgsPaciente.length) {
      linhas.push('', 'ÚLTIMAS MENSAGENS DO PACIENTE NO WHATSAPP:')
      msgsPaciente.slice(0, 8).reverse().forEach(m => linhas.push(`- ${fmt(m.criado_em)}: ${corta(m.conteudo, 200)}`))
    }

    const fallback = (): ResumoPreConsulta => resumoSoDados({ cs, pre, form, pendentes, msgsPaciente, alergias, comorbidades, medicacoes })

    if (!process.env.ANTHROPIC_API_KEY) {
      const r: RespostaResumoPreConsulta = { ...baseResposta, fonte: 'dados', resumo: fallback() }
      guardar(chave, r)
      return NextResponse.json(r)
    }

    const prompt = [
      'Você prepara o médico para a consulta que vai começar. Leia os dados do paciente e escreva um resumo OBJETIVO, em português do Brasil, para leitura em 20 segundos.',
      '',
      'Regras:',
      '- Use só o que está nos dados. Não invente diagnósticos, exames ou valores.',
      '- Frases curtas, linguagem técnica, sem saudações.',
      '- "destaque": 1 frase com o mais importante (motivo provável do retorno ou condição principal).',
      '- "pontos": até 5 itens — queixas recentes, mudanças desde a última consulta, pendências (exames, retornos, metas).',
      '- "alertas": alergias, possíveis interações entre medicações em uso, sinais de atenção relatados (ex.: piora, efeito adverso). Lista vazia se nada.',
      '- "perguntas_sugeridas": até 3 perguntas úteis para o médico fazer hoje.',
      '',
      'Responda SOMENTE com este JSON:',
      '{ "destaque": "", "pontos": [], "alertas": [], "perguntas_sugeridas": [] }',
      '',
      'DADOS:',
      linhas.join('\n'),
    ].join('\n')

    let resumo: ResumoPreConsulta
    let fonte: RespostaResumoPreConsulta['fonte'] = 'ia'
    try {
      const msg = await anthropic.messages.create({
        model: MODELOS.apoio,
        max_tokens: 900,
        messages: [{ role: 'user', content: prompt }],
      })
      const txt = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
      const ini = txt.indexOf('{'), fim = txt.lastIndexOf('}')
      const j = JSON.parse(txt.slice(ini, fim + 1))
      const arr = (v: any, n: number) => (Array.isArray(v) ? v.filter((x: any) => typeof x === 'string' && x.trim()).map((x: string) => x.trim()).slice(0, n) : [])
      resumo = {
        destaque: typeof j.destaque === 'string' && j.destaque.trim() ? j.destaque.trim() : fallback().destaque,
        pontos: arr(j.pontos, 5),
        alertas: arr(j.alertas, 6),
        perguntas_sugeridas: arr(j.perguntas_sugeridas, 3),
      }
      // Alergias cadastradas sempre aparecem, mesmo que a IA esqueça
      for (const a of alergias) {
        if (!resumo.alertas.some(x => x.toLowerCase().includes(a.toLowerCase()))) resumo.alertas.unshift('Alergia: ' + a)
      }
    } catch (e: any) {
      log.error('resumo-pre-consulta IA:', e?.message || e)
      resumo = fallback()
      fonte = 'dados'
    }

    const r: RespostaResumoPreConsulta = { ...baseResposta, fonte, resumo }
    guardar(chave, r)
    return NextResponse.json(r)
  } catch (e: any) {
    log.error('resumo-pre-consulta:', e)
    return NextResponse.json({ error: 'Não foi possível montar o resumo' }, { status: 500 })
  }
}

function guardar(chave: string, r: RespostaResumoPreConsulta) {
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value as string)
  cache.set(chave, r)
}

/** Resumo montado só com os dados (sem IA). */
function resumoSoDados(d: {
  cs: any[]; pre: any; form: any; pendentes: any[]; msgsPaciente: any[]
  alergias: string[]; comorbidades: string[]; medicacoes: string[]
}): ResumoPreConsulta {
  const ult = d.cs[0]
  const pontos: string[] = []
  if (ult) {
    const cids = Array.isArray(ult.cids) ? ult.cids.map((x: any) => x?.codigo || x).filter(Boolean).join(', ') : ''
    pontos.push(`Última consulta em ${fmt(ult.criado_em)}${cids ? ' (' + cids + ')' : ''}${ult.plano ? ': ' + corta(ult.plano, 140) : ''}`)
  }
  if (d.comorbidades.length) pontos.push('Comorbidades: ' + d.comorbidades.join(', '))
  if (d.medicacoes.length) pontos.push('Em uso: ' + d.medicacoes.slice(0, 4).join(', '))
  if (d.pendentes.length) pontos.push(`${d.pendentes.length} retorno(s) pendente(s)`)
  if (d.pre || d.form) pontos.push('Pré-consulta respondida em ' + fmt(d.pre?.criado_em || d.form?.preenchido_em))
  if (d.msgsPaciente[0]) pontos.push(`Última mensagem no WhatsApp (${fmt(d.msgsPaciente[0].criado_em)}): "${corta(d.msgsPaciente[0].conteudo, 120)}"`)
  return {
    destaque: ult?.avaliacao ? 'Última avaliação: ' + corta(ult.avaliacao, 160) : `${d.cs.length} consulta(s) anterior(es) registrada(s).`,
    pontos: pontos.slice(0, 5),
    alertas: d.alergias.map(a => 'Alergia: ' + a),
    perguntas_sugeridas: [
      ...(ult?.plano ? ['Seguiu o plano da última consulta? Houve efeitos adversos?'] : []),
      'O que mudou desde a última consulta?',
      ...(d.pendentes.length ? ['Trouxe os exames/resultados pendentes?'] : []),
    ].slice(0, 3),
  }
}
