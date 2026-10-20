'use client'
/**
 * Central de atendimento: uma área só para quem atende, com
 *   • faixa ao vivo (a chegar, balcão, triagem, espera, atendendo, saídas, mensagens) — cada número leva à aba certa
 *   • abas por posto (cada perfil vê as suas)
 *   • "Meu posto": a Central abre direto onde a pessoa trabalha
 *   • tela cheia (tecla F) para o computador do balcão ou do consultório
 * As abas Recepção, Triagem e Consultório são as telas de antes (os endereços antigos redirecionam).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import { Activity, ConciergeBell, HeartPulse, DoorOpen, MessageCircle, CalendarHeart, MonitorPlay, Maximize2, Minimize2, Pin } from 'lucide-react'
import { tokens as T } from '@/lib/design-tokens'
import { useFila } from '@/lib/atendimento/useFila'
import { useChatNaoLidas } from '@/components/shell/useChatNaoLidas'
import { ehAtendente } from '@/lib/sessao'
import { CHAVE_POSTO, perfilAtual, type Perfil, type Posto } from '@/lib/atendimento/posto'

const ABAS: { id: Posto | 'mensagens'; label: string; icon: LucideIcon; href: string; perfis: Perfil[] }[] = [
  { id: 'agora', label: 'Agora', icon: Activity, href: '/atendimento/agora', perfis: ['gestor', 'recepcao', 'enfermagem', 'medico'] },
  { id: 'recepcao', label: 'Recepção', icon: ConciergeBell, href: '/atendimento/recepcao', perfis: ['gestor', 'recepcao'] },
  { id: 'triagem', label: 'Triagem', icon: HeartPulse, href: '/atendimento/triagem', perfis: ['gestor', 'recepcao', 'enfermagem', 'medico'] },
  { id: 'consultorio', label: 'Consultório', icon: DoorOpen, href: '/atendimento/consultorio', perfis: ['gestor', 'medico'] },
  { id: 'saidas', label: 'Saídas e retornos', icon: CalendarHeart, href: '/atendimento/saidas', perfis: ['gestor', 'recepcao', 'medico'] },
  { id: 'telas', label: 'TV e totem', icon: MonitorPlay, href: '/atendimento/telas', perfis: ['gestor', 'recepcao'] },
]

export default function AtendimentoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [perfil, setPerfil] = useState<Perfil>('gestor')
  const [posto, setPosto] = useState<Posto | null>(null)
  const [telaCheia, setTelaCheia] = useState(false)
  const [demo, setDemo] = useState('')
  const raiz = useRef<HTMLDivElement>(null)
  const { fila } = useFila(null)
  const mensagens = useChatNaoLidas()

  useEffect(() => {
    if (ehAtendente()) { router.replace('/chat'); return }
    setPerfil(perfilAtual())
    try { setPosto((localStorage.getItem(CHAVE_POSTO) as Posto) || null) } catch {}
    setDemo(new URLSearchParams(window.location.search).get('demo') === '1' ? '?demo=1' : '')
  }, [router])

  // Tela cheia: a Central ocupa a tela toda (sem menu); F liga/desliga, Esc sai
  useEffect(() => {
    const sync = () => setTelaCheia(!!document.fullscreenElement)
    const onKey = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement
      if (alvo?.closest('input, textarea, select, [contenteditable="true"]')) return
      if ((e.key === 'f' || e.key === 'F') && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); alternarTelaCheia() }
    }
    document.addEventListener('fullscreenchange', sync)
    window.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('fullscreenchange', sync); window.removeEventListener('keydown', onKey) }
  }, [])

  function alternarTelaCheia() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else raiz.current?.requestFullscreen?.().catch(() => {})
  }

  const abaAtual = ABAS.find(a => pathname.startsWith(a.href))?.id
  const abas = ABAS.filter(a => a.perfis.includes(perfil))
  function fixarPosto() {
    if (!abaAtual || abaAtual === 'mensagens') return
    const novo = posto === abaAtual ? null : abaAtual
    setPosto(novo)
    try { novo ? localStorage.setItem(CHAVE_POSTO, novo) : localStorage.removeItem(CHAVE_POSTO) } catch {}
  }

  // Faixa ao vivo
  const contadores = useMemo(() => {
    if (!fila) return null
    const agora = Date.now()
    const at = fila.atendimentos
    const triagem = at.filter(a => a.status === 'aguardando_triagem' || a.status === 'em_triagem')
    return [
      { id: 'chegar', label: 'A chegar', n: fila.esperados.length, extra: (() => { const atras = fila.esperados.filter(e => new Date(e.data_hora).getTime() < agora - 15 * 60e3).length; return atras ? `${atras} atrasado${atras > 1 ? 's' : ''}` : '' })(), href: '/atendimento/recepcao', alerta: false },
      { id: 'balcao', label: 'Balcão', n: (fila.balcao || []).length, extra: '', href: '/atendimento/recepcao', alerta: false },
      { id: 'triagem', label: 'Triagem', n: triagem.length, extra: (() => { const u = triagem.filter(a => a.risco === 'vermelho' || a.risco === 'laranja').length; return u ? `${u} urgente${u > 1 ? 's' : ''}` : '' })(), href: '/atendimento/triagem', alerta: triagem.some(a => a.risco === 'vermelho' || a.risco === 'laranja') },
      { id: 'espera', label: 'Esperando médico', n: at.filter(a => a.status === 'aguardando' || a.status === 'chamado').length, extra: '', href: '/atendimento/agora', alerta: false },
      { id: 'atendendo', label: 'Em consulta', n: at.filter(a => a.status === 'em_atendimento').length, extra: fila.medicos.length ? `de ${fila.medicos.length} médico${fila.medicos.length > 1 ? 's' : ''}` : '', href: '/atendimento/agora', alerta: false },
      { id: 'saidas', label: 'Saídas para resolver', n: (fila.saidas || []).length, extra: '', href: '/atendimento/saidas', alerta: (fila.saidas || []).length > 0 },
      { id: 'mensagens', label: 'Mensagens', n: mensagens, extra: '', href: '/chat', alerta: false },
    ]
  }, [fila, mensagens])

  return (
    <div ref={raiz} style={{ background: T.bg.card, minHeight: '100%', overflowY: telaCheia ? 'auto' : undefined, height: telaCheia ? '100vh' : undefined }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .c360-central-topo { position: sticky; top: 0; z-index: 20; background: ${T.bg.card}; border-bottom: 1px solid ${T.border.default}; }
        .c360-central-faixa { display: flex; gap: 8px; overflow-x: auto; padding: 12px 20px 10px; scrollbar-width: none; }
        .c360-central-abas { display: flex; align-items: flex-end; gap: 2px; overflow-x: auto; padding: 0 14px; scrollbar-width: none; }
        @media (max-width: 759px) { .c360-central-faixa { padding: 10px 12px 8px; } .c360-central-abas { padding: 0 6px; } }
      ` }} />
      <div className="c360-central-topo">
        <div className="c360-central-faixa">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: T.status.success, whiteSpace: 'nowrap', paddingRight: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.status.success, boxShadow: `0 0 0 3px ${T.status.successBg}` }} /> Ao vivo
          </span>
          {(contadores || Array.from({ length: 6 }, (_, i) => ({ id: 'sk' + i, label: '', n: 0, extra: '', href: '', alerta: false }))).map(c => c.label ? (
            <Link key={c.id} href={c.href + (c.href.startsWith('/atendimento') ? demo : '')} style={{
              display: 'flex', alignItems: 'baseline', gap: 6, padding: '7px 12px', borderRadius: 11, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0,
              border: `1px solid ${c.alerta ? T.status.danger : T.border.default}`, background: c.alerta ? T.status.dangerBg : '#fff',
            }}>
              <span style={{ fontSize: 16, fontWeight: 750, color: c.alerta ? T.status.danger : T.text.primary, fontVariantNumeric: 'tabular-nums' }}>{c.n}</span>
              <span style={{ fontSize: 12.5, color: T.text.secondary, fontWeight: 600 }}>{c.label}</span>
              {c.extra && <span style={{ fontSize: 11.5, color: c.alerta ? T.status.danger : T.text.tertiary }}>· {c.extra}</span>}
            </Link>
          ) : <span key={c.id} className="c360-skel" style={{ width: 120, height: 34, borderRadius: 11, flexShrink: 0 }} />)}
        </div>
        <nav className="c360-central-abas" aria-label="Abas da Central de atendimento">
          {abas.map(a => {
            const ativa = abaAtual === a.id
            const Icone = a.icon
            return (
              <Link key={a.id} href={a.href + (a.href.startsWith('/atendimento') ? demo : '')} aria-current={ativa ? 'page' : undefined} style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 12px', fontSize: 13.5, fontWeight: ativa ? 700 : 600, whiteSpace: 'nowrap',
                color: ativa ? T.brand.primary : T.text.secondary, textDecoration: 'none', borderBottom: `2px solid ${ativa ? T.brand.primary : 'transparent'}`, marginBottom: -1,
              }}>
                <Icone size={15} /> {a.label}
                {a.id === 'mensagens' && mensagens > 0 && <span style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 99, background: T.brand.primary, color: '#fff', fontSize: 10.5, fontWeight: 700, display: 'grid', placeItems: 'center' }}>{mensagens > 99 ? '99+' : mensagens}</span>}
                {posto === a.id && <Pin size={11} color={T.text.tertiary} />}
              </Link>
            )
          })}
          <span style={{ flex: 1, minWidth: 12 }} />
          <span style={{ display: 'flex', gap: 6, alignItems: 'center', paddingBottom: 6, flexShrink: 0 }}>
          {abaAtual && abaAtual !== 'mensagens' && (
            <button onClick={fixarPosto} title={posto === abaAtual ? 'Esta aba abre primeiro quando você entra na Central. Clique para desfazer.' : 'Abrir a Central sempre nesta aba'} style={botaoTopo(posto === abaAtual)}>
              <Pin size={14} /> {posto === abaAtual ? 'Meu posto' : 'Fixar como meu posto'}
            </button>
          )}
          <button onClick={alternarTelaCheia} title="Tela cheia (tecla F)" style={botaoTopo(false)}>
            {telaCheia ? <Minimize2 size={14} /> : <Maximize2 size={14} />} {telaCheia ? 'Sair da tela cheia' : 'Tela cheia'}
          </button>
          </span>
        </nav>
      </div>
      {children}
    </div>
  )
}

function botaoTopo(ativo: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px', borderRadius: 10, flexShrink: 0, whiteSpace: 'nowrap',
    border: `1px solid ${ativo ? T.brand.primaryAccent : T.border.default}`, background: ativo ? T.brand.primarySoftBg : '#fff',
    color: ativo ? T.brand.primary : T.text.secondary, fontSize: 12.5, fontWeight: 650, cursor: 'pointer', fontFamily: 'inherit',
  }
}
