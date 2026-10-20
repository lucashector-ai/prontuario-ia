import { NextRequest, NextResponse } from 'next/server'
import { supabaseServidor as supabase } from '@/lib/servidor'
import { contextoDaRequisicao, medicoDaClinica, naoAutenticado, proibido } from '@/lib/acesso'

// Editar/remover alguém da equipe: só o gestor, e só pessoas da própria clínica
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await contextoDaRequisicao(req)
    if (!ctx) return naoAutenticado()
    if (!ctx.gestor) return proibido('Só o administrador da clínica edita a equipe')
    if (!(await medicoDaClinica(params.id, ctx.clinica_id))) return proibido('Pessoa não encontrada nesta clínica')

    const body = await req.json()
    const allowedFields: any = {}
    const fields = ['nome', 'email', 'crm', 'especialidade', 'cargo', 'ativo', 'telefone', 'cor', 'comissao_tipo', 'comissao_valor', 'comissao_base', 'cpf', 'data_nascimento']
    const numericFields = ['comissao_valor']
    const dateFields = ['data_nascimento']
    for (const f of fields) {
      if (body[f] !== undefined) {
        let v = body[f]
        // Converte string vazia em null pra campos numericos e de data
        if ((numericFields.includes(f) || dateFields.includes(f)) && (v === '' || v === undefined)) {
          v = null
        }
        allowedFields[f] = v
      }
    }
    if (allowedFields.cargo !== undefined && !['medico', 'admin', 'recepcionista'].includes(allowedFields.cargo)) {
      return NextResponse.json({ error: 'Cargo inválido' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('medicos')
      .update(allowedFields)
      .eq('id', params.id)
      .eq('clinica_id', ctx.clinica_id!)
      .select('id, nome, email, crm, especialidade, cargo, ativo, telefone, cor, comissao_tipo, comissao_valor, comissao_base, cpf, data_nascimento, clinica_id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ medico: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await contextoDaRequisicao(req)
    if (!ctx) return naoAutenticado()
    if (!ctx.gestor) return proibido('Só o administrador da clínica remove pessoas da equipe')
    if (params.id === ctx.medico_id) return proibido('Você não pode remover a si mesmo')
    if (!(await medicoDaClinica(params.id, ctx.clinica_id))) return proibido('Pessoa não encontrada nesta clínica')

    const { error } = await supabase
      .from('medicos')
      .delete()
      .eq('id', params.id)
      .eq('clinica_id', ctx.clinica_id!)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
