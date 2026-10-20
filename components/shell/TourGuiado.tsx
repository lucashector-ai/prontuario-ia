'use client'
/**
 * Tour guiado em balões: aponta para cada parte da tela (menu por seção, busca, avisos,
 * checklist, conta) e termina com "por onde começar" — diferente para clínica, médico
 * e recepção. Os alvos são marcados com data-tour="..." no Sidebar e no Topbar.
 *
 *   iniciarTour()             abre de qualquer lugar (menu da conta → "Tour guiado")
 *   c360-tour-pendente = 1    o onboarding pede o tour na primeira entrada
 *   ?tour=1                   abre direto (útil para testar)
 * Quem nunca viu recebe só um convite discreto no canto — nada abre sozinho por cima do trabalho.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import {
  Sparkles, LayoutDashboard, ConciergeBell, Users, Stethoscope, ChartColumnBig, Settings2, Search, Bell,
  ListChecks, UserRound, ArrowRight, X, Compass, UserPlus, Upload, MessageCircle, CalendarPlus, Mic, DoorOpen, HeartPulse,
} from 'lucide-react'
import { tokens as T } from '@/lib/design-tokens'
import { ehAtendente } from '@/lib/sessao'
import { CHAVE_TOUR_PENDENTE as PENDENTE, CHAVE_OBJETIVOS, CHAVE_PERFIL_CADASTRO } from '@/lib/onboarding'
import { ehApoio, FILTRO_APOIO } from '@/lib/cargos'

const EVENTO = 'c360:tour'
const LARGURA = 340

export function iniciarTour() { window.dispatchEvent(new Event(EVENTO)) }

type Papel = 'clinica' | 'medico' | 'recepcao'
type Lado = 'direita' | 'baixo' | 'cima'
type Acao = { label: string; desc: string; href: string; icon: LucideIcon; objetivo?: string; soEquipe?: boolean }
type Passo = { alvo?: string; lado?: Lado; icon: LucideIcon; titulo: string; texto: string; papeis?: Papel[]; acoes?: boolean; opcional?: boolean; celular?: boolean }

const PASSOS: Passo[] = [
  { icon: Sparkles, titulo: 'Bem-vindo ao Clinical 360', texto: 'Em um minuto você vê onde fica cada coisa. Use as setas do teclado ou os botões — dá para sair quando quiser.' },
  { alvo: 'nav-celular', lado: 'cima', icon: LayoutDashboard, titulo: 'O menu fica aqui embaixo', celular: true, texto: 'Os quatro lugares do seu dia a dia ficam aqui. Em "Mais" está todo o resto do sistema.' },
  { alvo: 'menu-inicio', lado: 'direita', icon: LayoutDashboard, titulo: 'Início: o seu dia', texto: 'Dashboard com o resumo do dia e a Agenda, onde você marca, confirma, remarca e encaixa consultas.' },
  { alvo: 'menu-atendimento', lado: 'direita', icon: ConciergeBell, titulo: 'Atendimento: o caminho do paciente', texto: 'A Central de atendimento junta tudo do dia: Agora (a clínica neste momento), Recepção, Triagem, Consultório, Saídas e retornos e as telas da TV. Fixe o seu posto e use tela cheia (tecla F). O Chat junta WhatsApp, Instagram e Messenger.' },
  { alvo: 'menu-pacientes', lado: 'direita', icon: Users, titulo: 'Pacientes', texto: 'Cadastro, histórico completo, retornos pendentes e formulários. Importe sua base por planilha em Pacientes → Importar.' },
  { alvo: 'menu-clinico', lado: 'direita', icon: Stethoscope, titulo: 'Consulta e IA', papeis: ['clinica', 'medico'], texto: 'Grave a consulta e a IA escreve o prontuário. Teleconsulta, análise de exames, assistente e seus modelos de prontuário ficam aqui.' },
  { alvo: 'menu-gestao', lado: 'direita', icon: ChartColumnBig, titulo: 'Gestão', texto: 'Indicadores do dia em tempo real, relatórios e faturamento de convênios (TISS).' },
  { alvo: 'menu-config', lado: 'direita', icon: Settings2, titulo: 'Configurações', texto: 'Dados da clínica, equipe, salas, painel da TV, totem e a sua agenda pública para o paciente marcar sozinho.' },
  { alvo: 'personalizar', opcional: true, lado: 'direita', icon: Settings2, titulo: 'Deixe o menu do seu jeito', texto: 'Clique no nome de uma seção para recolher. Em "Personalizar menu" você esconde o que não usa.' },
  { alvo: 'busca', lado: 'baixo', icon: Search, titulo: 'Busca rápida (⌘K)', texto: 'Ache qualquer paciente por nome, CPF ou telefone — abre a ficha na hora, em qualquer tela. Também leva a qualquer página.' },
  { alvo: 'notificacoes', lado: 'baixo', icon: Bell, titulo: 'Tudo avisa você', texto: 'Chegadas, saídas do consultório, retornos, confirmações e mensagens aparecem aqui e num aviso no canto da tela.' },
  { alvo: 'checklist', opcional: true, lado: 'direita', icon: ListChecks, titulo: 'Primeiros passos', papeis: ['clinica'], texto: 'Esta lista mostra o que falta configurar. Siga de cima para baixo e a clínica fica pronta para atender.' },
  { alvo: 'conta', lado: 'baixo', icon: UserRound, titulo: 'Sua conta', texto: 'Perfil, dados da clínica e sair. Este tour fica aqui também, em "Tour guiado".' },
  { icon: Compass, titulo: 'Por onde começar', texto: 'Sugestões para o primeiro dia:', acoes: true },
]

// Sugestões finais. `objetivo` casa com o que a pessoa marcou no onboarding (sobe para o topo).
const ACOES: Record<Papel, Acao[]> = {
  clinica: [
    { label: 'Cadastrar a equipe', desc: 'Médicos e recepção com acesso próprio', href: '/admin?add=medico', icon: UserPlus, soEquipe: true },
    { label: 'Fazer uma consulta com IA', desc: 'Grave e receba o prontuário pronto', href: '/nova-consulta', icon: Mic, objetivo: 'ia' },
    { label: 'Abrir a agenda', desc: 'Horários, encaixes e confirmações', href: '/agenda', icon: CalendarPlus, objetivo: 'agenda' },
    { label: 'Montar a recepção', desc: 'Salas, painel da TV e totem', href: '/minha-clinica?aba=atendimento', icon: ConciergeBell, objetivo: 'recepcao', soEquipe: true },
    { label: 'Conectar o WhatsApp', desc: 'Atenda e confirme consultas pelo Chat', href: '/minha-clinica?aba=canais', icon: MessageCircle, objetivo: 'whatsapp' },
    { label: 'Faturar convênios', desc: 'Guias TISS dos atendimentos', href: '/faturamento', icon: ChartColumnBig, objetivo: 'tiss' },
    { label: 'Importar pacientes', desc: 'Traga sua base por planilha', href: '/pacientes', icon: Upload },
  ],
  medico: [
    { label: 'Fazer uma consulta com IA', desc: 'Grave e receba o prontuário pronto', href: '/nova-consulta', icon: Mic },
    { label: 'Abrir o consultório', desc: 'Veja quem está esperando e chame', href: '/atendimento/consultorio', icon: DoorOpen },
    { label: 'Ver a agenda', desc: 'Seus horários de hoje e da semana', href: '/agenda', icon: CalendarPlus },
  ],
  recepcao: [
    { label: 'Abrir a Central de atendimento', desc: 'Check-in, senhas e fila do dia', href: '/atendimento/recepcao', icon: ConciergeBell },
    { label: 'Agendar uma consulta', desc: 'Encaixe e confirmações', href: '/agenda', icon: CalendarPlus },
    { label: 'Triagem', desc: 'Sinais vitais e classificação de risco', href: '/atendimento/triagem', icon: HeartPulse },
  ],
}

function sugestoes(papel: Papel): Acao[] {
  if (papel !== 'clinica') return ACOES[papel]
  let objetivos: string[] = [], autonomo = false
  try {
    objetivos = JSON.parse(localStorage.getItem(CHAVE_OBJETIVOS) || '[]')
    autonomo = localStorage.getItem(CHAVE_PERFIL_CADASTRO) === 'autonomo'
    // Plano Grátis é para uso individual: nada de equipe/recepção nas sugestões
    if (sessionStorage.getItem('c360-plano') === 'gratis') autonomo = true
  } catch {}
  const lista = ACOES.clinica.filter(a => !(autonomo && a.soEquipe))
  const peso = (a: Acao) => a.objetivo && objetivos.includes(a.objetivo) ? 0 : a.soEquipe ? 1 : a.objetivo ? 3 : 2
  return lista.map((a, i) => ({ a, i })).sort((x, y) => peso(x.a) - peso(y.a) || x.i - y.i).slice(0, 4).map(x => x.a)
}

function usuarioAtual(): { id: string; papel: Papel } | null {
  try {
    const ca = localStorage.getItem('clinica_admin')
    if (ca) return { id: JSON.parse(ca).id || 'admin', papel: 'clinica' }
    const m = localStorage.getItem('medico')
    if (m) { const d = JSON.parse(m); return { id: d.id || 'medico', papel: ehApoio(d.cargo) ? 'recepcao' : d.cargo === 'admin' ? 'clinica' : 'medico' } }
  } catch {}
  return null
}
const chaveVisto = (id: string) => 'c360-tour-visto:' + id

export function TourGuiado() {
  const router = useRouter()
  const pathname = usePathname()
  const [ativo, setAtivo] = useState(false)
  const [convite, setConvite] = useState(false)
  const [idx, setIdx] = useState(0)
  const [passos, setPassos] = useState<Passo[]>([])
  const [papel, setPapel] = useState<Papel>('medico')
  const [alvo, setAlvo] = useState<DOMRect | null>(null)
  const [altura, setAltura] = useState(220)
  const balao = useRef<HTMLDivElement>(null)
  const usuario = useRef<{ id: string; papel: Papel } | null>(null)

  const marcarVisto = () => { try { if (usuario.current) localStorage.setItem(chaveVisto(usuario.current.id), '1') } catch {} }

  const abrir = useCallback(() => {
    const u = usuarioAtual()
    usuario.current = u
    const p: Papel = u?.papel || 'medico'
    setPapel(p)
    // Passos opcionais só entram se o alvo está à vista (ex.: checklist já concluído some)
    const visivel = (alvo: string) => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${alvo}"]`)
      const r = el?.getBoundingClientRect()
      return !!el && !!r && r.width > 0 && r.height > 0 && parseFloat(getComputedStyle(el).opacity) > 0.1
    }
    // No celular o menu lateral não existe: um passo aponta a barra de baixo no lugar das seções
    const celular = window.innerWidth < 760
    const doMenuLateral = (s: Passo) => !!s.alvo && (s.alvo.startsWith('menu-') || s.alvo === 'personalizar' || s.alvo === 'checklist')
    setPassos(PASSOS.filter(s =>
      (!s.papeis || s.papeis.includes(p)) && (!s.opcional || visivel(s.alvo!)) &&
      (celular ? !doMenuLateral(s) : !s.celular)))
    setIdx(0); setConvite(false); setAtivo(true)
  }, [])

  // Disparos: evento global, pedido do onboarding, ?tour=1 ou convite para quem nunca viu
  useEffect(() => {
    const onEvento = () => abrir()
    window.addEventListener(EVENTO, onEvento)
    let t: ReturnType<typeof setTimeout> | undefined
    try {
      const u = usuarioAtual()
      const atendente = ehAtendente()
      const porUrl = new URLSearchParams(window.location.search).get('tour') === '1'
      if (porUrl || localStorage.getItem(PENDENTE) === '1') {
        localStorage.removeItem(PENDENTE)
        t = setTimeout(abrir, 900)
      } else if (u && !atendente && !localStorage.getItem(chaveVisto(u.id))) {
        usuario.current = u
        t = setTimeout(() => setConvite(true), 2500)
      }
    } catch {}
    return () => { window.removeEventListener(EVENTO, onEvento); if (t) clearTimeout(t) }
  }, [abrir])

  const passo = passos[idx]

  // Abre no menu a seção explicada (o Sidebar escuta) e fecha ao sair do tour
  useEffect(() => {
    const secao = ativo && passo?.alvo?.startsWith('menu-') ? passo.alvo.slice(5) : null
    window.dispatchEvent(new CustomEvent('c360:tour-secao', { detail: secao }))
  }, [ativo, passo])

  // Mede o alvo (e acompanha rolagem/redimensionamento)
  useLayoutEffect(() => {
    if (!ativo || !passo) return
    const medir = () => {
      const el = passo.alvo ? document.querySelector<HTMLElement>(`[data-tour="${passo.alvo}"]`) : null
      const r = el?.getBoundingClientRect()
      setAlvo(r && r.width > 0 && r.height > 0 ? r : null)
      if (balao.current) setAltura(balao.current.offsetHeight)
    }
    const el = passo.alvo ? document.querySelector<HTMLElement>(`[data-tour="${passo.alvo}"]`) : null
    el?.scrollIntoView({ block: 'nearest' })
    medir()
    const t = setTimeout(medir, 60)
    const t2 = setTimeout(() => { el?.scrollIntoView({ block: 'nearest' }); medir() }, 320)
    window.addEventListener('resize', medir)
    window.addEventListener('scroll', medir, true)
    return () => { clearTimeout(t); clearTimeout(t2); window.removeEventListener('resize', medir); window.removeEventListener('scroll', medir, true) }
  }, [ativo, passo, idx])

  const fechar = useCallback(() => { setAtivo(false); marcarVisto() }, [])
  const proximo = useCallback(() => { if (idx < passos.length - 1) setIdx(idx + 1); else fechar() }, [idx, passos.length, fechar])
  const anterior = useCallback(() => { if (idx > 0) setIdx(idx - 1) }, [idx])

  useEffect(() => {
    if (!ativo) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fechar()
      else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); proximo() }
      else if (e.key === 'ArrowLeft') anterior()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ativo, proximo, anterior, fechar])

  // Fecha se a pessoa trocar de página no meio
  useEffect(() => { setAtivo(false) }, [pathname])

  if (convite && !ativo) {
    return (
      <div role="dialog" aria-label="Convite para o tour" style={{
        position: 'fixed', left: 18, bottom: 18, zIndex: 85, width: 'min(330px, calc(100vw - 36px))', padding: 16, borderRadius: 16,
        background: '#fff', border: `1px solid ${T.border.default}`, boxShadow: '0 18px 40px -12px rgba(30, 20, 70, .28)',
        animation: 'c360-tour-entra .3s ease-out', display: 'flex', gap: 12,
      }}>
        <style dangerouslySetInnerHTML={{ __html: '@keyframes c360-tour-entra { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } } @media (max-width: 759px) { [aria-label="Convite para o tour"] { bottom: 96px !important } }' }} />
        <span style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, display: 'grid', placeItems: 'center', background: T.brand.primaryLight, color: T.brand.primary }}><Compass size={19} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text.primary }}>Primeira vez por aqui?</div>
          <div style={{ fontSize: 12.5, color: T.text.secondary, lineHeight: 1.45, marginTop: 2 }}>Um tour de 1 minuto mostra onde fica cada coisa e por onde começar.</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={abrir} style={botao(true)}>Fazer o tour</button>
            <button onClick={() => { setConvite(false); marcarVisto() }} style={botao(false)}>Agora não</button>
          </div>
        </div>
      </div>
    )
  }

  if (!ativo || !passo) return null

  // Posição do balão: ao lado do alvo (menu) ou abaixo (topo); sem alvo, no centro
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const larg = Math.min(LARGURA, vw - 32)
  const PAD = 6
  let pos: { left: number; top: number }
  let seta: { left?: number; top?: number; lado: 'esq' | 'cima' | 'baixo' } | null = null
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
  if (alvo && passo.lado === 'direita' && alvo.right + 16 + larg < vw) {
    const top = clamp(alvo.top + alvo.height / 2 - altura / 2, 16, vh - altura - 16)
    pos = { left: alvo.right + PAD + 14, top }
    seta = { lado: 'esq', top: clamp(alvo.top + alvo.height / 2 - top - 7, 16, altura - 30) }
  } else if (alvo && passo.lado === 'cima' && alvo.top - 16 - altura > 0) {
    const left = clamp(alvo.left + alvo.width / 2 - larg / 2, 16, vw - larg - 16)
    pos = { left, top: alvo.top - PAD - 14 - altura }
    seta = { lado: 'baixo', left: clamp(alvo.left + alvo.width / 2 - left - 7, 16, larg - 30) }
  } else if (alvo && alvo.bottom + 16 + altura < vh) {
    const left = clamp(alvo.left + alvo.width / 2 - larg / 2, 16, vw - larg - 16)
    pos = { left, top: alvo.bottom + PAD + 14 }
    seta = { lado: 'cima', left: clamp(alvo.left + alvo.width / 2 - left - 7, 16, larg - 30) }
  } else {
    pos = { left: (vw - larg) / 2, top: Math.max(16, (vh - altura) / 2) }
  }

  const Icone = passo.icon
  // id novo sempre que o alvo muda: o navegador redesenha a máscara na hora
  const idMascara = `c360-tour-furo-${idx}-${alvo ? [alvo.left, alvo.top, alvo.width, alvo.height].map(Math.round).join('-') : 'x'}`
  const ultimo = idx === passos.length - 1
  const ir = (href: string) => { fechar(); router.push(href) }

  return (
    <div role="dialog" aria-modal="true" aria-label={passo.titulo} style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
      {/* Fundo escurecido com um "furo" no alvo; também bloqueia cliques no app */}
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }} onClick={e => e.stopPropagation()}>
        <defs>
          <mask id={idMascara}>
            <rect width="100%" height="100%" fill="#fff" />
            {alvo && <rect x={alvo.left - PAD} y={alvo.top - PAD} width={alvo.width + PAD * 2} height={alvo.height + PAD * 2} rx={14} fill="#000" />}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(20, 16, 40, .5)" mask={`url(#${idMascara})`} />
        {alvo && <rect x={alvo.left - PAD} y={alvo.top - PAD} width={alvo.width + PAD * 2} height={alvo.height + PAD * 2} rx={14} fill="none" stroke="rgba(255,255,255,.9)" strokeWidth={2} />}
      </svg>
      <div ref={balao} key={idx} style={{
        position: 'absolute', left: pos.left, top: pos.top, width: larg, boxSizing: 'border-box', padding: 18, borderRadius: 18,
        background: '#fff', border: `1px solid ${T.border.default}`, boxShadow: '0 24px 60px -16px rgba(20, 12, 60, .45)',
        animation: 'c360-tour-balao .28s ease-out',
      }}>
        <style dangerouslySetInnerHTML={{ __html: '@keyframes c360-tour-balao { from { opacity: 0; transform: scale(.97) translateY(4px) } to { opacity: 1; transform: none } }' }} />
        {seta && (
          <span style={{
            position: 'absolute', width: 14, height: 14, background: '#fff', transform: 'rotate(45deg)',
            ...(seta.lado === 'esq'
              ? { left: -8, top: seta.top, borderLeft: `1px solid ${T.border.default}`, borderBottom: `1px solid ${T.border.default}` }
              : seta.lado === 'baixo'
                ? { bottom: -8, left: seta.left, borderRight: `1px solid ${T.border.default}`, borderBottom: `1px solid ${T.border.default}` }
                : { top: -8, left: seta.left, borderLeft: `1px solid ${T.border.default}`, borderTop: `1px solid ${T.border.default}` }),
          }} />
        )}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <span style={{ width: 36, height: 36, borderRadius: 11, flexShrink: 0, display: 'grid', placeItems: 'center', background: T.brand.primaryLight, color: T.brand.primary }}><Icone size={18} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.brand.primary, letterSpacing: '.04em', textTransform: 'uppercase' }}>{idx + 1} de {passos.length}</div>
            <div style={{ fontSize: 15.5, fontWeight: 700, color: T.text.primary, letterSpacing: '-.01em', marginTop: 2 }}>{passo.titulo}</div>
          </div>
          <button onClick={fechar} aria-label="Fechar tour" style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', color: T.text.tertiary, display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: -4, marginRight: -6 }}><X size={16} /></button>
        </div>
        <p style={{ fontSize: 13.5, lineHeight: 1.55, color: T.text.secondary, margin: '10px 0 0' }}>{passo.texto}</p>

        {passo.acoes && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
            {sugestoes(papel).map(a => (
              <button key={a.label} onClick={() => ir(a.href)} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 12, border: `1px solid ${T.border.default}`,
                background: '#fff', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = T.brand.primaryAccent; e.currentTarget.style.background = T.brand.primarySoftBg }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = T.border.default; e.currentTarget.style.background = '#fff' }}>
                <span style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: 'grid', placeItems: 'center', background: T.bg.page, color: T.brand.primary }}><a.icon size={15} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 650, color: T.text.primary }}>{a.label}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: T.text.quaternary }}>{a.desc}</span>
                </span>
                <ArrowRight size={14} color={T.text.tertiary} />
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
          <div style={{ display: 'flex', gap: 4, flex: 1, flexWrap: 'wrap' }}>
            {passos.map((_, i) => (
              <span key={i} style={{ width: i === idx ? 16 : 6, height: 6, borderRadius: 99, background: i <= idx ? T.brand.primary : T.border.default, transition: 'width .25s, background .25s' }} />
            ))}
          </div>
          {idx > 0 && <button onClick={anterior} style={botao(false)}>Voltar</button>}
          <button onClick={proximo} style={botao(true)}>{ultimo ? 'Concluir' : idx === 0 ? 'Começar' : 'Próximo'}</button>
        </div>
      </div>
    </div>
  )
}

function botao(primario: boolean): React.CSSProperties {
  return {
    height: 32, padding: '0 14px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 650, whiteSpace: 'nowrap',
    border: primario ? 'none' : `1px solid ${T.border.default}`, background: primario ? T.brand.primary : '#fff', color: primario ? '#fff' : T.text.secondary,
  }
}
