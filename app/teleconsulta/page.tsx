'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Sidebar } from '@/components/Sidebar'

export default function Teleconsulta() {
  const router = useRouter()
  const [medico, setMedico] = useState<any>(null)
  const [consultas, setConsultas] = useState<any[]>([])
  const [pacientes, setPacientes] = useState<any[]>([])
  const [criandoAgora, setCriandoAgora] = useState(false)
  const [linkCopiado, setLinkCopiado] = useState<string|null>(null)

  useEffect(() => {
    const m = localStorage.getItem('medico')
    if (!m) { router.push('/login'); return }
    const med = JSON.parse(m); setMedico(med)
    carregar(med.id)
    supabase.from('pacientes').select('id,nome').eq('medico_id', med.id).order('nome').then(({ data }) => setPacientes(data || []))
  }, [router])

  const carregar = useCallback(async (mid: string) => {
    const r = await fetch('/api/teleconsulta?medico_id=' + mid)
    const d = await r.json()
    setConsultas((d.teleconsultas || []).filter((c: any) => c.status !== 'encerrada'))
  }, [])

  const criarAgora = async () => {
    if (!medico || criandoAgora) return
    setCriandoAgora(true)
    const codigo = Math.random().toString(36).slice(-4).toUpperCase()
    const r = await fetch('/api/teleconsulta', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ medico_id: medico.id, titulo: 'Consulta - ' + codigo })
    })
    const d = await r.json()
    if (d.teleconsulta) {
      const link = window.location.origin + '/sala/' + d.teleconsulta.sala_id
      navigator.clipboard.writeText(link).catch(() => {})
      setLinkCopiado(link)
      await carregar(medico.id)
      window.open('/sala/' + d.teleconsulta.sala_id, '_blank')
    }
    setCriandoAgora(false)
  }

  const abrirAgendamento = () => router.push('/agenda?nova_teleconsulta=1')

  const entrar = (salaId: string) => window.open('/sala/' + salaId, '_blank')

  const copiar = (salaId: string) => {
    const link = window.location.origin + '/sala/' + salaId
    navigator.clipboard.writeText(link)
    setLinkCopiado(link)
    setTimeout(() => setLinkCopiado(null), 3000)
  }

  const enviarWpp = async (consulta: any) => {
    const link = window.location.origin + '/sala/' + consulta.sala_id
    const msg = 'Ola! Dr(a). ' + medico.nome + ' te convidou para uma teleconsulta.\n\nAcesse pelo link  nao precisa instalar nada:\n' + link
    if (consulta.pacientes?.telefone) {
      await fetch('/api/whatsapp/enviar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ telefone: consulta.pacientes.telefone, texto: msg, medico_id: medico.id }) })
      alert('Enviado por WhatsApp!')
    } else { navigator.clipboard.writeText(msg); alert('Mensagem copiada! (paciente sem telefone)') }
  }

  const encerrar = async (id: string) => {
    if (!confirm('Encerrar esta sala?')) return
    await supabase.from('teleconsultas').update({ status: 'encerrada', encerrada_em: new Date().toISOString() }).eq('id', id)
    carregar(medico.id)
  }

  const statusInfo = (s: string): { txt: string; bg: string; cor: string } => {
    const map: Record<string, { txt: string; bg: string; cor: string }> = {
      aguardando: { txt: 'Aguardando', bg: '#fef3c7', cor: '#92400e' },
      em_andamento: { txt: 'Em andamento', bg: '#E8F7EF', cor: '#1F9D5C' },
    }
    return map[s] || { txt: s, bg: '#f3f4f6', cor: '#6b7280' }
  }

  const fmtData = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F5F5F5', overflow: 'hidden' }}>
      <main style={{ flex: 1, overflow: 'auto', padding: '0 24px 24px' }}>

        {/* Hero */}
        <div style={{ background: 'transparent', borderBottom: 'none', padding: '32px 32px 28px' }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111827', margin: '0 0 6px', letterSpacing: '-0.4px' }}>Teleconsulta</h1>
          <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 28px' }}>Video em tempo real  o paciente entra pelo link, sem instalar nada</p>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <button onClick={criarAgora} disabled={criandoAgora} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 24px', background: '#1F9D5C', color: 'white', border: 'none', borderRadius: 14, cursor: criandoAgora ? 'not-allowed' : 'pointer', opacity: criandoAgora ? 0.7 : 1, minWidth: 240 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M15 10l4.553-2.169A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14v-4zM3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/></svg>
              </div>
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{criandoAgora ? 'Criando sala...' : 'Nova consulta agora'}</p>
                <p style={{ fontSize: 12, margin: 0, opacity: 0.85 }}>Cria sala e copia link na hora</p>
              </div>
            </button>

            <button onClick={abrirAgendamento} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 24px', background: 'white', color: '#111827', borderRadius: 14, cursor: 'pointer', minWidth: 240 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: '#E8F7EF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1F9D5C" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Agendar teleconsulta</p>
                <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>Cria sala e salva no calendario</p>
              </div>
            </button>
          </div>

          {linkCopiado && (
            <div style={{ marginTop: 16, background: '#E8F7EF', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1F9D5C" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              <span style={{ fontSize: 13, color: '#1F9D5C', fontWeight: 600 }}>Sala criada! Link copiado e sala aberta em nova aba.</span>
              <code style={{ fontSize: 11, color: '#1F9D5C', background: 'rgba(0,0,0,0.06)', padding: '2px 8px', borderRadius: 5, marginLeft: 4, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{linkCopiado}</code>
            </div>
          )}
        </div>

        {/* Salas ativas */}
        <div style={{ padding: '24px 32px' }}>
          {consultas.length === 0 ? (
            <div style={{ background: 'white', borderRadius: 14, padding: '40px 24px', textAlign: 'center' }}>
              <p style={{ fontSize: 14, color: '#9ca3af', margin: 0 }}>Nenhuma sala ativa. Crie uma consulta acima.</p>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#374151', margin: '0 0 12px', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Salas ativas</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {consultas.map(c => {
                  const st = statusInfo(c.status)
                  return (
                    <div key={c.id} style={{ background: 'white', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: c.status === 'em_andamento' ? '#E8F7EF' : '#F5F5F5', border: '1px solid ' + (c.status === 'em_andamento' ? '#A7E0BF' : '#e5e7eb'), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c.status === 'em_andamento' ? '#1F9D5C' : '#9ca3af'} strokeWidth="1.5"><path d="M15 10l4.553-2.169A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14v-4zM3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/></svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.titulo}</p>
                          <span style={{ fontSize: 10, fontWeight: 700, color: st.cor, background: st.bg, padding: '2px 8px', borderRadius: 20, flexShrink: 0 }}>{st.txt}</span>
                        </div>
                        <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>{c.pacientes?.nome ? c.pacientes.nome + '  ' : ''}{fmtData(c.criado_em)}</p>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button onClick={() => copiar(c.sala_id)} style={{ padding: '6px 11px', background: 'white', borderRadius: 7, fontSize: 11, color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                          Copiar link
                        </button>
                        <button onClick={() => enviarWpp(c)} style={{ padding: '6px 11px', background: '#E8F7EF', borderRadius: 7, fontSize: 11, color: '#1F9D5C', cursor: 'pointer', fontWeight: 600 }}>WhatsApp</button>
                        <button onClick={() => entrar(c.sala_id)} style={{ padding: '6px 14px', background: '#1F9D5C', color: 'white', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Entrar</button>
                        <button onClick={() => encerrar(c.id)} style={{ padding: '6px 10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7, fontSize: 11, color: '#dc2626', cursor: 'pointer' }}>Encerrar</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
