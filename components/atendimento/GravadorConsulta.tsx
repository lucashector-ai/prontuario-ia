'use client'
/**
 * Gravação da consulta dentro do Consultório: grava (mesmo motor da Nova consulta),
 * mostra a conversa ao vivo, gera o prontuário com a IA, salva no histórico do
 * paciente e deixa editar. O estado fica guardado por atendimento (sessionStorage),
 * então trocar de tela ou recarregar não perde a consulta.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { CircleCheck, FileText, LoaderCircle, Mic, Pause, Play, RotateCcw, Save, Square, Type } from 'lucide-react'
import { tokens as T } from '@/lib/design-tokens'
import { Badge, Button, Textarea } from '@/components/ui'
import { notificar } from '@/components/ui/dialogos'
import ConversaConsulta from '@/components/ia/ConversaConsulta'
import { useTranscricao } from '@/lib/transcricao/useTranscricao'
import { supabase } from '@/lib/supabase'
import { ehDemo } from '@/lib/atendimento/cliente'

type Estado = 'idle' | 'gravando' | 'processando' | 'pronto' | 'erro'
type Prontuario = { subjetivo?: string; objetivo?: string; avaliacao?: string; plano?: string; cids?: { codigo: string; descricao: string }[]; [k: string]: any }
const SECOES: { key: 'subjetivo' | 'objetivo' | 'avaliacao' | 'plano'; label: string }[] = [
  { key: 'subjetivo', label: 'Subjetivo' }, { key: 'objetivo', label: 'Objetivo' }, { key: 'avaliacao', label: 'Avaliação' }, { key: 'plano', label: 'Plano' },
]
const mmss = (s: number) => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')

export function GravadorConsulta({ chave, medicoId, paciente, onProntuario }: {
  chave: string                                    // id do atendimento
  medicoId: string
  paciente: { id: string | null; nome: string }
  onProntuario?: (salvo: boolean) => void
}) {
  const armazenado = useRef(lerSalvo(chave))
  const [estado, setEstado] = useState<Estado>(armazenado.current?.prontuario ? 'pronto' : 'idle')
  const [transcricao, setTranscricao] = useState<string>(armazenado.current?.transcricao || '')
  const [prontuario, setProntuario] = useState<Prontuario | null>(armazenado.current?.prontuario || null)
  const [consultaId, setConsultaId] = useState<string | null>(armazenado.current?.consultaId || null)
  const [editado, setEditado] = useState(false)
  const [segundos, setSegundos] = useState(0)
  const [erroMsg, setErroMsg] = useState('')
  const [digitar, setDigitar] = useState(false)
  const [textoDigitado, setTextoDigitado] = useState('')

  useEffect(() => { gravarSalvo(chave, { transcricao, prontuario, consultaId }) }, [chave, transcricao, prontuario, consultaId])
  useEffect(() => { onProntuario?.(!!consultaId) }, [consultaId, onProntuario])

  const aoTexto = useCallback((t: string) => setTranscricao(t), [])
  const { gravando, gravandoPausado, iniciarGravacao, pararGravacao, pausarGravacao, limpar, erro, fase, parcial, nivel, vozBaixa } =
    useTranscricao(aoTexto, { medicoId })

  useEffect(() => {
    if (estado !== 'gravando' || !gravando || gravandoPausado) return
    const t = setInterval(() => setSegundos(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [estado, gravando, gravandoPausado])

  const iniciar = async () => {
    limpar(); setTranscricao(''); setProntuario(null); setConsultaId(null); setSegundos(0); setErroMsg(''); setEstado('gravando')
    await iniciarGravacao()
  }

  const parar = async () => {
    const final = await pararGravacao()
    if (final && final.trim().length > 10) gerar(final)
    else { setEstado('idle'); notificar('Não deu para ouvir a consulta. Tente de novo mais perto do microfone.', 'erro') }
  }

  const gerar = async (texto: string) => {
    setEstado('processando'); setErroMsg('')
    try {
      if (ehDemo()) {
        await new Promise(r => setTimeout(r, 1200))
        const p = { subjetivo: 'Paciente relata ' + texto.slice(0, 160), objetivo: 'PA 130x85 mmHg. Bom estado geral.', avaliacao: 'Quadro estável.', plano: 'Manter conduta. Retorno em 30 dias.', cids: [{ codigo: 'I10', descricao: 'Hipertensão essencial' }] }
        setProntuario(p); setConsultaId('demo-consulta'); setEstado('pronto'); return
      }
      const r = await fetch('/api/estruturar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcricao: texto }) })
      const d = await r.json()
      if (!d.prontuario) throw new Error(d.error || 'A IA não conseguiu gerar o prontuário')
      setProntuario(d.prontuario); setEstado('pronto'); setEditado(false)
      await salvarNovo(d.prontuario, texto)
    } catch (e: any) { setEstado('erro'); setErroMsg(e.message) }
  }

  const salvarNovo = async (p: Prontuario, texto: string) => {
    const r = await fetch('/api/consultas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ medico_id: medicoId, transcricao: texto, paciente_id: paciente.id, ...p }),
    })
    const d = await r.json().catch(() => null)
    if (d?.id) { setConsultaId(d.id); notificar('Prontuário salvo no histórico do paciente') }
    else notificar('Prontuário gerado, mas não foi salvo. Clique em Salvar.', 'erro')
  }

  const salvarEdicao = async () => {
    if (!prontuario) return
    if (!consultaId) { await salvarNovo(prontuario, transcricao); setEditado(false); return }
    if (ehDemo()) { setEditado(false); notificar('Alterações salvas'); return }
    const { error } = await supabase.from('consultas')
      .update({ subjetivo: prontuario.subjetivo, objetivo: prontuario.objetivo, avaliacao: prontuario.avaliacao, plano: prontuario.plano }).eq('id', consultaId)
    if (error) { notificar('Erro ao salvar alterações', 'erro'); return }
    setEditado(false); notificar('Alterações salvas')
  }

  // ── Telas ──
  if (estado === 'gravando') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 650, color: gravandoPausado ? T.text.secondary : T.status.danger }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: gravandoPausado ? T.text.tertiary : T.status.danger, animation: gravandoPausado ? 'none' : 'pulse-record 1.2s infinite' }} />
            {gravandoPausado ? 'Pausado' : 'Gravando'} <span className="mono">{mmss(segundos)}</span>
          </span>
          <Nivel nivel={gravandoPausado ? 0 : nivel} />
          <span style={{ flex: 1 }} />
          <Button size="sm" variant="secondary" icon={gravandoPausado ? Play : Pause} onClick={pausarGravacao}>{gravandoPausado ? 'Continuar' : 'Pausar'}</Button>
          <Button size="sm" variant="dark" icon={Square} onClick={parar} disabled={fase === 'finalizando'}>Encerrar e gerar prontuário</Button>
        </div>
        {vozBaixa && !gravandoPausado && <div style={{ fontSize: 12.5, color: T.status.warning }}>Voz baixa — aproxime o microfone ou fale um pouco mais alto.</div>}
        {erro && <div style={{ fontSize: 12.5, color: T.status.danger }}>{erro}</div>}
        <div style={{ maxHeight: 340, overflowY: 'auto', padding: 12, borderRadius: 12, background: T.bg.page, border: `1px solid ${T.border.muted}` }}>
          {transcricao || parcial ? <ConversaConsulta texto={transcricao} parcial={parcial} compacto />
            : <div style={{ fontSize: 13, color: T.text.tertiary }}>Pode começar a consulta normalmente. O texto aparece aqui enquanto vocês conversam.</div>}
        </div>
      </div>
    )
  }

  if (estado === 'processando') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '24px 4px' }}>
        <LoaderCircle size={22} color={T.brand.primary} style={{ animation: 'spin .8s linear infinite' }} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 650 }}>Gerando o prontuário…</div>
          <div style={{ fontSize: 12.5, color: T.text.secondary }}>Organizando em SOAP e sugerindo CID-10. Leva alguns segundos.</div>
        </div>
      </div>
    )
  }

  if (estado === 'pronto' && prontuario) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {consultaId ? <Badge tone="success" icon={CircleCheck}>Salvo no prontuário</Badge> : <Badge tone="warning">Não salvo</Badge>}
          {(prontuario.cids || []).slice(0, 4).map(c => <Badge key={c.codigo} tone="accent">{c.codigo} · {c.descricao}</Badge>)}
          <span style={{ flex: 1 }} />
          {(editado || !consultaId) && <Button size="sm" icon={Save} onClick={salvarEdicao}>Salvar alterações</Button>}
          <Button size="sm" variant="ghost" icon={RotateCcw} onClick={iniciar}>Gravar de novo</Button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
          {SECOES.map(s => (
            <label key={s.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: T.text.tertiary, textTransform: 'uppercase', letterSpacing: '.06em' }}>{s.label}</span>
              <Textarea value={prontuario[s.key] || ''} rows={4} onChange={e => { setProntuario(p => ({ ...p!, [s.key]: e.target.value })); setEditado(true) }} style={{ fontSize: 13, lineHeight: 1.5 }} />
            </label>
          ))}
        </div>
        {transcricao && (
          <details>
            <summary style={{ cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: T.text.secondary }}>Ver conversa transcrita</summary>
            <div style={{ marginTop: 8, maxHeight: 260, overflowY: 'auto', padding: 12, borderRadius: 12, background: T.bg.page }}><ConversaConsulta texto={transcricao} compacto /></div>
          </details>
        )}
      </div>
    )
  }

  // idle / erro
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {estado === 'erro' && <div style={{ fontSize: 13, color: T.status.danger }}>{erroMsg || 'Algo deu errado.'} {transcricao && <button onClick={() => gerar(transcricao)} style={{ border: 'none', background: 'none', color: T.brand.primary, fontWeight: 600, cursor: 'pointer', padding: 0 }}>Tentar gerar de novo</button>}</div>}
      {digitar ? (
        <>
          <Textarea value={textoDigitado} onChange={e => setTextoDigitado(e.target.value)} rows={6} placeholder="Escreva ou cole o relato da consulta: queixa, exame, conduta…" autoFocus />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button icon={FileText} onClick={() => { setTranscricao(textoDigitado); gerar(textoDigitado) }} disabled={textoDigitado.trim().length < 20}>Gerar prontuário</Button>
            <Button variant="ghost" onClick={() => setDigitar(false)}>Voltar a gravar</Button>
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '6px 0' }}>
          <button onClick={iniciar} style={{
            display: 'inline-flex', alignItems: 'center', gap: 10, height: 52, padding: '0 22px', borderRadius: 16, border: 'none', cursor: 'pointer',
            background: T.status.danger, color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', boxShadow: '0 8px 20px -10px rgba(194,65,59,.6)',
          }}>
            <Mic size={20} /> Iniciar gravação
          </button>
          <div style={{ fontSize: 12.5, color: T.text.secondary, maxWidth: 320, lineHeight: 1.45 }}>
            A IA escuta a consulta, separa médico e {paciente.nome.split(' ')[0] || 'paciente'} e monta o prontuário no fim.
            <button onClick={() => setDigitar(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'none', color: T.brand.primary, fontWeight: 600, cursor: 'pointer', padding: 0, marginLeft: 4, fontFamily: 'inherit', fontSize: 12.5 }}>
              <Type size={13} /> Prefiro digitar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Nivel({ nivel }: { nivel: number }) {
  const barras = 14
  const ativas = Math.round(Math.min(1, nivel * 1.6) * barras)
  return (
    <span aria-hidden style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 2, height: 18 }}>
      {Array.from({ length: barras }, (_, i) => (
        <span key={i} style={{ width: 3, height: 4 + (i % 4) * 3, borderRadius: 2, background: i < ativas ? T.brand.primary : T.border.default, transition: 'background .1s' }} />
      ))}
    </span>
  )
}

const CHAVE = (id: string) => 'c360-consulta-' + id
function lerSalvo(id: string): { transcricao?: string; prontuario?: Prontuario | null; consultaId?: string | null } | null {
  try { return JSON.parse(sessionStorage.getItem(CHAVE(id)) || 'null') } catch { return null }
}
function gravarSalvo(id: string, v: any) {
  try {
    if (!v.transcricao && !v.prontuario) sessionStorage.removeItem(CHAVE(id))
    else sessionStorage.setItem(CHAVE(id), JSON.stringify(v))
  } catch {}
}
