import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { medico, analise, contexto } = await req.json()
    const hoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })

    const renderValores = (analise.valores || []).map((v: any) => {
      const corStatus = v.status === "critico" ? "#dc2626" : v.status === "alterado" ? "#d97706" : "#059669"
      const bgStatus = v.status === "critico" ? "#fef2f2" : v.status === "alterado" ? "#fffbeb" : "#ecfdf5"
      return `<tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb">
          <div style="font-weight:600;color:#111;font-size:13px">${v.nome}</div>
          <div style="font-size:11px;color:#666;margin-top:2px">${v.interpretacao || ""}</div>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;white-space:nowrap">
          <div style="font-weight:700;color:${corStatus};font-size:14px">${v.valor}</div>
          <div style="font-size:10px;color:#9ca3af">Ref: ${v.referencia}</div>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center">
          <span style="display:inline-block;padding:3px 10px;border-radius:10px;background:${bgStatus};color:${corStatus};font-size:10px;font-weight:700;text-transform:uppercase">${v.status}</span>
        </td>
      </tr>`
    }).join("")

    const renderAlertas = (analise.alertas || []).length > 0
      ? `<div class="bloco alerta">
          <div class="label" style="color:#dc2626">⚠️ Achados importantes</div>
          <ul style="margin:0;padding-left:20px;color:#991b1b">
            ${(analise.alertas || []).map((a: string) => `<li style="margin:6px 0;font-size:13px;line-height:1.5">${a}</li>`).join("")}
          </ul>
        </div>`
      : ""

    const renderRecomendacoes = (analise.recomendacoes || []).length > 0
      ? `<div class="bloco recomendacoes">
          <div class="label">Recomendações</div>
          <ul style="margin:0;padding-left:20px">
            ${(analise.recomendacoes || []).map((r: string) => `<li style="margin:6px 0;font-size:13px;line-height:1.6;color:#4c2f9f">${r}</li>`).join("")}
          </ul>
        </div>`
      : ""

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/><title>Análise de Exame — ${analise.tipo || "Exame médico"}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;color:#111;padding:50px;max-width:780px;margin:0 auto;background:#fff}
@media print{.no-print{display:none!important}body{padding:30px}.bloco{break-inside:avoid}}
.btn{position:fixed;top:20px;right:20px;padding:10px 22px;background:#6043C1;color:#fff;border:none;border-radius:8px;font-size:13px;cursor:pointer;font-weight:600;box-shadow:0 4px 12px rgba(96,67,193,0.25)}
.header{border-bottom:2px solid #6043C1;padding-bottom:18px;margin-bottom:24px}
.clinica{font-size:13px;color:#6043C1;font-weight:700;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.05em}
.title{font-size:22px;font-weight:700;color:#111;margin-bottom:4px}
.subtitle{font-size:12px;color:#666}
.bloco{margin-bottom:22px}
.label{font-size:11px;font-weight:700;color:#9ca3af;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.06em}
.bloco.alerta{background:#fef2f2;border-left:4px solid #dc2626;padding:14px 18px;border-radius:6px}
.bloco.recomendacoes{background:#f5f3ff;padding:14px 18px;border-radius:6px}
.tabela{width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden}
.contexto{background:#f9fafb;padding:12px 14px;border-radius:6px;font-size:12px;color:#4b5563;border-left:3px solid #6043C1}
.conclusao{font-size:14px;line-height:1.7;color:#374151}
.aviso{margin-top:36px;padding:14px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;font-size:11px;color:#92400e;line-height:1.5}
.footer{margin-top:32px;padding-top:18px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:11px;color:#9ca3af}
</style></head><body>
<button class="btn no-print" onclick="window.print()">Imprimir / Salvar PDF</button>

<div class="header">
  <div class="clinica">${medico?.clinica || "Clínica MedIA"}</div>
  <div class="title">Análise de Exame</div>
  <div class="subtitle">Gerado em ${hoje} ${medico?.nome ? "• Dr(a). " + medico.nome : ""} ${medico?.crm ? "• CRM " + medico.crm : ""}</div>
</div>

<div class="bloco">
  <div class="label">Tipo de exame</div>
  <div style="font-size:18px;font-weight:700;color:#111">${analise.tipo || "Exame"}</div>
  ${analise.resumo ? `<div style="font-size:13px;color:#666;margin-top:6px;line-height:1.5">${analise.resumo}</div>` : ""}
</div>

${contexto ? `<div class="bloco">
  <div class="label">Contexto clínico</div>
  <div class="contexto">${contexto}</div>
</div>` : ""}

${renderAlertas}

${(analise.valores || []).length > 0 ? `<div class="bloco">
  <div class="label">Valores encontrados</div>
  <table class="tabela">${renderValores}</table>
</div>` : ""}

${analise.conclusao ? `<div class="bloco">
  <div class="label">Conclusão clínica</div>
  <div class="conclusao">${analise.conclusao}</div>
</div>` : ""}

${renderRecomendacoes}

<div class="aviso">
  <strong>Aviso importante:</strong> Este documento foi gerado por inteligência artificial a partir do exame enviado. Deve ser sempre revisado e validado por um profissional médico habilitado antes de qualquer decisão clínica.
</div>

<div class="footer">
  <div>${hoje}</div>
  <div>MedIA — Análise assistida por IA</div>
</div>
</body></html>`
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
