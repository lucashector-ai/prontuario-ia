'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Sidebar } from '@/components/Sidebar'
import { tokens } from '@/lib/design-tokens'

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
    <div style={{ display: 'flex', height: '100vh', background: tokens.neutral.grayPaper }}>
      <div style={{ flex: 1, overflow: 'auto', padding: 32 }}>
        {loading ? <p>Carregando...</p> : (
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <button onClick={() => router.back()} style={{ fontSize: 12, color: tokens.text.secondary, background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16 }}>Voltar</button>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: tokens.text.primary, marginBottom: 4 }}>Histórico da Consulta</h1>
            {sala && (
              <div style={{ background: 'white', borderRadius: 10, border: `1px solid ${tokens.border.default}`, padding: 16, marginBottom: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div><p style={{ fontSize: 11, color: tokens.text.tertiary, margin: '0 0 2px', textTransform: 'uppercase' }}>Sala</p><p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{sala.sala_id}</p></div>
                  <div><p style={{ fontSize: 11, color: tokens.text.tertiary, margin: '0 0 2px', textTransform: 'uppercase' }}>Status</p><p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: sala.status === 'encerrada' ? tokens.status.danger : tokens.status.success }}>{sala.status}</p></div>
                  <div><p style={{ fontSize: 11, color: tokens.text.tertiary, margin: '0 0 2px', textTransform: 'uppercase' }}>Duracao</p><p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{sala.duracao_segundos ? Math.floor(sala.duracao_segundos/60) + 'min' : '--'}</p></div>
                </div>
                {sala.encerrada_em && <p style={{ fontSize: 12, color: tokens.text.secondary, margin: '12px 0 0' }}>Encerrada em: {fmt(sala.encerrada_em)}</p>}
              </div>
            )}
            <h2 style={{ fontSize: 14, fontWeight: 700, color: tokens.text.strong, marginBottom: 12 }}>Mensagens ({msgs.length})</h2>
            {msgs.length === 0 ? <p style={{ color: tokens.text.tertiary, fontSize: 13 }}>Nenhuma mensagem registrada.</p> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {msgs.map((m, i) => (
                  <div key={i} style={{ background: 'white', borderRadius: 8, border: `1px solid ${tokens.border.default}`, padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: m.de === 'medico' ? tokens.status.infoStrong : tokens.status.success }}>{m.de}</span>
                      <span style={{ fontSize: 10, color: tokens.text.tertiary }}>{m.hora}</span>
                      {m.url && <span style={{ fontSize: 10, color: tokens.appointment.retorno.dot, background: tokens.appointment.exame.bg, padding: '1px 6px', borderRadius: 10 }}>arquivo</span>}
                    </div>
                    <p style={{ fontSize: 13, color: tokens.text.strong, margin: 0 }}>{m.msg}</p>
                    {m.url && m.tipo?.startsWith('image/') && <img src={m.url} style={{ marginTop: 8, maxWidth: 200, borderRadius: 6 }} alt={m.nome_arquivo || ''} />}
                    {m.url && m.tipo === 'application/pdf' && <a href={m.url} target='_blank' rel='noreferrer' style={{ display: 'inline-block', marginTop: 8, fontSize: 12, color: tokens.status.infoStrong }}>Abrir PDF</a>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
