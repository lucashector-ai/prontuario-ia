import { NextRequest, NextResponse } from 'next/server'
import { supabaseServidor as db } from '@/lib/servidor'
import { contextoDaRequisicao, medicoDaClinica, naoAutenticado, proibido } from '@/lib/acesso'
import { FILTRO_APOIO } from '@/lib/cargos'

const CAMPOS = ['nome', 'data_nascimento', 'sexo', 'genero', 'telefone', 'email', 'cpf', 'convenio', 'nr_carteirinha', 'endereco', 'cidade', 'alergias', 'comorbidades', 'medicamentos_uso', 'cids_cronicos', 'medico_id']

/** Novo paciente: sempre na clínica da sessão; o profissional informado precisa ser da clínica. */
export async function POST(req: NextRequest) {
  try {
    const ctx = await contextoDaRequisicao(req)
    if (!ctx) return naoAutenticado()
    if (ctx.tipo === 'atendente') return proibido()
    const body = await req.json()
    const novo: Record<string, any> = {}
    for (const k of CAMPOS) if (body[k] !== undefined) novo[k] = body[k]
    if (!String(novo.nome || '').trim()) return NextResponse.json({ error: 'Informe o nome do paciente.' }, { status: 422 })
    if (ctx.clinica_id) {
      if (novo.medico_id && !(await medicoDaClinica(novo.medico_id, ctx.clinica_id))) return proibido('Profissional de outra clínica.')
      novo.medico_id = novo.medico_id || ctx.medico_id || null
      novo.clinica_id = ctx.clinica_id
    } else {
      novo.medico_id = ctx.medico_id
    }
    const { data, error } = await db.from('pacientes').insert([novo]).select().single()
    if (error) throw error
    return NextResponse.json({ paciente: data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/** O paciente é da clínica (ou do autônomo) da sessão? */
async function pacienteDoEscopo(id: string, ctx: NonNullable<Awaited<ReturnType<typeof contextoDaRequisicao>>>) {
  const { data: p } = await db.from('pacientes').select('id, clinica_id, medico_id').eq('id', id).maybeSingle()
  if (!p) return null
  if (ctx.clinica_id) {
    if ((p as any).clinica_id === ctx.clinica_id) return p
    return (p as any).medico_id && (await medicoDaClinica((p as any).medico_id, ctx.clinica_id)) ? p : null
  }
  return (p as any).medico_id === ctx.medico_id ? p : null
}

/**
 * Lista de pacientes no escopo da SESSÃO (nunca pelo id que a tela manda):
 * equipe de clínica vê os pacientes da clínica; autônomo vê os seus. `medico_id` só filtra dentro do escopo.
 */
export async function GET(req: NextRequest) {
  const ctx = await contextoDaRequisicao(req)
  if (!ctx) return naoAutenticado()
  const filtroMedico = req.nextUrl.searchParams.get('medico_id')

  let medicoIds: string[]
  if (ctx.clinica_id) {
    const { data: medicos } = await db.from('medicos').select('id').eq('clinica_id', ctx.clinica_id).not('cargo', 'in', FILTRO_APOIO)
    medicoIds = (medicos || []).map((m: any) => m.id)
  } else if (ctx.medico_id) {
    medicoIds = [ctx.medico_id]
  } else return NextResponse.json({ pacientes: [] })
  if (filtroMedico && ctx.clinica_id && medicoIds.includes(filtroMedico) && req.nextUrl.searchParams.get('so_medico') === '1') medicoIds = [filtroMedico]

  let q = db.from('pacientes').select('*, medico:medico_id(id, nome)').order('nome')
  q = ctx.clinica_id
    ? (medicoIds.length ? q.or(`clinica_id.eq.${ctx.clinica_id},medico_id.in.(${medicoIds.join(',')})`) : q.eq('clinica_id', ctx.clinica_id))
    : q.eq('medico_id', ctx.medico_id!)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ pacientes: data })
}

export async function DELETE(req: NextRequest) {
  try {
    const ctx = await contextoDaRequisicao(req)
    if (!ctx) return naoAutenticado()
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })
    const p: any = await pacienteDoEscopo(id, ctx)
    if (!p) return NextResponse.json({ error: 'Paciente não encontrado.' }, { status: 404 })
    // Excluir apaga o histórico: só o dono/gestor da clínica, o profissional do paciente ou o autônomo
    if (ctx.clinica_id && !ctx.gestor && p.medico_id !== ctx.medico_id) return proibido('Só o administrador da clínica ou o profissional do paciente pode excluir.')

    await db.from('consultas').delete().eq('paciente_id', id)
    await db.from('agendamentos').delete().eq('paciente_id', id)

    const { error } = await db.from('pacientes').delete().eq('id', id)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
