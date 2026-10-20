'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import {
  Mic, Users, UserPlus, Check, CircleCheck, CircleAlert, ChevronLeft, ArrowRight, Stethoscope, Building2,
  CalendarCheck, ConciergeBell, HeartPulse, DoorOpen, CalendarHeart, MessageCircle, Wallet, Video, Compass, Sparkles, FileSignature, ListChecks,
} from 'lucide-react'
import { supabase, tokenSessao } from '@/lib/supabase'
import { usePlano } from '@/lib/usePlano'
import { ehGratis } from '@/lib/planos'
import { tokens } from '@/lib/design-tokens'
import { Marca } from '@/components/Marca'
import { Button, Field, Input, IconTile, ProgressBar } from '@/components/ui'
import { primeiroNome } from '@/lib/nome'
import { CHAVE_PERFIL_CADASTRO, CHAVE_OBJETIVOS, CHAVE_TOUR_PENDENTE } from '@/lib/onboarding'
import { ehApoio, FILTRO_APOIO } from '@/lib/cargos'
import { avisoDemo, CLINICA_DEMO, comDemo, ehDemo, MEDICO_DEMO } from '@/lib/demo'

const T = tokens
type TipoConta = 'clinica' | 'medico'
type Perfil = 'autonomo' | 'clinica'
type Kind = 'welcome' | 'perfil' | 'medico-form' | 'recepcao-form' | 'clinica-form' | 'jornada' | 'objetivos' | 'equipe' | 'done'
type Etapa = { icon: LucideIcon; titulo: string; quem: string; texto: string }

const NOME_PASSO: Record<Kind, string> = {
  welcome: 'Boas-vindas', perfil: 'Como você atende', 'medico-form': 'Seus dados', 'recepcao-form': 'Seus dados', 'clinica-form': 'Sua clínica',
  jornada: 'Como funciona', objetivos: 'Por onde começar', equipe: 'Sua equipe', done: 'Pronto',
}

// O caminho do paciente — o que o onboarding explica antes de entrar no sistema
const JORNADA_CLINICA: Etapa[] = [
  { icon: CalendarCheck, titulo: 'Agenda e WhatsApp', quem: 'Recepção e Sofia', texto: 'O paciente marca pela recepção, pela agenda online ou com a Sofia no WhatsApp. A confirmação sai sozinha antes da consulta.' },
  { icon: ConciergeBell, titulo: 'Recepção', quem: 'Recepção', texto: 'Na chegada, check-in com senha (prioridades por lei). O paciente entra na fila do médico e aparece no painel da TV.' },
  { icon: HeartPulse, titulo: 'Triagem', quem: 'Enfermagem', texto: 'Sinais vitais e classificação de risco por cores. Casos urgentes sobem na fila e avisam o médico na hora.' },
  { icon: DoorOpen, titulo: 'Consultório com IA', quem: 'Médico', texto: 'O médico chama pela TV, grava a consulta e a IA escreve o prontuário. Receita Memed e documentos saem dali mesmo.' },
  { icon: CalendarHeart, titulo: 'Saída e retorno', quem: 'Médico → Recepção', texto: 'O médico só diz "retorno em 30 dias": a recepção recebe o aviso, agenda e manda a mensagem ao paciente.' },
]
const JORNADA_AUTONOMO: Etapa[] = [
  { icon: CalendarCheck, titulo: 'Agenda e WhatsApp', quem: 'Você ou a Sofia', texto: 'Pacientes marcam pela sua agenda online ou com a Sofia no WhatsApp. Lembretes e confirmações saem sozinhos.' },
  { icon: Mic, titulo: 'Consulta com IA', quem: 'Você', texto: 'Aperte gravar e converse normalmente. Em segundos você tem o prontuário SOAP completo, com CIDs sugeridos.' },
  { icon: FileSignature, titulo: 'Receitas e documentos', quem: 'Você', texto: 'Prescrição Memed com validade ICP-Brasil, atestados e pedidos de exame — enviados direto ao paciente.' },
  { icon: CalendarHeart, titulo: 'Retorno e acompanhamento', quem: 'Você e a Sofia', texto: 'Defina o retorno e o sistema lembra o paciente na época certa. Todo o histórico fica numa ficha só.' },
]
const JORNADA_MEDICO: Etapa[] = [
  { icon: DoorOpen, titulo: 'Abra o consultório', quem: 'Você', texto: 'Escolha a sala e veja quem já chegou, com a triagem feita e o risco em cores.' },
  { icon: ConciergeBell, titulo: 'Chame o paciente', quem: 'Você', texto: 'Um clique chama na TV da recepção, com voz. Nada é chamado sem você autorizar.' },
  { icon: Mic, titulo: 'Grave a consulta', quem: 'Você', texto: 'A IA escreve o prontuário enquanto você conversa. Revise, ajuste e assine.' },
  { icon: CalendarHeart, titulo: 'Finalize e diga o retorno', quem: 'Você → Recepção', texto: 'Diga "retorno em X dias" e a recepção recebe o aviso para agendar.' },
]
const JORNADA_RECEPCAO: Etapa[] = [
  { icon: CalendarCheck, titulo: 'Agenda', quem: 'Você', texto: 'Marque, encaixe e confirme consultas. Confirmações do WhatsApp chegam aqui.' },
  { icon: ConciergeBell, titulo: 'Check-in e senha', quem: 'Você', texto: 'Na chegada, faça o check-in: o paciente ganha senha e entra na fila do médico.' },
  { icon: HeartPulse, titulo: 'Triagem', quem: 'Enfermagem', texto: 'Sinais vitais e risco por cores — os urgentes passam na frente.' },
  { icon: CalendarHeart, titulo: 'Saída e retorno', quem: 'Médico → Você', texto: 'Quando o médico encerra, você recebe um aviso com o retorno pedido para agendar.' },
]

