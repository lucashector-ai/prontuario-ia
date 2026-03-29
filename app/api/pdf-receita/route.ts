import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest) {
  try {
    const consultaId = req.nextUrl.searchParams.get('consulta_id')
    const medicoId = req.nextUrl.searchParams.get('medico_id')
    if (!consultaId || !medicoId) return NextResponse.json({ error: 'Parametros faltando' }, { status: 400 })

    const [{ data: consulta }, { data: medico }] = await Promise.all([
      sb.from('consultas').select('*, pacientes(nome)').eq('id', consultaId).single(),
      sb.from('medicos').select('nome, crm, especialidade').eq('id', medicoId).single(),
    ])
    if (!consulta || !medico) return NextResponse.json({ error: 'Nao encontrado' }, { status: 404 })

    const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    const pacienteNome = (consulta as any).pacientes?.nome || 'Paciente nao identificado'
    const receita = (consulta as any).receita || ''
    const plano = (consulta as any).plano || ''

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Receita Medica</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;color:#111827;background:white;padding:40px 48px;max-width:720px;margin:0 auto}
@media print{body{padding:20px 24px}.no-print{display:none!important}@page{margin:1cm}}
.btn{position:fixed;top:20px;right:20px;padding:10px 20px;background:#16a34a;color:white;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer}
.header{display:flex;align-items:flex-start;justify-content:space-between;padding-bottom:20px;border-bottom:2px solid #111827;margin-bottom:24px}
.doc-title{font-size:20px;font-weight:700;color:#111827;margin-bottom:4px}
.doc-sub{font-size:12px;color:#6b7280;line-height:1.6}
.badge{display:inline-block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:white;background:#16a34a;padding:3px 10px;border-radius:20px;margin-bottom:16px}
.box{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;margin-bottom:24px;display:flex;justify-content:space-between}
.label{font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}
.value{font-size:13px;font-weight:500;color:#111827}
.sec{font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #e5e7eb}
.content{font-size:14px;color:#374151;line-height:1.8;white-space:pre-wrap;margin-bottom:28px;min-height:120px}
hr{border:none;border-top:1px dashed #d1d5db;margin:24px 0}
.footer{margin-top:40px;display:flex;align-items:flex-end;justify-content:space-between}
.assinatura{text-align:center}
.linha{width:200px;border-top:1.5px solid #374151;margin-bottom:8px}
.a-nome{font-size:13px;font-weight:600;color:#111827}
.a-crm{font-size:11px;color:#6b7280}
.aviso{margin-top:32px;padding:10px 14px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;font-size:11px;color:#92400e;line-height:1.5}
</style>
</head>
<body>
<button class="btn no-print" onclick="window.print()">Imprimir / Salvar PDF</button>
<div class="header">
  <div>
    <p class="doc-title">Clinica ${(medico as any).nome}</p>
    <p class="doc-sub">${(medico as any).especialidade}<br/>CRM ${(medico as any).crm}</p>
  </div>
</div>
<span class="badge">Receita Medica</span>
<div class="box">
  <div><p class="label">Paciente</p><p class="value">${pacienteNome}</p></div>
  <div><p class="label">Data</p><p class="value">${hoje}</p></div>
</div>
${receita ? `<p class="sec">Prescricao</p><div class="content">${receita}</div>` : ''}
${plano && !receita ? `<p class="sec">Conduta / Plano</p><div class="content">${plano}</div>` : ''}
${!receita && !plano ? `<p class="sec">Prescricao</p><div class="content" style="color:#9ca3af;font-style:italic">Nenhuma prescricao registrada.</div>` : ''}
<hr/>
<div class="footer">
  <div style="font-size:12px;color:#6b7280">${hoje}</div>
  <div class="assinatura">
    <div class="linha"></div>
    <p class="a-nome">${(medico as any).nome}</p>
    <p class="a-crm">CRM ${(medico as any).crm} · ${(medico as any).especialidade}</p>
  </div>
</div>
<div class="aviso">Documento gerado eletronicamente pelo sistema MedIA. Valido conforme CFM Resolucao 2.299/2021.</div>
</body>
</html>`

    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
