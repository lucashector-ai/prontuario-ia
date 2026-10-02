'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { tokens } from '@/lib/design-tokens'
import { Mic, FileSignature, Bot, Users, UserPlus, Check, CircleCheck, CircleAlert, ChevronLeft, ArrowRight, Stethoscope, Building2 } from 'lucide-react'
import { Marca } from '@/components/Marca'
import { Button, Field, Input, IconTile, ProgressBar } from '@/components/ui'

import { primeiroNome } from '@/lib/nome'
type TipoConta = 'clinica' | 'medico'

type Passo =
  | { kind: 'welcome' }
  | { kind: 'perfil' }          // escolha do perfil (autônomo vs clínica com equipe) — só conta clinica
  | { kind: 'medico-form' }     // médico convidado: nome + CRM + especialidade
  | { kind: 'clinica-form' }    // dados da clínica
  | { kind: 'feature'; icon: 'mic' | 'memed' | 'sofia'; eyebrow: string; titulo: string; descricao: string; bullets: string[] }
  | { kind: 'equipe' }          // etapa de equipe no final — só perfil clínica
  | { kind: 'done' }

export default function OnboardingPage() {
  const router = useRouter()
  const [tipo, setTipo] = useState<TipoConta | null>(null)
  // Perfil escolhido no onboarding — NÃO é a identidade da conta (essa é `tipo`).
  // Só decide o fluxo (mostra etapa de equipe?) e o redirect final.
  const [perfil, setPerfil] = useState<'autonomo' | 'clinica' | null>(null)
  const [usuario, setUsuario] = useState<any>(null)
  const [passoIdx, setPassoIdx] = useState(0)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  // Forms separados por tipo
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
    { kind: 'perfil' },
    { kind: 'clinica-form' },
    ...featuresPassos,
    // Etapa de equipe só pra quem tem clínica com equipe; autônomo termina em 'done'.
    ...(perfil === 'clinica' ? [{ kind: 'equipe' } as Passo] : [{ kind: 'done' } as Passo]),
  ] : [
    { kind: 'welcome' },
    { kind: 'medico-form' },
    ...featuresPassos,
    { kind: 'done' },
  ]

  const passo = passos[passoIdx]
  const total = passos.length
  const progresso = total > 0 ? ((passoIdx + 1) / total) * 100 : 0
  const isPassoObrigatorio = passo?.kind === 'perfil' || passo?.kind === 'medico-form' || passo?.kind === 'clinica-form'

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

  async function concluir(destinoCustom?: string) {
    if (!usuario || !tipo) return
    setSalvando(true)
    try {
      const tabela = tipo === 'medico' ? 'medicos' : 'clinica_admins'
      await supabase.from(tabela).update({ onboarding_concluido: true }).eq('id', usuario.id)
      const novo = { ...usuario, onboarding_concluido: true }
      localStorage.setItem(tipo === 'medico' ? 'medico' : 'clinica_admin', JSON.stringify(novo))
      // Redirect por perfil: clínica com equipe → /admin; autônomo (ou médico convidado) → /dashboard.
      const destino = destinoCustom ?? ((tipo === 'clinica' && perfil === 'clinica') ? '/admin' : '/dashboard')
      router.replace(destino)
    } finally {
      setSalvando(false)
    }
  }

  async function avancar() {
    setErro('')
    if (passo?.kind === 'perfil' && !perfil) {
      setErro('Escolha uma opção pra continuar.')
      return
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
      if (p.kind === 'perfil' || p.kind === 'medico-form' || p.kind === 'clinica-form') return Math.max(max, i)
      return max
    }, -1)
    if (passoIdx < maxObrigatorioIdx) {
      // Avança pro próximo form obrigatório, não conclui ainda
      const proxObrig = passos.findIndex((p, i) => i > passoIdx && (p.kind === 'perfil' || p.kind === 'medico-form' || p.kind === 'clinica-form'))
      if (proxObrig >= 0) setPassoIdx(proxObrig)
      return
    }
    concluir()
  }

  if (!tipo || !passo) return null

  const T = tokens
  const overline: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: T.brand.primary, textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 0 14px' }
  const titulo: React.CSSProperties = { fontSize: 30, fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1.15, margin: '0 0 12px', color: T.text.primary }
  const tituloGrande: React.CSSProperties = { ...titulo, fontSize: 34, lineHeight: 1.1, margin: '0 0 14px' }
  const descricao: React.CSSProperties = { fontSize: 15, color: T.text.secondary, lineHeight: 1.6, margin: '0 0 28px' }
  const campo = { minHeight: 44 }
  const iconeFeature = { mic: Mic, memed: FileSignature, sofia: Bot } as const

  return (
    <div style={{ minHeight: '100dvh', background: T.bg.card, display: 'flex', overflow: 'hidden' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .ob-left { display: flex; }
        .ob-right { flex: 1; }
        @media (max-width: 900px) {
          .ob-left { display: none !important; }
          .ob-right { width: 100% !important; padding: 24px 16px !important; }
        }
        .ob-fadein { animation: fadein 0.4s ease; }
        @keyframes fadein {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      ` }} />

      <aside className="ob-left" style={{
        width: '42%',
        background: `linear-gradient(160deg, ${T.brand.primary} 0%, ${T.brand.primaryDark} 100%)`,
        color: 'white',
        padding: '48px',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -200, right: -200, width: 500, height: 500, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', filter: 'blur(40px)' }}/>
        <div style={{ position: 'absolute', bottom: -150, left: -100, width: 380, height: 380, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', filter: 'blur(30px)' }}/>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <Marca altura={28} style={{ filter: 'brightness(0) invert(1)' }} />
        </div>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', opacity: 0.8, margin: '0 0 16px' }}>Configuração inicial</p>
          <h2 style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1.1, margin: '0 0 16px' }}>
            Vamos configurar sua {tipo === 'clinica' ? 'clínica' : 'conta'} em poucos minutos.
          </h2>
          <p style={{ fontSize: 15, lineHeight: 1.6, opacity: 0.85, maxWidth: 360, margin: 0 }}>
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
        padding: '40px 56px',
        maxWidth: 720,
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 48, minHeight: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 80 }}>
            {passoIdx > 0 && (
              <Button variant="ghost" size="sm" icon={ChevronLeft} onClick={voltar} style={{ color: T.text.muted }}>
                Voltar
              </Button>
            )}
          </div>
          <div style={{ flex: 1, maxWidth: 280, margin: '0 24px' }}>
            <ProgressBar valor={progresso} altura={4} />
          </div>
          <div style={{ minWidth: 80, display: 'flex', justifyContent: 'flex-end' }}>
            {!isPassoObrigatorio && (
              <Button variant="ghost" size="sm" onClick={pularTudo} disabled={salvando} style={{ color: T.text.tertiary }}>
                Pular tudo
              </Button>
            )}
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="ob-fadein" style={{ width: '100%', maxWidth: 480 }}>

            {passo.kind === 'welcome' && (
              <div>
                <p style={overline}>Bem-vindo, {primeiroNome(usuario?.nome, 'doutor(a)')}</p>
                <h1 style={tituloGrande}>Tudo pronto pra começar.</h1>
                <p style={{ ...descricao, fontSize: 16, margin: '0 0 36px' }}>
                  {tipo === 'clinica'
                    ? 'Vamos configurar 2 coisas essenciais e te mostrar 3 funcionalidades que vão mudar como sua clínica atende. Leva 3 minutos.'
                    : 'Vamos configurar seu perfil e te mostrar 3 funcionalidades que vão mudar como você atende. Leva 2 minutos.'
                  }
                </p>
              </div>
            )}

            {passo.kind === 'perfil' && (
              <div>
                <p style={overline}>Perfil</p>
                <h1 style={titulo}>Como você atua?</h1>
                <p style={descricao}>Isso personaliza sua experiência no Clinical 360.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {([
                    { key: 'autonomo', titulo: 'Sou médico autônomo', sub: 'Atendo meus próprios pacientes', icone: Stethoscope },
                    { key: 'clinica', titulo: 'Tenho uma clínica com equipe', sub: 'Gerencio médicos e recepcionistas', icone: Building2 },
                  ] as const).map(op => {
                    const sel = perfil === op.key
                    return (
                      <button key={op.key} type="button" onClick={() => { setPerfil(op.key); setErro('') }}
                        style={{
                          textAlign: 'left' as const, padding: '16px 18px', borderRadius: 16, cursor: 'pointer',
                          border: `1px solid ${sel ? T.brand.primary : T.border.default}`,
                          background: sel ? T.brand.primarySoftBg : T.bg.card,
                          boxShadow: sel ? T.shadow.focusRing : 'none',
                          transition: 'border-color .15s, background .15s, box-shadow .15s',
                          display: 'flex', alignItems: 'center', gap: 14, fontFamily: 'inherit',
                        }}>
                        <IconTile icon={op.icone} size={40} active={sel} />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: T.text.primary }}>{op.titulo}</span>
                          <span style={{ display: 'block', fontSize: 13, color: T.text.quaternary, marginTop: 2 }}>{op.sub}</span>
                        </span>
                        <span style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, border: `1.5px solid ${sel ? T.brand.primary : T.border.strong}`, background: sel ? T.brand.primary : 'transparent', color: '#fff', display: 'grid', placeItems: 'center' }}>
                          {sel && <Check size={12} strokeWidth={2.4} />}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {passo.kind === 'medico-form' && (
              <div>
                <p style={overline}>Sobre você</p>
                <h1 style={titulo}>Quem aparece nos prontuários?</h1>
                <p style={descricao}>
                  Esses dados aparecem no rodapé de prontuários, prescrições Memed e PDFs gerados pela clínica.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <Field label="Nome completo">
                    <Input style={campo} value={formMedico.nome} onChange={e => setFormMedico({ ...formMedico, nome: e.target.value })} placeholder="Ex: Dr. João Silva" />
                  </Field>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Field label="CRM">
                      <Input style={campo} value={formMedico.crm} onChange={e => setFormMedico({ ...formMedico, crm: e.target.value })} placeholder="12345-SP" />
                    </Field>
                    <Field label="Especialidade">
                      <Input style={campo} value={formMedico.especialidade} onChange={e => setFormMedico({ ...formMedico, especialidade: e.target.value })} placeholder="Cardiologia" />
                    </Field>
                  </div>
                </div>
              </div>
            )}

            {passo.kind === 'clinica-form' && (
              <div>
                <p style={overline}>Sua clínica</p>
                <h1 style={titulo}>Dados da clínica</h1>
                <p style={descricao}>
                  Aparece em documentos, no WhatsApp da Sofia e na sala de teleconsulta personalizada.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <Field label="Nome da clínica">
                    <Input style={campo} value={formClinica.nome} onChange={e => setFormClinica({ ...formClinica, nome: e.target.value })} placeholder="Ex: Clínica São Paulo" />
                  </Field>
                  <Field label="Telefone">
                    <Input style={campo} value={formClinica.telefone} onChange={e => setFormClinica({ ...formClinica, telefone: e.target.value })} placeholder="(11) 99999-9999" />
                  </Field>
                  <Field label="Endereço">
                    <Input style={campo} value={formClinica.endereco} onChange={e => setFormClinica({ ...formClinica, endereco: e.target.value })} placeholder="Av. Paulista, 1000 — São Paulo/SP" />
                  </Field>
                </div>
              </div>
            )}

            {passo.kind === 'feature' && (
              <div>
                <IconTile icon={iconeFeature[passo.icon]} size={48} radius={15} style={{ marginBottom: 20 }} />
                <p style={overline}>{passo.eyebrow}</p>
                <h1 style={{ ...titulo, margin: '0 0 14px' }}>{passo.titulo}</h1>
                <p style={{ ...descricao, fontSize: 16 }}>{passo.descricao}</p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {passo.bullets.map((b, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, color: T.text.strong }}>
                      <span style={{ width: 22, height: 22, borderRadius: 7, background: T.brand.primaryLight, color: T.brand.primary, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <Check size={13} strokeWidth={2} />
                      </span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {passo.kind === 'equipe' && (
              <div>
                <IconTile icon={Users} size={48} radius={15} style={{ marginBottom: 20 }} />
                <p style={overline}>Sua equipe</p>
                <h1 style={titulo}>Adicione sua equipe</h1>
                <p style={{ ...descricao, margin: '0 0 8px' }}>
                  Cadastre médicos e recepcionistas — cada um recebe uma senha provisória pra acessar o sistema.
                </p>
                <p style={{ fontSize: 14, color: T.text.tertiary, lineHeight: 1.55, margin: '0 0 28px' }}>
                  Você pode fazer isso agora ou depois, quando quiser.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Button size="lg" block icon={UserPlus} onClick={() => concluir('/admin?add=medico')} disabled={salvando}>
                    {salvando ? 'Salvando…' : 'Adicionar equipe agora'}
                  </Button>
                  <Button size="lg" block variant="secondary" onClick={() => concluir()} disabled={salvando}>
                    Pular, adiciono depois
                  </Button>
                </div>
              </div>
            )}

            {passo.kind === 'done' && (
              <div style={{ textAlign: 'center' as const }}>
                <div style={{ width: 72, height: 72, borderRadius: 22, background: T.status.successBg, color: T.status.success, display: 'grid', placeItems: 'center', margin: '0 auto 24px' }}>
                  <CircleCheck size={34} strokeWidth={1.6} />
                </div>
                <h1 style={tituloGrande}>Tudo pronto.</h1>
                <p style={{ ...descricao, fontSize: 16, margin: '0 auto 8px', maxWidth: 380 }}>
                  {tipo === 'clinica'
                    ? 'No painel administrativo você cadastra sua equipe e configura a Sofia no WhatsApp.'
                    : 'Comece sua primeira consulta com IA quando quiser.'}
                </p>
              </div>
            )}

            {erro && (
              <div style={{ marginTop: 20, padding: '10px 12px', background: T.status.dangerBg, color: T.status.danger, borderRadius: 12, fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
                <CircleAlert size={15} strokeWidth={1.6} style={{ flexShrink: 0 }} />
                {erro}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 32 }}>
          {/* No step de equipe os botões ficam no conteúdo (Adicionar / Pular), então some o do rodapé */}
          {passo.kind !== 'equipe' && (
            <Button size="lg" onClick={avancar} disabled={salvando} iconRight={salvando ? undefined : ArrowRight} style={{ padding: '0 24px' }}>
              {salvando ? 'Salvando…' : (
                passo.kind === 'welcome' ? 'Vamos começar' :
                passo.kind === 'done' ? ((tipo === 'clinica' && perfil === 'clinica') ? 'Ir pro painel' : 'Ir pro dashboard') :
                'Continuar'
              )}
            </Button>
          )}
        </div>
      </main>
    </div>
  )
}