const JORNADA_ENFERMAGEM: Etapa[] = [
  { icon: ConciergeBell, titulo: 'Chegada', quem: 'Recepção', texto: 'O paciente faz o check-in, ganha senha e entra na fila da triagem.' },
  { icon: HeartPulse, titulo: 'Triagem', quem: 'Você', texto: 'Chame pela TV, registre os sinais vitais e o risco por cores. Os urgentes passam na frente.' },
  { icon: Stethoscope, titulo: 'Consultório', quem: 'Médico', texto: 'O médico vê a sua triagem antes de chamar o paciente.' },
]

const OBJETIVOS: { id: string; icon: LucideIcon; titulo: string; sub: string; soEquipe?: boolean }[] = [
  { id: 'ia', icon: Mic, titulo: 'Prontuário com IA', sub: 'Gravar e escrever menos' },
  { id: 'agenda', icon: CalendarCheck, titulo: 'Agenda e confirmações', sub: 'Menos faltas' },
  { id: 'whatsapp', icon: MessageCircle, titulo: 'WhatsApp com a Sofia', sub: 'Atender 24 horas' },
  { id: 'recepcao', icon: ConciergeBell, titulo: 'Recepção, fila e TV', sub: 'Organizar a espera', soEquipe: true },
  { id: 'tiss', icon: Wallet, titulo: 'Faturamento de convênios', sub: 'Guias TISS sem retrabalho' },
  { id: 'teleconsulta', icon: Video, titulo: 'Teleconsulta', sub: 'Atender a distância' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [tipo, setTipo] = useState<TipoConta | null>(null)
  const [recepcao, setRecepcao] = useState(false)
  const [enfermagem, setEnfermagem] = useState(false)
  // Perfil escolhido no cadastro/onboarding — só decide o fluxo e as sugestões (não é a identidade da conta)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [perfilDoCadastro, setPerfilDoCadastro] = useState(false)
  const [usuario, setUsuario] = useState<any>(null)
  const [passoIdx, setPassoIdx] = useState(0)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [etapaAberta, setEtapaAberta] = useState(0)
  const [objetivos, setObjetivos] = useState<string[]>([])
  const plano = usePlano()
  const [rede, setRede] = useState(false)
  useEffect(() => { try { setRede(localStorage.getItem('c360-tipo-conta') === 'rede') } catch {} }, [])
  const [pedidoPlano, setPedidoPlano] = useState(false)
  async function pedirPlanoCompleto() {
    if (ehDemo()) { avisoDemo(); setPedidoPlano(true); return }
    try {
      const t = tokenSessao()
      await fetch('/api/planos/interesse', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: JSON.stringify({ recurso: 'Equipe com mais pessoas' }) })
      setPedidoPlano(true)
    } catch { notificarErro() }
  }
  const notificarErro = () => setErro('Não foi possível enviar agora. Tente de novo.')

  const [formMedico, setFormMedico] = useState({ nome: '', crm: '', especialidade: '' })
  const [formClinica, setFormClinica] = useState({ nome: '', telefone: '', endereco: '' })

  useEffect(() => {
    // Demonstração: mostra o primeiro acesso de uma clínica fictícia (nada é gravado)
    if (ehDemo()) {
      setUsuario({ ...MEDICO_DEMO, onboarding_concluido: false })
      setTipo('clinica')
      setFormMedico({ nome: MEDICO_DEMO.nome, crm: MEDICO_DEMO.crm, especialidade: MEDICO_DEMO.especialidade })
      setFormClinica({ nome: CLINICA_DEMO.nome, telefone: '(11) 3000-0000', endereco: 'Av. Exemplo, 1000 — São Paulo, SP' })
      return
    }
    const ca = localStorage.getItem('clinica_admin')
    const m = localStorage.getItem('medico')
    const dados = ca ? JSON.parse(ca) : (m ? JSON.parse(m) : null)
    const tp: TipoConta | null = ca ? 'clinica' : (m ? 'medico' : null)
    if (!dados || !tp) { router.replace('/login'); return }

    // Já concluiu: vai direto
    if (dados.onboarding_concluido) {
      router.replace(tp === 'clinica' ? '/dashboard' : dados.cargo === 'enfermagem' ? '/atendimento/triagem' : dados.cargo === 'recepcionista' ? '/atendimento/recepcao' : '/dashboard')
      return
    }

    setUsuario(dados)
    setTipo(tp)
    setRecepcao(tp === 'medico' && ehApoio(dados.cargo))
    setEnfermagem(tp === 'medico' && dados.cargo === 'enfermagem')
    setFormMedico({ nome: dados.nome || '', crm: dados.crm || '', especialidade: dados.especialidade || '' })
    try {
      const p = localStorage.getItem(CHAVE_PERFIL_CADASTRO) as Perfil | null
      if (p === 'autonomo' || p === 'clinica') { setPerfil(p); setPerfilDoCadastro(true) }
    } catch {}
    if (tp === 'clinica' && dados.clinica_id) {
      supabase.from('clinicas').select('nome, telefone, endereco').eq('id', dados.clinica_id).single()
        .then(({ data }) => { if (data) setFormClinica({ nome: data.nome || '', telefone: data.telefone || '', endereco: data.endereco || '' }) })
    }
  }, [router])

  const kinds: Kind[] = !tipo ? [] : tipo === 'clinica' ? [
    'welcome',
    ...(perfilDoCadastro ? [] : ['perfil' as Kind]),
    'clinica-form', 'jornada', 'objetivos',
    ...(perfil === 'clinica' ? ['equipe' as Kind] : []),
    'done',
  ] : recepcao ? ['welcome', 'recepcao-form', 'jornada', 'done']
    : perfil === 'autonomo' ? ['welcome', 'medico-form', 'jornada', 'objetivos', 'done']
    : ['welcome', 'medico-form', 'jornada', 'done']

  const kind = kinds[passoIdx]
  const total = kinds.length
  const progresso = total > 0 ? ((passoIdx + 1) / total) * 100 : 0
  // Autônomo entra como médico-administrador (tipo 'medico'), mas a jornada é a de quem atende sozinho
  const jornada = perfil === 'autonomo' ? JORNADA_AUTONOMO : tipo === 'medico' ? (enfermagem ? JORNADA_ENFERMAGEM : recepcao ? JORNADA_RECEPCAO : JORNADA_MEDICO) : JORNADA_CLINICA

  async function salvarMedico(): Promise<boolean> {
    if (!usuario || tipo !== 'medico') return false
    if (!formMedico.nome.trim()) { setErro('Preencha seu nome para continuar.'); return false }
    if (!recepcao && !formMedico.crm.trim()) { setErro('Preencha o CRM — ele sai nos prontuários e receitas.'); return false }
    if (ehDemo()) return true // demonstração: segue sem gravar
    setSalvando(true); setErro('')
    try {
      const updates = recepcao
        ? { nome: formMedico.nome.trim() }
        : { nome: formMedico.nome.trim(), crm: formMedico.crm.trim(), especialidade: formMedico.especialidade.trim() || null }
      const { error } = await supabase.from('medicos').update(updates).eq('id', usuario.id)
      if (error) throw error
      const novo = { ...usuario, ...updates }
      setUsuario(novo)
      localStorage.setItem('medico', JSON.stringify(novo))
      return true
    } catch (e: any) {
      setErro(e.message || 'Não foi possível salvar seus dados. Tente de novo.')
      return false
    } finally {
      setSalvando(false)
    }
  }

  async function salvarClinica(): Promise<boolean> {
    if (!usuario || tipo !== 'clinica') return false
    if (!formClinica.nome.trim()) { setErro(perfil === 'autonomo' ? 'Dê um nome ao consultório.' : 'O nome da clínica é obrigatório.'); return false }
    if (ehDemo()) return true // demonstração: segue sem gravar
    if (!usuario.clinica_id) { setErro('Conta sem clínica vinculada. Fale com o suporte.'); return false }
    setSalvando(true); setErro('')
    try {
      const updates = { nome: formClinica.nome.trim(), telefone: formClinica.telefone.trim() || null, endereco: formClinica.endereco.trim() || null }
      const { error } = await supabase.from('clinicas').update(updates).eq('id', usuario.clinica_id)
      if (error) throw error
      try {
        const c = JSON.parse(localStorage.getItem('clinica') || '{}')
        localStorage.setItem('clinica', JSON.stringify({ ...c, ...updates }))
      } catch {}
      return true
    } catch (e: any) {
      setErro(e.message || 'Não foi possível salvar seus dados. Tente de novo.')
      return false
    } finally {
      setSalvando(false)
    }
  }

  async function concluir({ tour, destino }: { tour: boolean; destino?: string }) {
    if (!usuario || !tipo) return
    if (ehDemo()) {
      // Nada é gravado (nem no navegador): volta ao Início do demo, com o tour se pedido
      avisoDemo()
      const alvo = destino ?? '/dashboard'
      router.replace(comDemo(tour ? alvo + (alvo.includes('?') ? '&' : '?') + 'tour=1' : alvo))
      return
    }
    setSalvando(true)
    try {
      const tabela = tipo === 'medico' ? 'medicos' : 'clinica_admins'
      await supabase.from(tabela).update({ onboarding_concluido: true }).eq('id', usuario.id)
      const novo = { ...usuario, onboarding_concluido: true }
      localStorage.setItem(tipo === 'medico' ? 'medico' : 'clinica_admin', JSON.stringify(novo))
      try {
        if (perfil) localStorage.setItem(CHAVE_PERFIL_CADASTRO, perfil)
        localStorage.setItem(CHAVE_OBJETIVOS, JSON.stringify(objetivos))
        if (tour) localStorage.setItem(CHAVE_TOUR_PENDENTE, '1')
      } catch {}
      router.replace(destino ?? (enfermagem ? '/atendimento/triagem' : recepcao ? '/atendimento/recepcao' : '/dashboard'))
    } finally {
      setSalvando(false)
    }
  }

  async function avancar() {
    setErro('')
    if (kind === 'perfil' && !perfil) { setErro('Escolha uma opção para continuar.'); return }
    if (kind === 'medico-form' || kind === 'recepcao-form') { if (!(await salvarMedico())) return }
    if (kind === 'clinica-form') { if (!(await salvarClinica())) return }
    if (kind === 'jornada') setEtapaAberta(0)
    if (passoIdx < kinds.length - 1) setPassoIdx(passoIdx + 1)
    else concluir({ tour: true })
  }

  function voltar() { setErro(''); if (passoIdx > 0) setPassoIdx(passoIdx - 1) }

  if (!tipo || !kind) return null

  const overline: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: T.brand.primary, textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 0 12px' }
  const titulo: React.CSSProperties = { fontSize: 28, fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1.15, margin: '0 0 10px', color: T.text.primary }
  const descricao: React.CSSProperties = { fontSize: 15, color: T.text.secondary, lineHeight: 1.6, margin: '0 0 24px' }
  const campo = { minHeight: 44 }
  const nomeLugar = perfil === 'autonomo' ? 'consultório' : 'clínica'
  const nome = primeiroNome(usuario?.nome, '')

  const rotuloBotao =
    kind === 'welcome' ? 'Vamos lá' :
    kind === 'jornada' ? 'Entendi' :
    kind === 'objetivos' ? (objetivos.length ? 'Continuar' : 'Pular') :
    'Continuar'

  return (
    <div style={{ minHeight: '100dvh', background: T.bg.card, display: 'flex', overflow: 'hidden' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .ob-left { display: flex; }
        @media (max-width: 900px) {
          .ob-left { display: none !important; }
          .ob-right { padding: 20px 16px !important; }
          .ob-obj { grid-template-columns: 1fr !important; }
        }
        .ob-fadein { animation: ob-fadein 0.35s ease; }
        @keyframes ob-fadein { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
      ` }} />

      {/* Lado: mapa do onboarding */}
      <aside className="ob-left" style={{
        width: '38%', maxWidth: 520, background: `linear-gradient(160deg, ${T.brand.primary} 0%, ${T.brand.primaryDark} 100%)`,
        color: 'white', padding: 48, flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -200, right: -200, width: 500, height: 500, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', filter: 'blur(40px)' }} />
        <div style={{ position: 'relative' }}><Marca altura={28} style={{ filter: 'brightness(0) invert(1)' }} /></div>

        <div style={{ position: 'relative' }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', opacity: 0.8, margin: '0 0 14px' }}>Primeiro acesso</p>
          <h2 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1.12, margin: '0 0 28px' }}>
            {tipo === 'clinica' ? `Vamos deixar ${perfil === 'autonomo' ? 'seu consultório' : 'sua clínica'} pronta para atender.` : 'Vamos deixar tudo pronto para você atender.'}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {kinds.map((k, i) => {
              const feito = i < passoIdx, atual = i === passoIdx
              return (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 0', opacity: atual ? 1 : feito ? 0.85 : 0.55 }}>
                  <span style={{
                    width: 24, height: 24, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', fontSize: 11.5, fontWeight: 700,
                    background: atual ? '#fff' : feito ? 'rgba(255,255,255,.22)' : 'transparent', color: atual ? T.brand.primary : '#fff',
                    border: atual || feito ? 'none' : '1.5px solid rgba(255,255,255,.45)',
                  }}>{feito ? <Check size={13} strokeWidth={2.4} /> : i + 1}</span>
                  <span style={{ fontSize: 14.5, fontWeight: atual ? 700 : 500 }}>{NOME_PASSO[k]}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ position: 'relative', fontSize: 13, opacity: 0.75 }}>Leva uns 2 minutos · dá para mudar tudo depois</div>
      </aside>

      <main className="ob-right" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '36px 56px', minWidth: 0, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 36 }}>
          <div style={{ minWidth: 80 }}>
            {passoIdx > 0 && <Button variant="ghost" size="sm" icon={ChevronLeft} onClick={voltar} style={{ color: T.text.muted }}>Voltar</Button>}
          </div>
          <div style={{ flex: 1, maxWidth: 260, margin: '0 24px' }}><ProgressBar valor={progresso} altura={4} /></div>
          <div style={{ minWidth: 80, textAlign: 'right', fontSize: 12.5, color: T.text.tertiary }}>{passoIdx + 1} de {total}</div>
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px 0' }}>
          <div key={kind} className="ob-fadein" style={{ width: '100%', maxWidth: 500 }}>

            {kind === 'welcome' && (
              <div>
                <IconTile icon={Sparkles} size={52} radius={16} style={{ marginBottom: 22 }} />
                <p style={overline}>{tipo === 'clinica' || perfil === 'autonomo' ? 'Conta criada' : 'Boas-vindas à equipe'}</p>
                <h1 style={{ ...titulo, fontSize: 32 }}>{nome ? `Olá, ${nome}!` : 'Olá!'} Que bom ter você aqui.</h1>
                <p style={{ ...descricao, fontSize: 16 }}>
                  {tipo === 'clinica'
                    ? 'Antes de entrar, vamos fazer três coisas rápidas:'
                    : enfermagem ? 'Você vai cuidar da triagem dos pacientes. Antes de entrar:' : recepcao ? 'Você vai cuidar da agenda, das chegadas e dos retornos. Antes de entrar:' : 'Antes de abrir seu consultório, três coisas rápidas:'}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(tipo === 'clinica' ? [
                    { icon: Building2, t: 'Confirmar os dados', s: 'O nome que o paciente vê na TV, no WhatsApp e nos documentos' },
                    { icon: Compass, t: 'Entender como funciona', s: 'O caminho do paciente, da agenda ao retorno' },
                    { icon: ListChecks, t: 'Escolher por onde começar', s: 'E um tour em balões mostrando cada parte da tela' },
                  ] : [
                    { icon: Stethoscope, t: 'Confirmar seus dados', s: recepcao ? 'Seu nome aparece para a equipe' : 'Nome e CRM saem nos prontuários e receitas' },
                    { icon: Compass, t: 'Ver como funciona', s: enfermagem ? 'Da chegada ao consultório' : recepcao ? 'Da agenda ao retorno' : 'Do chamado na TV ao prontuário pronto' },
                    { icon: ListChecks, t: 'Tour guiado', s: 'Balões mostrando cada parte da tela' },
                  ]).map((it, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', borderRadius: 14, border: `1px solid ${T.border.default}`, background: '#fff' }}>
                      <span style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: 'grid', placeItems: 'center', background: T.brand.primaryLight, color: T.brand.primary }}><it.icon size={17} /></span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 14.5, fontWeight: 650, color: T.text.primary }}>{it.t}</span>
                        <span style={{ display: 'block', fontSize: 12.5, color: T.text.quaternary, marginTop: 1 }}>{it.s}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {kind === 'perfil' && (
              <div>
                <p style={overline}>Perfil</p>
                <h1 style={titulo}>Como você atende?</h1>
                <p style={descricao}>Isso ajusta o menu, as sugestões e o tour.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {([
                    { key: 'autonomo', titulo: 'Atendo sozinho(a)', sub: 'Médico ou profissional autônomo', icone: Stethoscope },
                    { key: 'clinica', titulo: 'Tenho uma clínica com equipe', sub: 'Médicos, recepção, triagem e gestão', icone: Building2 },
                  ] as const).map(op => {
                    const sel = perfil === op.key
                    return (
                      <button key={op.key} type="button" onClick={() => { setPerfil(op.key); setErro('') }} style={{
                        textAlign: 'left', padding: '16px 18px', borderRadius: 16, cursor: 'pointer', fontFamily: 'inherit',
                        border: `1px solid ${sel ? T.brand.primary : T.border.default}`, background: sel ? T.brand.primarySoftBg : T.bg.card,
                        boxShadow: sel ? T.shadow.focusRing : 'none', display: 'flex', alignItems: 'center', gap: 14,
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

            {(kind === 'medico-form' || kind === 'recepcao-form') && (
              <div>
                <p style={overline}>Sobre você</p>
                <h1 style={titulo}>{recepcao ? 'Como a equipe te chama?' : 'Quem assina os prontuários?'}</h1>
                <p style={descricao}>{recepcao ? 'Seu nome aparece nos registros de check-in e agendamento.' : 'Esses dados saem no rodapé de prontuários, receitas Memed e PDFs.'}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <Field label="Nome completo">
                    <Input style={campo} value={formMedico.nome} onChange={e => setFormMedico({ ...formMedico, nome: e.target.value })} placeholder={enfermagem ? 'Ex.: Bruno Lima' : recepcao ? 'Ex.: Carla Mendes' : 'Ex.: Dr. João Silva'} />
                  </Field>
                  {!recepcao && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <Field label="CRM">
                        <Input style={campo} value={formMedico.crm} onChange={e => setFormMedico({ ...formMedico, crm: e.target.value })} placeholder="12345-SP" />
                      </Field>
                      <Field label="Especialidade">
                        <Input style={campo} value={formMedico.especialidade} onChange={e => setFormMedico({ ...formMedico, especialidade: e.target.value })} placeholder="Cardiologia" />
                      </Field>
                    </div>
                  )}
                </div>
              </div>
            )}

            {kind === 'clinica-form' && (
              <div>
                <p style={overline}>{perfil === 'autonomo' ? 'Seu consultório' : 'Sua clínica'}</p>
                <h1 style={titulo}>Confirme os dados do {nomeLugar}</h1>
                <p style={descricao}>Aparecem para o paciente: na TV da recepção, nas mensagens do WhatsApp, na agenda online e nos documentos.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <Field label={perfil === 'autonomo' ? 'Nome do consultório' : 'Nome da clínica'}>
                    <Input style={campo} value={formClinica.nome} onChange={e => setFormClinica({ ...formClinica, nome: e.target.value })} placeholder="Ex.: Clínica São Lucas" />
                  </Field>
                  <Field label="Telefone de contato" hint="O paciente vê este número nos lembretes.">
                    <Input style={campo} inputMode="tel" value={formClinica.telefone} onChange={e => setFormClinica({ ...formClinica, telefone: e.target.value })} placeholder="(11) 99999-9999" />
                  </Field>
                  <Field label="Endereço" hint="Opcional — vai nas confirmações de consulta.">
                    <Input style={campo} value={formClinica.endereco} onChange={e => setFormClinica({ ...formClinica, endereco: e.target.value })} placeholder="Av. Paulista, 1000 — São Paulo/SP" />
                  </Field>
                </div>
              </div>
            )}

            {kind === 'jornada' && (
              <div>
                <p style={overline}>Como funciona</p>
                <h1 style={titulo}>{perfil === 'autonomo' ? 'O caminho do paciente' : tipo === 'medico' ? (enfermagem ? 'Seu dia na triagem' : recepcao ? 'Seu dia na recepção' : 'Seu dia no consultório') : 'O caminho do paciente'}</h1>
                <p style={descricao}>Cada etapa avisa a próxima sozinha — ninguém precisa sair da tela para chamar o outro. Toque numa etapa para ver.</p>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {jornada.map((e, i) => {
                    const aberta = etapaAberta === i
                    const ultima = i === jornada.length - 1
                    return (
                      <button key={e.titulo} type="button" onClick={() => setEtapaAberta(i)} style={{ display: 'flex', gap: 14, textAlign: 'left', border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}>
                        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                          <span style={{
                            width: 38, height: 38, borderRadius: 12, display: 'grid', placeItems: 'center', transition: 'background .2s, color .2s',
                            background: aberta ? T.brand.primary : T.brand.primaryLight, color: aberta ? '#fff' : T.brand.primary,
                          }}><e.icon size={18} /></span>
                          {!ultima && <span style={{ width: 2, flex: 1, minHeight: 12, background: T.brand.primaryAccentLight, margin: '3px 0' }} />}
                        </span>
                        <span style={{ flex: 1, minWidth: 0, paddingBottom: ultima ? 0 : 12, paddingTop: 2 }}>
                          <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 15, fontWeight: 650, color: T.text.primary }}>{e.titulo}</span>
                            <span style={{ fontSize: 12, color: T.text.tertiary }}>{e.quem}</span>
                          </span>
                          <span style={{ display: 'grid', gridTemplateRows: aberta ? '1fr' : '0fr', transition: 'grid-template-rows .25s ease' }}>
                            <span style={{ overflow: 'hidden', display: 'block' }}>
                              <span style={{ display: 'block', fontSize: 13.5, color: T.text.secondary, lineHeight: 1.55, marginTop: 4 }}>{e.texto}</span>
                            </span>
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {kind === 'objetivos' && (
              <div>
                <p style={overline}>Por onde começar</p>
                <h1 style={titulo}>O que você quer resolver primeiro?</h1>
                <p style={descricao}>Marque quantos quiser. O tour e as sugestões da tela inicial começam por aqui.</p>
                <div className="ob-obj" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {OBJETIVOS.filter(o => !(o.soEquipe && perfil === 'autonomo')).map(o => {
                    const sel = objetivos.includes(o.id)
                    return (
                      <button key={o.id} type="button" onClick={() => setObjetivos(l => sel ? l.filter(x => x !== o.id) : [...l, o.id])} style={{
                        position: 'relative', textAlign: 'left', padding: 14, borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit',
                        border: `1px solid ${sel ? T.brand.primary : T.border.default}`, background: sel ? T.brand.primarySoftBg : '#fff',
                        display: 'flex', flexDirection: 'column', gap: 10, transition: 'border-color .15s, background .15s',
                      }}>
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', background: sel ? T.brand.primary : T.brand.primaryLight, color: sel ? '#fff' : T.brand.primary }}><o.icon size={17} /></span>
                          <span style={{ width: 18, height: 18, borderRadius: 6, border: `1.5px solid ${sel ? T.brand.primary : T.border.strong}`, background: sel ? T.brand.primary : 'transparent', color: '#fff', display: 'grid', placeItems: 'center' }}>
                            {sel && <Check size={11} strokeWidth={2.6} />}
                          </span>
                        </span>
                        <span>
                          <span style={{ display: 'block', fontSize: 14, fontWeight: 650, color: T.text.primary }}>{o.titulo}</span>
                          <span style={{ display: 'block', fontSize: 12.5, color: T.text.quaternary, marginTop: 2 }}>{o.sub}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {kind === 'equipe' && (
              <div>
                <IconTile icon={Users} size={48} radius={15} style={{ marginBottom: 20 }} />
                <p style={overline}>Sua equipe</p>
                <h1 style={titulo}>Quem trabalha com você?</h1>
                <p style={{ ...descricao, margin: '0 0 18px' }}>
                  Cada pessoa tem o próprio acesso e vê só o que precisa: médicos abrem o consultório, a recepção cuida da agenda e das chegadas.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                  {[
                    { icon: Stethoscope, t: 'Médicos', s: 'Consultório, prontuário com IA, receitas' },
                    { icon: ConciergeBell, t: 'Recepção', s: 'Agenda, check-in, senhas, retornos' },
                  ].map(p => (
                    <div key={p.t} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, background: T.bg.page }}>
                      <p.icon size={17} color={T.brand.primary} />
                      <span style={{ fontSize: 14, fontWeight: 650, color: T.text.primary }}>{p.t}</span>
                      <span style={{ fontSize: 12.5, color: T.text.quaternary }}>{p.s}</span>
                    </div>
                  ))}
                </div>
                {ehGratis(plano) ? (
                  <>
                    <div style={{ padding: '12px 14px', borderRadius: 12, background: T.brand.primarySoftBg, border: `1px solid ${T.border.default}`, fontSize: 13.5, color: T.text.secondary, lineHeight: 1.55, marginBottom: 14 }}>
                      Sua conta começa no <b style={{ color: T.text.primary }}>plano Grátis</b>, para usar sozinho. Para cadastrar a equipe, peça o plano completo: a equipe do Clinical 360 fala com você e libera.
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {pedidoPlano ? (
                        <div style={{ padding: '12px 14px', borderRadius: 12, background: T.status.successBg, color: T.status.success, fontSize: 13.5, fontWeight: 600 }}>Pedido recebido. Vamos falar com você.</div>
                      ) : (
                        <Button size="lg" block icon={UserPlus} onClick={pedirPlanoCompleto} disabled={salvando}>Quero o plano completo para a equipe</Button>
                      )}
                      <Button size="lg" block variant="secondary" onClick={avancar} disabled={salvando}>Continuar</Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <Button size="lg" block icon={UserPlus} onClick={() => concluir({ tour: false, destino: '/admin?add=medico' })} disabled={salvando}>
                        {salvando ? 'Salvando…' : 'Cadastrar a equipe agora'}
                      </Button>
                      <Button size="lg" block variant="secondary" onClick={avancar} disabled={salvando}>Depois — continuar</Button>
                    </div>
                    <p style={{ fontSize: 12.5, color: T.text.tertiary, margin: '12px 0 0', textAlign: 'center' }}>Cada pessoa recebe uma senha provisória para o primeiro acesso.</p>
                  </>
                )}
              </div>
            )}

            {kind === 'done' && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 72, height: 72, borderRadius: 22, background: T.status.successBg, color: T.status.success, display: 'grid', placeItems: 'center', margin: '0 auto 22px' }}>
                  <CircleCheck size={34} strokeWidth={1.6} />
                </div>
                <h1 style={{ ...titulo, fontSize: 32 }}>Tudo pronto{nome ? `, ${nome}` : ''}.</h1>
                <p style={{ ...descricao, fontSize: 16, maxWidth: 420, margin: '0 auto 26px' }}>
                  Quer um tour rápido? Balões mostram cada parte da tela — o menu, a busca, os avisos — e onde começar. Leva 1 minuto.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360, margin: '0 auto' }}>
                  <Button size="lg" block icon={Compass} onClick={() => concluir({ tour: true })} disabled={salvando}>{salvando ? 'Entrando…' : 'Entrar com o tour guiado'}</Button>
                  <Button size="lg" block variant="secondary" onClick={() => concluir({ tour: false })} disabled={salvando}>Entrar sem tour</Button>
                </div>
                <p style={{ fontSize: 12.5, color: T.text.tertiary, margin: '14px 0 0' }}>Dá para rever quando quiser no menu da sua conta → Tour guiado.</p>
                {rede && <p style={{ fontSize: 13, color: T.text.secondary, margin: '10px 0 0' }}>Depois, cadastre as outras unidades em <b>Minha clínica → Unidades</b>.</p>}
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

        {/* Equipe e Pronto têm os próprios botões */}
        {kind !== 'equipe' && kind !== 'done' && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Button size="lg" onClick={avancar} disabled={salvando} iconRight={salvando ? undefined : ArrowRight} style={{ padding: '0 24px' }}>
              {salvando ? 'Salvando…' : rotuloBotao}
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}
