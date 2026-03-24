'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Sidebar } from '@/components/Sidebar'

export default function WhatsApp() {
  const router = useRouter()
  const [medico, setMedico] = useState<any>(null)
  const [conversas, setConversas] = useState<any[]>([])
  const [ativa, setAtiva] = useState<any>(null)
  const [mensagens, setMensagens] = useState<any[]>([])
  const [msg, setMsg] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [busca, setBusca] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const m = localStorage.getItem('medico')
    if (!m) { router.push('/login'); return }
    setMedico(JSON.parse(m))
  }, [router])

  useEffect(() => {
    if (!medico) return
    carregar()
    const t = setInterval(carregar, 5000)
    return () => clearInterval(t)
  }, [medico])

  useEffect(() => { if (ativa) carregarMsgs(ativa.id) }, [ativa])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [mensagens])

  const carregar = async () => {
    if (!medico) return
    const { data, error } = await supabase
      .from('whatsapp_conversas')
      .select('*, whatsapp_mensagens(conteudo, criado_em, tipo, lida)')
      .eq('medico_id', medico.id)
      .order('ultimo_contato', { ascending: false })

    if (error) { console.error('Erro conversas:', error); return }
    const proc = (data || []).map((c: any) => ({
      ...c,
      ultima: c.whatsapp_mensagens?.sort((a: any, b: any) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime())[0],
      naoLidas: c.whatsapp_mensagens?.filter((m: any) => !m.lida && m.tipo === 'recebida').length || 0
    }))
    setConversas(proc)
  }

  const carregarMsgs = async (id: string) => {
    const { data } = await supabase
      .from('whatsapp_mensagens')
      .select('*')
      .eq('conversa_id', id)
      .order('criado_em', { ascending: true })
    setMensagens(data || [])
    await supabase.from('whatsapp_mensagens').update({ lida: true }).eq('conversa_id', id).eq('tipo', 'recebida')
  }

  const enviar = async () => {
    if (!msg.trim() || !ativa || enviando) return
    setEnviando(true)
    const texto = msg.trim(); setMsg('')
    const { data: nova } = await supabase.from('whatsapp_mensagens').insert({
      conversa_id: ativa.id, tipo: 'enviada', conteudo: texto, metadata: { manual: true }
    }).select().single()
    if (nova) setMensagens(p => [...p, nova])
    await fetch('/api/whatsapp/enviar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telefone: ativa.telefone, texto, medico_id: medico.id })
    })
    setEnviando(false)
  }

  const fmt = (iso: string) => {
    const d = new Date(iso)
    return d.toDateString() === new Date().toDateString()
      ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }
  const fmtH = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const nome = (c: any) => c.nome_contato || c.telefone
  const ini = (n: string) => n?.split(' ').map((x: string) => x[0]).slice(0, 2).join('').toUpperCase() || '?'
  const filtradas = conversas.filter(c => nome(c).toLowerCase().includes(busca.toLowerCase()))
  const totalNaoLidas = conversas.reduce((a, c) => a + c.naoLidas, 0)

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f9fafb', overflow: 'hidden' }}>
      <Sidebar activeHref="/whatsapp" />
      <main style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ width: 300, background: 'white', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#16a34a"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </div>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0, flex: 1 }}>WhatsApp IA</h2>
              {totalNaoLidas > 0 && <span style={{ fontSize: 10, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '1px 7px', borderRadius: 20, fontWeight: 700 }}>{totalNaoLidas}</span>}
            </div>
            <input value={busca} onChange={e => setBusca(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 7, border: '1px solid #e5e7eb', background: '#f9fafb' }}
              placeholder="Buscar..."/>
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            {filtradas.length === 0 ? (
              <div style={{ padding: '28px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 6px' }}>Nenhuma conversa ainda</p>
                <p style={{ fontSize: 11, color: '#d1d5db', margin: 0, lineHeight: 1.5 }}>As mensagens aparecerao aqui quando pacientes enviarem para o numero da clinica</p>
              </div>
            ) : filtradas.map(c => (
              <div key={c.id} onClick={() => setAtiva(c)}
                style={{ padding: '10px 14px', borderBottom: '1px solid #f9fafb', cursor: 'pointer', background: ativa?.id === c.id ? '#f0fdf4' : 'white', borderLeft: ativa?.id === c.id ? '3px solid #16a34a' : '3px solid transparent' }}>
                <div style={{ display: 'flex', gap: 9 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: ativa?.id === c.id ? '#dcfce7' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: ativa?.id === c.id ? '#16a34a' : '#6b7280', flexShrink: 0 }}>{ini(nome(c))}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <p style={{ fontSize: 12, fontWeight: c.naoLidas > 0 ? 700 : 500, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome(c)}</p>
                      <span style={{ fontSize: 10, color: '#9ca3af', flexShrink: 0, marginLeft: 4 }}>{c.ultima ? fmt(c.ultima.criado_em) : ''}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <p style={{ fontSize: 11, color: '#9ca3af', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {c.ultima?.tipo === 'enviada' && '✓ '}{c.ultima?.conteudo?.substring(0, 38) || ''}
                      </p>
                      {c.naoLidas > 0 && <span style={{ fontSize: 9, fontWeight: 700, color: 'white', background: '#16a34a', width: 16, height: 16, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 4 }}>{c.naoLidas}</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {ativa ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f0f2f5' }}>
            <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#16a34a' }}>{ini(nome(ativa))}</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0 }}>{nome(ativa)}</p>
                <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>{ativa.telefone}{ativa.paciente_id ? ' · Paciente cadastrado' : ''}</p>
              </div>
              {ativa.paciente_id && <a href={'/pacientes/' + ativa.paciente_id} style={{ fontSize: 11, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '4px 10px', borderRadius: 6, textDecoration: 'none', fontWeight: 600 }}>Ver ficha</a>}
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {mensagens.map(m => {
                const rec = m.tipo === 'recebida'
                return (
                  <div key={m.id} style={{ display: 'flex', justifyContent: rec ? 'flex-start' : 'flex-end' }}>
                    <div style={{ maxWidth: '68%', padding: '7px 11px', borderRadius: rec ? '4px 10px 10px 10px' : '10px 4px 10px 10px', background: rec ? 'white' : '#dcfce7', border: rec ? '1px solid #e5e7eb' : '1px solid #bbf7d0' }}>
                      {m.metadata?.ia && <p style={{ fontSize: 9, color: '#16a34a', fontWeight: 700, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sofia IA</p>}
                      <p style={{ fontSize: 12, color: '#111827', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-line' }}>{m.conteudo}</p>
                      <p style={{ fontSize: 9, color: '#9ca3af', margin: '3px 0 0', textAlign: rec ? 'left' : 'right' }}>{fmtH(m.criado_em)}</p>
                    </div>
                  </div>
                )
              })}
              <div ref={endRef}/>
            </div>
            <div style={{ background: 'white', borderTop: '1px solid #e5e7eb', padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'flex-end', flexShrink: 0 }}>
              <textarea value={msg} onChange={e => setMsg(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
                style={{ flex: 1, padding: '9px 12px', fontSize: 12, borderRadius: 20, border: '1px solid #e5e7eb', resize: 'none', minHeight: 40, maxHeight: 100, lineHeight: 1.5 }}
                placeholder="Mensagem... (Enter para enviar)"/>
              <button onClick={enviar} disabled={!msg.trim() || enviando}
                style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: msg.trim() ? '#16a34a' : '#e5e7eb', cursor: msg.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
              </button>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5', flexDirection: 'column', gap: 12 }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="#16a34a"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#374151', margin: 0 }}>Selecione uma conversa</p>
          </div>
        )}
      </main>
    </div>
  )
}
