"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/Sidebar"

type Tab = "followup" | "confirmacao" | "nps" | "relatorio" | "pdf"

export default function AutomacoesPage() {
  const router = useRouter()
  const [medico, setMedico] = useState<any>(null)
  const [aba, setAba] = useState<Tab>("followup")
  const [carregando, setCarregando] = useState(false)
  const [resultado, setResultado] = useState<any>(null)
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null)

  useEffect(() => {
    const m = localStorage.getItem("medico")
    if (!m) { router.push("/login"); return }
    setMedico(JSON.parse(m))
  }, [router])

  const chamarAPI = async (endpoint: string, body: any) => {
    setCarregando(true)
    setMsg(null)
    setResultado(null)
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ medico_id: medico.id, ...body })
      })
      const data = await res.json()
      if (data.error) setMsg({ tipo: "erro", texto: data.error })
      else {
        setResultado(data)
        const total = data.enviados ?? data.total ?? null
        setMsg({ tipo: "ok", texto: total !== null ? `${total} mensagem${total !== 1 ? "s" : ""} enviada${total !== 1 ? "s" : ""} com sucesso` : "Concluído com sucesso" })
      }
    } catch {
      setMsg({ tipo: "erro", texto: "Erro de conexão" })
    } finally {
      setCarregando(false)
    }
  }

  const ABAS: { id: Tab; label: string; icon: string }[] = [
    { id: "followup", label: "Follow-up", icon: "↻" },
    { id: "confirmacao", label: "Confirmação", icon: "✓" },
    { id: "nps", label: "Avaliação NPS", icon: "★" },
    { id: "relatorio", label: "Relatório semanal", icon: "📋" },
    { id: "pdf", label: "Relatório PDF", icon: "⬇" },
  ]

  const card = (titulo: string, desc: string, cor: string, bg: string, border: string, acao: string, body: any, extra?: React.ReactNode) => (
    <div style={{ background: "white", borderRadius: 14, padding: "20px 24px", display: "flex", flexDirection: "column" as const, gap: 16 }}>
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>{titulo}</h3>
        <p style={{ fontSize: 13, color: "#6b7280", margin: 0, lineHeight: 1.6 }}>{desc}</p>
      </div>
      {extra}
      <button onClick={() => chamarAPI(acao, body)} disabled={carregando}
        style={{ alignSelf: "flex-start" as const, padding: "9px 20px", borderRadius: 8, border: "none", background: carregando ? "#b9a9ef" : cor, color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
        {carregando ? "Enviando..." : "Enviar agora"}
      </button>
    </div>
  )

  return (
    <div style={{ display: "flex", height: "100vh", background: "#F9FAFC", overflow: "hidden" }}>
      <Sidebar />
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        <div style={{ padding: "0 28px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <h1 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>Automações WhatsApp</h1>
            <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>Central de mensagens automáticas para seus pacientes</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#16a34a" }} />
            <span style={{ fontSize: 12, color: "#6b7280" }}>WhatsApp ativo</span>
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "0 24px 24px" }}>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 2, background: "#f3f4f6", borderRadius: 10, padding: 3, marginBottom: 20, width: "fit-content" }}>
            {ABAS.map(a => (
              <button key={a.id} onClick={() => { setAba(a.id); setResultado(null); setMsg(null) }}
                style={{ padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: aba === a.id ? 600 : 400, background: aba === a.id ? "white" : "transparent", color: aba === a.id ? "#111827" : "#6b7280", boxShadow: aba === a.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 14 }}>{a.icon}</span>
                {a.label}
              </button>
            ))}
          </div>

          {/* Feedback */}
          {msg && (
            <div style={{ padding: "10px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500, marginBottom: 16, background: msg.tipo === "ok" ? "#f0fdf4" : "#fef2f2", color: msg.tipo === "ok" ? "#16a34a" : "#dc2626", border: `1px solid ${msg.tipo === "ok" ? "#bbf7d0" : "#fecaca"}` }}>
              {msg.tipo === "ok" ? "✓" : "⚠"} {msg.texto}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 720 }}>

            {/* FOLLOW-UP */}
            {aba === "followup" && (<>
              {card(
                "Check-in de pacientes inativos",
                "Envia uma mensagem calorosa para pacientes que não tiveram contato há mais de 7 dias. A Sofia pergunta como estão se sentindo e oferece ajuda.",
                "#6043C1", "#f0ebff", "#d4c9f7",
                "/api/whatsapp-checkin",
                { dias_sem_contato: 7 }
              )}
              {card(
                "Follow-up pós-consulta (3 dias)",
                "Envia uma mensagem 3 dias após a consulta perguntando sobre a evolução do paciente. Se detectar piora, alerta o médico automaticamente.",
                "#0d9488", "#f0fdfa", "#99f6e4",
                "/api/whatsapp-checkin",
                { dias_sem_contato: 3 }
              )}
              {resultado?.enviados !== undefined && (
                <div style={{ background: "white", borderRadius: 12, padding: "16px 20px" }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#111827", margin: "0 0 8px" }}>Resultado</p>
                  <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>Pacientes contatados: <strong style={{ color: "#6043C1" }}>{resultado.enviados}</strong> de {resultado.total || resultado.enviados}</p>
                </div>
              )}
            </>)}

            {/* CONFIRMAÇÃO */}
            {aba === "confirmacao" && (<>
              {card(
                "Confirmar consultas das próximas 24h",
                "Envia mensagem de confirmação para todos os pacientes com consulta agendada nas próximas 24 horas. O paciente pode confirmar, remarcar ou cancelar diretamente pelo WhatsApp.",
                "#2563eb", "#eff6ff", "#bfdbfe",
                "/api/whatsapp-confirmacao",
                {}
              )}
              <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: "14px 18px" }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#92400e", margin: "0 0 4px" }}>Dica: configure um cron job</p>
                <p style={{ fontSize: 12, color: "#92400e", margin: 0, lineHeight: 1.6 }}>Para enviar automaticamente todo dia às 18h, configure um cron job apontando para <code style={{ background: "#fef3c7", padding: "1px 6px", borderRadius: 4, fontSize: 11 }}>POST /api/whatsapp-confirmacao</code> com seu medico_id.</p>
              </div>
            </>)}

            {/* NPS */}
            {aba === "nps" && (<>
              {card(
                "Enviar pesquisa de satisfação (NPS)",
                "Envia uma pesquisa de satisfação para pacientes atendidos hoje. O paciente avalia o atendimento de 0 a 10 diretamente pelo WhatsApp.",
                "#7c3aed", "#f5f3ff", "#ddd6fe",
                "/api/whatsapp-nps",
                {}
              )}
              {resultado && (
                <div style={{ background: "white", borderRadius: 12, padding: "16px 20px" }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#111827", margin: "0 0 8px" }}>Resultado</p>
                  <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>Pesquisas enviadas: <strong style={{ color: "#7c3aed" }}>{resultado.enviados ?? 0}</strong></p>
                </div>
              )}
            </>)}

            {/* PDF MENSAL */}
            {aba === "pdf" && (
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 14 }}>
                <div style={{ background: "white", borderRadius: 14, padding: "20px 24px" }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: "0 0 8px" }}>Relatório mensal completo em PDF</h3>
                  <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 16px", lineHeight: 1.6 }}>Gera um PDF completo do mês atual com consultas, crescimento, diagnósticos mais frequentes, próximos agendamentos e análise por IA. Ideal para arquivar ou compartilhar com a gestão da clínica.</p>
                  <button onClick={async () => {
                    if (!medico) return
                    setCarregando(true)
                    setMsg(null)
                    try {
                      const res = await fetch("/api/pdf-relatorio-mensal", {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ medico_id: medico.id })
                      })
                      if (res.ok) {
                        const html = await res.text()
                        const win = window.open("", "_blank")
                        if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 800) }
                        setMsg({ tipo: "ok", texto: "Relatório gerado com sucesso — use Ctrl+P para salvar como PDF" })
                      } else {
                        const d = await res.json()
                        setMsg({ tipo: "erro", texto: d.error })
                      }
                    } catch { setMsg({ tipo: "erro", texto: "Erro de conexão" }) }
                    finally { setCarregando(false) }
                  }} disabled={carregando}
                    style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: carregando ? "#b9a9ef" : "#6043C1", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    {carregando ? "Gerando..." : "Gerar relatório do mês"}
                  </button>
                </div>
                <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: "14px 18px" }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#92400e", margin: "0 0 4px" }}>Dica: relatório mensal automático</p>
                  <p style={{ fontSize: 12, color: "#92400e", margin: 0, lineHeight: 1.6 }}>Configure um cron job para gerar e enviar o relatório automaticamente no primeiro dia de cada mês. Endpoint: <code style={{ background: "#fef3c7", padding: "1px 6px", borderRadius: 4, fontSize: 11 }}>POST /api/pdf-relatorio-mensal</code></p>
                </div>
              </div>
            )}

            {/* RELATÓRIO */}
            {aba === "relatorio" && (<>
              {card(
                "Relatório semanal da clínica",
                "Gera e exibe um resumo da semana com consultas realizadas, alertas pendentes, próximos agendamentos e novos pacientes no WhatsApp.",
                "#d97706", "#fffbeb", "#fde68a",
                "/api/whatsapp-relatorio",
                {}
              )}
              {resultado?.periodo && (
                <div style={{ background: "white", borderRadius: 12, padding: "16px 20px", display: "flex", flexDirection: "column" as const, gap: 10 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#111827", margin: 0 }}>Relatório {resultado.periodo.inicio} – {resultado.periodo.fim}</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                    {[
                      { label: "Consultas", valor: resultado.consultas_semana ?? 0, cor: "#6043C1" },
                      { label: "Alertas pendentes", valor: resultado.alertas_pendentes?.length ?? 0, cor: "#dc2626" },
                      { label: "Novos no WhatsApp", valor: resultado.novos_pacientes_wpp ?? 0, cor: "#16a34a" },
                    ].map(m => (
                      <div key={m.label} style={{ background: "#f9fafb", borderRadius: 8, padding: "12px 14px", textAlign: "center" as const }}>
                        <p style={{ fontSize: 22, fontWeight: 800, color: m.cor, margin: "0 0 2px" }}>{m.valor}</p>
                        <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>{m.label}</p>
                      </div>
                    ))}
                  </div>
                  {resultado.resumo_ia && (
                    <div style={{ background: "#f0ebff", border: "1px solid #d4c9f7", borderRadius: 8, padding: "12px 14px" }}>
                      <p style={{ fontSize: 12, color: "#4c1d95", margin: 0, lineHeight: 1.6 }}>{resultado.resumo_ia}</p>
                    </div>
                  )}
                </div>
              )}
            </>)}

          </div>
        </div>
      </main>
    </div>
  )
}
