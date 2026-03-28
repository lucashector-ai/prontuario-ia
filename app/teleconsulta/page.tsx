'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Sidebar } from '@/components/Sidebar'

export default function Teleconsulta() {
  const router = useRouter()
  const [medico, setMedico] = useState<any>(null)
  const [consultas, setConsultas] = useState<any[]>([])
  const [pacientes, setPacientes] = useState<any[]>([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ paciente_id: '', titulo: '' })
  const [criando, setCriando] = useState(false)

  useEffect(() => {
    const m = localStorage.getItem('medico')
    if (!m) { router.push('/login'); return }
    const med = JSON.parse(m); setMedico(med)
    carregar(med.id)
    supabase.from('pacientes').select('id, nome').eq('medico_id', med.id).order('nome').then(({ data }) => setPacientes(data || []))
  }, [router])

  const carregar = async (medicoId: string) => {
    const r = await fetch('/api/teleconsulta?medico_id=' + medicoId)
    const d = await r.json()
    setConsultas(d.teleconsultas || [])
  }

  const criar = async () => {
    if (criando) return
    setCriando(true)
    try {
      const r = await fetch('/api/teleconsulta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medico_id: medico.id, paciente_id: form.paciente_id || null, titulo: form.titulo || 'Teleconsulta' })
      })
      const d = await r.json()
      if (d.teleconsulta) {
        setModal(false)
        setForm({ paciente_id: '', titulo: '' })
        await carregar(medico.id)
      }
    } catch(e) { console.error(e) }
    setCriando(false)
  }

  const copiarLink = (salaId: string) => {
    const link = window.location.origin + '/sala/' + salaId
    navigator.clipboard.writeText(link)
    alert('Link copiado!')
  }

  const enviarWhatsApp = async (consulta: any) => {
    if (!medico) return
    const link = window.location.origin + '/sala/' + consulta.sala_id
    const msg = 'Ola! O Dr(a). ' + medico.nome + ' te convidou para uma teleconsulta.\n\nAcesse pelo link abaixo — nao precisa instalar nada:\n' + link
    if (consulta.pacientes?.telefone) {
      await fetch('/api/whatsapp/enviar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone: consulta.pacientes.telefone, texto: msg, medico_id: medico.id })
      })
      alert('Link enviado por WhatsApp!')
    } else {
      navigator.clipboard.writeText(msg)
      alert('Paciente sem telefone. Mensagem com link copiada!')
    }
  }

  const statusLabel = (s: string) => ({
    aguardando: { txt: 'Aguardando', cor: '#92400e', bg: '#fef3c7' },
    em_andamento: { txt: 'Em andamento', cor: '#166534', bg: '#dcfce7' },
    encerrada: { txt: 'Encerrada', cor: '#6b7280', bg: '#f3f4f6' }
  }[s] || { txt: s, cor: '#6b7280', bg: '#f3f4f6' })

  const fmtData = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f9fafb', overflow: 'hidden' }}>
      <Sidebar activeHref="/teleconsulta" />
      <main style={{ flex: 1, overflow: 'auto', padding: 28 }}>
        <div style={{ maxWidth: 860 }}>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: '#111827', margin: '0 0 4px', letterSpacing: '-0.3px' }}>Teleconsulta</h1>
              <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Video sem app — o paciente entra pelo link</p>
            </div>
            <button onClick={() => setModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
              Nova teleconsulta
            </button>
          </div>

          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 14, padding: '16px 20px', marginBottom: 24, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
            {[
              { n: '1', txt: 'Crie uma sala', sub: 'escolha o paciente' },
              { n: '2', txt: 'Envie o link', sub: 'via WhatsApp' },
              { n: '3', txt: 'Paciente entra', sub: 'pelo browser' },
              { n: '4', txt: 'Video em tempo real', sub: 'peer-to-peer' },
            ].map(s => (
              <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#f0fdf4', border: '1.5px solid #16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#16a34a', flexShrink: 0 }}>{s.n}</div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#111827', margin: 0 }}>{s.txt}</p>
                  <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>{s.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {consultas.length === 0 ? (
            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 14, padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.5"><path d="M15 10l4.553-2.169A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14v-4zM3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/></svg>
              </div>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#374151', margin: '0 0 8px' }}>Nenhuma teleconsulta criada</p>
              <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 20px' }}>Crie uma sala e envie o link para o paciente</p>
              <button onClick={() => setModal(true)} style={{ padding: '10px 20px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Criar primeira sala</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {consultas.map(c => {
                const st = statusLabel(c.status)
                return (
                  <div key={c.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: c.status === 'em_andamento' ? '#dcfce7' : '#f9fafb', border: '1px solid ' + (c.status === 'em_andamento' ? '#bbf7d0' : '#e5e7eb'), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c.status === 'em_andamento' ? '#16a34a' : '#9ca3af'} strokeWidth="1.5"><path d="M15 10l4.553-2.169A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14v-4zM3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/></svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0 }}>{c.titulo}</p>
                        <span style={{ fontSize: 10, fontWeight: 700, color: st.cor, background: st.bg, padding: '2px 8px', borderRadius: 20 }}>{st.txt}</span>
                      </div>
                      <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
                        {c.pacientes?.nome ? c.pacientes.nome + ' · ' : ''}{fmtData(c.criado_em)}
                        {c.duracao_segundos ? ' · ' + Math.floor(c.duracao_segundos / 60) + ' min' : ''}
                      </p>
                    </div>
                    {c.status !== 'encerrada' && (
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button onClick={() => copiarLink(c.sala_id)} style={{ padding: '7px 12px', background: 'white', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 11, color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 500 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                          Copiar link
                        </button>
                        <button onClick={() => enviarWhatsApp(c)} style={{ padding: '7px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 7, fontSize: 11, color: '#16a34a', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="#16a34a"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                          WhatsApp
                        </button>
                        <a href={'/sala/' + c.sala_id} target="_blank" rel="noreferrer" style={{ padding: '7px 14px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M15 10l4.553-2.169A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14v-4zM3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/></svg>
                          Entrar
                        </a>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: '24px', width: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 20px' }}>Nova teleconsulta</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Paciente</label>
                <select value={form.paciente_id} onChange={e => setForm(f => ({ ...f, paciente_id: e.target.value }))} style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8, border: '1.5px solid #e5e7eb' }}>
                  <option value="">Selecionar paciente (opcional)</option>
                  {pacientes.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Titulo</label>
                <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} onKeyDown={e => e.key === 'Enter' && criar()} style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8, border: '1.5px solid #e5e7eb' }} placeholder="Ex: Consulta de retorno..."/>
              </div>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 9, padding: '10px 14px' }}>
                <p style={{ fontSize: 12, color: '#166534', margin: 0 }}>Um link exclusivo sera gerado. Envie para o paciente pelo WhatsApp direto da plataforma.</p>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={() => { setModal(false); setForm({ paciente_id: '', titulo: '' }) }} style={{ flex: 1, padding: '10px', borderRadius: 9, border: '1px solid #e5e7eb', background: 'white', fontSize: 13, cursor: 'pointer', color: '#6b7280' }}>Cancelar</button>
                <button onClick={criar} disabled={criando} style={{ flex: 1, padding: '10px', borderRadius: 9, border: 'none', background: '#16a34a', color: 'white', fontSize: 13, fontWeight: 700, cursor: criando ? 'not-allowed' : 'pointer', opacity: criando ? 0.7 : 1 }}>
                  {criando ? 'Criando...' : 'Criar sala'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
