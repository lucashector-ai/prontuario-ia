
"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/Sidebar"

const PLANOS: Record<string, { nome: string; max: number; cor: string; bg: string }> = {
  starter:    { nome: "Starter",    max: 3,    cor: "#6043C1", bg: "#f0ebff" },
  pro:        { nome: "Pro",        max: 10,   cor: "#0d9488", bg: "#f0fdfa" },
  enterprise: { nome: "Enterprise", max: 9999, cor: "#d97706", bg: "#fffbeb" },
}

export default function ClinicaPage() {
  const router = useRouter()
  const [medico, setMedico] = useState<any>(null)
  const [clinica, setClinica] = useState<any>(null)
  const [medicos, setMedicos] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const [novoForm, setNovoForm] = useState({ nome: "", email: "", especialidade: "", crm: "" })
  const [adicionando, setAdicionando] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => {
    const m = localStorage.getItem("medico")
    if (!m) { router.push("/login"); return }
    const med = JSON.parse(m)
    setMedico(med)
    if (med.clinica_id) carregarClinica(med.clinica_id)
    else setCarregando(false)
  }, [router])

  const carregarClinica = async (clinicaId: string) => {
    setCarregando(true)
    const res = await fetch(`/api/clinica?clinica_id=${clinicaId}`)
    const data = await res.json()
    setClinica(data.clinica)
    setMedicos(data.medicos || [])
    setCarregando(false)
  }

  const adicionarMedico = async () => {
    if (!novoForm.nome || !novoForm.email) return setMsg({ tipo: "erro", texto: "Nome e email são obrigatórios" })
    setAdicionando(true)
    const res = await fetch("/api/clinica", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...novoForm, clinica_id: medico.clinica_id })
    })
    const data = await res.json()
    if (data.medico) {
      setMsg({ tipo: "ok", texto: "Médico adicionado! Senha padrão: medIA@2026" })
      setNovoForm({ nome: "", email: "", especialidade: "", crm: "" })
      setShowForm(false)
      carregarClinica(medico.clinica_id)
    } else {
      setMsg({ tipo: "erro", texto: data.error })
    }
    setAdicionando(false)
    setTimeout(() => setMsg(null), 5000)
  }

  const toggleAtivo = async (medicoId: string, ativo: boolean) => {
    await fetch("/api/clinica", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ medico_id: medicoId, ativo: !ativo }) })
    carregarClinica(medico.clinica_id)
  }

  const removerMedico = async (medicoId: string) => {
    await fetch(`/api/clinica?medico_id=${medicoId}`, { method: "DELETE" })
    setConfirmDelete(null)
    carregarClinica(medico.clinica_id)
    setMsg({ tipo: "ok", texto: "Médico removido da clínica" })
    setTimeout(() => setMsg(null), 3000)
  }

  const plano = PLANOS[clinica?.plano_id || "starter"]
  const usados = medicos.filter(m => m.ativo).length
  const maxMedicos = clinica?.planos?.max_medicos || plano?.max || 3
  const pctUso = Math.round((usados / maxMedicos) * 100)

  if (carregando) return (
    <div style={{ display: "flex", height: "100vh", background: "#F5F5F5" }}>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid #ede9fb", borderTopColor: "#6043C1", animation: "spin 0.8s linear infinite" }}/>
      </div>
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
    </div>
  )

  if (!medico?.clinica_id) return (
    <div style={{ display: "flex", height: "100vh", background: "#F5F5F5" }}>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
        <p style={{ fontSize: 15, color: "#6b7280" }}>Sua conta não está associada a nenhuma clínica.</p>
        <p style={{ fontSize: 13, color: "#9ca3af" }}>Crie uma nova conta para configurar sua clínica.</p>
      </div>
    </div>
  )

  return (
    <div style={{ display: "flex", height: "100vh", background: "#F5F5F5", overflow: "hidden" }}>
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "0 28px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <h1 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>Minha clínica</h1>
            <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>Gerencie sua equipe e plano</p>
          </div>
          {medico?.cargo === "admin" && (
            <button onClick={() => setShowForm(true)} style={{ fontSize: 13, fontWeight: 600, color: "white", background: "#6043C1", border: "none", padding: "8px 16px", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
              Adicionar médico
            </button>
          )}
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "0 24px 24px", display: "flex", flexDirection: "column", gap: 16, maxWidth: 900 }}>

          {msg && (
            <div style={{ padding: "10px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500, background: msg.tipo === "ok" ? "#f0fdf4" : "#fef2f2", color: msg.tipo === "ok" ? "#16a34a" : "#dc2626", border: `1px solid ${msg.tipo === "ok" ? "#bbf7d0" : "#fecaca"}` }}>
              {msg.tipo === "ok" ? "✓" : "⚠"} {msg.texto}
            </div>
          )}

          {/* Card da clínica */}
          <div style={{ background: "white", borderRadius: 14, padding: "20px 24px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>{clinica?.nome}</h2>
                <span style={{ fontSize: 12, fontWeight: 700, color: plano?.cor, background: plano?.bg, padding: "3px 10px", borderRadius: 20 }}>Plano {plano?.nome}</span>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 2px" }}>Médicos ativos</p>
                <p style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0 }}>{usados} <span style={{ fontSize: 14, color: "#9ca3af", fontWeight: 400 }}>/ {maxMedicos === 9999 ? "∞" : maxMedicos}</span></p>
              </div>
            </div>
            {maxMedicos !== 9999 && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>Capacidade utilizada</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: pctUso >= 90 ? "#dc2626" : "#6043C1" }}>{pctUso}%</span>
                </div>
                <div style={{ height: 6, background: "#f3f4f6", borderRadius: 4 }}>
                  <div style={{ height: "100%", width: `${Math.min(pctUso, 100)}%`, background: pctUso >= 90 ? "#dc2626" : "#6043C1", borderRadius: 4, transition: "width 0.4s" }}/>
                </div>
                {pctUso >= 80 && (
                  <p style={{ fontSize: 12, color: "#d97706", marginTop: 8 }}>⚠ Você está próximo do limite. Considere fazer upgrade do plano.</p>
                )}
              </div>
            )}
          </div>

          {/* Form novo médico */}
          {showForm && (
            <div style={{ background: "white", borderRadius: 14, padding: "20px 24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: 0 }}>Adicionar médico à clínica</h3>
                <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 18 }}>×</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                {[
                  { key: "nome", label: "Nome completo *", placeholder: "Dr. Nome Sobrenome" },
                  { key: "email", label: "E-mail *", placeholder: "email@clinica.com" },
                  { key: "especialidade", label: "Especialidade", placeholder: "Ex: Cardiologia" },
                  { key: "crm", label: "CRM", placeholder: "Ex: 12345-SP" },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>{f.label}</label>
                    <input value={(novoForm as any)[f.key]} onChange={e => setNovoForm(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      style={{ width: "100%", padding: "9px 12px", fontSize: 13, borderRadius: 8, border: "1.5px solid #e5e7eb", boxSizing: "border-box" }} />
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 11, color: "#9ca3af", margin: "0 0 12px" }}>Senha padrão: <strong>medIA@2026</strong> — o médico poderá alterar no primeiro acesso</p>
              <button onClick={adicionarMedico} disabled={adicionando} style={{ padding: "10px 20px", background: adicionando ? "#b9a9ef" : "#6043C1", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                {adicionando ? "Adicionando..." : "Adicionar à clínica"}
              </button>
            </div>
          )}

          {/* Lista de médicos */}
          <div style={{ background: "white", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #F5F5F5" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#111827", margin: 0 }}>Equipe médica ({medicos.length})</p>
            </div>
            {medicos.map((m, i) => {
              const iniciais = m.nome?.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase() || "??"
              const isMe = m.id === medico?.id
              return (
                <div key={m.id} style={{ padding: "14px 20px", borderBottom: i < medicos.length - 1 ? "1px solid #F5F5F5" : "none", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: m.cargo === "admin" ? "#6043C1" : "#f0ebff", color: m.cargo === "admin" ? "white" : "#6043C1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{iniciais}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", margin: 0 }}>{m.nome}</p>
                      {m.cargo === "admin" && <span style={{ fontSize: 10, fontWeight: 700, color: "#6043C1", background: "#f0ebff", padding: "1px 8px", borderRadius: 10, border: "1px solid #b9a9ef" }}>Admin</span>}
                      {isMe && <span style={{ fontSize: 10, fontWeight: 700, color: "#16a34a", background: "#f0fdf4", padding: "1px 8px", borderRadius: 10, border: "1px solid #bbf7d0" }}>Você</span>}
                    </div>
                    <p style={{ fontSize: 12, color: "#9ca3af", margin: "2px 0 0" }}>{m.email} {m.especialidade ? `• ${m.especialidade}` : ""} {m.crm ? `• CRM ${m.crm}` : ""}</p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: m.ativo ? "#16a34a" : "#9ca3af", background: m.ativo ? "#f0fdf4" : "#f3f4f6", padding: "3px 10px", borderRadius: 20 }}>
                      {m.ativo ? "Ativo" : "Inativo"}
                    </span>
                    {medico?.cargo === "admin" && !isMe && (
                      <>
                        <button onClick={() => toggleAtivo(m.id, m.ativo)} style={{ fontSize: 12, color: m.ativo ? "#d97706" : "#16a34a", background: m.ativo ? "#fffbeb" : "#f0fdf4", border: `1px solid ${m.ativo ? "#fde68a" : "#bbf7d0"}`, padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontWeight: 500 }}>
                          {m.ativo ? "Desativar" : "Ativar"}
                        </button>
                        {confirmDelete === m.id ? (
                          <>
                            <button onClick={() => removerMedico(m.id)} style={{ fontSize: 12, color: "white", background: "#dc2626", border: "none", padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontWeight: 500 }}>Confirmar</button>
                            <button onClick={() => setConfirmDelete(null)} style={{ fontSize: 12, color: "#6b7280", background: "#f3f4f6", border: "none", padding: "4px 10px", borderRadius: 6, cursor: "pointer" }}>Cancelar</button>
                          </>
                        ) : (
                          <button onClick={() => setConfirmDelete(m.id)} style={{ fontSize: 12, color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontWeight: 500 }}>Remover</button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Upgrade de plano */}
          <div style={{ background: "white", borderRadius: 14, padding: "20px 24px" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#111827", margin: "0 0 16px" }}>Planos disponíveis</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {Object.entries(PLANOS).map(([id, p]) => {
                const atual = clinica?.plano_id === id
                return (
                  <div key={id} style={{ padding: "16px", borderRadius: 10, border: atual ? `2px solid ${p.cor}` : "1px solid #e5e7eb", background: atual ? p.bg : "white" }}>
                    {atual && <span style={{ fontSize: 10, fontWeight: 700, color: p.cor, display: "block", marginBottom: 8 }}>PLANO ATUAL</span>}
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>{p.nome}</p>
                    <p style={{ fontSize: 22, fontWeight: 800, color: p.cor, margin: "0 0 4px" }}>{p.max === 9999 ? "∞" : p.max}</p>
                    <p style={{ fontSize: 11, color: "#9ca3af", margin: "0 0 12px" }}>médicos</p>
                    {!atual && <button style={{ width: "100%", padding: "8px", borderRadius: 7, border: `1px solid ${p.cor}`, background: "transparent", color: p.cor, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Fazer upgrade</button>}
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      </main>
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
    </div>
  )
}
