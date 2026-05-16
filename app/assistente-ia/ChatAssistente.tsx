'use client'

import { useEffect, useRef, useState } from 'react'
import { tokens } from '@/lib/design-tokens'
import {
  criarConversa, salvarMensagem, atualizarTituloConversa, gerarTituloDaPergunta,
  type Mensagem,
} from '@/lib/ai/assistente'
import { DISCLAIMER_UI } from '@/lib/ai/system-prompt-medico'

type Props = {
  medicoId: string
  clinicaId: string | null
  nomeMedico: string
  conversaAtiva: string | null
  mensagensIniciais: Mensagem[]
  carregandoMensagens: boolean
  sidebarAberta: boolean
  onToggleSidebar: () => void
  onConversaCriada: (id: string) => void
  onTituloAtualizado: () => void
}

type MsgLocal = {
  papel: 'user' | 'assistant'
  conteudo: string
}

const SUGESTOES = [
  'Quais as interações da varfarina com anti-inflamatórios?',
  'Dose de amoxicilina para otite média em criança de 4 anos',
  'Diagnóstico diferencial de dor torácica em adulto jovem',
  'Como interpretar um TSH elevado com T4 livre normal?',
]

export default function ChatAssistente({
  medicoId, clinicaId, nomeMedico, conversaAtiva, mensagensIniciais,
  carregandoMensagens, sidebarAberta, onToggleSidebar, onConversaCriada, onTituloAtualizado,
}: Props) {
  const [mensagens, setMensagens] = useState<MsgLocal[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [respostaParcial, setRespostaParcial] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  const conversaIdRef = useRef<string | null>(conversaAtiva)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Sincroniza quando troca de conversa pela sidebar
  useEffect(() => {
    conversaIdRef.current = conversaAtiva
    setMensagens(mensagensIniciais.map(m => ({ papel: m.papel, conteudo: m.conteudo })))
    setRespostaParcial('')
    setErro(null)
  }, [conversaAtiva, mensagensIniciais])

  // Auto-scroll pro fim
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [mensagens, respostaParcial])

  function ajustarAltura() {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }

  async function enviar(texto?: string) {
    const pergunta = (texto ?? input).trim()
    if (!pergunta || streaming) return

    setErro(null)
    setInput('')
    if (inputRef.current) inputRef.current.style.height = 'auto'

    // Garante que existe uma conversa
    let convId = conversaIdRef.current
    let conversaNova = false
    if (!convId) {
      const nova = await criarConversa(medicoId, clinicaId)
      if (!nova) {
        setErro('Não foi possível iniciar a conversa. Tente de novo.')
        return
      }
      convId = nova.id
      conversaIdRef.current = convId
      conversaNova = true
    }

    // Adiciona pergunta do usuário na tela
    const novasMensagens: MsgLocal[] = [...mensagens, { papel: 'user', conteudo: pergunta }]
    setMensagens(novasMensagens)
    setStreaming(true)
    setRespostaParcial('')

    // Salva pergunta no banco
    await salvarMensagem({ conversaId: convId, papel: 'user', conteudo: pergunta })

    // Se for a primeira mensagem, dá título à conversa
    if (conversaNova) {
      await atualizarTituloConversa(convId, gerarTituloDaPergunta(pergunta))
      onConversaCriada(convId)
    }

    // Chama a API com streaming
    try {
      const res = await fetch('/api/assistente/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagens: novasMensagens }),
      })

      if (!res.ok || !res.body) {
        let msgErro = 'Erro ao processar. Tente novamente.'
        try {
          const j = await res.json()
          if (j.erro) msgErro = j.erro
        } catch {}
        setErro(msgErro)
        setStreaming(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acumulado = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acumulado += decoder.decode(value, { stream: true })
        setRespostaParcial(acumulado)
      }

      // Finaliza: move resposta parcial pra lista definitiva
      const mensagensFinais: MsgLocal[] = [...novasMensagens, { papel: 'assistant', conteudo: acumulado }]
      setMensagens(mensagensFinais)
      setRespostaParcial('')

      // Salva resposta no banco
      await salvarMensagem({ conversaId: convId, papel: 'assistant', conteudo: acumulado })
      if (conversaNova) onTituloAtualizado()
    } catch (e: any) {
      setErro('Erro de conexão. Verifique sua internet e tente novamente.')
    } finally {
      setStreaming(false)
    }
  }

  const vazio = mensagens.length === 0 && !streaming && !carregandoMensagens

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid ' + tokens.border.subtle,
        background: '#fff',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexShrink: 0,
      }}>
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Mostrar/ocultar conversas"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: tokens.text.secondary, display: 'flex' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
        </button>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: 'linear-gradient(135deg, ' + tokens.brand.primary + ', ' + tokens.brand.primaryDark + ')',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
            <path d="M12 2a3 3 0 0 0-3 3v1a3 3 0 0 0-3 3 3 3 0 0 0 0 6 3 3 0 0 0 3 3v1a3 3 0 0 0 6 0v-1a3 3 0 0 0 3-3 3 3 0 0 0 0-6 3 3 0 0 0-3-3V5a3 3 0 0 0-3-3z" />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: tokens.text.primary }}>
            Assistente clínico
          </div>
          <div style={{ fontSize: 12, color: tokens.text.tertiary }}>
            Apoio à decisão · não substitui julgamento clínico
          </div>
        </div>
      </div>

      {/* Área de mensagens */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '24px 0' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 24px' }}>
          {carregandoMensagens ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
              <div style={{ width: 24, height: 24, border: '2.5px solid ' + tokens.brand.primaryLight, borderTopColor: tokens.brand.primary, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : vazio ? (
            <EstadoVazio nomeMedico={nomeMedico} onSugestao={(s) => enviar(s)} />
          ) : (
            <>
              {mensagens.map((m, idx) => (
                <Balao key={idx} papel={m.papel} conteudo={m.conteudo} />
              ))}
              {streaming && (
                <Balao papel="assistant" conteudo={respostaParcial} streaming />
              )}
            </>
          )}

          {erro && (
            <div style={{
              margin: '12px 0',
              padding: '12px 14px',
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: 10,
              color: '#991B1B',
              fontSize: 13,
              fontWeight: 500,
            }}>
              {erro}
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div style={{
        borderTop: '1px solid ' + tokens.border.subtle,
        background: '#fff',
        padding: '16px 24px 12px',
        flexShrink: 0,
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 10,
            border: '1px solid ' + tokens.border.default,
            borderRadius: 14,
            padding: 8,
            background: '#fff',
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => { setInput(e.target.value); ajustarAltura() }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  enviar()
                }
              }}
              placeholder="Pergunte sobre doses, interações, condutas, CID-10..."
              rows={1}
              disabled={streaming}
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                resize: 'none',
                fontSize: 14,
                lineHeight: 1.5,
                fontFamily: 'inherit',
                color: tokens.text.primary,
                background: 'transparent',
                padding: '8px 6px',
                maxHeight: 200,
              }}
            />
            <button
              type="button"
              onClick={() => enviar()}
              disabled={!input.trim() || streaming}
              aria-label="Enviar"
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                border: 'none',
                background: (!input.trim() || streaming) ? tokens.bg.cardSubtle : tokens.brand.primary,
                color: (!input.trim() || streaming) ? tokens.text.tertiary : '#fff',
                cursor: (!input.trim() || streaming) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'background 0.12s',
              }}
            >
              {streaming ? (
                <div style={{ width: 14, height: 14, border: '2px solid ' + tokens.text.tertiary, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
              )}
            </button>
          </div>
          <div style={{ fontSize: 11, color: tokens.text.tertiary, textAlign: 'center', marginTop: 8, lineHeight: 1.4 }}>
            {DISCLAIMER_UI}
          </div>
        </div>
      </div>

      <style>{'@keyframes spin { to { transform: rotate(360deg) } }'}</style>
    </div>
  )
}

