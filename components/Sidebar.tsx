'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard, Calendar, Users, Clock, CirclePlus, Video, ScanSearch, Sparkles, MessageCircle,
  CalendarHeart, ChartColumnBig, ReceiptText, LayoutTemplate,
  Hospital, SlidersHorizontal, ClipboardList, CalendarCheck, UserRound, LogOut, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react'
import { tokens } from '@/lib/design-tokens'
import { Icon, Avatar } from '@/components/ui'
import { SetupChecklist } from '@/components/SetupChecklist'
import { Marca } from '@/components/Marca'
import { useChatNaoLidas } from '@/components/shell/useChatNaoLidas'

import { ehAtendente, sairDaConta } from '@/lib/sessao'
const T = tokens

type Item = { href: string; label: string; icon: LucideIcon; emBreve?: boolean; novaAba?: boolean }

/**
 * Menu lateral (204px). Recolhido (`rail`) vira uma faixa de 52px só com ícones —
 * o usuário alterna pelo botão do topo, como no ChatGPT (no modo recolhido o logo
 * vira o botão de abrir ao passar o mouse). Abaixo de 760px o AppShell usa a BottomNav.
 */
export function Sidebar({ rail = false, onAlternar }: { rail?: boolean; onAlternar?: () => void }) {
  const router = useRouter()
  const pathname = usePathname()
  const [medico, setMedico] = useState<any>(null)
  const [clinicaAdmin, setClinicaAdmin] = useState<any>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [hoverLogo, setHoverLogo] = useState(false)
  const chatNaoLidas = useChatNaoLidas()

  useEffect(() => {
    const ca = localStorage.getItem('clinica_admin')
    if (ca) { setClinicaAdmin(JSON.parse(ca)); return }
    const m = localStorage.getItem('medico')
    if (m) setMedico(JSON.parse(m))
  }, [])

  const isClinicaAdmin = !!clinicaAdmin
  const isRecepcionista = medico?.cargo === 'recepcionista'
  const [ehAtendenteLocal, setEhAtendenteLocal] = useState(false)
  useEffect(() => { setEhAtendenteLocal(ehAtendente()) }, [])
  const isMedicoAdmin = medico?.cargo === 'admin'
  const temAcessoAdmin = isClinicaAdmin || isMedicoAdmin

  const atendente = ehAtendenteLocal
  const grupos: { label: string; items: Item[] }[] = atendente ? [
    { label: 'Atendimento', items: [{ href: '/chat', label: 'Chat', icon: MessageCircle }] },
  ] : [
    {
      label: 'Menu principal',
      items: [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/agenda', label: 'Agenda', icon: Calendar },
        { href: '/pacientes', label: 'Pacientes', icon: Users },
        ...(!isRecepcionista ? [{ href: '/historico', label: 'Histórico', icon: Clock }] : []),
        { href: '/retornos', label: 'Retornos', icon: CalendarHeart },
      ],
    },
    {
      label: 'Atendimento',
      items: [
        ...(!isRecepcionista ? [
          { href: '/nova-consulta', label: 'Nova consulta', icon: CirclePlus },
          { href: '/teleconsulta', label: 'Teleconsulta', icon: Video },
          { href: '/exames', label: 'Analisar exames', icon: ScanSearch },
          { href: '/assistente-ia', label: 'Assistente IA', icon: Sparkles },
        ] : []),
        { href: '/chat', label: 'Chat', icon: MessageCircle },
      ],
    },
    {
      label: 'Clínica',
      items: [
        ...(temAcessoAdmin ? [
          { href: '/minha-clinica', label: 'Minha clínica', icon: Hospital },
          { href: '/admin', label: 'Painel admin', icon: SlidersHorizontal },
        ] : []),
        ...(!isRecepcionista ? [{ href: '/relatorios', label: 'Relatórios', icon: ChartColumnBig }] : []),
        { href: '/faturamento', label: 'Faturamento TISS', icon: ReceiptText },
        ...(!isRecepcionista ? [{ href: '/modelos-prontuario', label: 'Modelos de prontuário', icon: LayoutTemplate }] : []),
        { href: '/formularios', label: 'Formulários', icon: ClipboardList },
        { href: '/configuracoes/agenda-publica', label: 'Agenda pública', icon: CalendarCheck },
        { href: '/perfil', label: 'Perfil', icon: UserRound },
      ],
    },
  ]

  const usuario = clinicaAdmin || medico
  const sair = () => router.push(sairDaConta())

  // Animação: só a largura do <aside> muda. Ícones ficam sempre na mesma posição
  // (padding fixo), e textos/cards somem com fade — nada "pula" ao abrir/fechar.
  const EASE = 'cubic-bezier(.2,.8,.2,1)'
  const DUR = '.42s'
  const fade = (visivel: boolean, atraso = 0.12): React.CSSProperties => ({
    opacity: visivel ? 1 : 0,
    transition: `opacity ${visivel ? '.3s' : '.16s'} ease ${visivel ? atraso : 0}s`,
    pointerEvents: visivel ? 'auto' : 'none',
    whiteSpace: 'nowrap',
  })

  return (
    <aside style={{
      width: rail ? 52 : 204, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14,
      height: '100%', transition: `width ${DUR} ${EASE}`, overflow: 'hidden',
    }}>
      {/* Marca — logo fixo em x=11; wordmark e botão de fechar com fade */}
      <div style={{ position: 'relative', height: 36, flexShrink: 0, display: 'flex', alignItems: 'center', paddingLeft: 11, gap: 10 }}>
        <button
          onClick={rail ? onAlternar : undefined}
          title={rail ? 'Abrir menu' : undefined}
          aria-label={rail ? 'Abrir menu' : undefined}
          onMouseEnter={() => setHoverLogo(true)} onMouseLeave={() => setHoverLogo(false)}
          style={{
            position: 'relative', width: 30, height: 30, borderRadius: 9, border: 'none', padding: 0, flexShrink: 0,
            cursor: rail ? 'pointer' : 'default', background: 'transparent', display: 'grid', placeItems: 'center',
          }}
        >
          <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', transition: 'opacity .15s', opacity: rail && hoverLogo ? 0 : 1 }}>
            <Marca simbolo size={28} />
          </span>
          <span style={{
            position: 'absolute', inset: -3, borderRadius: 10, display: 'grid', placeItems: 'center', background: T.bg.hoverStrong,
            color: T.text.secondary, transition: 'opacity .15s', opacity: rail && hoverLogo ? 1 : 0,
          }}>
            <PanelLeftOpen size={18} strokeWidth={1.6} />
          </span>
        </button>
        <span style={{ flex: 1, display: 'flex', alignItems: 'center', minWidth: 0, ...fade(!rail) }}>
          <img src="/logo-texto.svg" alt="Clinical 360" style={{ height: 17, width: 'auto', display: 'block' }} />
        </span>
        {onAlternar && (
          <button
            onClick={onAlternar} title="Fechar menu" aria-label="Fechar menu" tabIndex={rail ? -1 : 0}
            style={{
              width: 32, height: 32, borderRadius: 9, border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0,
              background: 'transparent', color: T.text.tertiary, ...fade(!rail),
            }}
            onMouseEnter={e => { e.currentTarget.style.background = T.bg.hoverStrong; e.currentTarget.style.color = T.text.secondary }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = T.text.tertiary }}
          >
            <PanelLeftClose size={18} strokeWidth={1.6} />
          </button>
        )}
      </div>

      {/* Navegação */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none' }}>
        {grupos.map(g => g.items.length === 0 ? null : (
          <div key={g.label} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {/* rótulo do grupo e divisória ocupam a mesma altura — troca por fade */}
            <div style={{ position: 'relative', height: 18, flexShrink: 0 }}>
              <div style={{ fontSize: 12, color: '#9A98A5', padding: '0 10px', ...fade(!rail) }}>{g.label}</div>
              <div style={{ position: 'absolute', left: 10, width: 32, top: 9, height: 1, background: T.border.default, ...fade(rail) }} />
            </div>
            {g.items.map(item => {
              const ativo = pathname === item.href || pathname.startsWith(item.href + '/')
              const hv = !item.emBreve && hover === item.href
              const realce = ativo || hv
              const contador = item.href === '/chat' ? chatNaoLidas : 0
              return (
                <button
                  key={item.href}
                  title={item.label}
                  onMouseEnter={() => setHover(item.href)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => {
                    if (item.emBreve) return
                    if (item.novaAba) window.open(item.href, '_blank')
                    else router.push(item.href)
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 11, overflow: 'hidden', flexShrink: 0,
                    padding: '0 10px 0 16px', height: 34, borderRadius: 9, fontSize: 13.5, fontFamily: 'inherit', textAlign: 'left',
                    fontWeight: ativo ? 600 : 500,
                    color: ativo || hv ? T.text.primary : '#5A5865',
                    background: ativo ? '#fff' : hv ? '#ECECF0' : 'transparent',
                    transition: 'background .15s, color .15s',
                    border: `1px solid ${ativo ? T.border.default : 'transparent'}`,
                    boxShadow: ativo ? T.shadow.sm : 'none',
                    opacity: item.emBreve ? 0.5 : 1,
                    cursor: item.emBreve ? 'not-allowed' : 'pointer',
                  }}
                >
                  <span style={{
                    position: 'relative', display: 'inline-grid', flexShrink: 0, color: realce ? T.brand.primary : 'inherit',
                    transition: `transform .35s ${T.motion.spring}, color .25s`,
                    transform: hv ? 'rotate(-8deg) scale(1.06)' : 'none',
                  }}>
                    <Icon icon={item.icon} size={18} active={realce} />
                    {/* Recolhido: selo pequeno sobre o ícone */}
                    {contador > 0 && (
                      <span style={{
                        position: 'absolute', top: -6, right: -8, minWidth: 15, height: 15, padding: '0 4px', boxSizing: 'border-box',
                        borderRadius: 99, background: T.brand.primary, color: '#fff', fontSize: 9.5, fontWeight: 700, lineHeight: '15px',
                        textAlign: 'center', border: `2px solid ${T.bg.page}`, opacity: rail ? 1 : 0, transition: 'opacity .2s',
                      }}>{contador > 9 ? '9+' : contador}</span>
                    )}
                  </span>
                  <span style={{ flex: 1, ...fade(!rail) }}>{item.label}</span>
                  {contador > 0 && (
                    <span title={`${contador} conversa${contador === 1 ? '' : 's'} com mensagens não lidas`} style={{
                      minWidth: 20, height: 20, padding: '0 6px', boxSizing: 'border-box', borderRadius: 99, textAlign: 'center',
                      background: T.brand.primary, color: '#fff', fontSize: 11, fontWeight: 700, lineHeight: '20px', ...fade(!rail),
                    }}>{contador > 99 ? '99+' : contador}</span>
                  )}
                  {item.emBreve && (
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#8A6A1F', background: '#FBF3DF', padding: '2px 7px', borderRadius: 99, ...fade(!rail) }}>Em breve</span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Card de configuração: recolhe altura + fade (some no modo recolhido) */}
      {temAcessoAdmin && (
        <div style={{
          display: 'grid', gridTemplateRows: rail ? '0fr' : '1fr', marginTop: rail ? -18 : 0,
          transition: `grid-template-rows ${DUR} ${EASE}, margin-top ${DUR} ${EASE}`, flexShrink: 0,
        }}>
          <div style={{ overflow: 'hidden', minWidth: 180, ...fade(!rail) }}>
            <SetupChecklist variante="sidebar" />
          </div>
        </div>
      )}

      {/* Usuário — avatar fixo; borda/fundo e textos com fade */}
      {usuario && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 14, flexShrink: 0, overflow: 'hidden',
          background: rail ? 'rgba(255,255,255,0)' : '#fff', border: `1px solid ${rail ? 'rgba(235,234,239,0)' : T.border.default}`,
          transition: `background ${DUR} ease, border-color ${DUR} ease`,
        }}>
          <Avatar nome={usuario.nome} size={34} src={usuario.foto_url} />
          <div style={{ flex: 1, minWidth: 0, lineHeight: 1.3, ...fade(!rail) }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.text.primary, overflow: 'hidden', textOverflow: 'ellipsis' }}>{usuario.nome}</div>
            <div style={{ fontSize: 12, color: T.text.quaternary, overflow: 'hidden', textOverflow: 'ellipsis' }}>{usuario.email}</div>
          </div>
          <button
            title="Sair" onClick={sair} tabIndex={rail ? -1 : 0}
            style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 8, border: 'none', display: 'grid', placeItems: 'center', color: T.status.danger, background: 'transparent', cursor: 'pointer', ...fade(!rail) }}
            onMouseEnter={e => e.currentTarget.style.background = '#FDF2F1'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <LogOut size={16} strokeWidth={1.6} />
          </button>
        </div>
      )}
    </aside>
  )
}
