'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import { Sidebar } from '@/components/Sidebar'
import { IconGift } from '@/components/Icon'

const TIPOS = {
  consulta: { label: 'Consulta', bg: '#E8F7EF', text: '#176F44', border: '#A7E0BF', dot: '#1F9D5C' },
  retorno:  { label: 'Retorno',  bg: '#f3effd', text: '#5b42b0', border: '#dfd3f5', dot: '#7c3aed' },
  exame:    { label: 'Exame',    bg: '#e8f5ee', text: '#1f6b3d', border: '#c4e4d2', dot: '#16a34a' },
  urgencia: { label: 'Urgência', bg: '#fee2e2', text: '#991b1b', border: '#fca5a5', dot: '#dc2626' },
}

const STATUS_OPTS = [
  { value: 'agendado',   label: 'Agendado' },
  { value: 'confirmado', label: 'Confirmado' },
  { value: 'cancelado',  label: 'Cancelado' },
  { value: 'realizado',  label: 'Realizado' },
]

const SLOT_MIN = 15
const SLOT_PX = 20
const HORA_INI = 7
const HORA_FIM = 20
const TOTAL_SLOTS = ((HORA_FIM - HORA_INI) * 60) / SLOT_MIN

const toSlotIdx = (d: Date) => Math.floor(((d.getHours() - HORA_INI) * 60 + d.getMinutes()) / SLOT_MIN)
const slotToPx = (idx: number) => idx * SLOT_PX
const durToPx  = (dur: number) => (dur / SLOT_MIN) * SLOT_PX

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

function getMonthGrid(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1)
  const startDay = first.getDay()
  const offset = startDay === 0 ? -6 : 1 - startDay
  const start = new Date(first)
  start.setDate(first.getDate() + offset)
  return Array.from({ length: 42 }, (_, i) => {
    const nd = new Date(start)
    nd.setDate(start.getDate() + i)
    return nd
  })
}

const isMesmoDia = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

const fmtMesAno = (d: Date) =>
  d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/ De /, ' de ')

const fmtDia = (d: Date) =>
  d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })

const ehAniversario = (nascStr: string | null | undefined, alvo: Date) => {
  if (!nascStr) return false
  const n = new Date(nascStr)
  if (isNaN(n.getTime())) return false
  return n.getMonth() === alvo.getMonth() && n.getDate() === alvo.getDate()
}

