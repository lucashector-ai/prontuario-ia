
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const consultaId = req.nextUrl.searchParams.get('consulta_id')
    const medicoId = req.nextUrl.searchParams.get('medico_id')
    if (!consultaId || !medicoId) return NextResponse.json({ error: 'Parametros faltando' }, { status: 400 })

    const [{ data: consulta }, { data: medico }] = await Promise.all([
      supabase.from('consultas').select('*, pacientes(nome, data_nascimento, telefone, email)').eq('id', consultaId).single(),
      supabase.from('medicos').select('nome, crm, especialidade, clinica').eq('id', medicoId).single(),
    ])
    if (!consulta || !medico) return NextResponse.json({ error: 'Nao encontrado' }, { status: 404 })

    const c = consulta as any
    const m = medico as any
    const p = c.pacientes || {}
    const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    const dataConsulta = c.criado_em ? new Date(c.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : hoje
    const cids = (c.cids || []).map((x: any) => `<tr><td style="padding:6px 0;font-size:13px;font-weight:600;color:#111">${x.codigo}</td><td style="padding:6px 0;font-size:13px;color:#374151">${x.descricao}</td></tr>`).join('')
    const secao = (label: string, content: string) => content ? `
      <div style="margin-bottom:20px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;margin-bottom:6px">${label}</div>
        <div style="font-size:13px;line-height:1.8;color:#111827;white-space:pre-wrap;background:#F5F5F5;border-radius:8px;padding:12px 14px;border:1px solid #e5e7eb">${content}</div>
      </div>` : ''

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
<title>Prontuario - ${p.nome || 'Paciente'}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;color:#111827;background:#fff;padding:40px;max-width:760px;margin:0 auto}
@media print{.no-print{display:none!important}body{padding:20px}}
.btn{position:fixed;top:20px;right:20px;padding:10px 20px;background:#1F9D5C;color:#fff;border:none;border-radius:8px;font-size:13px;cursor:pointer;font-weight:600}
.header{border-bottom:2px solid #1F9D5C;padding-bottom:16px;margin-bottom:24px}
.clinic{font-size:20px;font-weight:700;color:#1F9D5C}
.clinic-info{font-size:12px;color:#6b7280;margin-top:2px}
.meta{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px}
.meta-card{background:#F5F5F5;border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px}
.meta-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af;margin-bottom:4px}
.meta-value{font-size:13px;font-weight:600;color:#111827}
.meta-sub{font-size:11px;color:#6b7280;margin-top:2px}
.section-title{font-size:14px;font-weight:700;color:#1F9D5C;border-bottom:1px solid #e5e7eb;padding-bottom:8px;margin-bottom:16px}
table{width:100%;border-collapse:collapse}
.footer{margin-top:60px;display:flex;justify-content:space-between;align-items:flex-end}
.assinatura{text-align:center}
.assinatura-linha{border-top:1.5px solid #111;width:220px;margin-bottom:8px}
</style>
</head><body>
<button class="btn no-print" onclick="window.print()">Imprimir / Salvar PDF</button>

<div class="header">
  <div class="clinic">${m.clinica || ('Clinica ' + m.nome)}</div>
  <div class="clinic-info">${m.especialidade || ''}${m.crm ? ' &bull; CRM ' + m.crm : ''}</div>
</div>

<div class="meta">
  <div class="meta-card">
    <div class="meta-label">Paciente</div>
    <div class="meta-value">${p.nome || 'Nao informado'}</div>
    <div class="meta-sub">${p.telefone || ''} ${p.email ? '&bull; ' + p.email : ''}</div>
  </div>
  <div class="meta-card">
    <div class="meta-label">Data da consulta</div>
    <div class="meta-value">${dataConsulta}</div>
    <div class="meta-sub">Medico: ${m.nome || ''}</div>
  </div>
</div>

<div class="section-title">Prontuário SOAP</div>
${secao('Subjetivo (queixa e historico)', c.subjetivo || '')}
${secao('Objetivo (exame fisico)', c.objetivo || '')}
${secao('Avaliacao (hipoteses diagnosticas)', c.avaliacao || '')}
${secao('Plano (conduta)', c.plano || '')}

${cids ? `<div style="margin-bottom:20px">
  <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;margin-bottom:6px">CID-10</div>
  <table><tbody>${cids}</tbody></table>
</div>` : ''}

${c.receita ? `<div style="margin-bottom:20px">
  <div class="section-title" style="margin-top:20px">Prescricao</div>
  ${secao('', c.receita)}
</div>` : ''}

${c.transcricao ? `<div style="margin-bottom:20px">
  <div class="section-title" style="margin-top:20px">Transcricao da consulta</div>
  ${secao('', c.transcricao)}
</div>` : ''}

<div class="footer">
  <div style="font-size:11px;color:#9ca3af">${hoje}</div>
  <div class="assinatura">
    <div class="assinatura-linha"></div>
    <div style="font-size:13px;font-weight:700">${m.nome || ''}</div>
    <div style="font-size:11px;color:#6b7280">${m.especialidade || ''} &bull; CRM ${m.crm || ''}</div>
  </div>
</div>
</body></html>`

    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
