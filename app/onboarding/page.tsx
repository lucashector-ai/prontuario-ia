
"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

const passos = [
  {
    num: 1,
    titulo: "Bem-vindo ao MedIA",
    subtitulo: "Seu assistente medico inteligente",
    desc: "Em poucos minutos voce estara pronto para fazer sua primeira consulta com transcricao automatica e prontuario gerado por IA.",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1F9D5C" strokeWidth="1.5">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
      </svg>
    ),
    cta: "Comecar",
  },
  {
    num: 2,
    titulo: "Complete seu perfil",
    subtitulo: "Informacoes exibidas no prontuario",
    desc: "Adicione sua especialidade, CRM e nome da clinica. Essas informacoes aparecem automaticamente em todos os documentos gerados.",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1F9D5C" strokeWidth="1.5">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"/>
      </svg>
    ),
    cta: "Ir para meu perfil",
    href: "/perfil",
    opcao: "Pular por agora",
  },
  {
    num: 3,
    titulo: "Cadastre seu primeiro paciente",
    subtitulo: "Organize seu histórico de atendimentos",
    desc: "Cadastre pacientes para vincular consultas, gerar histórico clinico e acompanhar a evolucao ao longo do tempo.",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1F9D5C" strokeWidth="1.5">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
      </svg>
    ),
    cta: "Cadastrar paciente",
    href: "/pacientes",
    opcao: "Pular por agora",
  },
  {
    num: 4,
    titulo: "Faca sua primeira consulta",
    subtitulo: "Transcrição + prontuario em segundos",
    desc: "Clique em Nova consulta, pressione gravar e fale normalmente com o paciente. A IA transcreve e gera o prontuario SOAP automaticamente.",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1F9D5C" strokeWidth="1.5">
        <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
        <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/>
      </svg>
    ),
    cta: "Fazer primeira consulta",
    href: "/nova-consulta",
  },
]

export default function OnboardingPage() {
  const [passo, setPasso] = useState(0)
  const [medico, setMedico] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    const m = localStorage.getItem("medico")
    if (!m) { router.push("/login"); return }
    setMedico(JSON.parse(m))
  }, [router])

  async function concluir() {
    if (!medico) return
    await supabase.from("medicos").update({ onboarding_concluido: true }).eq("id", medico.id)
    const novoMedico = { ...medico, onboarding_concluido: true }
    localStorage.setItem("medico", JSON.stringify(novoMedico))
    router.push("/dashboard")
  }

  function avancar(href?: string) {
    if (href) { router.push(href); return }
    if (passo < passos.length - 1) setPasso(passo + 1)
    else concluir()
  }

  const p = passos[passo]
  const progresso = ((passo + 1) / passos.length) * 100

  return (
    <div style={{ minHeight: "100vh", background: "#F5F5F5", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <div style={{ width: "100%", maxWidth: 480 }}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "#1F9D5C", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>MedIA</span>
          </div>
          <span style={{ fontSize: 12, color: "#9ca3af" }}>Passo {passo + 1} de {passos.length}</span>
        </div>

        <div style={{ height: 3, background: "#e5e7eb", borderRadius: 2, marginBottom: 40, overflow: "hidden" }}>
          <div style={{ height: "100%", background: "#1F9D5C", borderRadius: 2, width: progresso + "%", transition: "width 0.4s ease" }} />
        </div>

        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: "#f0ebff", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            {p.icon}
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827", margin: "0 0 6px" }}>{p.titulo}</h1>
          <p style={{ fontSize: 13, color: "#1F9D5C", fontWeight: 600, margin: "0 0 16px" }}>{p.subtitulo}</p>
          <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.7, maxWidth: 380, margin: "0 auto" }}>{p.desc}</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={() => avancar(p.href)}
            style={{ width: "100%", padding: "14px", background: "#1F9D5C", color: "white", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer" }}
          >
            {p.cta}
          </button>
          {p.opcao && (
            <button
              onClick={() => setPasso(passo + 1)}
              style={{ width: "100%", padding: "12px", background: "transparent", color: "#9ca3af", border: "0.5px solid #e5e7eb", borderRadius: 10, fontSize: 14, cursor: "pointer" }}
            >
              {p.opcao}
            </button>
          )}
          {passo === 0 && (
            <button
              onClick={concluir}
              style={{ width: "100%", padding: "12px", background: "transparent", color: "#9ca3af", border: "none", fontSize: 13, cursor: "pointer" }}
            >
              Ja conheo a plataforma, pular tudo
            </button>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 32 }}>
          {passos.map((_, i) => (
            <div key={i} style={{ width: i === passo ? 20 : 6, height: 6, borderRadius: 3, background: i === passo ? "#1F9D5C" : "#e5e7eb", transition: "all 0.3s ease" }} />
          ))}
        </div>

      </div>
    </div>
  )
}
