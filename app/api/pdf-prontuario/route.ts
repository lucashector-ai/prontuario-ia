import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const consultaId = req.nextUrl.searchParams.get('consulta_id')
    const medicoId = req.nextUrl.searchParams.get('medico_id')
    if (!consultaId || !medicoId) return NextResponse.json({ error: 'Parametros faltando' }, { status: 400 })

    const [{ data: consulta }, { data: medico }] = await Promise.all([
      supabase.from('consultas').select('*, pacientes(nome, data_nascimento, telefone, email, cpf)').eq('id', consultaId).single(),
      supabase.from('medicos').select('nome, crm, especialidade, telefone, clinica_id').eq('id', medicoId).single(),
    ])
    if (!consulta) return NextResponse.json({ error: 'Consulta nao encontrada' }, { status: 404 })
    if (!medico) return NextResponse.json({ error: 'Medico nao encontrado' }, { status: 404 })

    // Busca dados da clinica separadamente
    let clinica: any = null
    if ((medico as any).clinica_id) {
      const { data: c } = await supabase.from('clinicas').select('nome, telefone, endereco, email, logo_url').eq('id', (medico as any).clinica_id).single()
      clinica = c
    }

    const c = consulta as any
    const m = medico as any
    const p = c.pacientes || {}
    const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    const dataConsulta = c.criado_em ? new Date(c.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : hoje

    // Idade
    let idade = ''
    if (p.data_nascimento) {
      const dn = new Date(p.data_nascimento)
      const n = new Date()
      let anos = n.getFullYear() - dn.getFullYear()
      if (n.getMonth() < dn.getMonth() || (n.getMonth() === dn.getMonth() && n.getDate() < dn.getDate())) anos--
      idade = ' · ' + anos + ' anos'
    }

    const nomeClinica = (clinica && clinica.nome) || 'Consultório ' + (m.nome || '')
    const infoClinica = [clinica?.telefone, clinica?.endereco, clinica?.email].filter(Boolean).join(' · ')

    // Hipoteses diagnosticas
    const probCor = (p: string) => {
      const pp = (p || '').toLowerCase()
      if (pp === 'alta') return { bg: '#dcfce7', text: '#166534' }
      if (pp === 'media' || pp === 'média') return { bg: '#fef3c7', text: '#854d0e' }
      return { bg: '#f3f4f6', text: '#6b7280' }
    }
    const hipotesesHtml = (c.hipoteses || []).length > 0 ? `
      <div class="section">
        <div class="section-label">Hipóteses diagnósticas</div>
        <div class="hipoteses-list">
          ${c.hipoteses.map((h: any, i: number) => {
            const cor = probCor(h.probabilidade || '')
            return `
            <div class="hipotese-item">
              <div class="hipotese-header">
                <span class="hipotese-num">${i + 1}</span>
                <span class="hipotese-nome">${h.nome || ''}</span>
                ${h.probabilidade ? `<span class="hipotese-prob" style="background:${cor.bg};color:${cor.text}">${(h.probabilidade || '').toUpperCase()}</span>` : ''}
              </div>
              ${h.justificativa ? `<p class="hipotese-just">${h.justificativa}</p>` : ''}
            </div>
          `}).join('')}
        </div>
      </div>` : ''

    const cidsHtml = (c.cids || []).length > 0 ? `
      <div class="section">
        <div class="section-label">CID-10</div>
        <div class="cids-list">
          ${c.cids.map((x: any) => `
            <div class="cid-item">
              <span class="cid-code">${x.codigo}</span>
              <span class="cid-desc">${x.descricao || ''}</span>
            </div>
          `).join('')}
        </div>
      </div>` : ''

    const secao = (label: string, content: string) => content && content.trim() ? `
      <div class="section">
        <div class="section-label">${label}</div>
        <div class="section-content">${content.replace(/\n/g, '<br>')}</div>
      </div>` : ''

    const alertasHtml = (c.alertas || []).length > 0 ? `
      <div class="alertas">
        <div class="alertas-label">⚠ Alertas clínicos</div>
        ${c.alertas.map((a: string) => `<div class="alerta-item">${a}</div>`).join('')}
      </div>` : ''

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
<title>Prontuário - ${p.nome || 'Paciente'}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;color:#111827;background:#F5F5F5;padding:40px 20px}
.page{max-width:780px;margin:0 auto;background:white;padding:48px 56px;box-shadow:0 2px 8px rgba(0,0,0,0.05);border-radius:8px}
@media print{
  body{background:white;padding:0}
  .page{max-width:none;margin:0;padding:32px 40px;box-shadow:none;border-radius:0}
  .no-print{display:none !important}
}
.btn{position:fixed;top:20px;right:20px;padding:10px 20px;background:#6043C1;color:#fff;border:none;border-radius:10px;font-size:13px;cursor:pointer;font-weight:600;box-shadow:0 4px 12px rgba(96,67,193,0.3);z-index:100}
.header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:20px;border-bottom:3px solid #6043C1;margin-bottom:28px;gap:20px}
.clinic-block{flex:1}
.clinic-name{font-size:22px;font-weight:800;color:#111827;margin-bottom:6px;letter-spacing:-0.3px}
.clinic-info{font-size:11px;color:#6b7280;line-height:1.6}
.doc-type{text-align:right;flex-shrink:0}
.doc-type-label{font-size:10px;font-weight:700;color:#6043C1;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:3px}
.doc-type-title{font-size:16px;font-weight:700;color:#111827}
.doc-type-date{font-size:11px;color:#6b7280;margin-top:2px}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:28px}
.info-card{background:#F5F5F5;border-radius:10px;padding:14px 16px}
.info-label{font-size:9px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px}
.info-value{font-size:14px;font-weight:700;color:#111827;margin-bottom:3px}
.info-sub{font-size:11px;color:#6b7280;line-height:1.5}
.section{margin-bottom:18px;page-break-inside:avoid}
.section-label{font-size:10px;font-weight:700;color:#6043C1;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px}
.section-content{font-size:13px;line-height:1.75;color:#111827;padding:14px 16px;background:#fafafa;border-left:3px solid #6043C1;border-radius:6px}
.cids-list{display:flex;flex-direction:column;gap:6px}
.cid-item{display:flex;gap:12px;align-items:center;padding:8px 12px;background:#ede9fb;border-radius:8px}
.cid-code{font-family:monospace;font-weight:700;font-size:12px;color:#6043C1;background:white;padding:3px 8px;border-radius:5px;flex-shrink:0}
.cid-desc{font-size:12px;color:#374151}
.hipoteses-list{display:flex;flex-direction:column;gap:10px}
.hipotese-item{padding:10px 12px;background:#fafafa;border-radius:8px;border-left:3px solid #6043C1}
.hipotese-header{display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap}
.hipotese-num{width:20px;height:20px;border-radius:50%;background:#ede9fb;color:#6043C1;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0}
.hipotese-nome{font-size:13px;font-weight:700;color:#111827}
.hipotese-prob{font-size:9px;font-weight:700;padding:2px 8px;border-radius:10px;letter-spacing:0.04em}
.hipotese-just{font-size:11px;color:#6b7280;margin:4px 0 0 28px;line-height:1.5}
.alertas{background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px 16px;margin-bottom:20px}
.alertas-label{font-size:11px;font-weight:700;color:#991b1b;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px}
.alerta-item{font-size:12px;color:#991b1b;line-height:1.6;padding:4px 0}
.footer{margin-top:48px;padding-top:24px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:flex-end;gap:32px}
.footer-left{font-size:10px;color:#9ca3af;line-height:1.6}
.assinatura{text-align:center;flex-shrink:0}
.assinatura-linha{border-top:1.5px solid #111;width:240px;margin:0 auto 8px}
.assinatura-nome{font-size:13px;font-weight:700;color:#111827}
.assinatura-crm{font-size:11px;color:#6b7280;margin-top:2px}
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
      <div class="doc-type-title">Prontuário Clínico</div>
      <div class="doc-type-date">${dataConsulta}</div>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-card">
      <div class="info-label">Paciente</div>
      <div class="info-value">${p.nome || 'Não informado'}${idade}</div>
      <div class="info-sub">${[p.cpf ? 'CPF ' + p.cpf : '', p.telefone].filter(Boolean).join(' · ')}</div>
    </div>
    <div class="info-card">
      <div class="info-label">Profissional</div>
      <div class="info-value">${m.nome || ''}</div>
      <div class="info-sub">${[m.especialidade, m.crm ? 'CRM ' + m.crm : ''].filter(Boolean).join(' · ')}</div>
    </div>
  </div>

  ${alertasHtml}

  ${secao('Subjetivo (queixa e história)', c.subjetivo || '')}
  ${secao('Objetivo (exame físico)', c.objetivo || '')}
  ${secao('Avaliação (hipóteses diagnósticas)', c.avaliacao || '')}
  ${secao('Plano (conduta)', c.plano || '')}

  ${hipotesesHtml}
  ${cidsHtml}

  <div class="footer">
    <div class="footer-left">
      Documento gerado em ${hoje}<br>
      ID: ${consultaId.substring(0, 8).toUpperCase()}
    </div>
    <div class="assinatura">
      <div class="assinatura-linha"></div>
      <div class="assinatura-nome">${m.nome || ''}</div>
      <div class="assinatura-crm">${[m.especialidade, m.crm ? 'CRM ' + m.crm : ''].filter(Boolean).join(' · ')}</div>
    </div>
  </div>
</div>
</body></html>`

    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
