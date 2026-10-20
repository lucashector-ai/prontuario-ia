import { NextRequest, NextResponse } from 'next/server'
import { supabaseServidor as supabase } from '@/lib/servidor'
import bcrypt from 'bcryptjs'
import { contextoDaRequisicao, medicoDaClinica, naoAutenticado, proibido, type Contexto } from '@/lib/acesso'

/**
 * Atendentes do Chat ficam ligados à caixa de um médico. Só mexe quem é da mesma clínica:
 * ver — qualquer pessoa da clínica; criar/editar/desativar — o gestor ou o próprio dono da caixa.
 */
async function caixaPermitida(ctx: Contexto, medicoId: string, gerenciar: boolean) {
  if (ctx.tipo === 'atendente') return false
  if (medicoId === ctx.medico_id) return true
  if (!(await medicoDaClinica(medicoId, ctx.clinica_id))) return false
  return gerenciar ? ctx.gestor : true
}

async function atendenteDaClinica(ctx: Contexto, id: string) {
  const { data } = await supabase.from('atendentes').select('id, medico_id').eq('id', id).maybeSingle()
  if (!data) return false
  return caixaPermitida(ctx, data.medico_id, true)
}

export async function GET(req: NextRequest) {
  const ctx = await contextoDaRequisicao(req)
  if (!ctx) return naoAutenticado()
  const medico_id = req.nextUrl.searchParams.get('medico_id')
  if (!medico_id) return NextResponse.json({ error: 'medico_id required' }, { status: 400 })
  if (!(await caixaPermitida(ctx, medico_id, false))) return proibido()
  const { data, error } = await supabase.from('atendentes').select('id,nome,email,cargo,ativo,criado_em').eq('medico_id', medico_id).order('nome')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ atendentes: data || [] })
}

export async function POST(req: NextRequest) {
  const ctx = await contextoDaRequisicao(req)
  if (!ctx) return naoAutenticado()
  const { medico_id, nome, email, senha, cargo } = await req.json()
  if (!medico_id || !nome || !email || !senha) return NextResponse.json({ error: 'Campos obrigatórios: medico_id, nome, email, senha' }, { status: 400 })
  if (!(await caixaPermitida(ctx, medico_id, true))) return proibido()
  // Verifica se email já existe
  const { data: existe } = await supabase.from('atendentes').select('id').eq('email', email).maybeSingle()
  if (existe) return NextResponse.json({ error: 'Email já cadastrado' }, { status: 400 })
  const senhaHash = await bcrypt.hash(senha, 10)
  const { data, error } = await supabase.from('atendentes').insert({ medico_id, nome, email, senha: senhaHash, cargo: cargo || 'Atendente', ativo: true }).select('id,nome,email,cargo,ativo,medico_id,criado_em').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ atendente: data })
}

export async function DELETE(req: NextRequest) {
  const ctx = await contextoDaRequisicao(req)
  if (!ctx) return naoAutenticado()
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  if (!(await atendenteDaClinica(ctx, id))) return proibido()
  await supabase.from('atendentes').update({ ativo: false }).eq('id', id)
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest) {
  const ctx = await contextoDaRequisicao(req)
  if (!ctx) return naoAutenticado()
  const { id, nome, cargo, ativo } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  if (!(await atendenteDaClinica(ctx, id))) return proibido()
  const { data, error } = await supabase.from('atendentes').update({ nome, cargo, ativo }).eq('id', id).select('id,nome,email,cargo,ativo,medico_id,criado_em').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ atendente: data })
}
