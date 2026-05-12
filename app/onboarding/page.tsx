'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { tokens } from '@/lib/design-tokens'

type TipoConta = 'clinica' | 'medico'

type Passo =
  | { kind: 'welcome' }
  | { kind: 'admin-form' }      // só pra admin: coleta nome
  | { kind: 'medico-form' }     // só pra médico solo: nome + CRM + especialidade
  | { kind: 'clinica-form' }    // só pra admin: dados da clínica
  | { kind: 'feature'; icon: 'mic' | 'memed' | 'sofia'; eyebrow: string; titulo: string; descricao: string; bullets: string[] }
  | { kind: 'done' }

export default function OnboardingPage() {
  const router = useRouter()
  const [tipo, setTipo] = useState<TipoConta | null>(null)
  const [usuario, setUsuario] = useState<any>(null)
  const [passoIdx, setPassoIdx] = useState(0)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  // Forms separados por tipo
  const [formAdmin, setFormAdmin] = useState({ nome: '' })
  const [formMedico, setFormMedico] = useState({ nome: '', crm: '', especialidade: '' })
  const [formClinica, setFormClinica] = useState({ nome: '', telefone: '', endereco: '' })

  useEffect(() => {
    const ca = localStorage.getItem('clinica_admin')
    const m = localStorage.getItem('medico')
    const dados = ca ? JSON.parse(ca) : (m ? JSON.parse(m) : null)
    const tp: TipoConta | null = ca ? 'clinica' : (m ? 'medico' : null)

    if (!dados || !tp) {
      router.replace('/login')
      return
    }

    // GATE: se já concluiu o onboarding, manda direto pro destino
    if (dados.onboarding_concluido) {
      router.replace(tp === 'clinica' ? '/admin' : '/dashboard')
      return
    }

    setUsuario(dados)
    setTipo(tp)
    setFormAdmin({ nome: dados.nome || '' })
    setFormMedico({
      nome: dados.nome || '',
      crm: dados.crm || '',
      especialidade: dados.especialidade || '',
    })
    setFormClinica({
      nome: '',
      telefone: '',
      endereco: '',
    })
    // Pré-popula dados da clínica se o admin tiver clinica_id
    if (tp === 'clinica' && dados.clinica_id) {
      supabase.from('clinicas').select('nome, telefone, endereco').eq('id', dados.clinica_id).single()
        .then(({ data }) => {
          if (data) setFormClinica({ nome: data.nome || '', telefone: data.telefone || '', endereco: data.endereco || '' })
        })
    }
  }, [router])

  // Monta passos conforme tipo
  const featuresPassos: Passo[] = [
    {
      kind: 'feature',
      icon: 'mic',
      eyebrow: 'IA na consulta',
      titulo: 'Grave a consulta. A IA escreve o prontuário.',
      descricao: 'Aperte o botão de gravar, fale normalmente com seu paciente. Em segundos você recebe um prontuário SOAP completo, com CIDs sugeridos.',
      bullets: ['Transcrição em tempo real', 'SOAP estruturado automaticamente', 'CIDs sugeridos pelo contexto'],
    },
    {
      kind: 'feature',
      icon: 'memed',
      eyebrow: 'Prescrição digital',
      titulo: 'Receitas Memed direto da plataforma.',
      descricao: 'Integração nativa com a Memed: prescreva com validade ICP-Brasil, envie por SMS ou WhatsApp pro paciente, sem sair do prontuário.',
      bullets: ['Validade legal ICP-Brasil', 'Envio direto pro paciente', 'Histórico completo na ficha'],
    },
    {
      kind: 'feature',
      icon: 'sofia',
      eyebrow: 'Sofia · IA no WhatsApp',
      titulo: 'Sua secretária IA atende 24/7.',
      descricao: 'A Sofia agenda consultas, confirma horários, tira dúvidas e cuida do paciente pelo WhatsApp — automaticamente, no tom da sua clínica.',
      bullets: ['Agendamento automático', 'Confirmação 48h antes', 'Reduz no-show em até 40%'],
    },
  ]

  const passos: Passo[] = !tipo ? [] : tipo === 'clinica' ? [
    { kind: 'welcome' },
    { kind: 'admin-form' },
    { kind: 'clinica-form' },
    ...featuresPassos,
    { kind: 'done' },
  ] : [
    { kind: 'welcome' },
    { kind: 'medico-form' },
    ...featuresPassos,
    { kind: 'done' },
  ]

  const passo = passos[passoIdx]
  const total = passos.length
  const progresso = total > 0 ? ((passoIdx + 1) / total) * 100 : 0
  const isPassoObrigatorio = passo?.kind === 'admin-form' || passo?.kind === 'medico-form' || passo?.kind === 'clinica-form'

  async function salvarAdmin(): Promise<boolean> {
    if (!usuario || tipo !== 'clinica') return false
    if (!formAdmin.nome.trim()) {
      setErro('Preencha seu nome pra continuar.')
      return false
    }
    setSalvando(true); setErro('')
    try {
      const updates = { nome: formAdmin.nome.trim() }
      const { error } = await supabase.from('clinica_admins').update(updates).eq('id', usuario.id)
      if (error) throw error

      const novo = { ...usuario, ...updates }
      setUsuario(novo)
      localStorage.setItem('clinica_admin', JSON.stringify(novo))
      return true
    } catch (e: any) {
      setErro(e.message || 'Erro ao salvar')
      return false
    } finally {
      setSalvando(false)
    }
  }

  async function salvarMedico(): Promise<boolean> {
    if (!usuario || tipo !== 'medico') return false
    if (!formMedico.nome.trim() || !formMedico.crm.trim()) {
      setErro('Preencha nome e CRM pra continuar.')
      return false
    }
    setSalvando(true); setErro('')
    try {
      const updates = {
        nome: formMedico.nome.trim(),
        crm: formMedico.crm.trim(),
        especialidade: formMedico.especialidade.trim() || null,
      }
      const { error } = await supabase.from('medicos').update(updates).eq('id', usuario.id)
      if (error) throw error

      const novo = { ...usuario, ...updates }
      setUsuario(novo)
      localStorage.setItem('medico', JSON.stringify(novo))
      return true
    } catch (e: any) {
      setErro(e.message || 'Erro ao salvar')
      return false
    } finally {
      setSalvando(false)
    }
  }

  async function salvarClinica(): Promise<boolean> {
    if (!usuario || tipo !== 'clinica') return false
    if (!formClinica.nome.trim()) {
      setErro('O nome da clínica é obrigatório.')
      return false
    }
    if (!usuario.clinica_id) {
      setErro('Conta sem clínica vinculada. Contate o suporte.')
      return false
    }
    setSalvando(true); setErro('')
    try {
      const updates = {
        nome: formClinica.nome.trim(),
        telefone: formClinica.telefone.trim() || null,
        endereco: formClinica.endereco.trim() || null,
      }
      const { error } = await supabase.from('clinicas').update(updates).eq('id', usuario.clinica_id)
      if (error) throw error
      return true
    } catch (e: any) {
      setErro(e.message || 'Erro ao salvar')
      return false
    } finally {
      setSalvando(false)
    }
  }

  async function concluir() {
    if (!usuario || !tipo) return
    setSalvando(true)
    try {
      const tabela = tipo === 'medico' ? 'medicos' : 'clinica_admins'
      await supabase.from(tabela).update({ onboarding_concluido: true }).eq('id', usuario.id)
      const novo = { ...usuario, onboarding_concluido: true }
      localStorage.setItem(tipo === 'medico' ? 'medico' : 'clinica_admin', JSON.stringify(novo))
      router.replace(tipo === 'medico' ? '/dashboard' : '/admin')
    } finally {
      setSalvando(false)
    }
  }

  async function avancar() {
    setErro('')
    if (passo?.kind === 'admin-form') {
      const ok = await salvarAdmin()
      if (!ok) return
    }
    if (passo?.kind === 'medico-form') {
      const ok = await salvarMedico()
      if (!ok) return
    }
    if (passo?.kind === 'clinica-form') {
      const ok = await salvarClinica()
      if (!ok) return
    }
    if (passoIdx < passos.length - 1) setPassoIdx(passoIdx + 1)
    else concluir()
  }

  function voltar() {
    setErro('')
    if (passoIdx > 0) setPassoIdx(passoIdx - 1)
  }

  // "Pular tudo" — só funciona após preencher os forms obrigatórios
  function pularTudo() {
    const maxObrigatorioIdx = passos.reduce((max, p, i) => {
      if (p.kind === 'admin-form' || p.kind === 'medico-form' || p.kind === 'clinica-form') return Math.max(max, i)
      return max
    }, -1)
    if (passoIdx < maxObrigatorioIdx) {
      // Avança pro próximo form obrigatório, não conclui ainda
      const proxObrig = passos.findIndex((p, i) => i > passoIdx && (p.kind === 'admin-form' || p.kind === 'medico-form' || p.kind === 'clinica-form'))
      if (proxObrig >= 0) setPassoIdx(proxObrig)
      return
    }
    concluir()
  }

  if (!tipo || !passo) return null

  return (
    <div style={{ minHeight: '100vh', background: 'white', display: 'flex', overflow: 'hidden' }}>
      <style>{`
        .ob-left { display: flex; }
        .ob-right { flex: 1; }
        @media (max-width: 900px) {
          .ob-left { display: none !important; }
          .ob-right { width: 100% !important; }
        }
        .ob-input {
          width: 100%;
          padding: 14px 16px;
          background: white;
          border: 1px solid ${tokens.neutral[200]};
          border-radius: 12px;
          font-size: 15px;
          color: ${tokens.neutral[900]};
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
          box-sizing: border-box;
        }
        .ob-input:focus {
          border-color: ${tokens.brand.primary};
          box-shadow: 0 0 0 4px ${tokens.brand.primaryLight};
        }
        .ob-label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: ${tokens.neutral[700]};
          margin-bottom: 8px;
        }
        .ob-fadein { animation: fadein 0.4s ease; }
        @keyframes fadein {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <aside className="ob-left" style={{
        width: '42%',
        background: `linear-gradient(160deg, ${tokens.brand.primary} 0%, ${tokens.accent.violet} 55%, ${tokens.brand.primaryDark || tokens.brand.primary} 100%)`,
        color: 'white',
        padding: '56px 48px',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -200, right: -200, width: 500, height: 500, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', filter: 'blur(40px)' }}/>
        <div style={{ position: 'absolute', bottom: -150, left: -100, width: 380, height: 380, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', filter: 'blur(30px)' }}/>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <img src="/logo-clinical-360.svg" alt="Clinical 360" style={{ height: 30, filter: 'brightness(0) invert(1)' }}/>
        </div>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.8, margin: '0 0 18px' }}>Configuração inicial</p>
          <h2 style={{ fontSize: 38, fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1.1, margin: '0 0 18px' }}>
            Vamos configurar sua {tipo === 'clinica' ? 'clínica' : 'conta'} em poucos minutos.
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.55, opacity: 0.85, maxWidth: 360, margin: 0 }}>
            Você conhece o essencial pra começar a atender com IA, prescrever via Memed e atender pacientes no WhatsApp.
          </p>
        </div>

        <div style={{ position: 'relative', zIndex: 1, fontSize: 13, opacity: 0.75 }}>
          Passo {passoIdx + 1} de {total}
        </div>
      </aside>

      <main className="ob-right" style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: '48px 56px',
        maxWidth: 720,
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 48 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {passoIdx > 0 && (
              <button onClick={voltar} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center', gap: 4, color: tokens.text.muted, fontSize: 13, fontWeight: 500 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                Voltar
              </button>
            )}
          </div>
          <div style={{ flex: 1, maxWidth: 280, margin: '0 24px', height: 4, background: tokens.neutral[150], borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: tokens.brand.primary, width: `${progresso}%`, transition: 'width 0.4s ease' }}/>
          </div>
          {!isPassoObrigatorio && (
            <button onClick={pularTudo} disabled={salvando} style={{ background: 'none', border: 'none', cursor: salvando ? 'wait' : 'pointer', fontSize: 13, color: tokens.text.tertiary, fontWeight: 500 }}>
              Pular tudo
            </button>
          )}
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="ob-fadein" style={{ width: '100%', maxWidth: 480 }}>

            {passo.kind === 'welcome' && (
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: tokens.brand.primary, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 16px' }}>Bem-vindo, {usuario?.nome?.split(' ')[0] || 'doutor(a)'}</p>
                <h1 style={{ fontSize: 36, fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1.1, margin: '0 0 16px', color: tokens.neutral[900] }}>
                  Tudo pronto pra começar.
                </h1>
                <p style={{ fontSize: 16, color: tokens.text.muted, lineHeight: 1.6, margin: '0 0 36px' }}>
                  {tipo === 'clinica'
                    ? 'Vamos configurar 2 coisas essenciais e te mostrar 3 funcionalidades que vão mudar como sua clínica atende. Leva 3 minutos.'
                    : 'Vamos configurar seu perfil e te mostrar 3 funcionalidades que vão mudar como você atende. Leva 2 minutos.'
                  }
                </p>
              </div>
            )}

            {passo.kind === 'admin-form' && (
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: tokens.brand.primary, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 16px' }}>Sobre você</p>
                <h1 style={{ fontSize: 32, fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1.15, margin: '0 0 12px', color: tokens.neutral[900] }}>
                  Como devemos te chamar?
                </h1>
                <p style={{ fontSize: 15, color: tokens.text.muted, lineHeight: 1.55, margin: '0 0 28px' }}>
                  Seu nome aparece como administrador da clínica em logs e comunicações internas.
                </p>
                <div>
                  <label className="ob-label">Nome completo</label>
                  <input className="ob-input" value={formAdmin.nome} onChange={e => setFormAdmin({ nome: e.target.value })} placeholder="Ex: Maria Silva" />
                </div>
              </div>
            )}

            {passo.kind === 'medico-form' && (
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: tokens.brand.primary, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 16px' }}>Sobre você</p>
                <h1 style={{ fontSize: 32, fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1.15, margin: '0 0 12px', color: tokens.neutral[900] }}>
                  Quem aparece nos prontuários?
                </h1>
                <p style={{ fontSize: 15, color: tokens.text.muted, lineHeight: 1.55, margin: '0 0 28px' }}>
                  Esses dados aparecem no rodapé de prontuários, prescrições Memed e PDFs gerados pela clínica.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label className="ob-label">Nome completo</label>
                    <input className="ob-input" value={formMedico.nome} onChange={e => setFormMedico({ ...formMedico, nome: e.target.value })} placeholder="Ex: Dr. João Silva" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label className="ob-label">CRM</label>
                      <input className="ob-input" value={formMedico.crm} onChange={e => setFormMedico({ ...formMedico, crm: e.target.value })} placeholder="12345-SP" />
                    </div>
                    <div>
                      <label className="ob-label">Especialidade</label>
                      <input className="ob-input" value={formMedico.especialidade} onChange={e => setFormMedico({ ...formMedico, especialidade: e.target.value })} placeholder="Cardiologia" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {passo.kind === 'clinica-form' && (
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: tokens.brand.primary, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 16px' }}>Sua clínica</p>
                <h1 style={{ fontSize: 32, fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1.15, margin: '0 0 12px', color: tokens.neutral[900] }}>
                  Dados da clínica
                </h1>
                <p style={{ fontSize: 15, color: tokens.text.muted, lineHeight: 1.55, margin: '0 0 28px' }}>
                  Aparece em documentos, no WhatsApp da Sofia e na sala de teleconsulta personalizada.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label className="ob-label">Nome da clínica</label>
                    <input className="ob-input" value={formClinica.nome} onChange={e => setFormClinica({ ...formClinica, nome: e.target.value })} placeholder="Ex: Clínica São Paulo" />
                  </div>
                  <div>
                    <label className="ob-label">Telefone</label>
                    <input className="ob-input" value={formClinica.telefone} onChange={e => setFormClinica({ ...formClinica, telefone: e.target.value })} placeholder="(11) 99999-9999" />
                  </div>
                  <div>
                    <label className="ob-label">Endereço</label>
                    <input className="ob-input" value={formClinica.endereco} onChange={e => setFormClinica({ ...formClinica, endereco: e.target.value })} placeholder="Av. Paulista, 1000 — São Paulo/SP" />
                  </div>
                </div>
              </div>
            )}

            {passo.kind === 'feature' && (
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: tokens.brand.primary, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 16px' }}>{passo.eyebrow}</p>
                <h1 style={{ fontSize: 32, fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1.15, margin: '0 0 16px', color: tokens.neutral[900] }}>
                  {passo.titulo}
                </h1>
                <p style={{ fontSize: 16, color: tokens.text.muted, lineHeight: 1.6, margin: '0 0 28px' }}>
                  {passo.descricao}
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {passo.bullets.map((b, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, color: tokens.neutral[700] }}>
                      <span style={{ width: 22, height: 22, borderRadius: 6, background: tokens.brand.primaryLight, color: tokens.brand.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                      </span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {passo.kind === 'done' && (
              <div style={{ textAlign: 'center' as const }}>
                <div style={{ width: 80, height: 80, borderRadius: 24, background: tokens.brand.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={tokens.brand.primary} strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <h1 style={{ fontSize: 36, fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1.1, margin: '0 0 16px', color: tokens.neutral[900] }}>
                  Tudo pronto.
                </h1>
                <p style={{ fontSize: 16, color: tokens.text.muted, lineHeight: 1.6, margin: '0 0 8px', maxWidth: 380, marginLeft: 'auto', marginRight: 'auto' }}>
                  {tipo === 'clinica'
                    ? 'No painel administrativo você cadastra sua equipe e configura a Sofia no WhatsApp.'
                    : 'Comece sua primeira consulta com IA quando quiser.'}
                </p>
              </div>
            )}

            {erro && (
              <div style={{ marginTop: 20, padding: '10px 14px', background: tokens.status.dangerBg, color: tokens.status.dangerDark, borderRadius: 8, fontSize: 13, fontWeight: 500 }}>
                {erro}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 32 }}>
          <button
            onClick={avancar}
            disabled={salvando}
            style={{
              padding: '14px 28px',
              background: salvando ? tokens.neutral[400] : tokens.neutral[900],
              color: 'white',
              border: 'none',
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 600,
              cursor: salvando ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {salvando ? 'Salvando...' : (
              passo.kind === 'welcome' ? 'Vamos começar' :
              passo.kind === 'done' ? (tipo === 'clinica' ? 'Ir pro painel' : 'Ir pro dashboard') :
              'Continuar'
            )}
            {!salvando && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            )}
          </button>
        </div>
      </main>
    </div>
  )
}
