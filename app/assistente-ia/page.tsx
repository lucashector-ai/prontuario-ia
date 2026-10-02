'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { tokens } from '@/lib/design-tokens'
import { Button, Icon, IconButton } from '@/components/ui'
import { MessageSquare, PanelLeftClose, Plus, Trash2 } from 'lucide-react'
import {
  listarConversas, criarConversa, listarMensagens, deletarConversa,
  type Conversa, type Mensagem,
} from '@/lib/ai/assistente'
import ChatAssistente from './ChatAssistente'
import { confirmar } from '@/components/ui/dialogos'

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
      // Em telas estreitas a lista de conversas começa recolhida
      if (window.innerWidth < 900) setSidebarAberta(false)
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
    if (!(await confirmar({ titulo: 'Excluir esta conversa?', mensagem: 'O histórico desta conversa com o assistente será apagado.', confirmar: 'Excluir', perigo: true }))) return
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
    <div className={'ia-grid' + (sidebarAberta ? '' : ' ia-grid--fechada')}>
      {/* Conversas recentes */}
      {sidebarAberta && (
        <div className="ia-lista" style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0, minHeight: 0 }}>
          <Button icon={Plus} block onClick={novaConversa}>Nova conversa</Button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0 0 6px' }}>
            <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#9A98A5' }}>Recentes</span>
            <IconButton icon={PanelLeftClose} size={28} onClick={() => setSidebarAberta(false)} aria-label="Ocultar conversas" title="Ocultar conversas" />
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {conversas.length === 0 ? (
              <div style={{ padding: '18px 10px', fontSize: 12.5, color: tokens.text.tertiary, lineHeight: 1.5 }}>
                Suas conversas aparecem aqui.
              </div>
            ) : (
              conversas.map(c => (
                <ItemConversa
                  key={c.id}
                  titulo={c.titulo}
                  quando={quandoConversa(c.atualizado_em || c.criado_em)}
                  ativa={conversaAtiva === c.id}
                  onAbrir={() => abrirConversa(c.id)}
                  onDeletar={(e) => handleDeletar(c.id, e)}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* Área do chat */}
      <div style={{
        border: '1px solid ' + tokens.border.default, borderRadius: 18, minWidth: 0, minHeight: 0,
        display: 'flex', flexDirection: 'column', overflow: 'hidden', background: tokens.bg.card,
      }}>
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

      <style>{`
        .ia-grid {
          height: 100%; min-height: 480px; box-sizing: border-box; padding: 20px;
          display: grid; grid-template-columns: 250px minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); gap: 20px;
        }
        .ia-grid--fechada { grid-template-columns: minmax(0, 1fr); }
        @media (max-width: 900px) {
          .ia-grid { padding: 14px; gap: 14px; grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); }
          .ia-grid--fechada { grid-template-rows: minmax(0, 1fr); }
          .ia-lista { max-height: 38vh; }
        }
      `}</style>
    </div>
  )
}

function ItemConversa({ titulo, quando, ativa, onAbrir, onDeletar }: {
  titulo: string
  quando: string
  ativa: boolean
  onAbrir: () => void
  onDeletar: (e: React.MouseEvent) => void
}) {
  const [h, setH] = useState(false)
  return (
    <div
      onClick={onAbrir}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderRadius: 10, cursor: 'pointer',
        background: ativa ? tokens.brand.primarySubtle : h ? tokens.bg.hover : 'transparent',
        transition: 'background .12s',
      }}
    >
      <Icon icon={MessageSquare} size={14} color={ativa ? tokens.brand.primary : tokens.text.tertiary} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{
          fontSize: 13, fontWeight: 600, color: ativa ? tokens.brand.primaryDarkText : tokens.text.strong,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{titulo}</span>
        {quando && <span style={{ fontSize: 11.5, color: tokens.text.tertiary }}>{quando}</span>}
      </span>
      <button
        type="button"
        onClick={onDeletar}
        aria-label="Excluir conversa"
        title="Excluir conversa"
        style={{
          width: 26, height: 26, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer',
          display: 'grid', placeItems: 'center', flexShrink: 0, color: tokens.text.tertiary,
          opacity: h || ativa ? 1 : 0, transition: 'opacity .12s, color .12s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = tokens.status.danger }}
        onMouseLeave={(e) => { e.currentTarget.style.color = tokens.text.tertiary }}
      >
        <Icon icon={Trash2} size={14} />
      </button>
    </div>
  )
}

/** "14:32" (hoje), "ontem", "seg" (últimos 7 dias) ou "22 set". */
function quandoConversa(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const hoje = new Date()
  const inicio = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const dias = Math.round((inicio(hoje) - inicio(d)) / 86400000)
  if (dias <= 0) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (dias === 1) return 'ontem'
  if (dias < 7) return d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '').replace(' de ', ' ')
}
