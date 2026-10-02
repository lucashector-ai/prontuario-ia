'use client'
/**
 * Diálogos imperativos no padrão do design system — substituem confirm()/alert() do navegador.
 *
 *   if (!(await confirmar({ titulo: 'Excluir paciente?', mensagem: '…', confirmar: 'Excluir', perigo: true }))) return
 *   notificar('Paciente salvo')            // pílula escura no rodapé, 2,6s
 *   notificar('Erro ao salvar', 'erro')    // pílula vermelha
 *
 * Não precisa de provider: monta um root próprio no <body> na primeira chamada.
 */
import { useEffect, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { TriangleAlert, CircleCheck, CircleAlert, Info } from 'lucide-react'
import { tokens } from '@/lib/design-tokens'

const T = tokens

type OpcoesConfirmar = {
  titulo: string
  mensagem?: React.ReactNode
  confirmar?: string
  cancelar?: string
  perigo?: boolean
}
type Pedido = OpcoesConfirmar & { id: number; resolver: (ok: boolean) => void }
type TomAviso = 'ok' | 'erro' | 'info'
type Aviso = { id: number; texto: string; tom: TomAviso }

let root: Root | null = null
let emitir: ((p: Pedido | null) => void) | null = null
let emitirAviso: ((a: Aviso) => void) | null = null
let seq = 0
const pendentes: Array<() => void> = []

function garantirRoot() {
  if (typeof window === 'undefined' || root) return
  const el = document.createElement('div')
  el.id = 'c360-dialogos'
  document.body.appendChild(el)
  root = createRoot(el)
  root.render(<Camada />)
}

/** Abre um diálogo de confirmação. Resolve true se o usuário confirmar. */
export function confirmar(opcoes: OpcoesConfirmar | string): Promise<boolean> {
  const o = typeof opcoes === 'string' ? { titulo: opcoes } : opcoes
  garantirRoot()
  return new Promise(resolve => {
    const pedido: Pedido = { ...o, id: ++seq, resolver: resolve }
    if (emitir) emitir(pedido)
    else pendentes.push(() => emitir!(pedido))
  })
}

/** Aviso rápido (toast) no rodapé da tela. */
export function notificar(texto: string, tom: TomAviso = 'ok') {
  garantirRoot()
  const aviso = { id: ++seq, texto, tom }
  if (emitirAviso) emitirAviso(aviso)
  else pendentes.push(() => emitirAviso!(aviso))
}

function Camada() {
  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [avisos, setAvisos] = useState<Aviso[]>([])

  useEffect(() => {
    emitir = setPedido
    emitirAviso = a => {
      setAvisos(p => [...p.slice(-2), a])
      setTimeout(() => setAvisos(p => p.filter(x => x.id !== a.id)), a.tom === 'erro' ? 4200 : 2600)
    }
    pendentes.splice(0).forEach(fn => fn())
    return () => { emitir = null; emitirAviso = null }
  }, [])

  return (
    <>
      {pedido && <DialogoConfirmar key={pedido.id} pedido={pedido} onFim={() => setPedido(null)} />}
      <div style={{ position: 'fixed', left: '50%', bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))', transform: 'translateX(-50%)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, pointerEvents: 'none' }}>
        {avisos.map(a => {
          const I = a.tom === 'erro' ? CircleAlert : a.tom === 'info' ? Info : CircleCheck
          return (
            <div key={a.id} role="status" style={{
              display: 'flex', alignItems: 'center', gap: 9, maxWidth: 'calc(100vw - 32px)', padding: '10px 16px', borderRadius: 99,
              background: a.tom === 'erro' ? T.status.danger : T.night[800], color: '#fff', fontSize: 13, fontWeight: 600,
              boxShadow: '0 12px 32px -8px rgba(28,27,34,.35)', animation: 'c360-sobe .2s ease-out',
            }}>
              <I size={16} color={a.tom === 'ok' ? '#8FE0B5' : '#fff'} style={{ flexShrink: 0 }} />{a.texto}
            </div>
          )
        })}
      </div>
      <style>{`@keyframes c360-sobe { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }`}</style>
    </>
  )
}

function DialogoConfirmar({ pedido, onFim }: { pedido: Pedido; onFim: () => void }) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const responder = (ok: boolean) => { pedido.resolver(ok); onFim() }

  useEffect(() => {
    btnRef.current?.focus()
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); responder(false) }
      if (e.key === 'Enter') { e.preventDefault(); responder(true) }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cor = pedido.perigo ? T.status.danger : T.brand.primary
  return (
    <div onClick={() => responder(false)} style={{
      position: 'fixed', inset: 0, zIndex: 999, background: T.bg.overlay, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      animation: 'c360-fade .15s ease-out',
    }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="c360-confirmar-titulo" onClick={e => e.stopPropagation()} style={{
        width: 'min(420px, 100%)', background: '#fff', borderRadius: 20, boxShadow: T.shadow.modal, padding: 22, display: 'flex', flexDirection: 'column', gap: 14,
        animation: 'c360-sobe .18s ease-out',
      }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <span style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: 'grid', placeItems: 'center', background: pedido.perigo ? T.status.dangerBg : T.brand.primaryLight, color: cor }}>
            <TriangleAlert size={19} strokeWidth={1.8} />
          </span>
          <div style={{ minWidth: 0, paddingTop: 2 }}>
            <div id="c360-confirmar-titulo" style={{ fontSize: 16, fontWeight: 700, color: T.text.primary, lineHeight: 1.35 }}>{pedido.titulo}</div>
            {pedido.mensagem && <div style={{ fontSize: 13.5, color: T.text.secondary, marginTop: 6, lineHeight: 1.5 }}>{pedido.mensagem}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button onClick={() => responder(false)} style={{
            height: 38, padding: '0 16px', borderRadius: 10, border: `1px solid ${T.border.default}`, background: '#fff', color: T.text.strong,
            fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}>{pedido.cancelar || 'Cancelar'}</button>
          <button ref={btnRef} onClick={() => responder(true)} style={{
            height: 38, padding: '0 16px', borderRadius: 10, border: `1px solid ${cor}`, background: cor, color: '#fff',
            fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', outline: 'none', boxShadow: `0 0 0 0 ${cor}`,
          }}>{pedido.confirmar || 'Confirmar'}</button>
        </div>
      </div>
      <style>{`@keyframes c360-fade { from { opacity: 0 } to { opacity: 1 } }`}</style>
    </div>
  )
}