export default function Agenda() {
  const router = useRouter()
  const { toast } = useToast()

  const [medico, setMedico] = useState<any>(null)
  const [pacientes, setPacientes] = useState<any[]>([])
  const [agendamentos, setAgendamentos] = useState<any[]>([])

  const [semana, setSemana] = useState(new Date())
  const [diaSelecionado, setDiaSelecionado] = useState(new Date())
  const [viewMode, setViewMode] = useState<'semana' | 'dia' | 'mes'>('semana')
  const [mesVisualizado, setMesVisualizado] = useState(new Date())

  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const [filtroPaciente, setFiltroPaciente] = useState<string>('')
  const [filtroProfissional, setFiltroProfissional] = useState<string>('todos')

  const [listaEsperaOpen, setListaEsperaOpen] = useState(false)
  const [listaEspera] = useState<any[]>([])

  const [modal, setModal] = useState<{ open: boolean; date?: Date; ag?: any }>({ open: false })
  const [form, setForm] = useState({ paciente_id: '', data_hora: '', tipo: 'consulta', motivo: '', observacoes: '', duracao: '30' })
  const [salvando, setSalvando] = useState(false)

  const [comVideo, setComVideo] = useState(false)
  const [salaLink, setSalaLink] = useState('')
  const [salaId, setSalaId] = useState('')

  const [enviandoPreConsulta, setEnviandoPreConsulta] = useState(false)
  const [preConsultaEnviada, setPreConsultaEnviada] = useState(false)

  const [agora, setAgora] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  const diasSemana = getWeekDays(semana)
  const hojeStr = new Date().toDateString()
  const isHoje = (d: Date) => d.toDateString() === hojeStr

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
      supabase.from('pacientes').select('id, nome, data_nascimento, telefone').eq('medico_id', medicoId).order('nome'),
      supabase.from('agendamentos').select(`*, pacientes(nome, data_nascimento, telefone)`).eq('medico_id', medicoId).order('data_hora'),
    ])
    setPacientes(pacs || [])
    setAgendamentos(ags || [])
  }

  const agendamentosFiltrados = useMemo(() => {
    return agendamentos.filter(a => {
      if (filtroStatus !== 'todos' && a.status !== filtroStatus) return false
      if (filtroTipo !== 'todos' && a.tipo !== filtroTipo) return false
      if (filtroPaciente) {
        const nome = (a.pacientes?.nome || a.paciente_nome || '').toLowerCase()
        if (!nome.includes(filtroPaciente.toLowerCase())) return false
      }
      if (filtroProfissional !== 'todos' && a.profissional_id && a.profissional_id !== filtroProfissional) return false
      return true
    })
  }, [agendamentos, filtroStatus, filtroTipo, filtroPaciente, filtroProfissional])

  const getAgsDia = (dia: Date) =>
    agendamentosFiltrados.filter(a => new Date(a.data_hora).toDateString() === dia.toDateString())

  const navegarSemana = (dir: number) => {
    const nd = new Date(semana); nd.setDate(nd.getDate() + dir * 7); setSemana(nd)
  }
  const navegarMes = (dir: number) => {
    const nd = new Date(mesVisualizado); nd.setMonth(nd.getMonth() + dir); setMesVisualizado(nd)
  }

  const limparFiltros = () => {
    setFiltroStatus('todos'); setFiltroTipo('todos'); setFiltroPaciente(''); setFiltroProfissional('todos')
  }

  const filtrosAtivos =
    (filtroStatus !== 'todos' ? 1 : 0) +
    (filtroTipo !== 'todos' ? 1 : 0) +
    (filtroPaciente ? 1 : 0) +
    (filtroProfissional !== 'todos' ? 1 : 0)

  const abrirModal = (date?: Date, ag?: any) => {
    setPreConsultaEnviada(false); setComVideo(false); setSalaLink(''); setSalaId('')
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
      if (d.getHours() < HORA_INI) d.setHours(8, 0, 0, 0)
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
          tipo: form.tipo,
          motivo: form.motivo,
          observacoes: form.observacoes,
          duracao: form.duracao,
        }).eq('id', modal.ag.id).select(`*, pacientes(nome, data_nascimento, telefone)`).single()
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
            setSalaLink(meetLinkFinal); setSalaId(meetCodeFinal)
          }
        }
        const { data } = await supabase.from('agendamentos').insert({
          medico_id: medico.id,
          paciente_id: form.paciente_id || null,
          data_hora: new Date(form.data_hora).toISOString(),
          tipo: form.tipo,
          motivo: form.motivo,
          observacoes: form.observacoes,
          duracao: form.duracao,
          status: 'agendado',
          meet_link: meetLinkFinal || null,
          meet_code: meetCodeFinal || null,
        }).select(`*, pacientes(nome, data_nascimento, telefone)`).single()
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
      const res = await fetch('/api/sofia/preatendimento', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agendamento_id: agendamentoId })
      })
      const data = await res.json()
      if (data.ok) {
        setPreConsultaEnviada(true)
        setAgendamentos(prev => prev.map(a => a.id === agendamentoId ? { ...a, pre_consulta_enviada: true } : a))
        toast(`Sofia vai fazer ${data.total_perguntas} perguntas adaptativas ao paciente`)
      } else {
        toast(data.error || 'Erro ao enviar pré-atendimento', 'error')
      }
    } catch (e) { alert('Erro de conexao') }
    finally { setEnviandoPreConsulta(false) }
  }

  const atualizarStatus = async (id: string, status: string) => {
    const { data } = await supabase.from('agendamentos').update({ status }).eq('id', id).select(`*, pacientes(nome, data_nascimento, telefone)`).single()
    if (data) setAgendamentos(prev => prev.map(a => a.id === id ? data : a))
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 6,
    textTransform: 'uppercase', letterSpacing: '0.06em',
  }
  const selectStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', fontSize: 12, borderRadius: 7, background: 'white', color: '#111827', cursor: 'pointer',
  }

  const renderHeader = () => {
    const labelData = viewMode === 'mes'
      ? fmtMesAno(mesVisualizado)
      : viewMode === 'dia'
        ? diaSelecionado.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
        : `${diasSemana[0].getDate()} – ${diasSemana[6].getDate()} ${fmtMesAno(diasSemana[6])}`

    return (
      <div style={{ padding: '0 20px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => { setSemana(new Date()); setDiaSelecionado(new Date()); setMesVisualizado(new Date()) }}
            style={{ fontSize: 12, fontWeight: 600, color: '#374151', background: 'white', padding: '5px 14px', borderRadius: 7, cursor: 'pointer' }}>
            Hoje
          </button>
          <div style={{ display: 'flex', gap: 1 }}>
            <button onClick={() => viewMode === 'mes' ? navegarMes(-1) : navegarSemana(-1)}
              style={{ width: 28, height: 28, background: 'white', borderRadius: '6px 0 0 6px', cursor: 'pointer', color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <button onClick={() => viewMode === 'mes' ? navegarMes(1) : navegarSemana(1)}
              style={{ width: 28, height: 28, background: 'white', borderRadius: '0 6px 6px 0', cursor: 'pointer', color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: 'none' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </div>
          <h1 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0, textTransform: 'capitalize' }}>{labelData}</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setListaEsperaOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 7, background: 'white', fontSize: 12, color: '#374151', fontWeight: 600, cursor: 'pointer' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Lista de espera
            {listaEspera.length > 0 && <span style={{ background: '#1F9D5C', color: 'white', borderRadius: 10, padding: '0 6px', fontSize: 10 }}>{listaEspera.length}</span>}
          </button>
          <div style={{ display: 'flex', borderRadius: 7, overflow: 'hidden', background: 'white' }}>
            {(['dia', 'semana', 'mes'] as const).map((v, i) => (
              <button key={v} onClick={() => setViewMode(v)}
                style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: viewMode === v ? '#1F9D5C' : 'white', color: viewMode === v ? 'white' : '#6b7280', border: 'none', borderLeft: i > 0 ? '1px solid #e5e7eb' : 'none' }}>
                {v === 'dia' ? 'Dia' : v === 'semana' ? 'Semana' : 'Mês'}
              </button>
            ))}
          </div>
          <button onClick={() => abrirModal()}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 16px', borderRadius: 8, border: 'none', background: '#1F9D5C', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Novo
          </button>
        </div>
      </div>
    )
  }

  const renderPainel = () => {
    const monthGrid = getMonthGrid(mesVisualizado)
    const mesAtual = mesVisualizado.getMonth()
    return (
      <aside style={{ width: 260, background: 'white', borderRight: '1px solid #f3f4f6', padding: 16, overflow: 'auto', flexShrink: 0 }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0, textTransform: 'capitalize' }}>{fmtMesAno(mesVisualizado)}</h3>
            <div style={{ display: 'flex', gap: 2 }}>
              <button onClick={() => navegarMes(-1)} style={{ width: 22, height: 22, border: 'none', background: 'transparent', cursor: 'pointer', color: '#6b7280', borderRadius: 4 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <button onClick={() => navegarMes(1)} style={{ width: 22, height: 22, border: 'none', background: 'transparent', cursor: 'pointer', color: '#6b7280', borderRadius: 4 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
            {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((l, i) => (
              <div key={i} style={{ fontSize: 10, color: '#9ca3af', textAlign: 'center', fontWeight: 700, padding: '4px 0' }}>{l}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {monthGrid.map((d, i) => {
              const noMes = d.getMonth() === mesAtual
              const hoje = isHoje(d)
              const selecionado = isMesmoDia(d, diaSelecionado)
              const temAgs = agendamentosFiltrados.some(a => new Date(a.data_hora).toDateString() === d.toDateString())
              return (
                <button key={i} onClick={() => { setDiaSelecionado(d); setSemana(d); setViewMode('dia') }}
                  style={{ aspectRatio: '1', border: 'none', background: selecionado ? '#1F9D5C' : (hoje ? '#E8F7EF' : 'transparent'), color: selecionado ? 'white' : (!noMes ? '#d1d5db' : (hoje ? '#1F9D5C' : '#374151')), fontSize: 11, fontWeight: hoje || selecionado ? 700 : 500, borderRadius: 6, cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {d.getDate()}
                  {temAgs && !selecionado && <span style={{ position: 'absolute', bottom: 2, width: 3, height: 3, borderRadius: '50%', background: hoje ? '#1F9D5C' : '#9ca3af' }}/>}
                </button>
              )
            })}
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0 }}>Filtros</h3>
            {filtrosAtivos > 0 && <button onClick={limparFiltros} style={{ fontSize: 11, color: '#1F9D5C', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Limpar ({filtrosAtivos})</button>}
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>Status</label>
            <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={selectStyle}>
              <option value="todos">Todos</option>
              {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>Tipo</label>
            <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={selectStyle}>
              <option value="todos">Todos</option>
              {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>Paciente</label>
            <input type="text" value={filtroPaciente} onChange={e => setFiltroPaciente(e.target.value)} placeholder="Buscar por nome..." style={{ ...selectStyle, padding: '8px 10px' }}/>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>Profissional</label>
            <select value={filtroProfissional} onChange={e => setFiltroProfissional(e.target.value)} style={selectStyle}>
              <option value="todos">Todos</option>
              {medico && <option value={medico.id}>{medico.nome || 'Eu'}</option>}
            </select>
          </div>
        </div>
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #f3f4f6' }}>
          <h3 style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Legenda</h3>
          {Object.entries(TIPOS).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: v.bg, border: `1.5px solid ${v.border}`, borderLeft: `3px solid ${v.dot}` }}/>
              <span style={{ fontSize: 12, color: '#6b7280' }}>{v.label}</span>
            </div>
          ))}
        </div>
      </aside>
    )
  }

  const renderGridSemana = () => {
    const agoraIdx = toSlotIdx(agora)
    const mostrarLinhaAgora = agoraIdx >= 0 && agoraIdx < TOTAL_SLOTS
    return (
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'white', borderRadius: 12, margin: '0 16px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '56px repeat(7, 1fr)', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
          <div/>
          {diasSemana.map((dia, i) => {
            const ags = getAgsDia(dia)
            const aniversariantes = pacientes.filter(p => ehAniversario(p.data_nascimento, dia)).length
            return (
              <div key={i} onClick={() => { setDiaSelecionado(dia); setViewMode('dia') }}
                style={{ padding: '10px 8px', textAlign: 'center', borderLeft: '1px solid #f3f4f6', cursor: 'pointer', background: isHoje(dia) ? '#faf8ff' : 'white' }}>
                <p style={{ fontSize: 10, color: isHoje(dia) ? '#1F9D5C' : '#9ca3af', fontWeight: 700, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {dia.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: isHoje(dia) ? '#1F9D5C' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: isHoje(dia) ? 'white' : '#111827', margin: 0 }}>{dia.getDate()}</p>
                  </div>
                  {aniversariantes > 0 && <span title={`${aniversariantes} aniversariante(s)`} style={{ fontSize: 12 }}><IconGift size={14} /></span>}
                </div>
                {ags.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 2, marginTop: 3 }}>
                    {ags.slice(0, 4).map((ag, ai) => (
                      <div key={ai} style={{ width: 4, height: 4, borderRadius: '50%', background: TIPOS[ag.tipo as keyof typeof TIPOS]?.dot || '#1F9D5C' }}/>
                    ))}
                    {ags.length > 4 && <span style={{ fontSize: 9, color: '#6b7280' }}>+{ags.length - 4}</span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '56px repeat(7, 1fr)', minHeight: `${TOTAL_SLOTS * SLOT_PX}px`, position: 'relative' }}>
            <div style={{ position: 'sticky', left: 0, background: 'white', zIndex: 5 }}>
              {Array.from({ length: HORA_FIM - HORA_INI }, (_, i) => (
                <div key={i} style={{ height: SLOT_PX * 4, position: 'relative', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ position: 'absolute', top: -7, right: 8, fontSize: 10, color: '#9ca3af', fontWeight: 600, background: 'white', padding: '0 2px' }}>
                    {(HORA_INI + i).toString().padStart(2, '0')}:00
                  </span>
                </div>
              ))}
            </div>
            {diasSemana.map((dia, di) => (
              <div key={di} style={{ borderLeft: '1px solid #f3f4f6', background: isHoje(dia) ? '#faf8ff' : 'white', position: 'relative' }}>
                {Array.from({ length: (HORA_FIM - HORA_INI) * 4 }, (_, i) => {
                  const isHoraCheia = i % 4 === 0
                  const isMeia = i % 4 === 2
                  return (
                    <div key={i}
                      onClick={() => { const d = new Date(dia); d.setHours(HORA_INI + Math.floor(i / 4), (i % 4) * 15, 0, 0); abrirModal(d) }}
                      style={{ height: SLOT_PX, borderTop: isHoraCheia ? '1px solid #f3f4f6' : (isMeia ? '1px dashed #F5F5F5' : 'none'), cursor: 'pointer', transition: 'background 0.1s' }}
                      onMouseOver={e => { e.currentTarget.style.background = 'rgba(96,67,193,0.04)' }}
                      onMouseOut={e => { e.currentTarget.style.background = 'transparent' }}/>
                  )
                })}
                {getAgsDia(dia).map(ag => {
                  const tipo = TIPOS[ag.tipo as keyof typeof TIPOS] || TIPOS.consulta
                  const d = new Date(ag.data_hora)
                  const idx = toSlotIdx(d)
                  const dur = Number(ag.duracao) || 30
                  const pacNome = ag.pacientes?.nome || ag.paciente_nome || 'Paciente'
                  const cancelado = ag.status === 'cancelado'
                  return (
                    <div key={ag.id} onClick={e => { e.stopPropagation(); abrirModal(undefined, ag) }}
                      style={{ position: 'absolute', left: 3, right: 3, top: slotToPx(idx) + 1, height: durToPx(dur) - 2, background: cancelado ? '#f3f4f6' : tipo.bg, border: `1px solid ${cancelado ? '#d1d5db' : tipo.border}`, borderLeft: `3px solid ${cancelado ? '#9ca3af' : tipo.dot}`, borderRadius: 6, padding: '3px 6px', cursor: 'pointer', zIndex: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', opacity: cancelado ? 0.6 : 1, textDecoration: cancelado ? 'line-through' : 'none' }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: tipo.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pacNome}</p>
                      {durToPx(dur) > 28 && (
                        <p style={{ fontSize: 10, color: tipo.text, margin: '1px 0 0', opacity: 0.75, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ag.motivo || tipo.label}</p>
                      )}
                      {durToPx(dur) > 44 && (
                        <p style={{ fontSize: 9, color: tipo.text, margin: 'auto 0 0', opacity: 0.65, fontWeight: 600 }}>
                          {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} – {new Date(d.getTime() + dur * 60000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  )
                })}
                {isHoje(dia) && mostrarLinhaAgora && (
                  <div style={{ position: 'absolute', top: slotToPx(agoraIdx) + (agora.getMinutes() % SLOT_MIN) * (SLOT_PX / SLOT_MIN), left: 0, right: 0, height: 2, background: '#dc2626', zIndex: 20, pointerEvents: 'none' }}>
                    <div style={{ position: 'absolute', left: -4, top: -3, width: 8, height: 8, borderRadius: '50%', background: '#dc2626' }}/>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const renderGridMes = () => {
    const grid = getMonthGrid(mesVisualizado)
    const mesAtual = mesVisualizado.getMonth()
    return (
      <div style={{ flex: 1, background: 'white', borderRadius: 12, margin: '0 16px 16px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #f3f4f6' }}>
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((l, i) => (
            <div key={i} style={{ padding: 8, fontSize: 11, fontWeight: 700, color: '#9ca3af', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l}</div>
          ))}
        </div>
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: '1fr' }}>
          {grid.map((d, i) => {
            const ags = getAgsDia(d)
            const noMes = d.getMonth() === mesAtual
            const hoje = isHoje(d)
            return (
              <div key={i} onClick={() => { setDiaSelecionado(d); setSemana(d); setViewMode('dia') }}
                style={{ borderTop: '1px solid #f3f4f6', borderLeft: i % 7 !== 0 ? '1px solid #f3f4f6' : 'none', padding: 6, cursor: 'pointer', background: noMes ? '#F5F5F5' : (hoje ? '#faf8ff' : 'white'), overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, fontWeight: hoje ? 700 : 600, color: !noMes ? '#d1d5db' : hoje ? 'white' : '#374151', background: hoje ? '#1F9D5C' : 'transparent', width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{d.getDate()}</span>
                  {ags.length > 2 && <span style={{ fontSize: 9, color: '#9ca3af', fontWeight: 600 }}>+{ags.length - 2}</span>}
                </div>
                {ags.slice(0, 2).map(ag => {
                  const tipo = TIPOS[ag.tipo as keyof typeof TIPOS] || TIPOS.consulta
                  return (
                    <div key={ag.id} onClick={e => { e.stopPropagation(); abrirModal(undefined, ag) }}
                      style={{ fontSize: 10, padding: '2px 5px', borderRadius: 4, background: tipo.bg, color: tipo.text, borderLeft: `2px solid ${tipo.dot}`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                      {new Date(ag.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} {ag.pacientes?.nome || 'Paciente'}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderGridDia = () => {
    const agoraIdx = toSlotIdx(agora)
    const mostrarLinhaAgora = isHoje(diaSelecionado) && agoraIdx >= 0 && agoraIdx < TOTAL_SLOTS
    const ags = getAgsDia(diaSelecionado)
    return (
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'white', borderRadius: 12, margin: '0 16px 16px' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: isHoje(diaSelecionado) ? '#1F9D5C' : '#E8F7EF', color: isHoje(diaSelecionado) ? 'white' : '#1F9D5C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 700 }}>
            {diaSelecionado.getDate()}
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827', textTransform: 'capitalize' }}>{diaSelecionado.toLocaleDateString('pt-BR', { weekday: 'long' })}</p>
            <p style={{ margin: 0, fontSize: 12, color: '#6b7280', textTransform: 'capitalize' }}>{fmtMesAno(diaSelecionado)} · {ags.length} agendamento{ags.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr', minHeight: `${TOTAL_SLOTS * SLOT_PX}px`, position: 'relative' }}>
            <div style={{ position: 'sticky', left: 0, background: 'white', zIndex: 5 }}>
              {Array.from({ length: HORA_FIM - HORA_INI }, (_, i) => (
                <div key={i} style={{ height: SLOT_PX * 4, position: 'relative', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ position: 'absolute', top: -7, right: 10, fontSize: 11, color: '#9ca3af', fontWeight: 600, background: 'white', padding: '0 4px' }}>{(HORA_INI + i).toString().padStart(2, '0')}:00</span>
                </div>
              ))}
            </div>
            <div style={{ borderLeft: '1px solid #f3f4f6', position: 'relative' }}>
              {Array.from({ length: (HORA_FIM - HORA_INI) * 4 }, (_, i) => {
                const isHoraCheia = i % 4 === 0
                const isMeia = i % 4 === 2
                return (
                  <div key={i}
                    onClick={() => { const d = new Date(diaSelecionado); d.setHours(HORA_INI + Math.floor(i / 4), (i % 4) * 15, 0, 0); abrirModal(d) }}
                    style={{ height: SLOT_PX, borderTop: isHoraCheia ? '1px solid #f3f4f6' : (isMeia ? '1px dashed #F5F5F5' : 'none'), cursor: 'pointer' }}
                    onMouseOver={e => { e.currentTarget.style.background = 'rgba(96,67,193,0.04)' }}
                    onMouseOut={e => { e.currentTarget.style.background = 'transparent' }}/>
                )
              })}
              {ags.map(ag => {
                const tipo = TIPOS[ag.tipo as keyof typeof TIPOS] || TIPOS.consulta
                const d = new Date(ag.data_hora)
                const idx = toSlotIdx(d)
                const dur = Number(ag.duracao) || 30
                const pacNome = ag.pacientes?.nome || ag.paciente_nome || 'Paciente'
                return (
                  <div key={ag.id} onClick={e => { e.stopPropagation(); abrirModal(undefined, ag) }}
                    style={{ position: 'absolute', left: 8, right: 8, top: slotToPx(idx) + 1, height: durToPx(dur) - 2, background: tipo.bg, border: `1px solid ${tipo.border}`, borderLeft: `3px solid ${tipo.dot}`, borderRadius: 8, padding: '8px 12px', cursor: 'pointer', zIndex: 10, overflow: 'hidden' }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: tipo.text, margin: 0 }}>{pacNome}</p>
                    <p style={{ fontSize: 11, color: tipo.text, margin: '2px 0 0', opacity: 0.75 }}>
                      {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · {ag.motivo || tipo.label}
                    </p>
                  </div>
                )
              })}
              {mostrarLinhaAgora && (
                <div style={{ position: 'absolute', top: slotToPx(agoraIdx) + (agora.getMinutes() % SLOT_MIN) * (SLOT_PX / SLOT_MIN), left: 0, right: 0, height: 2, background: '#dc2626', zIndex: 20, pointerEvents: 'none' }}>
                  <div style={{ position: 'absolute', left: -4, top: -3, width: 8, height: 8, borderRadius: '50%', background: '#dc2626' }}/>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F5F5F5', overflow: 'hidden' }}>
      {renderPainel()}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {renderHeader()}
        {viewMode === 'semana' && renderGridSemana()}
        {viewMode === 'dia'    && renderGridDia()}
        {viewMode === 'mes'    && renderGridMes()}
      </main>

      {listaEsperaOpen && (
        <div onClick={() => setListaEsperaOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 90 }}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 360, background: 'white', boxShadow: '-8px 0 24px rgba(0,0,0,0.08)', padding: 20, overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>Lista de espera</h3>
              <button onClick={() => setListaEsperaOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af' }}>✕</button>
            </div>
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#9ca3af' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 12px', display: 'block' }}>
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <p style={{ margin: 0, fontSize: 13 }}>Nenhum paciente na lista de espera.</p>
              <p style={{ margin: '6px 0 0', fontSize: 11 }}>Pacientes aguardando encaixe aparecem aqui.</p>
            </div>
          </div>
        </div>
      )}

      {modal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={e => { if (e.target === e.currentTarget) setModal({ open: false }) }}>
          <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 480, overflow: 'hidden' }}>
            <div style={{ padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#E8F7EF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1F9D5C" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </div>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0 }}>{modal.ag ? 'Editar agendamento' : 'Novo agendamento'}</h3>
                  {modal.date && <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>{fmtDia(modal.date)}</p>}
                </div>
              </div>
              <button onClick={() => setModal({ open: false })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 20, lineHeight: 1, padding: 4 }}>✕</button>
            </div>
            <form onSubmit={salvar} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Tipo</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
                  {Object.entries(TIPOS).map(([k, v]) => (
                    <button key={k} type="button" onClick={() => setForm(f => ({...f, tipo: k}))}
                      style={{ padding: '7px 4px', borderRadius: 8, border: `1.5px solid ${form.tipo === k ? v.dot : '#e5e7eb'}`, background: form.tipo === k ? v.bg : 'white', color: form.tipo === k ? v.text : '#6b7280', fontSize: 12, fontWeight: form.tipo === k ? 700 : 500, cursor: 'pointer', transition: 'all 0.15s' }}>
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Paciente</label>
                <select value={form.paciente_id} onChange={e => setForm(f => ({...f, paciente_id: e.target.value}))}
                  style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8, background: 'white', color: '#111827' }}>
                  <option value="">Selecionar paciente</option>
                  {pacientes.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Data e hora *</label>
                  <input type="datetime-local" required value={form.data_hora} onChange={e => setForm(f => ({...f, data_hora: e.target.value}))}
                    style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8 }}/>
                </div>
                <div>
                  <label style={labelStyle}>Duração</label>
                  <select value={form.duracao} onChange={e => setForm(f => ({...f, duracao: e.target.value}))}
                    style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8, background: 'white' }}>
                    <option value="15">15 min</option>
                    <option value="30">30 min</option>
                    <option value="45">45 min</option>
                    <option value="60">1 hora</option>
                    <option value="90">1h30</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Motivo</label>
                <input value={form.motivo} onChange={e => setForm(f => ({...f, motivo: e.target.value}))}
                  style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8 }}
                  placeholder="Ex: Consulta de rotina, dor abdominal..."/>
              </div>
              <div>
                <label style={labelStyle}>Observações</label>
                <textarea value={form.observacoes} onChange={e => setForm(f => ({...f, observacoes: e.target.value}))}
                  style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8, minHeight: 56, resize: 'none' }}
                  placeholder="Observações adicionais..."/>
              </div>
              {modal.ag && (
                <div style={{ background: 'white', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>Status atual: <strong style={{ color: '#111827' }}>{modal.ag.status}</strong></span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {modal.ag.status !== 'confirmado' && (
                      <button type="button" onClick={() => { atualizarStatus(modal.ag.id, 'confirmado'); setModal(m => ({...m, ag: {...m.ag, status: 'confirmado'}})) }}
                        style={{ fontSize: 11, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '3px 10px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Confirmar</button>
                    )}
                    {modal.ag.status !== 'cancelado' && (
                      <button type="button" onClick={() => { atualizarStatus(modal.ag.id, 'cancelado'); setModal({ open: false }) }}
                        style={{ fontSize: 11, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '3px 10px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
                    )}
                  </div>
                </div>
              )}
              {!modal.ag && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: comVideo ? '#E8F7EF' : '#F5F5F5', borderRadius: 10, border: '1px solid ' + (comVideo ? '#A7E0BF' : '#e5e7eb') }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={comVideo ? '#1F9D5C' : '#9ca3af'} strokeWidth="2"><path d="M15 10l4.553-2.169A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14v-4zM3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/></svg>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: comVideo ? '#1F9D5C' : '#374151', margin: 0 }}>Incluir sala de vídeo</p>
                      <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>Link gerado automaticamente</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => { setComVideo(!comVideo); setSalaLink(''); setSalaId('') }}
                    style={{ width: 42, height: 24, borderRadius: 12, border: 'none', background: comVideo ? '#1F9D5C' : '#d1d5db', cursor: 'pointer', position: 'relative', flexShrink: 0 }}>
                    <span style={{ position: 'absolute', top: 2, left: comVideo ? 20 : 2, width: 20, height: 20, borderRadius: '50%', background: 'white', transition: 'left .2s' }}/>
                  </button>
                </div>
              )}
              {salaLink && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 9, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2"><path d="M15 10l4.553-2.169A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14v-4zM3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/></svg>
                  <span style={{ fontSize: 11, color: '#176F44', flex: 1, overflow: 'hidden', background: 'white', padding: '4px 8px', borderRadius: 6, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{salaLink}</span>
                  <button type="button" onClick={() => { navigator.clipboard.writeText(salaLink); window.open('/sala/' + salaId, '_blank') }}
                    style={{ fontSize: 11, color: '#1F9D5C', background: 'white', border: '1px solid #bfdbfe', padding: '3px 8px', borderRadius: 5, cursor: 'pointer', whiteSpace: 'nowrap' }}>Copiar e abrir</button>
                </div>
              )}
              {modal.ag && modal.ag.paciente_id && (
                <div style={{ background: preConsultaEnviada || modal.ag.pre_consulta_enviada ? '#f0fdf4' : '#f0ebff', border: '1px solid ' + (preConsultaEnviada || modal.ag.pre_consulta_enviada ? '#bbf7d0' : '#A7E0BF'), borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={preConsultaEnviada || modal.ag.pre_consulta_enviada ? '#16a34a' : '#1F9D5C'} strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: preConsultaEnviada || modal.ag.pre_consulta_enviada ? '#16a34a' : '#1F9D5C', margin: 0 }}>Pré-consulta WhatsApp</p>
                      <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>{preConsultaEnviada || modal.ag.pre_consulta_enviada ? 'Perguntas enviadas ao paciente' : 'Enviar perguntas antes da consulta'}</p>
                    </div>
                  </div>
                  {!(preConsultaEnviada || modal.ag.pre_consulta_enviada) && (
                    <button type="button" onClick={() => enviarPreConsulta(modal.ag.id)} disabled={enviandoPreConsulta}
                      style={{ fontSize: 12, color: '#1F9D5C', background: 'white', padding: '5px 12px', borderRadius: 7, cursor: 'pointer', fontWeight: 600 }}>
                      {enviandoPreConsulta ? 'Enviando...' : 'Enviar'}
                    </button>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
                <button type="submit" disabled={salvando}
                  style={{ flex: 1, padding: '11px', borderRadius: 9, border: 'none', background: '#1F9D5C', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  {salvando ? 'Salvando...' : modal.ag ? 'Salvar alterações' : 'Criar agendamento'}
                </button>
                {modal.ag && (
                  <>
                    <button type="button" onClick={() => {
                      const ag = modal.ag
                      const params = new URLSearchParams()
                      if (ag.paciente_id) params.set('paciente_id', ag.paciente_id)
                      if (ag.pacientes?.nome) params.set('paciente_nome', ag.pacientes.nome)
                      if (ag.pacientes?.telefone) params.set('paciente_tel', ag.pacientes.telefone || '')
                      router.push('/nova-consulta?' + params.toString())
                    }}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#059669', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/></svg>
                      Iniciar consulta
                    </button>
                    <button type="button" onClick={() => deletar(modal.ag.id)}
                      style={{ padding: '11px 16px', borderRadius: 9, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
