'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, FileText, MessageSquare, Paperclip } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { tokens } from '@/lib/design-tokens'
import { Badge, Button, EmptyState, Icon, Overline } from '@/components/ui'
import { CascaPublica, Spinner, cartaoPublico } from '@/components/publico/CascaPublica'

const T = tokens

export default function HistóricoSala() {
  const { sala_id } = useParams()
  const router = useRouter()
  const [sala, setSala] = useState<any>(null)
  const [msgs, setMsgs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sala_id) return
    Promise.all([
      supabase.from('teleconsultas').select('*').eq('sala_id', sala_id).single(),
      supabase.from('sala_mensagens').select('*').eq('sala_id', sala_id).order('criado_em', { ascending: true })
    ]).then(([{ data: s }, { data: m }]) => {
      setSala(s); setMsgs(m || []); setLoading(false)
    })
  }, [sala_id])

  const fmt = (iso: string) => new Date(iso).toLocaleString('pt-BR')

  return (
    <CascaPublica largura={720} rodape={false}>
      <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => router.back()} style={{ paddingLeft: 6 }}>Voltar</Button>
        </div>

        {loading ? (
          <div style={{ ...cartaoPublico, display: 'flex', justifyContent: 'center', padding: '56px 0' }}>
            <Spinner tamanho={26} />
          </div>
        ) : (
          <>
            <div style={{ ...cartaoPublico, padding: '20px 20px 18px' }}>
              <h1 style={{ fontSize: 19, fontWeight: 700, color: T.text.primary, margin: 0, letterSpacing: '-.01em' }}>Registro da teleconsulta</h1>
              {sala && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginTop: 16 }}>
                    <Dado rotulo="Sala"><span className="mono" style={{ fontSize: 12.5, wordBreak: 'break-all' }}>{sala.sala_id}</span></Dado>
                    <Dado rotulo="Status">
                      <Badge tone={sala.status === 'encerrada' ? 'danger' : 'success'} dot>{sala.status}</Badge>
                    </Dado>
                    <Dado rotulo="Duração">
                      <span className="mono">{sala.duracao_segundos ? Math.floor(sala.duracao_segundos / 60) + 'min' : '--'}</span>
                    </Dado>
                  </div>
                  {sala.encerrada_em && (
                    <p style={{ fontSize: 12.5, color: T.text.quaternary, margin: '14px 0 0' }}>
                      Encerrada em <span className="mono">{fmt(sala.encerrada_em)}</span>
                    </p>
                  )}
                </>
              )}
            </div>

            <div style={{ ...cartaoPublico, padding: '18px 20px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: T.text.primary, margin: 0, flex: 1 }}>Mensagens</h2>
                <Badge>{msgs.length}</Badge>
              </div>
              {msgs.length === 0 ? (
                <EmptyState icon={MessageSquare} titulo="Nenhuma mensagem registrada" descricao="As mensagens trocadas no chat da sala aparecem aqui." />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {msgs.map((m, i) => {
                    const doMedico = m.de === 'medico'
                    return (
                      <div key={i} style={{ background: T.bg.cardSubtle, borderRadius: T.radius.input, border: `1px solid ${T.border.muted}`, padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                          <Badge tone={doMedico ? 'accent' : 'success'}>{m.de}</Badge>
                          <span className="mono" style={{ fontSize: 11.5, color: T.text.tertiary }}>{m.hora}</span>
                          {m.url && <Badge tone="info" icon={Paperclip}>arquivo</Badge>}
                        </div>
                        <p style={{ fontSize: 13.5, color: T.text.strong, margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.msg}</p>
                        {m.url && m.tipo?.startsWith('image/') && <img src={m.url} style={{ marginTop: 8, maxWidth: 200, borderRadius: T.radius.md, display: 'block' }} alt={m.nome_arquivo || ''} />}
                        {m.url && m.tipo === 'application/pdf' && (
                          <a href={m.url} target='_blank' rel='noreferrer' style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12.5, fontWeight: 600, color: T.brand.primary, textDecoration: 'none' }}>
                            <Icon icon={FileText} size={14} /> Abrir PDF
                          </a>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </CascaPublica>
  )
}

function Dado({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: T.radius.input, background: T.bg.cardSubtle, border: `1px solid ${T.border.muted}`, display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
      <Overline>{rotulo}</Overline>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text.primary }}>{children}</div>
    </div>
  )
}
