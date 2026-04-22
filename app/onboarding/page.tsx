"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

type TipoConta = 'clinica' | 'medico' | null

const passosMedico = [
  {
    titulo: "Bem-vindo ao MedIA",
    subtitulo: "Seu assistente médico inteligente",
    desc: "Em poucos minutos você estará pronto para fazer sua primeira consulta com transcrição automática e prontuário gerado por IA.",
    cta: "Começar",
  },
  {
    titulo: "Complete seu perfil",
    subtitulo: "Informações exibidas no prontuário",
    desc: "Adicione sua especialidade, CRM e foto. Essas informações aparecem automaticamente em todos os documentos gerados.",
    cta: "Ir para meu perfil",
    href: "/perfil",
    opcao: "Pular por agora",
  },
  {
    titulo: "Cadastre seu primeiro paciente",
    subtitulo: "Organize seu histórico de atendimentos",
    desc: "Cadastre pacientes para vincular consultas, gerar histórico clínico e acompanhar a evolução ao longo do tempo.",
    cta: "Cadastrar paciente",
    href: "/pacientes",
    opcao: "Pular por agora",
  },
  {
    titulo: "Faça sua primeira consulta",
    subtitulo: "Transcrição + prontuário em segundos",
    desc: "Clique em Nova consulta, pressione gravar e fale normalmente com o paciente. A IA transcreve e gera o prontuário SOAP automaticamente.",
    cta: "Fazer primeira consulta",
    href: "/nova-consulta",
  },
]

const passosClinica = [
  {
    titulo: "Bem-vindo ao MedIA",
    subtitulo: "Prontuário com IA pra toda sua equipe",
    desc: "Você acabou de criar a conta da sua clínica. Vamos configurar tudo em poucos minutos para começar a atender.",
    cta: "Começar",
  },
  {
    titulo: "Adicione seus médicos",
    subtitulo: "Sua equipe no Painel administrativo",
    desc: "Cadastre os médicos que atendem na sua clínica. Cada um recebe seu login próprio e passa pelo onboarding.",
    cta: "Abrir painel administrativo",
    href: "/admin",
    opcao: "Adicionar depois",
  },
  {
    titulo: "Configure sua clínica",
    subtitulo: "Logo, dados de contato e mais",
    desc: "Complete os dados da sua clínica para que apareçam nos prontuários e atendimentos via WhatsApp.",
    cta: "Ir para configurações",
    href: "/minha-clinica",
    opcao: "Pular por agora",
  },
  {
    titulo: "Tudo pronto",
    subtitulo: "Explore sua plataforma",
    desc: "Você e sua equipe já podem começar a atender. A Sofia cuida dos agendamentos via WhatsApp automaticamente.",
    cta: "Ir para o painel",
    href: "/admin",
  },
]

const IconBoasVindas = (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6043C1" strokeWidth="1.5">
    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
  </svg>
)
const IconPerfil = (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6043C1" strokeWidth="1.5">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"/>
  </svg>
)
const IconPacientes = (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6043C1" strokeWidth="1.5">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
  </svg>
)
const IconMic = (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6043C1" strokeWidth="1.5">
    <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
    <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/>
  </svg>
)
const IconClinica = (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6043C1" strokeWidth="1.5">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
)
const IconCheck = (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6043C1" strokeWidth="1.5">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

const iconesMedico = [IconBoasVindas, IconPerfil, IconPacientes, IconMic]
const iconesClinica = [IconBoasVindas, IconPerfil, IconClinica, IconCheck]

export default function OnboardingPage() {
  const router = useRouter()
  const [passo, setPasso] = useState(0)
  const [tipo, setTipo] = useState<TipoConta>(null)
  const [usuario, setUsuario] = useState<any>(null)

  useEffect(() => {
    const ca = localStorage.getItem('clinica_admin')
    if (ca) {
      setUsuario(JSON.parse(ca))
      setTipo('clinica')
      return
    }
    const m = localStorage.getItem('medico')
    if (m) {
      setUsuario(JSON.parse(m))
      setTipo('medico')
      return
    }
    router.push('/login')
  }, [router])

  async function concluir() {
    if (!usuario || !tipo) return
    if (tipo === 'medico') {
      await supabase.from('medicos').update({ onboarding_concluido: true }).eq('id', usuario.id)
      const novo = { ...usuario, onboarding_concluido: true }
      localStorage.setItem('medico', JSON.stringify(novo))
      router.push('/dashboard')
    } else {
      await supabase.from('clinica_admins').update({ onboarding_concluido: true }).eq('id', usuario.id)
      const novo = { ...usuario, onboarding_concluido: true }
      localStorage.setItem('clinica_admin', JSON.stringify(novo))
      router.push('/admin')
    }
  }

  if (!tipo) return null

  const passos = tipo === 'clinica' ? passosClinica : passosMedico
  const icones = tipo === 'clinica' ? iconesClinica : iconesMedico

  function avancar(href?: string) {
    if (href) { router.push(href); return }
    if (passo < passos.length - 1) setPasso(passo + 1)
    else concluir()
  }

  const p = passos[passo]
  const progresso = ((passo + 1) / passos.length) * 100
  const icon = icones[passo]

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#6043C1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>MedIA</span>
          </div>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>Passo {passo + 1} de {passos.length}</span>
        </div>

        <div style={{ height: 3, background: '#e5e7eb', borderRadius: 2, marginBottom: 40, overflow: 'hidden' }}>
          <div style={{ height: '100%', background: '#6043C1', borderRadius: 2, width: progresso + '%', transition: 'width 0.4s ease' }} />
        </div>

        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: '#ede9fb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            {icon}
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>{p.titulo}</h1>
          <p style={{ fontSize: 13, color: '#6043C1', fontWeight: 600, margin: '0 0 16px' }}>{p.subtitulo}</p>
          <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.7, maxWidth: 380, margin: '0 auto' }}>{p.desc}</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={() => avancar((p as any).href)}
            style={{ width: '100%', padding: '14px', background: '#6043C1', color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
          >
            {p.cta}
          </button>
          {(p as any).opcao && (
            <button
              onClick={() => setPasso(passo + 1)}
              style={{ width: '100%', padding: '12px', background: 'transparent', color: '#9ca3af', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, cursor: 'pointer' }}
            >
              {(p as any).opcao}
            </button>
          )}
          {passo === 0 && (
            <button
              onClick={concluir}
              style={{ width: '100%', padding: '12px', background: 'transparent', color: '#9ca3af', border: 'none', fontSize: 13, cursor: 'pointer' }}
            >
              Já conheço a plataforma, pular tudo
            </button>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 32 }}>
          {passos.map((_, i) => (
            <div key={i} style={{ width: i === passo ? 20 : 6, height: 6, borderRadius: 3, background: i === passo ? '#6043C1' : '#e5e7eb', transition: 'all 0.3s ease' }} />
          ))}
        </div>

      </div>
    </div>
  )
}
