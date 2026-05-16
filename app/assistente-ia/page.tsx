'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { tokens } from '@/lib/design-tokens'
import {
  listarConversas, criarConversa, listarMensagens, deletarConversa,
  type Conversa, type Mensagem,
} from '@/lib/ai/assistente'
import ChatAssistente from './ChatAssistente'

type Auth = {
  medicoId: string | null
  clinicaId: string | null
  nome: string
  loading: boolean
}

export default function AssistenteIAPage() {
  const router = useRouter()
  const [auth, setAuth] = useState<Auth>({ medicoId: null, clinicaId: null, nome: '', loading: true })

  const [conversas, setConversas] = useState<Conversa[]>([])
  const [conversaAtiva, setConversaAtiva] = useState<string | null>(null)
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [carregandoMensagens, setCarregandoMensagens] = useState(false)
  const [sidebarAberta, setSidebarAberta] = useState(true)

  useEffect(() => {
    try {
      const rawMedico = localStorage.getItem('medico')
      const rawAdmin = localStorage.getItem('clinica_admin')
      let med: any = null
      if (rawMedico) med = JSON.parse(rawMedico)
      else if (rawAdmin) med = JSON.parse(rawAdmin)

      if (!med) {
        router.replace('/login')
        return
      }
      setAuth({
        medicoId: med.id,
        clinicaId: med.clinica_id || null,
        nome: med.nome || 'Doutor(a)',
        loading: false,
      })
      listarConversas(med.id).then(setConversas)
    } catch {
      router.replace('/login')
    }
  }, [router])

  const abrirConversa = useCallback(async (conversaId: string) => {
    setConversaAtiva(conversaId)
    setCarregandoMensagens(true)
    try {
      const msgs = await listarMensagens(conversaId)
      setMensagens(msgs)
    } finally {
      setCarregandoMensagens(false)
    }
  }, [])

  function novaConversa() {
    setConversaAtiva(null)
    setMensagens([])
  }

  async function handleDeletar(conversaId: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Excluir esta conversa?')) return
    await deletarConversa(conversaId)
    if (auth.medicoId) {
      const lista = await listarConversas(auth.medicoId)
      setConversas(lista)
    }
    if (conversaAtiva === conversaId) novaConversa()
  }

  // Callback quando uma conversa nova é criada dentro do chat
  const onConversaCriada = useCallback(async (novaConversaId: string) => {
    setConversaAtiva(novaConversaId)
    if (auth.medicoId) {
      const lista = await listarConversas(auth.medicoId)
      setConversas(lista)
    }
  }, [auth.medicoId])

  // Callback quando o título muda (primeira pergunta)
  const onTituloAtualizado = useCallback(async () => {
    if (auth.medicoId) {
      const lista = await listarConversas(auth.medicoId)
      setConversas(lista)
    }
  }, [auth.medicoId])

  if (auth.loading) {
    return (
      <div style={{ padding: 64, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 28, height: 28, border: '2.5px solid ' + tokens.brand.primaryLight, borderTopColor: tokens.brand.primary, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{'@keyframes spin { to { transform: rotate(360deg) } }'}</style>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 0px)', overflow: 'hidden' }}>
      {/* Sidebar de conversas */}
      <div style={{
        width: sidebarAberta ? 280 : 0,
        flexShrink: 0,
        borderRight: sidebarAberta ? '1px solid ' + tokens.border.subtle : 'none',
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'width 0.2s',
      }}>
        <div style={{ padding: 16 }}>
          <button
            type="button"
            onClick={novaConversa}
            style={{
              width: '100%',
              padding: '11px 14px',
              background: tokens.brand.primary,
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nova conversa
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 16px' }}>
          {conversas.length === 0 ? (
            <div style={{ padding: '24px 12px', fontSize: 13, color: tokens.text.tertiary, textAlign: 'center', lineHeight: 1.5 }}>
              Suas conversas aparecem aqui.
            </div>
          ) : (
            conversas.map(c => {
              const ativa = conversaAtiva === c.id
              return (
                <div
                  key={c.id}
                  onClick={() => abrirConversa(c.id)}
                  style={{
                    padding: '10px 12px',
                    marginBottom: 2,
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: ativa ? tokens.brand.primaryLight : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={(e) => { if (!ativa) e.currentTarget.style.background = tokens.bg.cardSubtle }}
                  onMouseLeave={(e) => { if (!ativa) e.currentTarget.style.background = 'transparent' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ativa ? tokens.brand.primary : tokens.text.tertiary} strokeWidth="2" style={{ flexShrink: 0 }}>
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <span style={{
                    flex: 1,
                    fontSize: 13,
                    fontWeight: ativa ? 600 : 500,
                    color: ativa ? tokens.brand.primaryDarkText : tokens.text.primary,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {c.titulo}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handleDeletar(c.id, e)}
                    aria-label="Excluir conversa"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 2,
                      color: tokens.text.tertiary,
                      display: 'flex',
                      flexShrink: 0,
                      opacity: 0.6,
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Área do chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: tokens.bg.page }}>
        <ChatAssistente
          medicoId={auth.medicoId!}
          clinicaId={auth.clinicaId}
          nomeMedico={auth.nome}
          conversaAtiva={conversaAtiva}
          mensagensIniciais={mensagens}
          carregandoMensagens={carregandoMensagens}
          sidebarAberta={sidebarAberta}
          onToggleSidebar={() => setSidebarAberta(v => !v)}
          onConversaCriada={onConversaCriada}
          onTituloAtualizado={onTituloAtualizado}
        />
      </div>
    </div>
  )
}
