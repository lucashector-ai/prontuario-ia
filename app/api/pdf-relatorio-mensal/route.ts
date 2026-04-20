
import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { medico_id } = await req.json()
    if (!medico_id) return NextResponse.json({ error: "medico_id obrigatorio" }, { status: 400 })

    const agora = new Date()
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1)
    const fimMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0)
    const mesAnteriorInicio = new Date(agora.getFullYear(), agora.getMonth() - 1, 1)
    const mesAnteriorFim = new Date(agora.getFullYear(), agora.getMonth(), 0)

    const nomeMes = agora.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })

    const [
      { data: medico },
      { data: consultasMes },
      { data: consultasMesAnterior },
      { data: pacientes },
      { data: todasConsultas },
      { data: agendamentos },
    ] = await Promise.all([
      supabase.from("medicos").select("nome, crm, especialidade, clinica").eq("id", medico_id).single(),
      supabase.from("consultas").select("id, criado_em, paciente_id, cids, subjetivo, avaliacao").eq("medico_id", medico_id).gte("criado_em", inicioMes.toISOString()).lte("criado_em", fimMes.toISOString()),
      supabase.from("consultas").select("id").eq("medico_id", medico_id).gte("criado_em", mesAnteriorInicio.toISOString()).lte("criado_em", mesAnteriorFim.toISOString()),
      supabase.from("pacientes").select("id, nome, criado_em").eq("medico_id", medico_id),
      supabase.from("consultas").select("cids").eq("medico_id", medico_id),
      supabase.from("agendamentos").select("id, data_hora, status, motivo, pacientes(nome)").eq("medico_id", medico_id).gte("data_hora", agora.toISOString()).order("data_hora").limit(10),
    ])

    const m = medico as any
    const consultas = consultasMes || []
    const totalMes = consultas.length
    const totalAnterior = (consultasMesAnterior || []).length
    const crescimento = totalAnterior > 0 ? Math.round(((totalMes - totalAnterior) / totalAnterior) * 100) : totalMes > 0 ? 100 : 0

    const pacientesUnicosSet = new Set(consultas.map((c: any) => c.paciente_id).filter(Boolean))
    const novosPacientes = (pacientes || []).filter((p: any) => new Date(p.criado_em) >= inicioMes).length

    const cidMap: Record<string, { codigo: string; descricao: string; total: number }> = {}
    ;(todasConsultas || []).forEach((c: any) => {
      (c.cids || []).forEach((cid: any) => {
        if (!cidMap[cid.codigo]) cidMap[cid.codigo] = { codigo: cid.codigo, descricao: cid.descricao, total: 0 }
        cidMap[cid.codigo].total++
      })
    })
    const topCids = Object.values(cidMap).sort((a, b) => b.total - a.total).slice(0, 5)

    const proxAgendamentos = (agendamentos || []).slice(0, 8)

    // Resumo com IA
    const prompt = `Voce e um assistente medico. Gere um resumo executivo mensal conciso para o medico. Use paragrafos curtos. Maximo 150 palavras. Seja objetivo e destaque o mais importante.

Dados do mes de ${nomeMes}:
- Consultas realizadas: ${totalMes} (${crescimento >= 0 ? "+" : ""}${crescimento}% vs mes anterior)
- Pacientes atendidos: ${pacientesUnicosSet.size}
- Novos pacientes: ${novosPacientes}
- Diagnosticos mais frequentes: ${topCids.slice(0, 3).map(c => c.descricao).join(", ") || "sem dados"}

Destaque pontos positivos, alertas e sugestoes para o proximo mes.`

    const res = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514", max_tokens: 250,
      messages: [{ role: "user", content: prompt }]
    })
    const resumoIA = res.content[0].type === "text" ? res.content[0].text : ""

    const hoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })

    const linhasCID = topCids.map(c => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6">
          <span style="font-family:monospace;font-size:11px;font-weight:700;color:#6043C1;background:#f0ebff;padding:2px 8px;border-radius:4px">${c.codigo}</span>
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#374151">${c.descricao}</td>
        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;font-weight:700;color:#111827;text-align:right">${c.total}x</td>
      </tr>`).join("")

    const linhasAgenda = proxAgendamentos.map((a: any) => {
      const data = new Date(a.data_hora).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
      return `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#374151">${data}</td>
        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#111827">${(a.pacientes as any)?.nome || "—"}</td>
        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#6b7280">${a.motivo || "Consulta"}</td>
        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:11px;font-weight:600;color:${a.status === "confirmado" ? "#16a34a" : "#6043C1"};text-align:right">${a.status}</td>
      </tr>`}).join("")

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
<title>Relatório Mensal — ${nomeMes}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;color:#111827;background:#fff;padding:40px;max-width:820px;margin:0 auto}
@media print{.no-print{display:none!important}}
.btn{position:fixed;top:20px;right:20px;padding:10px 20px;background:#6043C1;color:#fff;border:none;border-radius:8px;font-size:13px;cursor:pointer;font-weight:600}
.header{background:#6043C1;color:white;padding:28px 32px;border-radius:12px;margin-bottom:28px}
.header-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px}
.clinic{font-size:20px;font-weight:700}
.periodo{font-size:13px;opacity:0.8;margin-top:4px}
.medico-info{text-align:right;font-size:12px;opacity:0.8}
.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
.metric{background:#F5F5F5;border:1px solid #e5e7eb;border-radius:10px;padding:16px}
.metric-label{font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px}
.metric-value{font-size:26px;font-weight:800;color:#111827}
.metric-sub{font-size:11px;margin-top:4px;font-weight:600}
.section{margin-bottom:24px}
.section-title{font-size:14px;font-weight:700;color:#111827;border-bottom:2px solid #6043C1;padding-bottom:8px;margin-bottom:14px}
.ia-box{background:#f0ebff;border:1px solid #d4c9f7;border-radius:10px;padding:16px;font-size:13px;color:#3C3489;line-height:1.7}
table{width:100%;border-collapse:collapse}
.footer{margin-top:40px;display:flex;justify-content:space-between;align-items:center;padding-top:16px;border-top:1px solid #e5e7eb}
.footer-text{font-size:11px;color:#9ca3af}
.assinatura{text-align:center}
.assinatura-linha{border-top:1.5px solid #111;width:180px;margin-bottom:6px}
</style></head><body>
<button class="btn no-print" onclick="window.print()">Imprimir / Salvar PDF</button>

<div class="header">
  <div class="header-top">
    <div>
      <div class="clinic">${m?.clinica || "MedIA"}</div>
      <div class="periodo">Relatório mensal · ${nomeMes}</div>
    </div>
    <div class="medico-info">
      <div>${m?.nome || ""}</div>
      <div>${m?.especialidade || ""} ${m?.crm ? "· CRM " + m.crm : ""}</div>
      <div>Gerado em ${hoje}</div>
    </div>
  </div>
</div>

<div class="metrics">
  <div class="metric">
    <div class="metric-label">Consultas</div>
    <div class="metric-value">${totalMes}</div>
    <div class="metric-sub" style="color:${crescimento >= 0 ? "#16a34a" : "#dc2626"}">${crescimento >= 0 ? "+" : ""}${crescimento}% vs mês anterior</div>
  </div>
  <div class="metric">
    <div class="metric-label">Pacientes atendidos</div>
    <div class="metric-value">${pacientesUnicosSet.size}</div>
    <div class="metric-sub" style="color:#6b7280">pacientes únicos</div>
  </div>
  <div class="metric">
    <div class="metric-label">Novos pacientes</div>
    <div class="metric-value">${novosPacientes}</div>
    <div class="metric-sub" style="color:#6b7280">cadastrados este mês</div>
  </div>
  <div class="metric">
    <div class="metric-label">Total pacientes</div>
    <div class="metric-value">${(pacientes || []).length}</div>
    <div class="metric-sub" style="color:#6b7280">na clínica</div>
  </div>
</div>

<div class="section">
  <div class="section-title">Análise do mês — IA</div>
  <div class="ia-box">${resumoIA.split(String.fromCharCode(10)).join("<br/>")}</div>
/g, "<br/>")}</div>
</div>

${topCids.length > 0 ? `
<div class="section">
  <div class="section-title">Diagnósticos mais frequentes</div>
  <table><tbody>${linhasCID}</tbody></table>
</div>` : ""}

${proxAgendamentos.length > 0 ? `
<div class="section">
  <div class="section-title">Próximos agendamentos</div>
  <table>
    <thead><tr>
      <th style="text-align:left;font-size:11px;color:#9ca3af;font-weight:600;padding-bottom:8px">Data</th>
      <th style="text-align:left;font-size:11px;color:#9ca3af;font-weight:600;padding-bottom:8px">Paciente</th>
      <th style="text-align:left;font-size:11px;color:#9ca3af;font-weight:600;padding-bottom:8px">Motivo</th>
      <th style="text-align:right;font-size:11px;color:#9ca3af;font-weight:600;padding-bottom:8px">Status</th>
    </tr></thead>
    <tbody>${linhasAgenda}</tbody>
  </table>
</div>` : ""}

<div class="footer">
  <div class="footer-text">MedIA · Relatório gerado automaticamente · ${hoje}</div>
  <div class="assinatura">
    <div class="assinatura-linha"></div>
    <div style="font-size:12px;font-weight:700">${m?.nome || ""}</div>
    <div style="font-size:11px;color:#6b7280">${m?.crm ? "CRM " + m.crm : ""}</div>
  </div>
</div>
</body></html>`

    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
