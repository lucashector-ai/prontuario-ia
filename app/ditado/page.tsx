'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useGravador } from '@/lib/useGravador'
import { useToast } from '@/components/Toast'
import { tokens } from '@/lib/design-tokens'
import { tint } from '@/lib/design-tokens'
import { usePageHeader } from '@/components/shell/header-context'
import { Check, CircleAlert, Copy, FileText, Loader2, Mic, PenLine, RotateCcw, Square } from 'lucide-react'
import { Badge, Button, Card, Icon, IconTile, Overline, SegmentedControl } from '@/components/ui'

const T = tokens

export default function Ditado() {
  usePageHeader('Ditado livre', 'Dite ou escreva livremente — a IA estrutura em SOAP com CIDs sugeridos')
  const router = useRouter()
  const { toast } = useToast()
  const [medico, setMedico] = useState<any>(null)
  const [transcricao, setTranscricao] = useState('')
  const [prontuario, setProntuario] = useState<any>(null)
  const [processando, setProcessando] = useState(false)
  const [copiado, setCopiado] = useState<string | null>(null)
  const [textoDireto, setTextoDireto] = useState('')
  const [modo, setModo] = useState<'gravar' | 'digitar'>('gravar')

  useEffect(() => {
    const ca_ = localStorage.getItem('clinica_admin')
    const m = ca_ || localStorage.getItem('medico')
    if (!m) { router.push('/login'); return }
    setMedico(JSON.parse(m))
  }, [router])

  const handleNovoTexto = useCallback((t: string) => setTranscricao(t), [])
  const { gravando, transcrevendo, iniciarGravacao, pararGravacao, limpar, erro } = useGravador(handleNovoTexto)

  const textoFinal = modo === 'gravar' ? transcricao : textoDireto

  const handleEstruturar = async () => {
    if (!textoFinal.trim() || textoFinal.trim().length < 20) {
      toast('Digite ou grave pelo menos algumas frases', 'error')
      return
    }
    setProcessando(true)
    try {
      const res = await fetch('/api/estruturar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcricao: textoFinal, especialidade: medico?.especialidade || '' }),
      })
      const data = await res.json()
      if (data.prontuario) {
        setProntuario(data.prontuario)
        toast('Prontuário estruturado!')
      } else throw new Error(data.error)
    } catch (e: any) {
      toast(e.message || 'Erro ao estruturar', 'error')
    } finally {
      setProcessando(false)
    }
  }

  const copiar = (campo: string, valor: string) => {
    navigator.clipboard.writeText(valor)
    setCopiado(campo)
    setTimeout(() => setCopiado(null), 2000)
  }

  const copiarTudo = () => {
    if (!prontuario) return
    const t = [
      `PRONTUÁRIO — ${new Date().toLocaleDateString('pt-BR')}`,
      medico ? `${medico.nome} | ${medico.crm || ''}` : '', '',
      'SUBJETIVO', prontuario.subjetivo, '',
      'OBJETIVO', prontuario.objetivo, '',
      'AVALIAÇÃO', prontuario.avaliacao, '',
      'PLANO', prontuario.plano, '',
      ...(prontuario.cids || []).map((c: any) => `${c.codigo} — ${c.descricao}`),
    ].join('\n')
    navigator.clipboard.writeText(t)
    toast('Prontuário completo copiado!')
  }

  const reiniciar = () => {
    limpar(); setTranscricao(''); setTextoDireto(''); setProntuario(null)
  }

  if (!medico) return null

  const campos = [
    { key: 'subjetivo', label: 'Subjetivo', cor: T.data.blue },
    { key: 'objetivo', label: 'Objetivo', cor: T.data.purple },
    { key: 'avaliacao', label: 'Avaliação', cor: T.data.orange },
    { key: 'plano', label: 'Plano', cor: T.data.green },
  ]

  return (
    <div style={{ padding: 20 }}>
      <style>{`
        .dit-grid { display: grid; grid-template-columns: 1fr; gap: 16px; width: 100%; }
        @media (min-width: 1024px) { .dit-grid.com-prontuario { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } }
        @keyframes dit-spin { to { transform: rotate(360deg) } }
        @keyframes dit-pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }
      `}</style>

      {/* Ações */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 10, flexWrap: 'wrap' }}>
        <SegmentedControl
          value={modo}
          onChange={setModo}
          options={[
            { value: 'gravar', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon icon={Mic} size={14} />Gravar</span> },
            { value: 'digitar', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon icon={PenLine} size={14} />Digitar</span> },
          ]}
        />

        {prontuario && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" icon={RotateCcw} onClick={reiniciar}>Novo ditado</Button>
            <Button icon={Copy} onClick={copiarTudo}>Copiar tudo</Button>
          </div>
        )}
      </div>

      {/* Grid — 2 colunas quando tem prontuário, 1 coluna (100%) quando não */}
      <div className={'dit-grid' + (prontuario ? ' com-prontuario' : '')}>

        {/* Coluna esquerda — entrada (gravação ou texto) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <Card padding={0} style={{ overflow: 'hidden' }}>
            {modo === 'gravar' ? (
              <div style={{ padding: 20 }}>
                {/* Estado da gravação */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
                  {!gravando ? (
                    <Button
                      variant="dangerSolid"
                      size="lg"
                      icon={Mic}
                      onClick={async () => { limpar(); setTranscricao(''); await iniciarGravacao() }}
                    >
                      Iniciar gravação
                    </Button>
                  ) : (
                    <Button variant="danger" size="lg" icon={Square} onClick={() => pararGravacao()}>
                      Parar gravação
                    </Button>
                  )}
                  {gravando && (
                    <Badge tone="danger" style={{ height: 26, padding: '0 11px' }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: T.status.danger, animation: 'dit-pulse 1.2s infinite' }} />
                      Gravando
                    </Badge>
                  )}
                  {transcrevendo && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: T.text.secondary, fontWeight: 500 }}>
                      <Loader2 size={14} strokeWidth={1.6} style={{ animation: 'dit-spin .8s linear infinite' }} />
                      Transcrevendo áudio…
                    </span>
                  )}
                </div>

                {/* Área do texto transcrito */}
                {transcricao ? (
                  <div style={{
                    padding: 18, background: T.bg.cardSubtle, border: `1px solid ${T.border.muted}`, borderRadius: T.radius.input,
                    minHeight: 200, maxHeight: 500, overflow: 'auto',
                  }}>
                    <p style={{ fontSize: 14, color: T.text.primary, lineHeight: 1.75, margin: 0, whiteSpace: 'pre-wrap' }}>
                      {transcricao}
                    </p>
                  </div>
                ) : (
                  <div style={{
                    padding: 32, background: T.bg.cardSubtle, border: `1px solid ${T.border.muted}`, borderRadius: T.radius.input,
                    minHeight: 200, display: 'flex', flexDirection: 'column', gap: 6,
                    alignItems: 'center', justifyContent: 'center', textAlign: 'center',
                  }}>
                    <IconTile icon={Mic} size={48} radius={15} color={gravando ? T.status.danger : T.brand.primary} style={{ marginBottom: 6 }} />
                    <p style={{ fontSize: 14.5, fontWeight: 700, color: T.text.primary, margin: 0 }}>
                      {gravando ? 'Aguardando fala…' : 'Pronto pra começar'}
                    </p>
                    <p style={{ fontSize: 12.5, color: T.text.quaternary, margin: 0, maxWidth: 340, lineHeight: 1.45 }}>
                      {gravando
                        ? 'Fale naturalmente. Sua fala aparece aqui conforme você grava.'
                        : 'Clique em "Iniciar gravação" e dite o prontuário livremente.'}
                    </p>
                  </div>
                )}

                {erro && (
                  <div role="alert" style={{
                    marginTop: 12, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 8,
                    background: T.status.dangerBg, borderRadius: T.radius.lg, fontSize: 12.5, color: T.status.danger, fontWeight: 500,
                  }}>
                    <CircleAlert size={15} strokeWidth={1.6} style={{ flexShrink: 0, marginTop: 1 }} />
                    {erro}
                  </div>
                )}
              </div>
            ) : (
              <textarea
                value={textoDireto}
                onChange={e => setTextoDireto(e.target.value)}
                placeholder="Digite o relato da consulta livremente...&#10;&#10;A IA vai estruturar em formato SOAP (Subjetivo, Objetivo, Avaliação, Plano) e sugerir CIDs."
                style={{
                  display: 'block', width: '100%', minHeight: 340, padding: 20,
                  fontSize: 14, color: T.text.primary, lineHeight: 1.75,
                  border: 'none', outline: 'none', background: 'transparent',
                  resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              />
            )}
          </Card>

          {/* Botão estruturar */}
          {textoFinal.trim().length >= 20 && !gravando && (
            <Button size="lg" block icon={processando ? undefined : FileText} onClick={handleEstruturar} disabled={processando}>
              {processando && <Loader2 size={16} strokeWidth={1.6} style={{ animation: 'dit-spin .8s linear infinite' }} />}
              {processando ? 'Estruturando prontuário…' : 'Estruturar prontuário'}
            </Button>
          )}
        </div>

        {/* Coluna direita — prontuário estruturado (só aparece após processar) */}
        {prontuario && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
            {campos.map(campo => prontuario[campo.key] && (
              <Card key={campo.key} padding={0} style={{ overflow: 'hidden' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                  padding: '10px 12px 10px 18px', borderBottom: `1px solid ${T.border.muted}`,
                }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 3, background: campo.cor, boxShadow: `0 0 0 3px ${tint(campo.cor, 0.15)}` }} />
                    <Overline style={{ color: T.text.secondary }}>{campo.label}</Overline>
                  </span>
                  <Button
                    variant={copiado === campo.key ? 'secondary' : 'ghost'}
                    size="sm"
                    icon={copiado === campo.key ? Check : Copy}
                    onClick={() => copiar(campo.key, prontuario[campo.key])}
                    style={copiado === campo.key ? { color: T.status.success } : undefined}
                  >
                    {copiado === campo.key ? 'Copiado' : 'Copiar'}
                  </Button>
                </div>
                <p style={{ fontSize: 14, color: T.text.primary, lineHeight: 1.75, margin: 0, padding: '14px 18px 16px', whiteSpace: 'pre-wrap' }}>
                  {prontuario[campo.key]}
                </p>
              </Card>
            ))}

            {prontuario.cids?.length > 0 && (
              <Card padding={18}>
                <Overline style={{ marginBottom: 12 }}>CID-10 sugeridos</Overline>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {prontuario.cids.map((cid: any) => (
                    <div key={cid.codigo} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 12px', background: T.bg.cardSubtle, border: `1px solid ${T.border.muted}`, borderRadius: T.radius.lg,
                    }}>
                      <span className="mono" style={{
                        fontSize: 12, fontWeight: 600, color: T.brand.primary, background: T.brand.primaryLight,
                        padding: '3px 8px', borderRadius: T.radius.sm, flexShrink: 0,
                      }}>
                        {cid.codigo}
                      </span>
                      <span style={{ fontSize: 13, color: T.text.strong }}>{cid.descricao}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
