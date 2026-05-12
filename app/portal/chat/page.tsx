'use client'

import { useEffect, useRef, useState } from 'react'
import { tokens } from '@/lib/design-tokens'
import { Skeleton } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'
import { FadeIn } from '@/components/motion/FadeIn'
import { PageHeader } from '../_components/PageHeader'
import { usePortalSession } from '@/lib/portal/session'
import { listarMensagens, enviarMensagem } from '@/lib/portal/queries'
import { supabase } from '@/lib/supabase'
import { formatHora } from '@/lib/portal/format'
import type { PortalChatMensagem } from '@/lib/portal/types'

export default function ChatPage() {
  const { session, loading: loadingSession } = usePortalSession()
  const [mensagens, setMensagens] = useState<PortalChatMensagem[]>([])
  const [loading, setLoading] = useState(true)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (loadingSession || !session) return
    let alive = true
    setLoading(true)
    listarMensagens(session.pacienteId).then((m) => {
      if (alive) {
        setMensagens(m)
        setLoading(false)
        scrollToBottom()
      }
    })
    return () => { alive = false }
  }, [session, loadingSession])

  useEffect(() => {
    if (!session) return
    const channel = supabase
      .channel(`portal-chat-${session.pacienteId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'portal_chat_mensagens', filter: `paciente_id=eq.${session.pacienteId}` },
        (payload) => {
          const nova = payload.new as PortalChatMensagem
          setMensagens((prev) => [...prev, nova])
          scrollToBottom()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [session])

  function scrollToBottom() {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }, 50)
  }

  async function handleEnviar(e: React.FormEvent) {
    e.preventDefault()
    if (!texto.trim() || !session) return
    const conteudo = texto.trim()
    setTexto('')
    setEnviando(true)
    // optimistic
    const tempId = `temp-${Date.now()}`
    setMensagens((prev) => [...prev, {
      id: tempId,
      paciente_id: session.pacienteId,
      remetente: 'paciente',
      conteudo,
      lida: true,
      criada_em: new Date().toISOString(),
    }])
    scrollToBottom()
    await enviarMensagem(session.pacienteId, conteudo)
    setEnviando(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 78px)' }}>
      <div style={{ padding: '20px 20px 12px', maxWidth: 760, width: '100%', alignSelf: 'center' }}>
        <PageHeader
          eyebrow="Chat"
          title="Conversa com a clínica"
        />
      </div>

      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 20px',
          maxWidth: 760,
          width: '100%',
          alignSelf: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {loading ? (
          <>
            <Skeleton width="60%" height={36} style={{ borderRadius: 18 }} />
            <Skeleton width="50%" height={36} style={{ alignSelf: 'flex-end', borderRadius: 18 }} />
            <Skeleton width="70%" height={48} style={{ borderRadius: 18 }} />
          </>
        ) : mensagens.length === 0 ? (
          <FadeIn>
            <div style={{
              textAlign: 'center', padding: '48px 24px',
              color: tokens.text.tertiary, fontSize: 14, lineHeight: 1.55,
            }}>
              <div style={{ fontSize: 17, fontWeight: 600, color: tokens.text.primary, marginBottom: 6 }}>
                Nada por aqui ainda
              </div>
              Mande uma mensagem pra clínica — alguém vai responder em horário comercial.
            </div>
          </FadeIn>
        ) : (
          mensagens.map((m) => <Bubble key={m.id} mensagem={m} />)
        )}
      </div>

      <div style={{
        padding: '12px 20px',
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
        background: tokens.bg.card,
        borderTop: `1px solid ${tokens.border.subtle}`,
      }}>
        <form
          onSubmit={handleEnviar}
          style={{
            maxWidth: 760, margin: '0 auto',
            display: 'flex', gap: 10, alignItems: 'flex-end',
          }}
        >
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleEnviar(e)
              }
            }}
            placeholder="Escreva uma mensagem..."
            rows={1}
            style={{
              flex: 1,
              resize: 'none',
              padding: '10px 14px',
              border: `1px solid ${tokens.border.default}`,
              borderRadius: tokens.radius.xl,
              fontSize: 14,
              outline: 'none',
              fontFamily: 'inherit',
              maxHeight: 120,
              minHeight: 42,
            }}
          />
          <Button type="submit" loading={enviando} disabled={!texto.trim()}>Enviar</Button>
        </form>
      </div>
    </div>
  )
}

function Bubble({ mensagem }: { mensagem: PortalChatMensagem }) {
  const dele = mensagem.remetente === 'paciente'
  const sofia = mensagem.remetente === 'sofia'

  return (
    <div style={{ display: 'flex', justifyContent: dele ? 'flex-end' : 'flex-start' }}>
      <div style={{
        maxWidth: '75%',
        padding: '10px 14px',
        borderRadius: 18,
        borderBottomRightRadius: dele ? 4 : 18,
        borderBottomLeftRadius: dele ? 18 : 4,
        background: dele ? tokens.brand.primary : (sofia ? tokens.brand.primaryLighter : tokens.bg.card),
        color: dele ? tokens.text.inverse : tokens.text.primary,
        border: dele ? 'none' : `1px solid ${tokens.border.subtle}`,
        fontSize: 14,
        lineHeight: 1.45,
      }}>
        {sofia && !dele && (
          <div style={{ fontSize: 11, fontWeight: 600, color: tokens.brand.primary, marginBottom: 4 }}>Sofia · IA</div>
        )}
        <div style={{ whiteSpace: 'pre-wrap' }}>{mensagem.conteudo}</div>
        <div style={{
          fontSize: 10,
          textAlign: 'right',
          marginTop: 4,
          opacity: 0.7,
        }}>
          {formatHora(mensagem.criada_em)}
        </div>
      </div>
    </div>
  )
}
