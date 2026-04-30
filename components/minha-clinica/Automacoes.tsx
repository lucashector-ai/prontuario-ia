"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

const ACCENT = "#6043C1"
const ACCENT_LIGHT = "#ede9fb"
const BG = "#F5F5F5"
const CARD_RADIUS = 16

type Tab = "followup" | "confirmacao" | "nps" | "relatorio" | "pdf"

export function Automacoes() {
  const router = useRouter()
  const [medico, setMedico] = useState<any>(null)
  const [aba, setAba] = useState<Tab>("followup")
  const [carregando, setCarregando] = useState(false)
  const [resultado, setResultado] = useState<any>(null)
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null)

  useEffect(() => {
    const ca_ = localStorage.getItem("clinica_admin")
    const m = ca_ || localStorage.getItem("medico")
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

  const ABAS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "followup", label: "Follow-up", icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
        <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
      </svg>
    )},
    { id: "confirmacao", label: "Confirmação", icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    )},
    { id: "nps", label: "Avaliação NPS", icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    )},
    { id: "relatorio", label: "Relatório semanal", icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    )},
    { id: "pdf", label: "Relatório PDF", icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
    )},
  ]

  const h3Style: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: "#111827", margin: "0 0 4px" }
  const pDescStyle: React.CSSProperties = { fontSize: 13, color: "#6b7280", margin: 0, lineHeight: 1.6 }

  const card = (titulo: string, desc: string, acao: string, body: any, extra?: React.ReactNode) => (
    <div style={{ background: "white", borderRadius: CARD_RADIUS, padding: 24, display: "flex", flexDirection: "column" as const, gap: 16 }}>
      <div>
        <h3 style={h3Style}>{titulo}</h3>
        <p style={pDescStyle}>{desc}</p>
      </div>
      {extra}
      <button onClick={() => chamarAPI(acao, body)} disabled={carregando}
        style={{
          alignSelf: "flex-start" as const, padding: "10px 20px", borderRadius: 10, border: "none",
          background: carregando ? "#9ca3af" : ACCENT, color: "white",
          fontSize: 13, fontWeight: 600, cursor: carregando ? "not-allowed" : "pointer",
        }}>
        {carregando ? "Enviando..." : "Enviar agora"}
      </button>
    </div>
  )

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>Automações</h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>Mensagens e relatórios automáticos pra seus pacientes via WhatsApp</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: "white", borderRadius: 20 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#16a34a" }} />
          <span style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>WhatsApp ativo</span>
        </div>
      </div>

      {/* Toast flutuante */}
      {msg && (
        <div style={{
          position: "fixed", top: 24, right: 24, zIndex: 200,
          padding: "12px 20px", borderRadius: 10,
          background: msg.tipo === "ok" ? "#ecfdf5" : "#fef2f2",
          color: msg.tipo === "ok" ? "#065f46" : "#991b1b",
          fontSize: 13, fontWeight: 600,
          border: `1px solid ${msg.tipo === "ok" ? "#a7f3d0" : "#fecaca"}`,
          boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
          maxWidth: 400,
        }}>
          {msg.texto}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, background: "white", borderRadius: 12, padding: 4, marginBottom: 20, width: "fit-content" }}>
        {ABAS.map(a => (
          <button key={a.id} onClick={() => { setAba(a.id); setResultado(null); setMsg(null) }}
            style={{
              padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: aba === a.id ? 600 : 500,
              background: aba === a.id ? ACCENT_LIGHT : "transparent",
              color: aba === a.id ? ACCENT : "#6b7280",
              display: "flex", alignItems: "center", gap: 8,
              transition: "all 0.12s",
            }}>
            {a.icon}
            {a.label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column" as const, gap: 16, maxWidth: 760 }}>

        {/* FOLLOW-UP */}
        {aba === "followup" && (<>
          {card(
            "Check-in de pacientes inativos",
            "Envia uma mensagem calorosa para pacientes que não tiveram contato há mais de 7 dias. A Sofia pergunta como estão se sentindo e oferece ajuda.",
            "/api/whatsapp-checkin",
            { dias_sem_contato: 7 }
          )}
          {card(
            "Follow-up pós-consulta (3 dias)",
            "Envia uma mensagem 3 dias após a consulta perguntando sobre a evolução do paciente. Se detectar piora, alerta o médico automaticamente.",
            "/api/whatsapp-checkin",
            { dias_sem_contato: 3 }
          )}
          {resultado?.enviados !== undefined && (
            <div style={{ background: "white", borderRadius: CARD_RADIUS, padding: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#111827", margin: "0 0 8px" }}>Resultado</p>
              <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>Pacientes contatados: <strong style={{ color: ACCENT }}>{resultado.enviados}</strong> de {resultado.total || resultado.enviados}</p>
            </div>
          )}
        </>)}

        {/* CONFIRMAÇÃO */}
        {aba === "confirmacao" && (<>
          {card(
            "Confirmar consultas das próximas 24h",
            "Envia mensagem de confirmação para todos os pacientes com consulta agendada nas próximas 24 horas. O paciente pode confirmar, remarcar ou cancelar diretamente pelo WhatsApp.",
            "/api/whatsapp-confirmacao",
            {}
          )}
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: CARD_RADIUS, padding: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#92400e", margin: "0 0 6px" }}>Dica — configure um cron job</p>
            <p style={{ fontSize: 12, color: "#92400e", margin: 0, lineHeight: 1.6 }}>
              Para enviar automaticamente todo dia às 18h, configure um cron job apontando para <code style={{ background: "#fef3c7", padding: "1px 6px", borderRadius: 4, fontSize: 11 }}>POST /api/whatsapp-confirmacao</code> com seu medico_id.
            </p>
          </div>
        </>)}

        {/* NPS */}
        {aba === "nps" && (<>
          {card(
            "Enviar pesquisa de satisfação (NPS)",
            "Envia uma pesquisa de satisfação para pacientes atendidos hoje. O paciente avalia o atendimento de 0 a 10 diretamente pelo WhatsApp.",
            "/api/whatsapp-nps",
            {}
          )}
          {resultado && (
            <div style={{ background: "white", borderRadius: CARD_RADIUS, padding: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#111827", margin: "0 0 8px" }}>Resultado</p>
              <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>Pesquisas enviadas: <strong style={{ color: ACCENT }}>{resultado.enviados ?? 0}</strong></p>
            </div>
          )}
        </>)}

        {/* PDF MENSAL */}
        {aba === "pdf" && (<>
          <div style={{ background: "white", borderRadius: CARD_RADIUS, padding: 24 }}>
            <h3 style={h3Style}>Relatório mensal completo em PDF</h3>
            <p style={{ ...pDescStyle, marginBottom: 16 }}>
              Gera um PDF completo do mês atual com consultas, crescimento, diagnósticos mais frequentes, próximos agendamentos e análise por IA. Ideal para arquivar ou compartilhar com a gestão da clínica.
            </p>
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
                  setMsg({ tipo: "ok", texto: "Relatório gerado — use Ctrl+P para salvar como PDF" })
                } else {
                  const d = await res.json()
                  setMsg({ tipo: "erro", texto: d.error })
                }
              } catch { setMsg({ tipo: "erro", texto: "Erro de conexão" }) }
              finally { setCarregando(false) }
            }} disabled={carregando}
              style={{
                padding: "10px 20px", borderRadius: 10, border: "none",
                background: carregando ? "#9ca3af" : ACCENT, color: "white",
                fontSize: 13, fontWeight: 600, cursor: carregando ? "not-allowed" : "pointer",
              }}>
              {carregando ? "Gerando..." : "Gerar relatório do mês"}
            </button>
          </div>
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: CARD_RADIUS, padding: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#92400e", margin: "0 0 6px" }}>Dica — relatório mensal automático</p>
            <p style={{ fontSize: 12, color: "#92400e", margin: 0, lineHeight: 1.6 }}>
              Configure um cron job para gerar e enviar o relatório automaticamente no primeiro dia de cada mês. Endpoint: <code style={{ background: "#fef3c7", padding: "1px 6px", borderRadius: 4, fontSize: 11 }}>POST /api/pdf-relatorio-mensal</code>
            </p>
          </div>
        </>)}

        {/* RELATÓRIO SEMANAL */}
        {aba === "relatorio" && (<>
          {card(
            "Relatório semanal da clínica",
            "Gera e exibe um resumo da semana com consultas realizadas, alertas pendentes, próximos agendamentos e novos pacientes no WhatsApp.",
            "/api/whatsapp-relatorio",
            {}
          )}
          {resultado?.periodo && (
            <div style={{ background: "white", borderRadius: CARD_RADIUS, padding: 24, display: "flex", flexDirection: "column" as const, gap: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#111827", margin: 0 }}>Período {resultado.periodo.inicio} — {resultado.periodo.fim}</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                {[
                  { label: "Consultas", valor: resultado.consultas_semana ?? 0, cor: ACCENT },
                  { label: "Alertas pendentes", valor: resultado.alertas_pendentes?.length ?? 0, cor: "#dc2626" },
                  { label: "Novos no WhatsApp", valor: resultado.novos_pacientes_wpp ?? 0, cor: "#16a34a" },
                ].map(m => (
                  <div key={m.label} style={{ background: "#F5F5F5", borderRadius: 12, padding: "16px 14px", textAlign: "center" as const }}>
                    <p style={{ fontSize: 22, fontWeight: 800, color: m.cor, margin: "0 0 4px", lineHeight: 1 }}>{m.valor}</p>
                    <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>{m.label}</p>
                  </div>
                ))}
              </div>
              {resultado.resumo_ia && (
                <div style={{ background: ACCENT_LIGHT, borderRadius: 12, padding: "14px 16px" }}>
                  <p style={{ fontSize: 12, color: "#4c1d95", margin: 0, lineHeight: 1.6 }}>{resultado.resumo_ia}</p>
                </div>
              )}
            </div>
          )}
        </>)}

      </div>
    </div>
  )
}
