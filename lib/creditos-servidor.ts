/**
 * Créditos de IA no servidor: saldo do mês e cobrança.
 * Fluxo das rotas de IA: `const c = await conferirCreditos(req, custo)` antes de chamar a IA
 * (devolve a mensagem se faltar saldo) e `await debitarCreditos(c, ...)` só depois que deu certo.
 * Sem a migration 0027 (tabelas ausentes), nada é bloqueado nem registrado.
 */
import type { NextRequest } from 'next/server'
import { createHash } from 'crypto'
import { sessaoDaRequisicao } from '@/lib/sessao-servidor'
import { supabaseServidor as db } from '@/lib/servidor'
import { log } from '@/lib/logger'
import { inicioDoMesSP } from '@/lib/planos'
import { calcularSaldo, fmtCreditos, type MotivoCredito, type Saldo } from '@/lib/creditos'

export type Cobranca = { chave: string; usuario: string | null; custo: number } | null

async function planoDaChave(chave: string): Promise<string | null> {
  const { data } = await db.from('clinicas').select('plano').eq('id', chave).maybeSingle()
  return (data as any)?.plano ?? null
}

export async function saldoDaClinica(chave: string): Promise<Saldo> {
  const agora = new Date().toISOString()
  const [plano, uso, pac] = await Promise.all([
    planoDaChave(chave),
    db.from('creditos_uso').select('creditos').eq('clinica_chave', chave).gte('criado_em', inicioDoMesSP()),
    db.from('creditos_pacotes').select('creditos').eq('clinica_chave', chave).gt('expira_em', agora),
  ])
  if (uso.error) return calcularSaldo(null, 0, 0) // sem a migration: sem limite
  const usados = (uso.data || []).reduce((s: number, r: any) => s + Number(r.creditos || 0), 0)
  const extras = (pac.data || []).reduce((s: number, r: any) => s + Number(r.creditos || 0), 0)
  return calcularSaldo(plano, usados, extras)
}

export function mensagemSemCreditos(s: Saldo, custo: number) {
  return `Os créditos de IA deste mês acabaram (${fmtCreditos(s.disponivel || 0)} disponíveis, esta ação usa ${fmtCreditos(custo)}). `
    + 'O que você gravou ou escreveu continua salvo. Para seguir com a IA, adicione um pacote de créditos em Planos.'
}

/** Confere o saldo antes de usar a IA. `erro` vem preenchido quando não há créditos suficientes. */
export async function conferirCreditos(req: NextRequest, custo: number): Promise<{ cobranca: Cobranca; erro: string | null; saldo: Saldo | null }> {
  const s = await sessaoDaRequisicao(req)
  const chave = s?.clinica_id || s?.medico_id || null
  if (!chave) return { cobranca: null, erro: null, saldo: null }
  try {
    const saldo = await saldoDaClinica(chave)
    const cobranca = { chave, usuario: (s as any)?.medico_id || (s as any)?.sub || null, custo }
    if (saldo.disponivel !== null && saldo.disponivel < custo) return { cobranca, erro: mensagemSemCreditos(saldo, custo), saldo }
    return { cobranca, erro: null, saldo }
  } catch (e) {
    log.warn('[creditos] conferir', e)
    return { cobranca: null, erro: null, saldo: null }
  }
}

/** Registra o uso depois que a IA respondeu. Nunca derruba a requisição. */
export async function debitarCreditos(c: Cobranca, motivo: MotivoCredito, detalhe?: string, custo?: number) {
  if (!c) return
  const valor = custo ?? c.custo
  if (!(valor > 0)) return
  const { error } = await db.from('creditos_uso').insert({ clinica_chave: c.chave, usuario_id: c.usuario, motivo, creditos: valor, detalhe: detalhe?.slice(0, 200) || null })
  if (error) log.warn('[creditos] debitar', error.message)
}

/** Para rotas sem requisição do usuário (ex.: Sofia no webhook): cobra direto pela chave da clínica. */
export async function debitarDaClinica(chave: string | null, motivo: MotivoCredito, creditos: number, detalhe?: string) {
  if (!chave) return
  await debitarCreditos({ chave, usuario: null, custo: creditos }, motivo, detalhe)
}

/** Assinatura curta de um texto (para não cobrar duas vezes o mesmo prontuário gerado de novo). */
export function assinatura(texto: string) {
  return createHash('sha256').update(String(texto || '').trim()).digest('hex').slice(0, 16)
}

/** Já foi cobrado nas últimas 24h para esta clínica com o mesmo detalhe? */
export async function jaCobrado(c: Cobranca, detalhe: string) {
  if (!c) return false
  const { data } = await db.from('creditos_uso').select('id').eq('clinica_chave', c.chave).eq('detalhe', detalhe)
    .gte('criado_em', new Date(Date.now() - 86400000).toISOString()).limit(1)
  return !!data?.length
}

/** Chave de créditos a partir do médico (clínica dele, ou ele mesmo em conta antiga). */
export async function chaveDoMedico(medicoId: string | null | undefined): Promise<string | null> {
  if (!medicoId) return null
  const { data } = await db.from('medicos').select('clinica_id').eq('id', medicoId).maybeSingle()
  return (data as any)?.clinica_id || medicoId
}

/**
 * Sofia: meio crédito por conversa por dia (várias mensagens no mesmo dia contam uma vez).
 * Não bloqueia a resposta ao paciente; só registra o uso.
 */
export async function cobrarConversaSofia(medicoId: string | null | undefined, conversaId: string | null | undefined) {
  try {
    const chave = await chaveDoMedico(medicoId)
    if (!chave || !conversaId) return
    const c = { chave, usuario: null, custo: 0.5 }
    const marca = 'sofia:' + conversaId
    if (await jaCobrado(c, marca)) return
    await debitarCreditos(c, 'sofia', marca)
  } catch (e) { log.warn('[creditos] sofia', e) }
}
