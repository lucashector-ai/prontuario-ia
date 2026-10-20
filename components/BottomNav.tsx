'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard, Calendar, CirclePlus, Users, Menu, Clock, Video, ScanSearch, Sparkles, MessageCircle,
  Hospital, SlidersHorizontal, ClipboardList, CalendarCheck, UserRound, LogOut, X, CalendarHeart, ChartColumnBig, ReceiptText, LayoutTemplate,
  ConciergeBell, DoorOpen, HeartPulse, Gauge, Mic, BookA, Coins, Receipt,
} from 'lucide-react'
import { tokens } from '@/lib/design-tokens'
import { Icon } from '@/components/ui'

import { ehAtendente, sairDaConta } from '@/lib/sessao'
import { ehApoio, FILTRO_APOIO } from '@/lib/cargos'
import { usePlano } from '@/lib/usePlano'
import { comDemo, ehDemo, MEDICO_DEMO } from '@/lib/demo'
const T = tokens
type Item = { href: string; label: string; icon: LucideIcon }

/**
 * Barra inferior flutuante (< 760px): 4 atalhos por perfil + "Mais"
 * (folha com o resto do menu). Segue o design v2 — pílula branca com borda e sombra.
 */
export function BottomNav() {
  const router = useRouter()
  const pathname = usePathname()
  const [maisAberto, setMaisAberto] = useState(false)
  const [medico, setMedico] = useState<any>(null)
  const [clinicaAdmin, setClinicaAdmin] = useState<any>(null)

  useEffect(() => {
    if (ehDemo()) { setMedico(MEDICO_DEMO); return } // demonstração: médica com acesso de gestora
    const ca = localStorage.getItem('clinica_admin')
    if (ca) { setClinicaAdmin(JSON.parse(ca)); return }
    const m = localStorage.getItem('medico')
    if (m) setMedico(JSON.parse(m))
  }, [])

  useEffect(() => { setMaisAberto(false) }, [pathname])

  const isRecepcionista = ehApoio(medico?.cargo)
  const [atendente, setAtendente] = useState(false)
  useEffect(() => { setAtendente(ehAtendente()) }, [])
  const temAcessoAdmin = !!clinicaAdmin || medico?.cargo === 'admin'

  const enfermagem = medico?.cargo === 'enfermagem'
  const gratis = usePlano() === 'gratis'
  // Barra por perfil: os 4 lugares do dia a dia de cada um; o resto fica em "Mais" (mesmo menu da lateral)
  const principais: Item[] = atendente ? [{ href: '/chat', label: 'Chat', icon: MessageCircle }]
    : gratis ? [
      { href: '/dashboard', label: 'Início', icon: LayoutDashboard },
      { href: '/agenda', label: 'Agenda', icon: Calendar },
      { href: '/pacientes', label: 'Pacientes', icon: Users },
      { href: '/nova-consulta', label: 'Nova consulta', icon: CirclePlus },
    ] : enfermagem ? [
      { href: '/atendimento/triagem', label: 'Triagem', icon: HeartPulse },
      { href: '/atendimento', label: 'Atendimento', icon: ConciergeBell },
      { href: '/agenda', label: 'Agenda', icon: Calendar },
      { href: '/pacientes', label: 'Pacientes', icon: Users },
    ] : isRecepcionista ? [
      { href: '/atendimento', label: 'Atendimento', icon: ConciergeBell },
      { href: '/agenda', label: 'Agenda', icon: Calendar },
      { href: '/chat', label: 'Chat', icon: MessageCircle },
      { href: '/pacientes', label: 'Pacientes', icon: Users },
    ] : temAcessoAdmin && !!clinicaAdmin ? [
      { href: '/dashboard', label: 'Início', icon: LayoutDashboard },
      { href: '/atendimento', label: 'Atendimento', icon: ConciergeBell },
      { href: '/agenda', label: 'Agenda', icon: Calendar },
      { href: '/pacientes', label: 'Pacientes', icon: Users },
    ] : [
      { href: '/atendimento/consultorio', label: 'Consultório', icon: DoorOpen },
      { href: '/agenda', label: 'Agenda', icon: Calendar },
      { href: '/pacientes', label: 'Pacientes', icon: Users },
      { href: '/nova-consulta', label: 'Nova consulta', icon: CirclePlus },
    ]

  const naoRecep = !isRecepcionista
  const todos: Item[] = atendente ? [] : [
    { href: '/dashboard', label: 'Início', icon: LayoutDashboard },
    { href: '/agenda', label: 'Agenda', icon: Calendar },
    ...(enfermagem ? [{ href: '/atendimento/triagem', label: 'Triagem', icon: HeartPulse }]
      : naoRecep && !clinicaAdmin && !gratis ? [{ href: '/atendimento/consultorio', label: 'Meu consultório', icon: DoorOpen }] : []),
    { href: '/atendimento', label: 'Central de atendimento', icon: ConciergeBell },
    ...(enfermagem ? [] : [{ href: '/chat', label: 'Chat', icon: MessageCircle }]),
    { href: '/pacientes', label: 'Pacientes', icon: Users },
    ...(enfermagem ? [] : [
      { href: '/retornos', label: 'Retornos', icon: CalendarHeart },
      { href: '/orcamentos', label: 'Orçamentos', icon: Receipt },
      { href: '/formularios', label: 'Formulários', icon: ClipboardList },
    ]),
    ...(naoRecep ? [
      { href: '/nova-consulta', label: 'Nova consulta', icon: CirclePlus },
      { href: '/teleconsulta', label: 'Teleconsulta', icon: Video },
      { href: '/exames', label: 'Analisar exames', icon: ScanSearch },
      { href: '/ditado', label: 'Ditado livre', icon: Mic },
      { href: '/assistente-ia', label: 'Assistente IA', icon: Sparkles },
    ] : []),
    ...(temAcessoAdmin && !gratis ? [{ href: '/gestao', label: 'Indicadores', icon: Gauge }] : naoRecep ? [{ href: '/relatorios', label: 'Meus números', icon: ChartColumnBig }] : []),
    ...(enfermagem ? [] : [{ href: '/faturamento', label: 'Convênios (TISS)', icon: ReceiptText }]),
    ...(temAcessoAdmin ? [
      { href: '/minha-clinica', label: 'Minha clínica', icon: Hospital },
      ...(gratis ? [] : [{ href: '/admin', label: 'Equipe', icon: SlidersHorizontal }]),
    ] : []),
    ...(naoRecep ? [
      { href: '/modelos-prontuario', label: 'Modelos de prontuário', icon: LayoutTemplate },
      { href: '/dicionario', label: 'Dicionário da IA', icon: BookA },
      { href: '/configuracoes/agenda-publica', label: 'Agenda online', icon: CalendarCheck },
    ] : []),
    { href: '/planos', label: 'Planos e créditos', icon: Coins },
    { href: '/perfil', label: 'Meu perfil', icon: UserRound },
  ]
  const resto = todos.filter(i => !principais.some(p => p.href === i.href))

  const ativo = (href: string) => pathname === href || pathname.startsWith(href + '/')
  const maisAtivo = resto.some(i => ativo(i.href))

  const navegar = (href: string) => {
    setMaisAberto(false)
    router.push(comDemo(href))
  }

  const sair = () => router.push(sairDaConta())

  const botao = (label: string, icon: LucideIcon, on: boolean, onClick: () => void) => (
    <button key={label} onClick={onClick} style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '7px 0', borderRadius: 12,
      border: 'none', cursor: 'pointer', fontSize: 10.5, fontWeight: 600, fontFamily: 'inherit',
      color: on ? T.brand.primary : T.text.secondary, background: on ? T.brand.primarySubtle : 'transparent',
    }}>
      <Icon icon={icon} size={20} active={on} />
      {label}
    </button>
  )

  return (
    <>
      <nav data-tour="nav-celular" style={{
        position: 'fixed', left: 12, right: 12, bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))', zIndex: 30,
        display: 'flex', justifyContent: 'space-around', padding: 6, borderRadius: 18, background: '#fff',
        border: `1px solid ${T.border.default}`, boxShadow: '0 12px 32px -12px rgba(28,27,34,.25)',
      }}>
        {principais.map(i => botao(i.label, i.icon, ativo(i.href), () => navegar(i.href)))}
        {botao('Mais', Menu, maisAberto || maisAtivo, () => setMaisAberto(true))}
      </nav>

      {maisAberto && (
        <div onClick={() => setMaisAberto(false)} style={{ position: 'fixed', inset: 0, background: T.bg.overlay, zIndex: 60 }}>
          <div onClick={e => e.stopPropagation()} style={{
            position: 'fixed', left: 12, right: 12, bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))', zIndex: 61,
            background: '#fff', borderRadius: 20, boxShadow: T.shadow.modal, padding: 8, maxHeight: '75vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '8px 10px 6px' }}>
              <span style={{ flex: 1, fontSize: 15, fontWeight: 700 }}>Mais</span>
              <button onClick={() => setMaisAberto(false)} aria-label="Fechar" style={{ width: 32, height: 32, borderRadius: 9, border: 'none', background: 'transparent', display: 'grid', placeItems: 'center', color: T.text.secondary }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, padding: 4 }}>
              {resto.map(i => {
                const on = ativo(i.href)
                return (
                  <button key={i.href} onClick={() => navegar(i.href)} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 4px', borderRadius: 14,
                    border: `1px solid ${on ? T.brand.primaryAccentSoft : T.border.default}`, background: on ? T.brand.primarySoftBg : '#fff',
                    color: on ? T.brand.primary : T.text.strong, fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                  }}>
                    <Icon icon={i.icon} size={20} active={on} />
                    {i.label}
                  </button>
                )
              })}
            </div>
            <button onClick={sair} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: 'calc(100% - 8px)', margin: '6px 4px 4px',
              height: 40, borderRadius: 12, border: `1px solid ${T.border.default}`, background: '#fff', color: T.status.danger,
              fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
            }}>
              <LogOut size={16} strokeWidth={1.6} />Sair
            </button>
          </div>
        </div>
      )}
    </>
  )
}
