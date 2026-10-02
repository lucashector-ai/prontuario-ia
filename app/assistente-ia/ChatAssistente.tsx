'use client'

import { useEffect, useRef, useState } from 'react'
import { tokens } from '@/lib/design-tokens'
import { Icon, IconButton } from '@/components/ui'
import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle, ArrowUp, FileText, FlaskConical, HeartPulse, PanelLeft, Paperclip, Pill, Sparkles, Stethoscope, X,
} from 'lucide-react'
import {
  criarConversa, salvarMensagem, atualizarTituloConversa, gerarTituloDaPergunta,
  type Mensagem,
} from '@/lib/ai/assistente'
import { DISCLAIMER_UI } from '@/lib/ai/system-prompt-medico'

import { primeiroNome } from '@/lib/nome'
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

const SUGESTOES: { icon: LucideIcon; texto: string }[] = [
  { icon: Pill, texto: 'Quais as interações da varfarina com anti-inflamatórios?' },
  { icon: Stethoscope, texto: 'Dose de amoxicilina para otite média em criança de 4 anos' },
  { icon: HeartPulse, texto: 'Diagnóstico diferencial de dor torácica em adulto jovem' },
  { icon: FlaskConical, texto: 'Como interpretar um TSH elevado com T4 livre normal?' },
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
  const [focado, setFocado] = useState(false)

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, position: 'relative' }}>
      {/* Lista de conversas recolhida: botão para reabrir */}
      {!sidebarAberta && (
        <IconButton
          icon={PanelLeft}
          size={32}
          variant="outline"
          onClick={onToggleSidebar}
          aria-label="Mostrar conversas"
          title="Mostrar conversas"
          style={{ position: 'absolute', top: 10, left: 10, zIndex: 2 }}
        />
      )}

      {/* Mensagens */}
      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: sidebarAberta ? '22px 22px 16px' : '52px 22px 16px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ width: '100%', maxWidth: 820, margin: '0 auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {carregandoMensagens ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
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
                respostaParcial
                  ? <Balao papel="assistant" conteudo={respostaParcial} streaming />
                  : (
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <AvatarIA />
                      <span style={{ fontSize: 13, color: tokens.text.quaternary }}>Pensando…</span>
                    </div>
                  )
              )}
            </>
          )}

          {erro && (
            <div style={{
              display: 'flex', gap: 8, alignItems: 'flex-start',
              padding: '10px 12px', background: tokens.status.dangerBg, borderRadius: 12,
              color: tokens.status.danger, fontSize: 13, fontWeight: 500, lineHeight: 1.45,
            }}>
              <Icon icon={AlertTriangle} size={15} style={{ marginTop: 1, flexShrink: 0 }} />
              {erro}
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div style={{ padding: 14, borderTop: '1px solid ' + tokens.border.muted, flexShrink: 0 }}>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          {/* Preview de anexos */}
          {anexos.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              {anexos.map((a, idx) => (
                <div key={idx} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '5px 6px 5px 5px',
                  background: tokens.bg.card, border: '1px solid ' + tokens.border.default, borderRadius: 12,
                }}>
                  {a.preview ? (
                    <img src={a.preview} alt={a.nome} style={{ width: 30, height: 30, borderRadius: 8, objectFit: 'cover' }} />
                  ) : (
                    <span style={{ width: 30, height: 30, borderRadius: 8, background: tokens.brand.primaryLight, color: tokens.brand.primary, display: 'grid', placeItems: 'center' }}>
                      <Icon icon={FileText} size={15} />
                    </span>
                  )}
                  <span style={{ fontSize: 12, fontWeight: 500, color: tokens.text.primary, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.nome}
                  </span>
                  <IconButton icon={X} size={24} onClick={() => removerAnexo(idx)} aria-label="Remover anexo" />
                </div>
              ))}
            </div>
          )}

          {/* Barra única: anexo + texto + enviar */}
          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: 6, padding: 6, borderRadius: 14,
            border: '1px solid ' + (focado ? tokens.brand.primaryAccent : tokens.border.default),
            boxShadow: focado ? tokens.shadow.focusRing : 'none',
            background: tokens.bg.card, transition: 'border-color .15s, box-shadow .15s',
          }}>
            <input
              ref={fileRef}
              type="file"
              accept={TIPOS_ACEITOS}
              multiple
              onChange={onArquivoSelecionado}
              style={{ display: 'none' }}
            />
            <IconButton
              icon={Paperclip}
              size={36}
              onClick={() => fileRef.current?.click()}
              disabled={streaming}
              aria-label="Anexar arquivo"
              title="Anexar exame ou imagem"
              style={streaming ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
            />

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
              onFocus={() => setFocado(true)}
              onBlur={() => setFocado(false)}
              placeholder="Pergunte sobre doses, interações, condutas, ou anexe um exame…"
              rows={1}
              disabled={streaming}
              style={{
                flex: 1, minWidth: 0, border: 'none', outline: 'none', boxShadow: 'none', resize: 'none',
                fontSize: 13.5, lineHeight: 1.5, fontFamily: 'inherit', color: tokens.text.primary,
                background: 'transparent', padding: '8px 4px', minHeight: 36, maxHeight: 220, boxSizing: 'border-box',
              }}
            />

            <button
              type="button"
              onClick={() => enviar()}
              disabled={!podeEnviar}
              aria-label="Enviar"
              style={{
                width: 36, height: 36, borderRadius: 10, border: 'none', flexShrink: 0,
                background: tokens.brand.primary, color: '#fff',
                opacity: podeEnviar || streaming ? 1 : 0.45,
                cursor: !podeEnviar ? 'not-allowed' : 'pointer',
                display: 'grid', placeItems: 'center', transition: 'background .15s, opacity .15s',
              }}
              onMouseEnter={(e) => { if (podeEnviar) e.currentTarget.style.background = tokens.brand.primaryHover }}
              onMouseLeave={(e) => { e.currentTarget.style.background = tokens.brand.primary }}
            >
              {streaming ? (
                <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              ) : (
                <Icon icon={ArrowUp} size={17} />
              )}
            </button>
          </div>

          <div style={{ fontSize: 11, color: tokens.text.tertiary, textAlign: 'center', marginTop: 8, lineHeight: 1.4 }}>
            {DISCLAIMER_UI} Ao anexar exames, prefira arquivos sem dados de identificação do paciente.
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: '@keyframes spin { to { transform: rotate(360deg) } } @keyframes piscar { 0%,50% { opacity: 1 } 50.01%,100% { opacity: 0 } }' }} />
    </div>
  )
}

