'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImportarPacientes } from '@/components/ImportarPacientes'

const ACCENT = '#6043C1'
const ACCENT_LIGHT = '#ede9fb'
const BG = '#F5F5F5'
const CARD_RADIUS = 16

function formatarTelefone(v: string) {
  const nums = v.replace(/\D/g, '').slice(0, 11)
  if (nums.length <= 2) return nums
  if (nums.length <= 6) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`
  if (nums.length <= 10) return `(${nums.slice(0, 2)}) ${nums.slice(2, 6)}-${nums.slice(6)}`
  return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7)}`
}

function formatarCPF(v: string) {
  const nums = v.replace(/\D/g, '').slice(0, 11)
  if (nums.length <= 3) return nums
  if (nums.length <= 6) return `${nums.slice(0, 3)}.${nums.slice(3)}`
  if (nums.length <= 9) return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6)}`
  return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6, 9)}-${nums.slice(9)}`
}

export default function Pacientes() {
  const router = useRouter()
  const [medico, setMedico] = useState<any>(null)
  const [pacientes, setPacientes] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [mostrarImport, setMostrarImport] = useState(false)
  const [form, setForm] = useState({ nome: '', data_nascimento: '', sexo: '', telefone: '', email: '', cpf: '' })
  const [salvando, setSalvando] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtroSexo, setFiltroSexo] = useState('todos')
  const [filtroConvenio, setFiltroConvenio] = useState('todos')
  const [ordenar, setOrdenar] = useState<'nome' | 'recente'>('nome')
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro', texto: string } | null>(null)

  useEffect(() => {
    const ca_ = localStorage.getItem('clinica_admin')
    const m = ca_ || localStorage.getItem('medico')
    if (!m) { router.push('/login'); return }
    const med = JSON.parse(m)
    setMedico(med)
    carregarPacientes(med.id)
  }, [router])

  const carregarPacientes = async (id: string) => {
    setCarregando(true)
    // Se for clinica admin, busca pacientes de todos medicos da clinica
    const ca = localStorage.getItem('clinica_admin')
    let url = '/api/pacientes?medico_id=' + id
    if (ca) {
      const admin = JSON.parse(ca)
      if (admin.clinica_id) url = '/api/pacientes?clinica_id=' + admin.clinica_id
    }
    const res = await fetch(url)
    const data = await res.json()
    setPacientes(data.pacientes || [])
    setCarregando(false)
  }

  const mostrarMsg = (tipo: 'ok' | 'erro', texto: string) => {
    setMsg({ tipo, texto })
    setTimeout(() => setMsg(null), 3500)
  }

  const salvarPaciente = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!medico) return
    setSalvando(true)
    const res = await fetch('/api/pacientes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, medico_id: medico.id }),
    })
    const data = await res.json()
    if (data.paciente) {
      router.push(`/pacientes/${data.paciente.id}`)
    } else {
      mostrarMsg('erro', data.error || 'Erro ao cadastrar')
    }
    setSalvando(false)
  }

  const deletar = async (e: React.MouseEvent, p: any) => {
    e.stopPropagation()
    if (!confirm(`Deletar ${p.nome}? Isso remove todas as consultas e agendamentos.`)) return
    await fetch(`/api/pacientes?id=${p.id}`, { method: 'DELETE' })
    setPacientes(prev => prev.filter(x => x.id !== p.id))
    mostrarMsg('ok', 'Paciente removido')
  }

  const calcularIdade = (nasc: string) => {
    if (!nasc) return null
    const hoje = new Date(); const dn = new Date(nasc)
    let idade = hoje.getFullYear() - dn.getFullYear()
    if (hoje.getMonth() < dn.getMonth() || (hoje.getMonth() === dn.getMonth() && hoje.getDate() < dn.getDate())) idade--
    return idade
  }

  const pacientesFiltrados = pacientes
    .filter(p => {
      if (busca && !(p.nome || '').toLowerCase().includes(busca.toLowerCase()) && !(p.telefone || '').includes(busca)) return false
      if (filtroSexo !== 'todos' && p.sexo !== filtroSexo) return false
      if (filtroConvenio === 'particular' && p.convenio && p.convenio !== 'Particular') return false
      if (filtroConvenio === 'convenio' && (!p.convenio || p.convenio === 'Particular')) return false
      return true
    })
    .sort((a, b) => ordenar === 'nome'
      ? (a.nome || '').localeCompare(b.nome || '')
      : new Date(b.criado_em || 0).getTime() - new Date(a.criado_em || 0).getTime()
    )

  // Cores de avatar por hash do nome (visual mais interessante)
  const coresAvatar = [
    { bg: '#ede9fb', fg: '#6043C1' },
    { bg: '#dbeafe', fg: '#2563eb' },
    { bg: '#dcfce7', fg: '#16a34a' },
    { bg: '#fef3c7', fg: '#d97706' },
    { bg: '#fce7f3', fg: '#db2777' },
    { bg: '#e0f2fe', fg: '#0284c7' },
  ]
  const getCorAvatar = (nome: string) => {
    let hash = 0
    for (let i = 0; i < nome.length; i++) hash = nome.charCodeAt(i) + ((hash << 5) - hash)
    return coresAvatar[Math.abs(hash) % coresAvatar.length]
  }

  const totalHomens = pacientes.filter(p => p.sexo === 'Masculino').length
  const totalMulheres = pacientes.filter(p => p.sexo === 'Feminino').length
  const filtroAtivo = busca || filtroSexo !== 'todos' || filtroConvenio !== 'todos'

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', fontSize: 14,
    borderRadius: 10, border: '1px solid #e5e7eb',
    outline: 'none', fontFamily: 'inherit', color: '#111827',
    background: 'white', boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: '#6b7280',
    display: 'block', marginBottom: 6,
    textTransform: 'uppercase' as const, letterSpacing: '0.04em',
  }

  return (
    <main style={{ height: '100%', overflow: 'auto', padding: 24, background: BG }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Meus pacientes</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
            {pacientes.length} paciente{pacientes.length !== 1 ? 's' : ''} cadastrado{pacientes.length !== 1 ? 's' : ''}
            {totalHomens + totalMulheres > 0 && ` · ${totalHomens} ${totalHomens === 1 ? 'homem' : 'homens'}, ${totalMulheres} ${totalMulheres === 1 ? 'mulher' : 'mulheres'}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={() => setMostrarImport(true)} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '10px 16px', borderRadius: 10,
            border: '1px solid #e5e7eb', background: 'white',
            color: '#374151',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
            </svg>
            Importar
          </button>
          <button onClick={() => setMostrarForm(true)} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '10px 18px', borderRadius: 10, border: 'none',
            background: ACCENT, color: 'white',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Novo paciente
          </button>
        </div>
      </div>

      {/* Toast */}
      {msg && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 200,
          padding: '12px 20px', borderRadius: 10,
          background: msg.tipo === 'ok' ? '#ecfdf5' : '#fef2f2',
          color: msg.tipo === 'ok' ? '#065f46' : '#991b1b',
          fontSize: 13, fontWeight: 600,
          border: `1px solid ${msg.tipo === 'ok' ? '#a7f3d0' : '#fecaca'}`,
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        }}>
          {msg.texto}
        </div>
      )}

      {/* Modal de novo paciente */}
      {mostrarForm && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setMostrarForm(false) }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
        >
          <div style={{ background: 'white', borderRadius: CARD_RADIUS, padding: 28, width: '100%', maxWidth: 520 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Novo paciente</h2>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 20px' }}>Preencha os dados principais pra começar</p>

            <form onSubmit={salvarPaciente} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Nome completo *</label>
                <input
                  required
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  style={inputStyle}
                  placeholder="Nome completo do paciente"
                  autoFocus
                />
              </div>

              <div>
                <label style={labelStyle}>CPF</label>
                <input
                  value={form.cpf}
                  onChange={e => setForm(f => ({ ...f, cpf: formatarCPF(e.target.value) }))}
                  style={inputStyle}
                  placeholder="000.000.000-00"
                  maxLength={14}
                />
              </div>

              <div>
                <label style={labelStyle}>Data de nascimento</label>
                <input
                  type="date"
                  value={form.data_nascimento}
                  onChange={e => setForm(f => ({ ...f, data_nascimento: e.target.value }))}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Telefone</label>
                <input
                  value={form.telefone}
                  onChange={e => setForm(f => ({ ...f, telefone: formatarTelefone(e.target.value) }))}
                  style={inputStyle}
                  placeholder="(11) 99999-9999"
                  maxLength={15}
                />
              </div>

              <div>
                <label style={labelStyle}>Sexo</label>
                <select
                  value={form.sexo}
                  onChange={e => setForm(f => ({ ...f, sexo: e.target.value }))}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  <option value="">Selecionar</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Feminino">Feminino</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>E-mail</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  style={inputStyle}
                  placeholder="email@paciente.com"
                />
              </div>

              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setMostrarForm(false)}
                  style={{
                    padding: '12px 20px', borderRadius: 10,
                    background: 'white', color: '#6b7280',
                    border: '1px solid #e5e7eb',
                    fontSize: 13, cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  style={{
                    flex: 1, padding: '12px 20px', borderRadius: 10, border: 'none',
                    background: salvando ? '#9ca3af' : ACCENT,
                    color: 'white', fontSize: 13, fontWeight: 700,
                    cursor: salvando ? 'not-allowed' : 'pointer',
                  }}
                >
                  {salvando ? 'Cadastrando...' : 'Cadastrar e abrir ficha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barra de busca */}
      <div style={{
        background: 'white', borderRadius: 12,
        padding: '10px 16px', marginBottom: 14,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/>
          <path d="M21 21l-4.35-4.35"/>
        </svg>
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome ou telefone..."
          style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 14, outline: 'none', color: '#374151' }}
        />
        {busca && (
          <button
            onClick={() => setBusca('')}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0, display: 'flex' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>

      {/* Chips de filtro */}
      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8, marginBottom: 16, alignItems: 'center' }}>
        {/* Chips sexo */}
        {([
          { v: 'todos', label: 'Todos' },
          { v: 'Masculino', label: 'Masculino' },
          { v: 'Feminino', label: 'Feminino' },
        ] as const).map(opt => {
          const ativo = filtroSexo === opt.v
          return (
            <button
              key={opt.v}
              onClick={() => setFiltroSexo(opt.v)}
              style={{
                padding: '7px 14px', borderRadius: 20,
                border: `1px solid ${ativo ? ACCENT : '#e5e7eb'}`,
                background: ativo ? ACCENT : 'white',
                color: ativo ? 'white' : '#374151',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {opt.label}
            </button>
          )
        })}

        <div style={{ width: 1, height: 20, background: '#e5e7eb', margin: '0 4px' }}/>

        {/* Chips convenio */}
        {([
          { v: 'todos', label: 'Todos convênios' },
          { v: 'particular', label: 'Particular' },
          { v: 'convenio', label: 'Com convênio' },
        ] as const).map(opt => {
          const ativo = filtroConvenio === opt.v
          return (
            <button
              key={opt.v}
              onClick={() => setFiltroConvenio(opt.v)}
              style={{
                padding: '7px 14px', borderRadius: 20,
                border: `1px solid ${ativo ? ACCENT : '#e5e7eb'}`,
                background: ativo ? ACCENT : 'white',
                color: ativo ? 'white' : '#374151',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {opt.label}
            </button>
          )
        })}

        <div style={{ width: 1, height: 20, background: '#e5e7eb', margin: '0 4px' }}/>

        {/* Ordenação */}
        <select
          value={ordenar}
          onChange={e => setOrdenar(e.target.value as 'nome' | 'recente')}
          style={{
            padding: '7px 12px', borderRadius: 20,
            border: '1px solid #e5e7eb', background: 'white',
            fontSize: 12, color: '#374151', cursor: 'pointer',
          }}
        >
          <option value="nome">Ordenar: A → Z</option>
          <option value="recente">Ordenar: Mais recentes</option>
        </select>

        {filtroAtivo && (
          <button
            onClick={() => { setFiltroSexo('todos'); setFiltroConvenio('todos'); setBusca('') }}
            style={{
              padding: '7px 12px', borderRadius: 20,
              border: '1px solid #fecaca',
              background: '#fef2f2', color: '#dc2626',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              marginLeft: 'auto',
            }}
          >
            Limpar filtros
          </button>
        )}

        <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: filtroAtivo ? 0 : 'auto' }}>
          {pacientesFiltrados.length} resultado{pacientesFiltrados.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Lista */}
      {carregando ? (
        <div style={{ background: 'white', borderRadius: CARD_RADIUS, padding: 60, display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 32, height: 32, border: `3px solid ${ACCENT_LIGHT}`, borderTopColor: ACCENT, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}/>
        </div>
      ) : pacientesFiltrados.length === 0 ? (
        <div style={{
          background: 'white', borderRadius: CARD_RADIUS, padding: 48,
          textAlign: 'center' as const,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: ACCENT_LIGHT, color: ACCENT,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px',
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87"/>
              <path d="M16 3.13a4 4 0 010 7.75"/>
            </svg>
          </div>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
            {filtroAtivo ? 'Nenhum paciente encontrado' : 'Nenhum paciente cadastrado ainda'}
          </p>
          <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>
            {filtroAtivo ? 'Tente ajustar os filtros ou a busca' : 'Clique em "+ Novo paciente" pra começar'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pacientesFiltrados.map(p => {
            const idade = calcularIdade(p.data_nascimento)
            const ini = (p.nome || '').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
            const cor = getCorAvatar(p.nome || '')
            return (
              <div
                key={p.id}
                onClick={() => router.push(`/pacientes/${p.id}`)}
                style={{
                  background: 'white', borderRadius: CARD_RADIUS,
                  padding: '16px 20px',
                  display: 'flex', alignItems: 'center', gap: 16,
                  cursor: 'pointer',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'none'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: cor.bg, color: cor.fg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, fontWeight: 700, flexShrink: 0,
                }}>
                  {ini || '?'}
                </div>

                {/* Info principal */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 3px' }}>
                    {p.nome}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const, fontSize: 12, color: '#6b7280' }}>
                    {p.sexo && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {p.sexo === 'Masculino' ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="10" cy="14" r="5"/>
                            <line x1="14" y1="10" x2="21" y2="3"/>
                            <polyline points="21 9 21 3 15 3"/>
                          </svg>
                        ) : p.sexo === 'Feminino' ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="8" r="5"/>
                            <line x1="12" y1="13" x2="12" y2="21"/>
                            <line x1="9" y1="18" x2="15" y2="18"/>
                          </svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"/>
                          </svg>
                        )}
                        {p.sexo}
                      </span>
                    )}
                    {idade !== null && (
                      <span>{idade} anos</span>
                    )}
                    {p.telefone && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
                        </svg>
                        {p.telefone}
                      </span>
                    )}
                    {p.email && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                          <polyline points="22,6 12,13 2,6"/>
                        </svg>
                        {p.email}
                      </span>
                    )}
                  </div>
                </div>

                {/* Badge do medico (so aparece pra clinica admin que ve varios medicos) */}
                {p.medico && p.medico.nome && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 10px', borderRadius: 20,
                    background: '#ede9fb',
                    flexShrink: 0,
                  }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%',
                      background: '#6043C1', color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 700,
                    }}>
                      {(p.medico.nome || '').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#6043C1', whiteSpace: 'nowrap' as const }}>
                      {(() => {
                        const partes = (p.medico.nome || '').split(' ')
                        const primeiro = partes[0] || ''
                        return 'Dr. ' + primeiro
                      })()}
                    </span>
                  </div>
                )}

                {/* Ações */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <button
                    onClick={(e) => deletar(e, p)}
                    title="Remover paciente"
                    style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: 'transparent', border: 'none',
                      cursor: 'pointer', color: '#d1d5db',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#dc2626' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#d1d5db' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                    </svg>
                  </button>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#d1d5db',
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18l6-6-6-6"/>
                    </svg>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ImportarPacientes
        aberto={mostrarImport}
        onFechar={() => setMostrarImport(false)}
        onImportado={() => { if (medico) carregarPacientes(medico.id) }}
        medicoId={medico?.id || ''}
        clinicaId={medico?.clinica_id || ''}
      />

      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </main>
  )
}
