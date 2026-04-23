import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const consultaId = req.nextUrl.searchParams.get('consulta_id')
    const medicoId = req.nextUrl.searchParams.get('medico_id')
    if (!consultaId || !medicoId) return NextResponse.json({ error: 'Parametros faltando' }, { status: 400 })

    const [{ data: consulta }, { data: medico }] = await Promise.all([
      supabase.from('consultas').select('*, pacientes(nome, cpf, data_nascimento)').eq('id', consultaId).single(),
      supabase.from('medicos').select('nome, crm, especialidade, telefone, clinica_id').eq('id', medicoId).single(),
    ])
    if (!consulta) return NextResponse.json({ error: 'Consulta nao encontrada' }, { status: 404 })
    if (!medico) return NextResponse.json({ error: 'Medico nao encontrado' }, { status: 404 })

    let clinica: any = null
    if ((medico as any).clinica_id) {
      const { data: cl } = await supabase.from('clinicas').select('nome, telefone, endereco, email').eq('id', (medico as any).clinica_id).single()
      clinica = cl
    }

    const c = consulta as any
    const m = medico as any
    const p = c.pacientes || {}
    const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

    const nomeClinica = (clinica && clinica.nome) || 'Consultório ' + (m.nome || '')
    const infoClinica = [clinica?.telefone, clinica?.endereco].filter(Boolean).join(' · ')

    // Prioriza campo receita, senão extrai do plano
    const receitaTexto = c.receita && c.receita.trim() ? c.receita : (c.plano || '')

    let idade = ''
    if (p.data_nascimento) {
      const dn = new Date(p.data_nascimento)
      const n = new Date()
      let anos = n.getFullYear() - dn.getFullYear()
      if (n.getMonth() < dn.getMonth() || (n.getMonth() === dn.getMonth() && n.getDate() < dn.getDate())) anos--
      idade = ' · ' + anos + ' anos'
    }

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
<title>Receita Médica - ${p.nome || 'Paciente'}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;color:#111827;background:#F5F5F5;padding:40px 20px}
.page{max-width:780px;margin:0 auto;background:white;padding:48px 56px;box-shadow:0 2px 8px rgba(0,0,0,0.05);border-radius:8px;min-height:900px;display:flex;flex-direction:column}
@media print{
  body{background:white;padding:0}
  .page{max-width:none;margin:0;padding:32px 40px;box-shadow:none;border-radius:0;min-height:auto}
  .no-print{display:none !important}
}
.btn{position:fixed;top:20px;right:20px;padding:10px 20px;background:#6043C1;color:#fff;border:none;border-radius:10px;font-size:13px;cursor:pointer;font-weight:600;box-shadow:0 4px 12px rgba(96,67,193,0.3);z-index:100}
.header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:20px;border-bottom:3px solid #6043C1;margin-bottom:28px;gap:20px}
.clinic-block{flex:1}
.clinic-name{font-size:22px;font-weight:800;color:#111827;margin-bottom:6px;letter-spacing:-0.3px}
.clinic-info{font-size:11px;color:#6b7280;line-height:1.6}
.doc-type{text-align:right;flex-shrink:0}
.doc-type-label{font-size:10px;font-weight:700;color:#6043C1;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:3px}
.doc-type-title{font-size:18px;font-weight:800;color:#111827}
.doc-type-date{font-size:11px;color:#6b7280;margin-top:2px}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:32px}
.info-card{background:#F5F5F5;border-radius:10px;padding:14px 16px}
.info-label{font-size:9px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px}
.info-value{font-size:14px;font-weight:700;color:#111827;margin-bottom:3px}
.info-sub{font-size:11px;color:#6b7280;line-height:1.5}
.rx-label{font-size:11px;font-weight:700;color:#6043C1;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:14px;display:flex;align-items:center;gap:10px}
.rx-label::before{content:"℞";font-size:28px;font-family:serif;color:#6043C1}
.rx-content{font-size:15px;line-height:2;color:#111827;padding:20px 24px;background:#fafafa;border-left:4px solid #6043C1;border-radius:6px;white-space:pre-wrap;flex:1;min-height:280px}
.orientacoes{margin-top:20px;padding:14px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px}
.orientacoes-label{font-size:10px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px}
.orientacoes-text{font-size:12px;color:#92400e;line-height:1.6}
.footer{margin-top:48px;padding-top:24px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:flex-end;gap:32px}
.footer-left{font-size:10px;color:#9ca3af;line-height:1.6}
.assinatura{text-align:center;flex-shrink:0}
.assinatura-linha{border-top:1.5px solid #111;width:260px;margin:0 auto 8px}
.assinatura-nome{font-size:14px;font-weight:700;color:#111827}
.assinatura-crm{font-size:11px;color:#6b7280;margin-top:3px}
.assinatura-esp{font-size:11px;color:#6b7280;margin-top:1px}
</style>
</head><body>
<button class="btn no-print" onclick="window.print()">📄 Imprimir / Salvar PDF</button>

<div class="page">
  <div class="header">
    <div class="clinic-block">
      <div class="clinic-name">${nomeClinica}</div>
      ${infoClinica ? `<div class="clinic-info">${infoClinica}</div>` : ''}
    </div>
    <div class="doc-type">
      <div class="doc-type-label">Documento</div>
      <div class="doc-type-title">Receita Médica</div>
      <div class="doc-type-date">${hoje}</div>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-card">
      <div class="info-label">Paciente</div>
      <div class="info-value">${p.nome || 'Não informado'}${idade}</div>
      ${p.cpf ? `<div class="info-sub">CPF ${p.cpf}</div>` : ''}
    </div>
    <div class="info-card">
      <div class="info-label">Prescritor</div>
      <div class="info-value">${m.nome || ''}</div>
      <div class="info-sub">${[m.especialidade, m.crm ? 'CRM ' + m.crm : ''].filter(Boolean).join(' · ')}</div>
    </div>
  </div>

  <div class="rx-label">Prescrição</div>
  <div class="rx-content">${receitaTexto ? receitaTexto.replace(/</g, '&lt;') : 'Nenhuma prescrição registrada.'}</div>

  <div class="orientacoes">
    <div class="orientacoes-label">Orientações ao paciente</div>
    <div class="orientacoes-text">
      Use os medicamentos conforme a prescrição acima. Em caso de dúvidas, efeitos adversos ou piora dos sintomas, entre em contato com seu médico imediatamente. Guarde esta receita em local seguro.
    </div>
  </div>

  <div class="footer">
    <div class="footer-left">
      Documento gerado em ${hoje}<br>
      ID: ${consultaId.substring(0, 8).toUpperCase()}
    </div>
    <div class="assinatura">
      <div class="assinatura-linha"></div>
      <div class="assinatura-nome">${m.nome || ''}</div>
      ${m.especialidade ? `<div class="assinatura-esp">${m.especialidade}</div>` : ''}
      <div class="assinatura-crm">${m.crm ? 'CRM ' + m.crm : ''}</div>
    </div>
  </div>
</div>
</body></html>`

    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
