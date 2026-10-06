/**
 * Configuração do atendimento: setores (salas de espera, cada uma com seu painel
 * de TV) e consultórios.
 *
 *   GET                                         → { setores, consultorios }
 *   POST   { tipo: 'setor' | 'consultorio', ...campos }   cria
 *   PATCH  { tipo, id, ...campos }                        altera
 *   PATCH  { tipo: 'setor', id, novo_link: true }         troca o link do painel
 *   DELETE ?tipo=…&id=…
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServidor as db } from '@/lib/servidor'
import { log } from '@/lib/logger'
import { ErroAtendimento, contextoAtendimento, faltaMigration, setoresDaClinica } from '@/lib/atendimento/servidor'

export const dynamic = 'force-dynamic'

const EXIBICOES = ['senha', 'senha_nome', 'nome_completo']

function erro(e: any) {
  if (e instanceof ErroAtendimento) return NextResponse.json({ error: e.message }, { status: e.status })
  if (faltaMigration(e)) return NextResponse.json({ error: 'Rode a migration 0018_atendimento_fila no Supabase', falta_migration: true }, { status: 503 })
  log.error('[atendimento/config]', e?.message || e)
  return NextResponse.json({ error: e?.message || 'Erro inesperado' }, { status: 500 })
}

/** Só o que pode ser gravado, já validado. */
function campos(tipo: string, b: any) {
  const c: Record<string, any> = {}
  if (typeof b.nome === 'string') {
    const nome = b.nome.trim().slice(0, 80)
    if (!nome) throw new ErroAtendimento('Dê um nome.')
    c.nome = nome
  }
  if (typeof b.ativo === 'boolean') c.ativo = b.ativo
  if (Number.isFinite(b.ordem)) c.ordem = Math.round(b.ordem)
  if (tipo === 'setor') {
    if (EXIBICOES.includes(b.painel_exibicao)) c.painel_exibicao = b.painel_exibicao
    if (typeof b.painel_voz === 'boolean') c.painel_voz = b.painel_voz
    if (typeof b.avisar_whatsapp === 'boolean') c.avisar_whatsapp = b.avisar_whatsapp
    if (b.painel_mensagem !== undefined) c.painel_mensagem = String(b.painel_mensagem || '').slice(0, 200) || null
  }
  return c
}

/** Configurar setores é do administrador (conta da clínica, médico admin ou médico autônomo). */
async function exigirAdmin(ctx: Awaited<ReturnType<typeof contextoAtendimento>>) {
  if (ctx.tipo === 'clinica' || ctx.clinica === ctx.medicoId) return
  if (ctx.tipo === 'medico' && ctx.medicoId) {
    const { data } = await db.from('medicos').select('cargo').eq('id', ctx.medicoId).maybeSingle()
    if (data?.cargo === 'admin') return
  }
  throw new ErroAtendimento('Só o administrador da clínica pode alterar setores e consultórios.', 403)
}

const tabela = (tipo: string) => {
  if (tipo === 'setor') return 'setores'
  if (tipo === 'consultorio') return 'consultorios'
  throw new ErroAtendimento('Tipo inválido')
}

export async function GET(req: NextRequest) {
  try { return NextResponse.json(await setoresDaClinica(await contextoAtendimento(req))) } catch (e) { return erro(e) }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await contextoAtendimento(req)
    await exigirAdmin(ctx)
    const b = await req.json().catch(() => ({}))
    const linha: Record<string, any> = { ...campos(b.tipo, b), clinica_id: ctx.clinica }
    if (!linha.nome) throw new ErroAtendimento('Dê um nome.')
    if (b.tipo === 'consultorio') {
      const { data: setor } = await db.from('setores').select('id').eq('id', b.setor_id).eq('clinica_id', ctx.clinica).maybeSingle()
      if (!setor) throw new ErroAtendimento('Escolha o setor do consultório.')
      linha.setor_id = setor.id
    }
    const { data, error } = await db.from(tabela(b.tipo)).insert(linha).select('*').single()
    if (error) throw error
    return NextResponse.json({ item: data })
  } catch (e) { return erro(e) }
}

export async function PATCH(req: NextRequest) {
  try {
    const ctx = await contextoAtendimento(req)
    await exigirAdmin(ctx)
    const b = await req.json().catch(() => ({}))
    const c = campos(b.tipo, b)
    if (b.tipo === 'setor' && b.novo_link) c.painel_token = crypto.randomUUID().replace(/-/g, '')
    if (b.tipo === 'consultorio' && b.setor_id) {
      const { data: setor } = await db.from('setores').select('id').eq('id', b.setor_id).eq('clinica_id', ctx.clinica).maybeSingle()
      if (!setor) throw new ErroAtendimento('Setor inválido.')
      c.setor_id = setor.id
    }
    const { data, error } = await db.from(tabela(b.tipo)).update(c).eq('id', b.id).eq('clinica_id', ctx.clinica).select('*').maybeSingle()
    if (error) throw error
    if (!data) throw new ErroAtendimento('Não encontrado.', 404)
    return NextResponse.json({ item: data })
  } catch (e) { return erro(e) }
}

export async function DELETE(req: NextRequest) {
  try {
    const ctx = await contextoAtendimento(req)
    await exigirAdmin(ctx)
    const sp = req.nextUrl.searchParams
    const { error } = await db.from(tabela(sp.get('tipo') || '')).delete().eq('id', sp.get('id') || '').eq('clinica_id', ctx.clinica)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) { return erro(e) }
}
