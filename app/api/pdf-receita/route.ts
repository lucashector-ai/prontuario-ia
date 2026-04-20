import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const consultaId = req.nextUrl.searchParams.get('consulta_id')
    const medicoId = req.nextUrl.searchParams.get('medico_id')
    if (!consultaId || !medicoId) return NextResponse.json({ error: 'Parametros faltando' }, { status: 400 })
    const [{ data: consulta }, { data: medico }] = await Promise.all([
      supabase.from('consultas').select('*, pacientes(nome)').eq('id', consultaId).single(),
      supabase.from('medicos').select('nome, crm, especialidade').eq('id', medicoId).single(),
    ])
    if (!consulta || !medico) return NextResponse.json({ error: 'Nao encontrado' }, { status: 404 })
    const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    const pac = (consulta as any).pacientes?.nome || 'Paciente'
    const rec = (consulta as any).receita || (consulta as any).plano || ''
    const nome = (medico as any).nome || ''
    const crm = (medico as any).crm || ''
    const esp = (medico as any).especialidade || ''
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Receita</title><style>body{font-family:Arial,sans-serif;padding:40px;max-width:700px;margin:0 auto}@media print{.no-print{display:none}}h1{font-size:20px;margin-bottom:4px}.sub{color:#6b7280;font-size:13px;margin-bottom:20px}.divider{border-top:2px solid #111;margin-bottom:20px}.box{background:#F5F5F5;border:1px solid #e5e7eb;border-radius:8px;padding:14px;margin-bottom:20px;display:flex;justify-content:space-between}.label{font-size:10px;color:#9ca3af;text-transform:uppercase;margin-bottom:4px}.value{font-size:13px;font-weight:500}.content{font-size:14px;line-height:1.8;white-space:pre-wrap;min-height:120px;margin-bottom:30px}.footer{display:flex;justify-content:space-between;align-items:flex-end;margin-top:40px}.linha{width:200px;border-top:1.5px solid #111;margin-bottom:8px}.a-nome{font-size:13px;font-weight:600}.a-crm{font-size:11px;color:#6b7280}.btn{position:fixed;top:20px;right:20px;padding:10px 20px;background:#1F9D5C;color:white;border:none;border-radius:8px;font-size:13px;cursor:pointer}</style></head><body><button class="btn no-print" onclick="window.print()">Imprimir / Salvar PDF</button><h1>Clinica ${nome}</h1><p class="sub">${esp} - CRM ${crm}</p><div class="divider"></div><div class="box"><div><p class="label">Paciente</p><p class="value">${pac}</p></div><div><p class="label">Data</p><p class="value">${hoje}</p></div></div><p style="font-size:12px;font-weight:700;text-transform:uppercase;margin-bottom:8px">Prescricao</p><div class="content">${rec || 'Nenhuma prescricao registrada.'}</div><div class="footer"><div style="font-size:12px;color:#6b7280">${hoje}</div><div class="assinatura"><div class="linha"></div><p class="a-nome">${nome}</p><p class="a-crm">CRM ${crm}</p></div></div></body></html>`
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
