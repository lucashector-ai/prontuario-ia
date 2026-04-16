'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Sidebar } from '@/components/Sidebar'

const TIPOS = {
  consulta:  { label: 'Consulta',  bg: '#ede9fb', text: '#4e35a3', border: '#d4c9f7', dot: '#6043C1' },
  retorno:   { label: 'Retorno',   bg: '#ede9fb', text: '#4e35a3', border: '#a78bfa', dot: '#6043C1' },
  exame:     { label: 'Exame',     bg: '#ede9fe', text: '#5b21b6', border: '#c4b5fd', dot: '#7c3aed' },
  urgencia:  { label: 'Urgência',  bg: '#fee2e2', text: '#991b1b', border: '#fca5a5', dot: '#dc2626' },
}

const HORAS = Array.from({ length: 14 }, (_, i) => i + 7) // 7h às 20h

function getWeekDays(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d.setDate(diff))
  return Array.from({ length: 7 }, (_, i) => {
    const nd = new Date(monday)
    nd.setDate(monday.getDate() + i)
    return nd
  })
}

export default function Agenda() {
  const router = useRouter()
  const [medico, setMedico] = useState<any>(null)
  const [pacientes, setPacientes] = useState<any[]>([])
  const [agendamentos, setAgendamentos] = useState<any[]>([])
  const [semana, setSemana] = useState(new Date())
  const [modal, setModal] = useState<{ open: boolean; date?: Date; ag?: any }>({ open: false })
  const [form, setForm] = useState({ paciente_id: '', data_hora: '', tipo: 'consulta', motivo: '', observacoes: '', duracao: '30' })
  const [salvando, setSalvando] = useState(false)
  const [viewMode, setViewMode] = useState<'semana' | 'dia'>('semana')
  const [diaSelecionado, setDiaSelecionado] = useState(new Date())
  const [dragging, setDragging] = useState<string | null>(null)
  const [comVideo, setComVideo] = useState(false)
  const [salaLink, setSalaLink] = useState('')
  const [salaId, setSalaId] = useState('')
  const [enviandoPreConsulta, setEnviandoPreConsulta] = useState(false)
  const [preConsultaEnviada, setPreConsultaEnviada] = useState(false)

  const diasSemana = getWeekDays(semana)
  const hoje = new Date().toDateString()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('nova_teleconsulta') === '1') {
        setComVideo(true)
        setModal({ open: true })
        window.history.replaceState({}, '', '/agenda')
      }
    }
  }, [])

  useEffect(() => {
    const m = localStorage.getItem('medico')
    if (!m) { router.push('/login'); return }
    const med = JSON.parse(m)
    setMedico(med)
    carregarDados(med.id)
  }, [router])

  const carregarDados = async (medicoId: string) => {
    const [{ data: pacs }, { data: ags }] = await Promise.all([
      supabase.from('pacientes').select('id, nome').eq('medico_id', medicoId).order('nome'),
      supabase.from('agendamentos').select(`*, pacientes(nome)`).eq('medico_id', medicoId).order('data_hora'),
    ])
    setPacientes(pacs || [])
    setAgendamentos(ags || [])
  }

  const navegarSemana = (dir: number) => {
    const nd = new Date(semana)
    nd.setDate(nd.getDate() + dir * 7)
    setSemana(nd)
  }

  const getAgsDia = (dia: Date) => {
    const dStr = dia.toDateString()
    return agendamentos.filter(a => new Date(a.data_hora).toDateString() === dStr)
  }

  const getAgHora = (dia: Date, hora: number) => {
    return agendamentos.filter(a => {
      const d = new Date(a.data_hora)
      return d.toDateString() === dia.toDateString() && d.getHours() === hora
    })
  }

  const abrirModal = (date?: Date, ag?: any) => {
    if (ag) {
      const d = new Date(ag.data_hora)
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
      setForm({
        paciente_id: ag.paciente_id || '',
        data_hora: local,
        tipo: ag.tipo || 'consulta',
        motivo: ag.motivo || '',
        observacoes: ag.observacoes || '',
        duracao: ag.duracao || '30',
      })
      setModal({ open: true, ag })
    } else {
      const d = date || new Date()
      if (d.getHours() < 7) d.setHours(8, 0, 0, 0)
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
      setForm({ paciente_id: '', data_hora: local, tipo: 'consulta', motivo: '', observacoes: '', duracao: '30' })
      setModal({ open: true, date: d })
    }
  }

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault(); setSalvando(true)
    try {
      if (modal.ag) {
        const { data } = await supabase.from('agendamentos').update({
          paciente_id: form.paciente_id || null,
          data_hora: new Date(form.data_hora).toISOString(),
          tipo: form.tipo, motivo: form.motivo, observacoes: form.observacoes,
        }).eq('id', modal.ag.id).select(`*, pacientes(nome)`).single()
        if (data) setAgendamentos(prev => prev.map(a => a.id === data.id ? data : a))
      } else {
        let meetLinkFinal = ''
        let meetCodeFinal = ''
        if (comVideo) {
          const tcRes = await fetch('/api/teleconsulta', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ medico_id: medico.id, paciente_id: form.paciente_id || null, titulo: form.motivo || 'Teleconsulta' })
          })
          const tcData = await tcRes.json()
          if (tcData.teleconsulta) {
            meetCodeFinal = tcData.teleconsulta.sala_id
            meetLinkFinal = window.location.origin + '/sala/' + meetCodeFinal
            setSalaLink(meetLinkFinal)
            setSalaId(meetCodeFinal)
          }
        }
        const { data } = await supabase.from('agendamentos').insert({
          medico_id: medico.id,
          paciente_id: form.paciente_id || null,
          data_hora: new Date(form.data_hora).toISOString(),
          tipo: form.tipo, motivo: form.motivo, observacoes: form.observacoes,
          status: 'agendado',
          meet_link: meetLinkFinal || null,
          meet_code: meetCodeFinal || null,
        }).select(`*, pacientes(nome)`).single()
        if (data) setAgendamentos(prev => [...prev, data])
      }
      setModal({ open: false })
    } finally { setSalvando(false) }
  }

  const deletar = async (id: string) => {
    if (!confirm('Deletar este agendamento?')) return
    await supabase.from('agendamentos').delete().eq('id', id)
    setAgendamentos(prev => prev.filter(a => a.id !== id))
    setModal({ open: false })
  }

  const enviarPreConsulta = async (agendamentoId: string) => {
    if (!medico) return
    setEnviandoPreConsulta(true)
    try {
      const res = await fetch('/api/pre-consulta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agendamento_id: agendamentoId, medico_id: medico.id })
      })
      const data = await res.json()
      if (data.ok) {
        setPreConsultaEnviada(true)
        setAgendamentos(prev => prev.map(a => a.id === agendamentoId ? { ...a, pre_consulta_enviada: true } : a))
      } else {
        alert(data.error || 'Erro ao enviar pre-consulta')
      }
    } catch (e) { alert('Erro de conexao') }
    finally { setEnviandoPreConsulta(false) }
  }

  const atualizarStatus = async (id: string, status: string) => {
    const { data } = await supabase.from('agendamentos').update({ status }).eq('id', id).select(`*, pacientes(nome)`).single()
    if (data) setAgendamentos(prev => prev.map(a => a.id === id ? data : a))
  }

  const fmtDia = (d: Date) => d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
  const fmtMes = (d: Date) => d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const isHoje = (d: Date) => d.toDateString() === hoje
  const totalSemana = diasSemana.reduce((acc, d) => acc + getAgsDia(d).length, 0)

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F9FAFC', overflow: 'hidden' }}>
      <Sidebar />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 16 }}>
        {/* Header */}
        <div style={{ background: 'transparent', borderBottom: 'none', padding: '0 20px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => setSemana(new Date())} style={{ fontSize: 12, fontWeight: 600, color: '#374151', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', padding: '5px 12px', borderRadius: 7, cursor: 'pointer' }}>
              Hoje
            </button>
            <div style={{ display: 'flex', gap: 1 }}>
              <button onClick={() => navegarSemana(-1)} style={{ width: 28, height: 28, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', background: 'white', borderRadius: '6px 0 0 6px', cursor: 'pointer', color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <button onClick={() => navegarSemana(1)} style={{ width: 28, height: 28, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', borderLeft: 'none', background: 'white', borderRadius: '0 6px 6px 0', cursor: 'pointer', color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </div>
            <h1 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0, textTransform: 'capitalize' }}>
              {fmtMes(diasSemana[0])}
              {diasSemana[0].getMonth() !== diasSemana[6].getMonth() && ` — ${fmtMes(diasSemana[6])}`}
            </h1>
            {totalSemana > 0 && (
              <span style={{ fontSize: 11, color: '#6043C1', background: '#f3f0fd', border: '1px solid #d4c9f7', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
                {totalSemana} agendamento{totalSemana !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Legenda tipos */}
            <div style={{ display: 'flex', gap: 10, marginRight: 8 }}>
              {Object.entries(TIPOS).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: v.dot }}/>
                  <span style={{ fontSize: 11, color: '#6b7280' }}>{v.label}</span>
                </div>
              ))}
            </div>
            <button onClick={() => abrirModal()} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 16px', borderRadius: 8, border: 'none', background: '#6043C1', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
              Novo agendamento
            </button>
          </div>
        </div>

        {/* Calendário */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Cabeçalho dos dias */}
          <div style={{ display: 'grid', gridTemplateColumns: '52px repeat(7, 1fr)', background: 'transparent', borderBottom: 'none', flexShrink: 0 }}>
            <div style={{ borderRight: '1px solid #f3f4f6' }}/>
            {diasSemana.map((dia, i) => {
              const ags = getAgsDia(dia)
              return (
                <div key={i} onClick={() => abrirModal(new Date(dia.setHours(9, 0, 0, 0)))}
                  style={{ padding: '10px 8px', textAlign: 'center', borderRight: i < 6 ? '1px solid #f3f4f6' : 'none', cursor: 'pointer', background: isHoje(dia) ? '#f3f0fd' : 'white', transition: 'background 0.1s' }}>
                  <p style={{ fontSize: 11, color: isHoje(dia) ? '#6043C1' : '#9ca3af', fontWeight: 600, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {dia.toLocaleDateString('pt-BR', { weekday: 'short' })}
                  </p>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: isHoje(dia) ? '#6043C1' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: isHoje(dia) ? 'white' : '#111827', margin: 0 }}>{dia.getDate()}</p>
                  </div>
                  {ags.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 2, marginTop: 4 }}>
                      {ags.slice(0, 4).map((ag, ai) => (
                        <div key={ai} style={{ width: 5, height: 5, borderRadius: '50%', background: TIPOS[ag.tipo as keyof typeof TIPOS]?.dot || '#6043C1' }}/>
                      ))}
                      {ags.length > 4 && <span style={{ fontSize: 9, color: '#6b7280' }}>+{ags.length - 4}</span>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Grade de horas */}
          <div style={{ flex: 1, overflow: 'auto', background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '52px repeat(7, 1fr)', minHeight: `${HORAS.length * 64}px` }}>
              {/* Coluna de horas */}
              <div style={{ borderRight: '1px solid #e5e7eb', background: 'white', position: 'sticky', left: 0, zIndex: 10 }}>
                {HORAS.map(h => (
                  <div key={h} style={{ height: 64, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: 8, paddingTop: 4, borderBottom: 'none' }}>
                    <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>{h}:00</span>
                  </div>
                ))}
              </div>

              {/* Colunas dos dias */}
              {diasSemana.map((dia, di) => (
                <div key={di} style={{ borderRight: di < 6 ? '1px solid #e5e7eb' : 'none', background: isHoje(dia) ? '#fafffe' : 'white', position: 'relative' }}>
                  {HORAS.map(h => {
                    const ags = getAgHora(dia, h)
                    const agendamentosSlot = agendamentos.filter(a => {
                      const d = new Date(a.data_hora)
                      return d.toDateString() === dia.toDateString() && d.getHours() === h
                    })
                    return (
                      <div key={h}
                        onClick={() => { const d = new Date(dia); d.setHours(h, 0, 0, 0); abrirModal(d) }}
                        style={{ height: 64, borderBottom: 'none', position: 'relative', cursor: 'pointer', transition: 'background 0.1s' }}
                        onMouseOver={e => { if (agendamentosSlot.length === 0) e.currentTarget.style.background = '#f9fafb' }}
                        onMouseOut={e => { e.currentTarget.style.background = 'transparent' }}>
                        {agendamentosSlot.map((ag, ai) => {
                          const tipo = TIPOS[ag.tipo as keyof typeof TIPOS] || TIPOS.consulta
                          const pacNome = ag.pacientes?.nome || ag.paciente_nome || 'Paciente'
                          return (
                            <div key={ag.id}
                              onClick={e => { e.stopPropagation(); abrirModal(undefined, ag) }}
                              style={{
                                position: 'absolute', left: `${ai * 6 + 3}px`, right: '3px', top: '2px', bottom: '2px',
                                background: tipo.bg, border: `1.5px solid ${tipo.border}`,
                                borderLeft: `3px solid ${tipo.dot}`,
                                borderRadius: 6, padding: '3px 6px', cursor: 'pointer', zIndex: 10,
                                overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                              }}>
                              <p style={{ fontSize: 11, fontWeight: 700, color: tipo.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {new Date(ag.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} {ag.motivo || tipo.label}
                              </p>
                              <p style={{ fontSize: 10, color: tipo.text, margin: 0, opacity: 0.75, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {pacNome}
                              </p>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Modal */}
      {modal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) setModal({ open: false }) }}>
          <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
            {/* Header modal */}
            <div style={{ padding: '18px 24px', borderBottom: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f3f0fd', border: '1px solid #d4c9f7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6043C1" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </div>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0 }}>{modal.ag ? 'Editar agendamento' : 'Novo agendamento'}</h3>
                  {modal.date && <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>{fmtDia(modal.date)}</p>}
                </div>
              </div>
              <button onClick={() => setModal({ open: false })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 20, lineHeight: 1, padding: 4 }}>✕</button>
            </div>

            <form onSubmit={salvar} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Tipos */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tipo</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
                  {Object.entries(TIPOS).map(([k, v]) => (
                    <button key={k} type="button" onClick={() => setForm(f => ({...f, tipo: k}))}
                      style={{ padding: '7px 4px', borderRadius: 8, border: `1.5px solid ${form.tipo === k ? v.dot : '#e5e7eb'}`, background: form.tipo === k ? v.bg : 'white', color: form.tipo === k ? v.text : '#6b7280', fontSize: 12, fontWeight: form.tipo === k ? 700 : 400, cursor: 'pointer', transition: 'all 0.15s' }}>
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Paciente */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Paciente</label>
                <select value={form.paciente_id} onChange={e => setForm(f => ({...f, paciente_id: e.target.value}))}
                  style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8, border: '1.5px solid #e5e7eb', background: 'white', color: '#111827' }}>
                  <option value="">Selecionar paciente</option>
                  {pacientes.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>

              {/* Data/hora + duração */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Data e hora *</label>
                  <input type="datetime-local" required value={form.data_hora} onChange={e => setForm(f => ({...f, data_hora: e.target.value}))}
                    style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8, border: '1.5px solid #e5e7eb' }}/>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Duração</label>
                  <select value={form.duracao} onChange={e => setForm(f => ({...f, duracao: e.target.value}))}
                    style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8, border: '1.5px solid #e5e7eb', background: 'white' }}>
                    <option value="15">15 min</option>
                    <option value="30">30 min</option>
                    <option value="45">45 min</option>
                    <option value="60">1 hora</option>
                    <option value="90">1h30</option>
                  </select>
                </div>
              </div>

              {/* Motivo */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Motivo</label>
                <input value={form.motivo} onChange={e => setForm(f => ({...f, motivo: e.target.value}))}
                  style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8, border: '1.5px solid #e5e7eb' }}
                  placeholder="Ex: Consulta de rotina, dor abdominal..."/>
              </div>

              {/* Observações */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Observações</label>
                <textarea value={form.observacoes} onChange={e => setForm(f => ({...f, observacoes: e.target.value}))}
                  style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8, border: '1.5px solid #e5e7eb', minHeight: 56, resize: 'none' }}
                  placeholder="Observações adicionais..."/>
              </div>

              {/* Status (só ao editar) */}
              {modal.ag && (
                <div style={{ background: 'white', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>Status atual: <strong style={{ color: '#111827' }}>{modal.ag.status}</strong></span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {modal.ag.status !== 'confirmado' && (
                      <button type="button" onClick={() => { atualizarStatus(modal.ag.id, 'confirmado'); setModal(m => ({...m, ag: {...m.ag, status: 'confirmado'}})) }}
                        style={{ fontSize: 11, color: '#6043C1', background: '#f3f0fd', border: '1px solid #d4c9f7', padding: '3px 10px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Confirmar</button>
                    )}
                    {modal.ag.status !== 'cancelado' && (
                      <button type="button" onClick={() => { atualizarStatus(modal.ag.id, 'cancelado'); setModal({ open: false }) }}
                        style={{ fontSize: 11, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '3px 10px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
                    )}
                  </div>
                </div>
              )}

              {/* Toggle video */}
              {!modal.ag && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: comVideo ? '#f3f0fd' : '#f9fafb', borderRadius: 10, border: '1px solid ' + (comVideo ? '#d4c9f7' : '#e5e7eb') }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={comVideo ? '#6043C1' : '#9ca3af'} strokeWidth="2"><path d="M15 10l4.553-2.169A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14v-4zM3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/></svg>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: comVideo ? '#6043C1' : '#374151', margin: 0 }}>Incluir sala de video</p>
                      <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>Link gerado automaticamente</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => { setComVideo(!comVideo); setSalaLink(''); setSalaId('') }} style={{ width: 42, height: 24, borderRadius: 12, border: 'none', background: comVideo ? '#6043C1' : '#d1d5db', cursor: 'pointer', position: 'relative' as const, flexShrink: 0 }}>
                    <span style={{ position: 'absolute' as const, top: 2, left: comVideo ? 20 : 2, width: 20, height: 20, borderRadius: '50%', background: 'white', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}/>
                  </button>
                </div>
              )}
              {salaLink && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 9, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2"><path d="M15 10l4.553-2.169A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14v-4zM3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/></svg>
                  <span style={{ fontSize: 11, color: '#4e35a3', flex: 1, overflow: 'hidden', background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{salaLink}</span>
                  <button type="button" onClick={() => { navigator.clipboard.writeText(salaLink); window.open('/sala/' + salaId, '_blank') }} style={{ fontSize: 11, color: '#6043C1', background: 'white', border: '1px solid #bfdbfe', padding: '3px 8px', borderRadius: 5, cursor: 'pointer', whiteSpace: 'nowrap' as const }}>Copiar e abrir</button>
                </div>
              )}
              {/* Pre-consulta WhatsApp */}
              {modal.ag && modal.ag.paciente_id && (
                <div style={{ background: preConsultaEnviada || modal.ag.pre_consulta_enviada ? '#f0fdf4' : '#f0ebff', border: '1px solid ' + (preConsultaEnviada || modal.ag.pre_consulta_enviada ? '#bbf7d0' : '#d4c9f7'), borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={preConsultaEnviada || modal.ag.pre_consulta_enviada ? '#16a34a' : '#6043C1'} strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: preConsultaEnviada || modal.ag.pre_consulta_enviada ? '#16a34a' : '#6043C1', margin: 0 }}>Pré-consulta WhatsApp</p>
                      <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>{preConsultaEnviada || modal.ag.pre_consulta_enviada ? 'Perguntas enviadas ao paciente' : 'Enviar perguntas antes da consulta'}</p>
                    </div>
                  </div>
                  {!(preConsultaEnviada || modal.ag.pre_consulta_enviada) && (
                    <button type="button" onClick={() => enviarPreConsulta(modal.ag.id)} disabled={enviandoPreConsulta}
                      style={{ fontSize: 12, color: '#6043C1', background: 'white', border: '1px solid #d4c9f7', padding: '5px 12px', borderRadius: 7, cursor: 'pointer', fontWeight: 600 }}>
                      {enviandoPreConsulta ? 'Enviando...' : 'Enviar'}
                    </button>
                  )}
                </div>
              )}

              {/* Botões */}
              <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
                <button type="submit" disabled={salvando} style={{ flex: 1, padding: '11px', borderRadius: 9, border: 'none', background: '#6043C1', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  {salvando ? 'Salvando...' : modal.ag ? 'Salvar alterações' : 'Criar agendamento'}
                </button>
                {modal.ag && (
                  <button
                    type="button"
                    onClick={() => {
                      const params = new URLSearchParams()
                      if (modal.ag.paciente_id) params.set('paciente_id', modal.ag.paciente_id)
                      if (modal.ag.pacientes?.nome) params.set('paciente_nome', modal.ag.pacientes.nome)
                      if (modal.ag.pacientes?.telefone) params.set('paciente_tel', modal.ag.pacientes.telefone || '')
                      router.push('/nova-consulta?' + params.toString())
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#6043C1', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/></svg>
                    Iniciar consulta
                  </button>
                  <button type="button" onClick={() => deletar(modal.ag.id)}
                    style={{ padding: '11px 16px', borderRadius: 9, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
