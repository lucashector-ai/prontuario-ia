
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { medico, paciente, atestado } = await req.json()
    const hoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/><title>Atestado Medico</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;color:#111;padding:60px;max-width:700px;margin:0 auto}
@media print{.no-print{display:none!important}body{padding:40px}}
.btn{position:fixed;top:20px;right:20px;padding:10px 20px;background:#1F9D5C;color:#fff;border:none;border-radius:8px;font-size:13px;cursor:pointer;font-weight:600}
.header{text-align:center;border-bottom:2px solid #111;padding-bottom:20px;margin-bottom:30px}
.title{font-size:18px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px}
.subtitle{font-size:12px;color:#555}
.body{font-size:14px;line-height:2;margin-bottom:40px}
.footer{display:flex;justify-content:space-between;align-items:flex-end;margin-top:60px}
.assinatura{text-align:center}
.linha{border-top:1.5px solid #111;width:220px;margin-bottom:8px}
</style></head><body>
<button class="btn no-print" onclick="window.print()">Imprimir / Salvar PDF</button>
<div class="header">
  <div class="title">Atestado Médico</div>
  <div class="subtitle">${medico?.clinica || ("Clínica " + medico?.nome)} ${medico?.crm ? "• CRM " + medico.crm : ""}</div>
</div>
<div class="body">
  <p>Atesto para os devidos fins que o(a) paciente <strong>${paciente?.nome || "Paciente"}</strong>
  ${atestado.cid ? ", portador(a) do CID " + atestado.cid + "," : ""}
  encontra-se sob meus cuidados médicos, necessitando de afastamento de suas atividades habituais
  pelo período de <strong>${atestado.dias} (${atestado.dias === 1 ? "um" : atestado.dias}) dia${atestado.dias > 1 ? "s" : ""}</strong>,
  a partir da data de hoje, ${hoje}.</p>
  <br/>
  ${atestado.motivo ? `<p><strong>Motivo:</strong> ${atestado.motivo}</p>` : ""}
  ${atestado.observacoes ? `<br/><p><strong>Observações:</strong> ${atestado.observacoes}</p>` : ""}
</div>
<div class="footer">
  <div style="font-size:11px;color:#9ca3af">${hoje}</div>
  <div class="assinatura">
    <div class="linha"></div>
    <div style="font-size:13px;font-weight:700">${medico?.nome || ""}</div>
    <div style="font-size:11px;color:#555">${medico?.especialidade || ""} ${medico?.crm ? "• CRM " + medico.crm : ""}</div>
  </div>
</div>
</body></html>`
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
