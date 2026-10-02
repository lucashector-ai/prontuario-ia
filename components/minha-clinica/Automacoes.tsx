"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import { RefreshCw, CalendarCheck, Star, FileText, FileDown, Send, Lightbulb, Check, Sparkles, Clock, UserRoundCheck } from "lucide-react"
import { tokens } from '@/lib/design-tokens'
import { Badge, Button, Card, Icon, IconTile, SegmentedControl } from '@/components/ui'
import { ConfiguracaoConfirmacoes } from '@/components/confirmacoes/ConfiguracaoConfirmacoes'

const T = tokens

type Tab = "followup" | "confirmacao" | "nps" | "relatorio" | "pdf"

export function Automacoes() {
  const router = useRouter()
  const [medico, setMedico] = useState<any>(null)
  const [aba, setAba] = useState<Tab>("followup")
  // ?demo=1 abre direto em Confirmações (para demonstração)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("demo") === "1") setAba("confirmacao")
  }, [])
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

  const ABAS: { id: Tab; label: string; icon: LucideIcon }[] = [
    { id: "followup", label: "Follow-up", icon: RefreshCw },
    { id: "confirmacao", label: "Confirmações", icon: CalendarCheck },
    { id: "nps", label: "Avaliação NPS", icon: Star },
    { id: "relatorio", label: "Relatório semanal", icon: FileText },
    { id: "pdf", label: "Relatório PDF", icon: FileDown },
  ]

  const card = (titulo: string, desc: string, acao: string, body: any, icon: LucideIcon, cor: string) => (
    <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <IconTile icon={icon} color={cor} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: "-.01em", color: T.text.primary }}>{titulo}</h3>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: T.text.secondary, lineHeight: 1.55 }}>{desc}</p>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button icon={Send} onClick={() => chamarAPI(acao, body)} disabled={carregando}>
          {carregando ? "Enviando…" : "Enviar agora"}
        </Button>
      </div>
    </Card>
  )

  const dica = (titulo: string, children: React.ReactNode) => (
    <div style={{ display: "flex", gap: 12, padding: "14px 16px", borderRadius: 16, border: `1px solid ${T.border.default}`, background: T.bg.page }}>
      <span style={{ color: T.status.warning, display: "inline-grid", paddingTop: 1 }}><Icon icon={Lightbulb} size={16} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: T.text.strong, margin: "0 0 4px" }}>{titulo}</p>
        <p style={{ fontSize: 12.5, color: T.text.secondary, margin: 0, lineHeight: 1.55 }}>{children}</p>
      </div>
    </div>
  )

  const codigo = (txt: string) => (
    <code className="mono" style={{ background: "#fff", border: `1px solid ${T.border.default}`, padding: "1px 6px", borderRadius: 6, fontSize: 11.5, color: T.text.strong }}>{txt}</code>
  )

  const resultadoCard = (rotulo: string, valor: React.ReactNode) => (
    <Card titulo="Resultado">
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: T.text.secondary }}>
        <IconTile icon={UserRoundCheck} color={T.data.green} size={32} radius={10} />
        <span>{rotulo}: <strong style={{ color: T.text.primary }}>{valor}</strong></span>
      </div>
    </Card>
  )

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Toast flutuante */}
      {msg && (
        <div style={{
          position: "fixed", top: 24, right: 24, zIndex: 200, maxWidth: 400,
          padding: "11px 16px", borderRadius: 12, display: "flex", alignItems: "center", gap: 8,
          background: "#fff", border: `1px solid ${T.border.default}`, boxShadow: T.shadow.lg,
          color: msg.tipo === "ok" ? T.status.success : T.status.danger, fontSize: 13, fontWeight: 600,
        }}>
          {msg.tipo === "ok" && <Icon icon={Check} size={15} />}
          {msg.texto}
        </div>
      )}

      {/* Sub-navegação + status */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 0, overflowX: "auto", scrollbarWidth: "none" }}>
          <SegmentedControl
            value={aba}
            onChange={(v) => { setAba(v); setResultado(null); setMsg(null) }}
            options={ABAS.map(a => ({
              value: a.id,
              label: <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon icon={a.icon} size={14} />{a.label}</span>,
            }))}
          />
        </div>
        <Badge tone="success" dot>WhatsApp ativo</Badge>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 760 }}>

        {/* FOLLOW-UP */}
        {aba === "followup" && (<>
          {card(
            "Check-in de pacientes inativos",
            "Envia uma mensagem calorosa para pacientes que não tiveram contato há mais de 7 dias. A Sofia pergunta como estão se sentindo e oferece ajuda.",
            "/api/whatsapp-checkin",
            { dias_sem_contato: 7 },
            RefreshCw, T.data.purple,
          )}
          {card(
            "Follow-up pós-consulta (3 dias)",
            "Envia uma mensagem 3 dias após a consulta perguntando sobre a evolução do paciente. Se detectar piora, alerta o médico automaticamente.",
            "/api/whatsapp-checkin",
            { dias_sem_contato: 3 },
            Clock, T.data.blue,
          )}
          {resultado?.enviados !== undefined && resultadoCard(
            "Pacientes contatados",
            <>{resultado.enviados} de {resultado.total || resultado.enviados}</>,
          )}
        </>)}

        {/* CONFIRMAÇÃO */}
        {aba === "confirmacao" && (<>
          <ConfiguracaoConfirmacoes />
          {card(
            "Enviar confirmações agora",
            "Dispara na hora a mensagem de confirmação para os pacientes com consulta nas próximas 24 horas, sem esperar o envio automático.",
            "/api/whatsapp-confirmacao",
            {},
            CalendarCheck, T.data.green,
          )}
        </>)}

        {/* NPS */}
        {aba === "nps" && (<>
          {card(
            "Enviar pesquisa de satisfação (NPS)",
            "Envia uma pesquisa de satisfação para pacientes atendidos hoje. O paciente avalia o atendimento de 0 a 10 diretamente pelo WhatsApp.",
            "/api/whatsapp-nps",
            {},
            Star, T.data.orange,
          )}
          {resultado && resultadoCard("Pesquisas enviadas", resultado.enviados ?? 0)}
        </>)}

        {/* PDF MENSAL */}
        {aba === "pdf" && (<>
          <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <IconTile icon={FileDown} color={T.data.pink} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: "-.01em", color: T.text.primary }}>Relatório mensal completo em PDF</h3>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: T.text.secondary, lineHeight: 1.55 }}>
                  Gera um PDF completo do mês atual com consultas, crescimento, diagnósticos mais frequentes, próximos agendamentos e análise por IA. Ideal para arquivar ou compartilhar com a gestão da clínica.
                </p>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button icon={FileDown} onClick={async () => {
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
            }} disabled={carregando}>
                {carregando ? "Gerando…" : "Gerar relatório do mês"}
              </Button>
            </div>
          </Card>
          {dica("Dica — relatório mensal automático", <>
            Configure um cron job para gerar e enviar o relatório automaticamente no primeiro dia de cada mês. Endpoint: {codigo("POST /api/pdf-relatorio-mensal")}
          </>)}
        </>)}

        {/* RELATÓRIO SEMANAL */}
        {aba === "relatorio" && (<>
          {card(
            "Relatório semanal da clínica",
            "Gera e exibe um resumo da semana com consultas realizadas, alertas pendentes, próximos agendamentos e novos pacientes no WhatsApp.",
            "/api/whatsapp-relatorio",
            {},
            FileText, T.data.purple,
          )}
          {resultado?.periodo && (
            <Card titulo={`Período ${resultado.periodo.inicio} — ${resultado.periodo.fim}`} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
                {[
                  { label: "Consultas", valor: resultado.consultas_semana ?? 0, cor: T.data.purple },
                  { label: "Alertas pendentes", valor: resultado.alertas_pendentes?.length ?? 0, cor: T.status.danger },
                  { label: "Novos no WhatsApp", valor: resultado.novos_pacientes_wpp ?? 0, cor: T.data.green },
                ].map(m => (
                  <div key={m.label} style={{ border: `1px solid ${T.border.default}`, borderRadius: 12, padding: "14px 14px" }}>
                    <p style={{ fontSize: 12.5, fontWeight: 600, color: T.text.secondary, margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: m.cor }} />{m.label}
                    </p>
                    <p style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-.03em", color: T.text.primary, margin: "8px 0 0", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{m.valor}</p>
                  </div>
                ))}
              </div>
              {resultado.resumo_ia && (
                <div style={{ marginTop: 10, display: "flex", gap: 10, background: T.brand.primarySoftBg, border: `1px solid ${T.brand.primaryAccentLight}`, borderRadius: 12, padding: "12px 14px" }}>
                  <span style={{ color: T.brand.primary, display: "inline-grid", paddingTop: 1 }}><Icon icon={Sparkles} size={15} /></span>
                  <p style={{ fontSize: 13, color: T.text.strong, margin: 0, lineHeight: 1.55 }}>{resultado.resumo_ia}</p>
                </div>
              )}
            </Card>
          )}
        </>)}

      </div>
    </div>
  )
}
