'use client'
/**
 * Avisos no canto da tela, em qualquer página: quando chega uma notificação nova
 * (ex.: "Maria Silva saiu do consultório — retorno por volta de 10/11"), aparece um
 * cartão com ação. Chegam na hora (tempo real) e, se o tempo real cair, a cada 20s.
 * Os avisos de saída do consultório ficam até alguém abrir/fechar e tocam um som curto.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { tokens as T } from '@/lib/design-tokens'
import { supabase } from '@/lib/supabase'
import { listarNotificacoes, marcarNotificacao, estiloDaNotificacao, avisarMudanca, EVENTO_NOTIFICACOES } from '@/lib/notificacoes'
import { EVENTO_AVISO, type AvisoTela } from '@/lib/atendimento/cliente'

const TIPOS_COM_AVISO = new Set(['saida_recepcao', 'triagem_urgente', 'atraso_medico', 'formulario_preenchido', 'confirmacao_recusada', 'reagendamento_solicitado', 'lista_espera_agendado', 'consulta_iniciando'])
const FIXOS = new Set(['saida_recepcao', 'triagem_urgente'])
const CHAVE_VISTOS = 'c360-avisos-vistos'

export function AvisosAoVivo() {
  const router = useRouter()
  const [avisos, setAvisos] = useState<AvisoTela[]>([])
  const vistos = useRef<Set<string>>(new Set())
  const primeira = useRef(true)

  const mostrar = useCallback((a: AvisoTela) => {
    if (vistos.current.has(a.id)) return
    vistos.current.add(a.id)
    try { sessionStorage.setItem(CHAVE_VISTOS, JSON.stringify(Array.from(vistos.current).slice(-200))) } catch {}
    setAvisos(l => [a, ...l.filter(x => x.id !== a.id)].slice(0, 3))
    if (FIXOS.has(a.tipo || '')) tocar()
    else setTimeout(() => setAvisos(l => l.filter(x => x.id !== a.id)), 10000)
  }, [])

  const verificar = useCallback(async () => {
    try {
      const pg = await listarNotificacoes({ filtro: 'nao_lidas', limite: 8 })
      const novos = pg.itens.filter(n => !vistos.current.has(n.id))
      if (primeira.current) {
        // Na abertura não "dispara" o que já estava lá — só os de saída ainda pendentes
        novos.forEach(n => { if (n.tipo !== 'saida_recepcao') vistos.current.add(n.id) })
        primeira.current = false
      }
      novos.filter(n => !vistos.current.has(n.id) && TIPOS_COM_AVISO.has(n.tipo || '')).reverse()
        .forEach(n => mostrar({ id: n.id, tipo: n.tipo, titulo: n.titulo, descricao: n.descricao, link: n.link }))
    } catch {}
  }, [mostrar])

  useEffect(() => {
    try { JSON.parse(sessionStorage.getItem(CHAVE_VISTOS) || '[]').forEach((id: string) => vistos.current.add(id)) } catch {}
    const logado = (() => { try { return !!(localStorage.getItem('medico') || localStorage.getItem('clinica_admin')) } catch { return false } })()
    if (!logado) return

    verificar()
    const t = setInterval(() => { if (document.visibilityState === 'visible') verificar() }, 20000)
    const onDemo = (e: Event) => mostrar((e as CustomEvent<AvisoTela>).detail)
    const onMuda = () => verificar()
    window.addEventListener(EVENTO_AVISO, onDemo)
    window.addEventListener(EVENTO_NOTIFICACOES, onMuda)
    // Tempo real: o RLS só entrega as notificações que esta sessão pode ver
    const canal = supabase.channel('avisos-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificacoes_medico' }, () => setTimeout(verificar, 400))
      .subscribe()
    return () => {
      clearInterval(t)
      window.removeEventListener(EVENTO_AVISO, onDemo)
      window.removeEventListener(EVENTO_NOTIFICACOES, onMuda)
      supabase.removeChannel(canal)
    }
  }, [verificar, mostrar])

  const fechar = (a: AvisoTela) => setAvisos(l => l.filter(x => x.id !== a.id))
  const abrir = async (a: AvisoTela) => {
    fechar(a)
    if (!a.id.startsWith('demo-')) { await marcarNotificacao(a.id, true).catch(() => {}); avisarMudanca() }
    if (a.link) router.push(a.link)
  }

  if (!avisos.length) return null
  return (
    <div aria-live="polite" style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 80, display: 'flex', flexDirection: 'column', gap: 10, width: 'min(380px, calc(100vw - 36px))' }}>
      <style dangerouslySetInnerHTML={{ __html: '@keyframes c360-aviso-entra { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: none } } @media (max-width: 759px) { .c360-aviso { margin-bottom: 70px } }' }} />
      {avisos.map(a => {
        const { icon: Icone, cor } = estiloDaNotificacao({ tipo: a.tipo || null, titulo: a.titulo })
        return (
          <div key={a.id} className="c360-aviso" role="status" style={{
            display: 'flex', gap: 12, padding: 14, borderRadius: 16, background: '#fff', border: `1px solid ${T.border.default}`,
            boxShadow: '0 18px 40px -12px rgba(30, 20, 70, .28)', animation: 'c360-aviso-entra .25s ease-out',
          }}>
            <span style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, display: 'grid', placeItems: 'center', background: `color-mix(in srgb, ${cor} 14%, transparent)`, color: cor }}><Icone size={18} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text.primary }}>{a.titulo}</div>
              {a.descricao && <div style={{ fontSize: 12.5, color: T.text.secondary, marginTop: 2, lineHeight: 1.45 }}>{a.descricao}</div>}
              {a.link && (
                <button onClick={() => abrir(a)} style={{ marginTop: 8, height: 30, padding: '0 12px', borderRadius: 9, border: 'none', cursor: 'pointer', background: T.brand.primary, color: '#fff', fontSize: 12.5, fontWeight: 650, fontFamily: 'inherit' }}>
                  {a.tipo === 'saida_recepcao' ? 'Ver e agendar' : a.tipo === 'triagem_urgente' ? 'Ver no consultório' : 'Abrir'}
                </button>
              )}
            </div>
            <button onClick={() => fechar(a)} aria-label="Fechar aviso" style={{ width: 26, height: 26, border: 'none', background: 'none', cursor: 'pointer', color: T.text.tertiary, display: 'grid', placeItems: 'center', flexShrink: 0 }}><X size={16} /></button>
          </div>
        )
      })}
    </div>
  )
}

/** Dois toques curtos (só depois de alguma interação com a página — regra dos navegadores). */
function tocar() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext
    const ctx = new Ctx()
    const nota = (f: number, t: number) => {
      const o = ctx.createOscillator(); const g = ctx.createGain()
      o.frequency.value = f; o.type = 'sine'
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t)
      g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.35)
      o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.4)
    }
    nota(784, 0); nota(1047, 0.18)
    setTimeout(() => ctx.close(), 900)
  } catch {}
}
