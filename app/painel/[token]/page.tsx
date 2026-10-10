'use client'
/**
 * Painel da TV da sala de espera. Abre pelo link secreto do setor (Minha clínica →
 * Atendimento) numa Smart TV, Chromecast ou mini PC — sem login.
 *
 * A cada chamada nova: destaque na tela, som de aviso e voz ("Senha A 23, Maria Silva.
 * Consultório 3"). Navegadores só tocam som depois de um toque na tela, por isso o
 * botão "Ativar som" na primeira vez.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Maximize, Volume2, VolumeX, WifiOff } from 'lucide-react'
import { carregarPainel, type Chamada, type DadosPainel } from '@/lib/atendimento/cliente'
import { fraseChamada } from '@/lib/atendimento/comum'

const INTERVALO_MS = 2500
const VEZES_FALADA = 2
const FUNDO = 'radial-gradient(1200px 700px at 15% 0%, #3B2A8C 0%, #221A55 45%, #150F36 100%)'

export default function PainelPage({ params }: { params: { token: string } }) {
  const [dados, setDados] = useState<DadosPainel | null>(null)
  const [naoExiste, setNaoExiste] = useState(false)
  const [offline, setOffline] = useState(false)
  const [som, setSom] = useState(false)
  const [destaque, setDestaque] = useState(false)
  const [relogio, setRelogio] = useState(() => new Date())
  const ultimaVista = useRef<string | null>(null)
  const primeiraCarga = useRef(true)
  const fila = useRef<Chamada[]>([])
  const falando = useRef(false)
  const somRef = useRef(false)
  const vozRef = useRef(true)
  const audio = useRef<AudioContext | null>(null)

  // ── Som e voz ──────────────────────────────────────────────────────────────
  const tocarAviso = useCallback(() => new Promise<void>(resolve => {
    const ctx = audio.current
    if (!ctx) return resolve()
    const nota = (freq: number, inicio: number, dur: number) => {
      const o = ctx.createOscillator(); const g = ctx.createGain()
      o.type = 'sine'; o.frequency.value = freq
      g.gain.setValueAtTime(0.0001, ctx.currentTime + inicio)
      g.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + inicio + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + inicio + dur)
      o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + inicio); o.stop(ctx.currentTime + inicio + dur + 0.05)
    }
    nota(880, 0, 0.55); nota(660, 0.45, 0.8)
    setTimeout(resolve, 1300)
  }), [])

  const falar = useCallback((texto: string) => new Promise<void>(resolve => {
    if (!('speechSynthesis' in window)) return resolve()
    const u = new SpeechSynthesisUtterance(texto)
    const vozes = window.speechSynthesis.getVoices()
    const pt = vozes.find(v => v.lang === 'pt-BR' && /Google|Luciana|Francisca|Maria/i.test(v.name)) || vozes.find(v => v.lang?.startsWith('pt'))
    if (pt) u.voice = pt
    u.lang = 'pt-BR'; u.rate = 0.92
    const fim = setTimeout(resolve, 9000)
    u.onend = () => { clearTimeout(fim); resolve() }
    u.onerror = () => { clearTimeout(fim); resolve() }
    window.speechSynthesis.cancel()   // nada acumulado na fila de voz do navegador
    window.speechSynthesis.speak(u)
  }), [])

  const anunciarFila = useCallback(async () => {
    if (falando.current) return
    falando.current = true
    while (fila.current.length) {
      const c = fila.current.shift()!
      setDestaque(true)
      if (somRef.current) {
        await tocarAviso()
        // Fala exatamente 2 vezes e para
        if (vozRef.current) for (let i = 0; i < VEZES_FALADA; i++) { if (i) await new Promise(r => setTimeout(r, 700)); await falar(fraseChamada(c)) }
      } else {
        await new Promise(r => setTimeout(r, 4000))
      }
      setDestaque(false)
      await new Promise(r => setTimeout(r, 600))
    }
    falando.current = false
  }, [falar, tocarAviso])

  const ativarSom = async () => {
    try {
      audio.current = audio.current || new (window.AudioContext || (window as any).webkitAudioContext)()
      await audio.current.resume()
      window.speechSynthesis?.getVoices()
      somRef.current = true; setSom(true)
      await tocarAviso()
    } catch {}
    telaCheia()
  }
  const telaCheia = () => { document.documentElement.requestFullscreen?.().catch(() => {}) }

  // ── Busca as chamadas ──────────────────────────────────────────────────────
  useEffect(() => {
    let vivo = true
    const buscar = async () => {
      try {
        const d = await carregarPainel(params.token)
        if (!vivo) return
        setOffline(false)
        if (!d) { setNaoExiste(true); return }
        setNaoExiste(false)
        vozRef.current = d.setor.voz
        // Chamadas novas desde a última vista (na ordem em que aconteceram)
        const ids = d.chamadas.map(c => c.id)
        if (!primeiraCarga.current && d.chamadas.length && d.chamadas[0].id !== ultimaVista.current) {
          const ate = ultimaVista.current ? ids.indexOf(ultimaVista.current) : -1
          const novas = (ate === -1 ? d.chamadas.slice(0, 1) : d.chamadas.slice(0, ate)).reverse()
          // Várias chamadas de uma vez (ex.: TV voltando da queda de internet): anuncia só a mais recente
          fila.current = novas.slice(-1)
          anunciarFila()
        }
        ultimaVista.current = d.chamadas[0]?.id || ultimaVista.current
        primeiraCarga.current = false
        setDados(d)
      } catch { if (vivo) setOffline(true) }
    }
    buscar()
    const t = setInterval(buscar, INTERVALO_MS)
    const onStorage = (e: StorageEvent) => { if (e.key?.startsWith('c360-demo-fila')) buscar() }
    window.addEventListener('storage', onStorage)
    return () => { vivo = false; clearInterval(t); window.removeEventListener('storage', onStorage) }
  }, [params.token, anunciarFila])

  // Relógio, tela sempre acesa e cursor escondido
  useEffect(() => {
    const t = setInterval(() => setRelogio(new Date()), 15000)
    let lock: any = null
    const pedir = async () => { try { lock = await (navigator as any).wakeLock?.request('screen') } catch {} }
    pedir()
    const vis = () => { if (document.visibilityState === 'visible') pedir() }
    document.addEventListener('visibilitychange', vis)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); lock?.release?.() }
  }, [])

  if (naoExiste) {
    return (
      <Tela>
        <div style={{ margin: 'auto', textAlign: 'center', maxWidth: 560, padding: 24 }}>
          <div style={{ fontSize: 34, fontWeight: 800 }}>Painel não encontrado</div>
          <div style={{ fontSize: 18, opacity: 0.75, marginTop: 12 }}>O link deste painel mudou ou foi desativado. Copie o link novo em Minha clínica → Atendimento.</div>
        </div>
      </Tela>
    )
  }

  const atual = dados?.chamadas[0]
  const anteriores = dados?.chamadas.slice(1, 6) || []

  return (
    <Tela semCursor={som}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes c360-pulsar { 0%, 100% { box-shadow: 0 0 0 0 rgba(167,139,250,.0) } 50% { box-shadow: 0 0 0 18px rgba(167,139,250,.28) } }
        @keyframes c360-entrar { from { opacity: 0; transform: translateY(18px) scale(.98) } to { opacity: 1; transform: none } }
        .c360-painel-grid { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); gap: 2.2vw; flex: 1; min-height: 0 }
        @media (max-aspect-ratio: 4/3) { .c360-painel-grid { grid-template-columns: minmax(0, 1fr) } }
      ` }} />

      {/* Cabeçalho */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '2vh 2.4vw 0' }}>
        {dados?.clinica.logo_url
          ? <img src={dados.clinica.logo_url} alt="" style={{ height: '6vh', maxWidth: '14vw', objectFit: 'contain', borderRadius: 10, background: '#fff', padding: 6 }} />
          : <span style={{ width: '6vh', height: '6vh', borderRadius: 14, background: 'rgba(255,255,255,.12)', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '2.6vh' }}>{(dados?.clinica.nome || 'C')[0]}</span>}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '3vh', fontWeight: 800, letterSpacing: '-.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dados?.clinica.nome || ' '}</div>
          <div style={{ fontSize: '2vh', opacity: 0.7 }}>{dados?.setor.nome || ' '}</div>
        </div>
        <span style={{ flex: 1 }} />
        {offline && <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.8vh', color: '#FCA5A5' }}><WifiOff size={20} /> Reconectando…</span>}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '4.2vh', fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{relogio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
          <div style={{ fontSize: '1.8vh', opacity: 0.7, textTransform: 'capitalize' }}>{relogio.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        </div>
      </header>

      <main className="c360-painel-grid" style={{ padding: '2.4vh 2.4vw' }}>
        {/* Chamada atual */}
        <section style={{
          borderRadius: 28, background: destaque ? 'rgba(255,255,255,.16)' : 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.14)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '3vh 2vw',
          animation: destaque ? 'c360-pulsar 1.2s ease-in-out infinite' : 'none', transition: 'background .4s',
        }}>
          {atual ? (
            <div key={atual.id} style={{ animation: 'c360-entrar .5s ease-out' }}>
              <div style={{ fontSize: '2.6vh', fontWeight: 700, letterSpacing: '.22em', textTransform: 'uppercase', opacity: 0.75 }}>Senha</div>
              <div style={{ fontSize: 'min(24vh, 16vw)', fontWeight: 900, letterSpacing: '-.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{atual.senha}</div>
              {atual.nome_exibicao && <div style={{ fontSize: 'min(7vh, 5vw)', fontWeight: 750, marginTop: '1.5vh' }}>{atual.nome_exibicao}</div>}
              <div style={{ display: 'inline-flex', marginTop: '3vh', padding: '1.4vh 2.4vw', borderRadius: 999, background: '#fff', color: '#2A1E6E', fontSize: 'min(6vh, 4vw)', fontWeight: 800 }}>{atual.local}</div>
            </div>
          ) : (
            <div style={{ opacity: 0.8 }}>
              <div style={{ fontSize: '5vh', fontWeight: 800 }}>Bem-vindo</div>
              <div style={{ fontSize: '2.6vh', marginTop: 10 }}>Aguarde. As chamadas aparecem aqui.</div>
            </div>
          )}
        </section>

        {/* Últimas chamadas */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '1.4vh', minHeight: 0 }}>
          <div style={{ fontSize: '2.2vh', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', opacity: 0.7, padding: '0 .4vw' }}>Últimas chamadas</div>
          {anteriores.length === 0 && <div style={{ fontSize: '2.2vh', opacity: 0.55, padding: '0 .4vw' }}>—</div>}
          {anteriores.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '1.4vw', padding: '1.8vh 1.4vw', borderRadius: 18, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)' }}>
              <span style={{ fontSize: '5vh', fontWeight: 850, fontVariantNumeric: 'tabular-nums', minWidth: '9vw' }}>{c.senha}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                {c.nome_exibicao && <span style={{ display: 'block', fontSize: '2.6vh', fontWeight: 650, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nome_exibicao}</span>}
                <span style={{ display: 'block', fontSize: '2.2vh', opacity: 0.75 }}>{c.local}</span>
              </span>
              <span style={{ fontSize: '2vh', opacity: 0.6, fontVariantNumeric: 'tabular-nums' }}>{new Date(c.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          ))}
        </section>
      </main>

      {/* Recados (ex.: médico atrasado) */}
      {!!dados?.avisos?.length && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: '1.2vw', margin: '0 2.4vw 1.6vh', padding: '1.6vh 1.8vw', borderRadius: 18, background: '#FDE68A', color: '#422006', fontSize: '2.6vh', fontWeight: 700 }}>
          <span style={{ fontSize: '3vh' }}>⏱</span>
          <span style={{ flex: 1 }}>{dados.avisos[Math.floor(relogio.getTime() / 15000) % dados.avisos.length]}</span>
          {dados.avisos.length > 1 && <span style={{ fontSize: '1.8vh', opacity: .7 }}>{dados.avisos.length} recados</span>}
        </div>
      )}

      {/* Rodapé */}
      <footer style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '1.6vh 2.4vw', background: 'rgba(0,0,0,.22)', fontSize: '2.2vh' }}>
        <span style={{ flex: 1, opacity: 0.85 }}>{dados?.setor.mensagem || 'Aguarde ser chamado. Pacientes prioritários são atendidos conforme a lei.'}</span>
        <span style={{ opacity: 0.45, fontSize: '1.6vh' }}>Clinical 360</span>
      </footer>

      {/* Ativar som (navegador exige um toque) */}
      {!som && (
        <button onClick={ativarSom} style={{
          position: 'fixed', right: 24, bottom: 'calc(6vh + 24px)', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px',
          borderRadius: 999, border: 'none', background: '#fff', color: '#2A1E6E', fontSize: 16, fontWeight: 700, cursor: 'pointer',
          boxShadow: '0 12px 30px rgba(0,0,0,.35)', fontFamily: 'inherit',
        }}>
          <Volume2 size={20} /> Ativar som e tela cheia
        </button>
      )}
      {som && (
        <button onClick={telaCheia} title="Tela cheia" aria-label="Tela cheia" style={{ position: 'fixed', right: 16, bottom: 'calc(6vh + 16px)', width: 40, height: 40, borderRadius: 12, border: 'none', background: 'rgba(255,255,255,.1)', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer', opacity: 0.5 }}>
          {dados?.setor.voz === false ? <VolumeX size={18} /> : <Maximize size={18} />}
        </button>
      )}
    </Tela>
  )
}

function Tela({ children, semCursor }: { children: React.ReactNode; semCursor?: boolean }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', color: '#fff', background: FUNDO, overflow: 'hidden', cursor: semCursor ? 'none' : 'auto',
      fontFamily: 'var(--font-sans), system-ui, sans-serif',
    }}>
      {children}
    </div>
  )
}