function AvatarIA() {
  return (
    <span style={{
      width: 30, height: 30, borderRadius: 10, flexShrink: 0,
      background: tokens.brand.primaryLight, color: tokens.brand.primary,
      display: 'grid', placeItems: 'center',
    }}>
      <Icon icon={Sparkles} size={15} active />
    </span>
  )
}

function EstadoVazio({ nomeMedico, onSugestao }: { nomeMedico: string; onSugestao: (s: string) => void }) {
  // "Dra. Ana Lima" → "Dra. Ana"; "Ricardo Almeida" → "Ricardo"
  const primeiroNomeMedico = primeiroNome(nomeMedico)
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, textAlign: 'center', padding: '20px 0' }}>
      <span style={{ width: 56, height: 56, borderRadius: 18, background: tokens.brand.primaryLight, color: tokens.brand.primary, display: 'grid', placeItems: 'center' }}>
        <Icon icon={Sparkles} size={26} active />
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.02em', color: tokens.text.primary }}>
          Como posso ajudar, {primeiroNomeMedico}?
        </span>
        <span style={{ fontSize: 13.5, color: tokens.text.quaternary, maxWidth: 460, lineHeight: 1.5 }}>
          Pergunte sobre farmacologia, condutas, exames ou diagnóstico diferencial. Você também pode anexar exames.
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, width: '100%', maxWidth: 560 }}>
        {SUGESTOES.map((s, i) => (
          <BotaoSugestao key={i} icon={s.icon} texto={s.texto} onClick={() => onSugestao(s.texto)} />
        ))}
      </div>
    </div>
  )
}

function BotaoSugestao({ icon, texto, onClick }: { icon: LucideIcon; texto: string; onClick: () => void }) {
  const [h, setH] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 14, textAlign: 'left',
        border: '1px solid ' + (h ? tokens.brand.primaryAccent : tokens.border.default),
        background: h ? tokens.brand.primarySoftBg : tokens.bg.card,
        fontSize: 13, lineHeight: 1.45, color: tokens.text.strong, fontFamily: 'inherit', cursor: 'pointer',
        transition: 'background .15s, border-color .15s',
      }}
    >
      <Icon icon={icon} size={16} color={tokens.brand.primary} style={{ marginTop: 1, flexShrink: 0 }} />
      {texto}
    </button>
  )
}

function Balao({ papel, conteudo, anexos, streaming }: { papel: 'user' | 'assistant'; conteudo: string; anexos?: AnexoLocal[]; streaming?: boolean }) {
  const ehUser = papel === 'user'
  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: ehUser ? 'flex-end' : 'flex-start' }}>
      {!ehUser && <AvatarIA />}
      <div style={{ maxWidth: '78%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6, alignItems: ehUser ? 'flex-end' : 'flex-start' }}>
        {/* Anexos da mensagem */}
        {anexos && anexos.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: ehUser ? 'flex-end' : 'flex-start' }}>
            {anexos.map((a, idx) => (
              a.preview ? (
                <img key={idx} src={a.preview} alt={a.nome} style={{ width: 120, height: 120, borderRadius: 12, objectFit: 'cover', border: '1px solid ' + tokens.border.default }} />
              ) : (
                <div key={idx} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                  background: tokens.bg.card, border: '1px solid ' + tokens.border.default, borderRadius: 12,
                }}>
                  <Icon icon={FileText} size={15} color={tokens.brand.primary} />
                  <span style={{ fontSize: 12, fontWeight: 500, color: tokens.text.primary }}>{a.nome}</span>
                </div>
              )
            ))}
          </div>
        )}

        {conteudo && (
          <div style={{
            padding: '11px 14px',
            borderRadius: ehUser ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
            background: ehUser ? tokens.brand.primary : tokens.bg.hover,
            color: ehUser ? '#fff' : tokens.text.primary,
            fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
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
      </div>
    </div>
  )
}
