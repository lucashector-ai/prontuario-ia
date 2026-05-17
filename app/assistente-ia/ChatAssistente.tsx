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

type AnexoLocal = {
  tipo: 'image' | 'document'
  media_type: string
  data: string          // base64 puro
  nome: string          // nome do arquivo, pra exibir
  preview?: string      // dataURL pra thumbnail (só imagem)
}

type MsgLocal = {
  papel: 'user' | 'assistant'
  conteudo: string
  anexos?: AnexoLocal[]
}

const SUGESTOES = [
  'Quais as interações da varfarina com anti-inflamatórios?',
  'Dose de amoxicilina para otite média em criança de 4 anos',
  'Diagnóstico diferencial de dor torácica em adulto jovem',
  'Como interpretar um TSH elevado com T4 livre normal?',
]

const MAX_ANEXO_MB = 10
const TIPOS_ACEITOS = 'image/jpeg,image/png,image/gif,image/webp,application/pdf'

export default function ChatAssistente({
  medicoId, clinicaId, nomeMedico, conversaAtiva, mensagensIniciais,
  carregandoMensagens, sidebarAberta, onToggleSidebar, onConversaCriada, onTituloAtualizado,
}: Props) {
  const [mensagens, setMensagens] = useState<MsgLocal[]>([])
  const [input, setInput] = useState('')
  const [anexos, setAnexos] = useState<AnexoLocal[]>([])
  const [streaming, setStreaming] = useState(false)
  const [respostaParcial, setRespostaParcial] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  const conversaIdRef = useRef<string | null>(conversaAtiva)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    conversaIdRef.current = conversaAtiva
    setMensagens(mensagensIniciais.map(m => ({ papel: m.papel, conteudo: m.conteudo })))
    setRespostaParcial('')
    setErro(null)
    setAnexos([])
  }, [conversaAtiva, mensagensIniciais])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [mensagens, respostaParcial])

  function ajustarAltura() {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 220) + 'px'
  }

  async function onArquivoSelecionado(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    setErro(null)

    for (const file of Array.from(files)) {
      if (file.size > MAX_ANEXO_MB * 1024 * 1024) {
        setErro(`"${file.name}" excede ${MAX_ANEXO_MB}MB.`)
        continue
      }
      const ehImagem = file.type.startsWith('image/')
      const ehPdf = file.type === 'application/pdf'
      if (!ehImagem && !ehPdf) {
        setErro(`"${file.name}": só imagens e PDF são aceitos.`)
        continue
      }

      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(r.result as string)
        r.onerror = () => reject(new Error('Falha ao ler arquivo'))
        r.readAsDataURL(file)
      })
      const base64 = dataUrl.split(',')[1] || ''

      setAnexos(prev => [...prev, {
        tipo: ehImagem ? 'image' : 'document',
        media_type: file.type,
        data: base64,
        nome: file.name,
        preview: ehImagem ? dataUrl : undefined,
      }])
    }
    // limpa o input pra poder reanexar o mesmo arquivo
    if (fileRef.current) fileRef.current.value = ''
  }

  function removerAnexo(idx: number) {
    setAnexos(prev => prev.filter((_, i) => i !== idx))
  }

  async function enviar(texto?: string) {
    const pergunta = (texto ?? input).trim()
    if ((!pergunta && anexos.length === 0) || streaming) return

    setErro(null)
    setInput('')
    const anexosEnvio = anexos
    setAnexos([])
    if (inputRef.current) inputRef.current.style.height = 'auto'

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

    const msgUser: MsgLocal = {
      papel: 'user',
      conteudo: pergunta,
      anexos: anexosEnvio.length > 0 ? anexosEnvio : undefined,
    }
    const novasMensagens: MsgLocal[] = [...mensagens, msgUser]
    setMensagens(novasMensagens)
    setStreaming(true)
    setRespostaParcial('')

    // Salva no banco — anexos não são persistidos (só o texto), nota isso no conteúdo
    const conteudoSalvo = anexosEnvio.length > 0
      ? pergunta + `\n[${anexosEnvio.length} anexo(s): ${anexosEnvio.map(a => a.nome).join(', ')}]`
      : pergunta
    await salvarMensagem({ conversaId: convId, papel: 'user', conteudo: conteudoSalvo })

    if (conversaNova) {
      const tituloBase = pergunta || 'Análise de arquivo'
      await atualizarTituloConversa(convId, gerarTituloDaPergunta(tituloBase))
      onConversaCriada(convId)
    }

    try {
      // Monta payload — anexos só na última mensagem (as antigas vão sem, já foram processadas)
      const payloadMensagens = novasMensagens.map((m, idx) => {
        const ultima = idx === novasMensagens.length - 1
        return {
          papel: m.papel,
          conteudo: m.conteudo,
          anexos: (ultima && m.anexos) ? m.anexos.map(a => ({
            tipo: a.tipo, media_type: a.media_type, data: a.data,
          })) : undefined,
        }
      })

      const res = await fetch('/api/assistente/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagens: payloadMensagens }),
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

      const mensagensFinais: MsgLocal[] = [...novasMensagens, { papel: 'assistant', conteudo: acumulado }]
      setMensagens(mensagensFinais)
      setRespostaParcial('')
      await salvarMensagem({ conversaId: convId, papel: 'assistant', conteudo: acumulado })
      if (conversaNova) onTituloAtualizado()
    } catch (e: any) {
      setErro('Erro de conexão. Verifique sua internet e tente novamente.')
    } finally {
      setStreaming(false)
    }
  }

  const vazio = mensagens.length === 0 && !streaming && !carregandoMensagens
  const podeEnviar = (input.trim().length > 0 || anexos.length > 0) && !streaming

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

      {/* Mensagens */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '24px 0' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px' }}>
          {carregandoMensagens ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
              <div style={{ width: 24, height: 24, border: '2.5px solid ' + tokens.brand.primaryLight, borderTopColor: tokens.brand.primary, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : vazio ? (
            <EstadoVazio nomeMedico={nomeMedico} onSugestao={(s) => enviar(s)} />
          ) : (
            <>
              {mensagens.map((m, idx) => (
                <Balao key={idx} papel={m.papel} conteudo={m.conteudo} anexos={m.anexos} />
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
        background: 'transparent',
        padding: '8px 24px 16px',
        flexShrink: 0,
      }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          {/* Preview de anexos */}
          {anexos.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              {anexos.map((a, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px 6px 6px',
                  background: '#fff',
                  borderRadius: 10,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                }}>
                  {a.preview ? (
                    <img src={a.preview} alt={a.nome} style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover' }} />
                  ) : (
                    <div style={{
                      width: 32, height: 32, borderRadius: 6,
                      background: tokens.brand.primaryLight,
                      color: tokens.brand.primary,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    </div>
                  )}
                  <span style={{ fontSize: 12, fontWeight: 500, color: tokens.text.primary, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.nome}
                  </span>
                  <button
                    type="button"
                    onClick={() => removerAnexo(idx)}
                    aria-label="Remover anexo"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: tokens.text.tertiary, display: 'flex' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Caixa do input */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 8,
            border: 'none',
            borderRadius: 18,
            padding: 10,
            background: '#fff',
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          }}>
            {/* Botão de anexo */}
            <input
              ref={fileRef}
              type="file"
              accept={TIPOS_ACEITOS}
              multiple
              onChange={onArquivoSelecionado}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={streaming}
              aria-label="Anexar arquivo"
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                border: 'none',
                background: 'transparent',
                color: tokens.text.secondary,
                cursor: streaming ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'background 0.12s',
              }}
              onMouseEnter={(e) => { if (!streaming) e.currentTarget.style.background = tokens.bg.cardSubtle }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>

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
              placeholder="Pergunte sobre doses, interações, condutas, ou anexe um exame..."
              rows={1}
              disabled={streaming}
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                resize: 'none',
                fontSize: 15,
                lineHeight: 1.6,
                fontFamily: 'inherit',
                color: tokens.text.primary,
                background: 'transparent',
                padding: '14px 6px',
                minHeight: 56,
                maxHeight: 220,
              }}
            />

            <button
              type="button"
              onClick={() => enviar()}
              disabled={!podeEnviar}
              aria-label="Enviar"
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                border: 'none',
                background: !podeEnviar ? tokens.bg.cardSubtle : tokens.brand.primary,
                color: !podeEnviar ? tokens.text.tertiary : '#fff',
                cursor: !podeEnviar ? 'not-allowed' : 'pointer',
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
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
              )}
            </button>
          </div>

          <div style={{ fontSize: 11, color: tokens.text.tertiary, textAlign: 'center', marginTop: 8, lineHeight: 1.4 }}>
            {DISCLAIMER_UI} Ao anexar exames, prefira arquivos sem dados de identificação do paciente.
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
      <p style={{ fontSize: 15, color: tokens.text.secondary, margin: '0 auto 28px', maxWidth: 440, lineHeight: 1.5 }}>
        Sou seu assistente de apoio à decisão clínica. Pergunte sobre farmacologia, condutas, exames ou diagnóstico diferencial. Você também pode anexar exames.
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
              border: 'none',
              borderRadius: 12,
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              fontSize: 14,
              color: tokens.text.primary,
              cursor: 'pointer',
              transition: 'all 0.12s',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = tokens.brand.primaryLight }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#fff' }}
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

function Balao({ papel, conteudo, anexos, streaming }: { papel: 'user' | 'assistant'; conteudo: string; anexos?: AnexoLocal[]; streaming?: boolean }) {
  const ehUser = papel === 'user'
  return (
    <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', alignItems: ehUser ? 'flex-end' : 'flex-start' }}>
      <div style={{
        fontSize: 11, fontWeight: 600, color: tokens.text.tertiary,
        textTransform: 'uppercase', letterSpacing: '0.04em',
        marginBottom: 6, padding: '0 4px',
      }}>
        {ehUser ? 'Você' : 'Assistente'}
      </div>

      {/* Anexos da mensagem */}
      {anexos && anexos.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6, justifyContent: ehUser ? 'flex-end' : 'flex-start' }}>
          {anexos.map((a, idx) => (
            a.preview ? (
              <img key={idx} src={a.preview} alt={a.nome} style={{ width: 120, height: 120, borderRadius: 10, objectFit: 'cover' }} />
            ) : (
              <div key={idx} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', background: '#fff', borderRadius: 10,
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={tokens.brand.primary} strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span style={{ fontSize: 12, fontWeight: 500, color: tokens.text.primary }}>{a.nome}</span>
              </div>
            )
          ))}
        </div>
      )}

      {conteudo && (
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
              display: 'inline-block', width: 7, height: 15,
              background: tokens.brand.primary, marginLeft: 2,
              verticalAlign: 'text-bottom',
              animation: 'piscar 1s steps(2) infinite',
            }} />
          )}
        </div>
      )}
      <style>{'@keyframes piscar { 0%,50% { opacity: 1 } 50.01%,100% { opacity: 0 } }'}</style>
    </div>
  )
}