function EstadoVazio({ nomeMedico, onSugestao }: { nomeMedico: string; onSugestao: (s: string) => void }) {
  const primeiroNome = nomeMedico.split(' ')[0]
  return (
    <div style={{ padding: '32px 0', textAlign: 'center' }}>
      <div style={{
        width: 56, height: 56, margin: '0 auto 20px',
        borderRadius: 16,
        background: 'linear-gradient(135deg, ' + tokens.brand.primary + ', ' + tokens.brand.primaryDark + ')',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
          <path d="M12 2a3 3 0 0 0-3 3v1a3 3 0 0 0-3 3 3 3 0 0 0 0 6 3 3 0 0 0 3 3v1a3 3 0 0 0 6 0v-1a3 3 0 0 0 3-3 3 3 0 0 0 0-6 3 3 0 0 0-3-3V5a3 3 0 0 0-3-3z" />
        </svg>
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: tokens.text.primary, margin: '0 0 8px', letterSpacing: '-0.01em' }}>
        Olá, {primeiroNome}
      </h2>
      <p style={{ fontSize: 15, color: tokens.text.secondary, margin: '0 auto 28px', maxWidth: 420, lineHeight: 1.5 }}>
        Sou seu assistente de apoio à decisão clínica. Pergunte sobre farmacologia, condutas, exames ou diagnóstico diferencial.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 480, margin: '0 auto' }}>
        {SUGESTOES.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSugestao(s)}
            style={{
              textAlign: 'left',
              padding: '12px 16px',
              background: '#fff',
              border: '1px solid ' + tokens.border.default,
              borderRadius: 12,
              fontSize: 14,
              color: tokens.text.primary,
              cursor: 'pointer',
              transition: 'all 0.12s',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = tokens.brand.primary
              e.currentTarget.style.background = tokens.brand.primaryLight
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = tokens.border.default
              e.currentTarget.style.background = '#fff'
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={tokens.brand.primary} strokeWidth="2" style={{ flexShrink: 0 }}>
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

function Balao({ papel, conteudo, streaming }: { papel: 'user' | 'assistant'; conteudo: string; streaming?: boolean }) {
  const ehUser = papel === 'user'
  return (
    <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', alignItems: ehUser ? 'flex-end' : 'flex-start' }}>
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        color: tokens.text.tertiary,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        marginBottom: 6,
        padding: '0 4px',
      }}>
        {ehUser ? 'Você' : 'Assistente'}
      </div>
      <div style={{
        maxWidth: ehUser ? '85%' : '100%',
        padding: ehUser ? '12px 16px' : '0 4px',
        background: ehUser ? tokens.brand.primary : 'transparent',
        color: ehUser ? '#fff' : tokens.text.primary,
        borderRadius: ehUser ? 14 : 0,
        fontSize: 14,
        lineHeight: 1.65,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {conteudo}
        {streaming && (
          <span style={{
            display: 'inline-block',
            width: 7,
            height: 15,
            background: tokens.brand.primary,
            marginLeft: 2,
            verticalAlign: 'text-bottom',
            animation: 'piscar 1s steps(2) infinite',
          }} />
        )}
      </div>
      <style>{'@keyframes piscar { 0%,50% { opacity: 1 } 50.01%,100% { opacity: 0 } }'}</style>
    </div>
  )
}
