'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'

export default function Pacientes() {
  const router = useRouter()
  const [medico, setMedico] = useState<any>(null)
  const [pacientes, setPacientes] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState({ nome: '', data_nascimento: '', sexo: '', telefone: '', email: '', cpf: '' })
  const [salvando, setSalvando] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtroSexo, setFiltroSexo] = useState('')
  const [filtroConvenio, setFiltroConvenio] = useState('')
  const [ordenar, setOrdenar] = useState('nome')

  useEffect(() => {
    const m = localStorage.getItem('medico')
    if (!m) { router.push('/login'); return }
    const med = JSON.parse(m)
    setMedico(med)
    carregarPacientes(med.id)
  }, [router])

  const carregarPacientes = async (id: string) => {
    const res = await fetch(`/api/pacientes?medico_id=${id}`)
    const data = await res.json()
    setPacientes(data.pacientes || [])
    setCarregando(false)
  }

  const salvarPaciente = async (e: React.FormEvent) => {
    e.preventDefault(); if (!medico) return
    setSalvando(true)
    const res = await fetch('/api/pacientes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, medico_id: medico.id }),
    })
    const data = await res.json()
    if (data.paciente) {
      router.push(`/pacientes/${data.paciente.id}`)
    }
    setSalvando(false)
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
      if (filtroSexo && p.sexo !== filtroSexo) return false
      if (filtroConvenio === 'particular' && p.convenio && p.convenio !== 'Particular') return false
      if (filtroConvenio === 'convenio' && (!p.convenio || p.convenio === 'Particular')) return false
      return true
    })
    .sort((a, b) => ordenar === 'nome' ? (a.nome || '').localeCompare(b.nome || '') : new Date(b.criado_em || 0).getTime() - new Date(a.criado_em || 0).getTime())

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F9FAFC', overflow: 'hidden' }}>
      <Sidebar />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '0 28px', height: 56, borderBottom: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h1 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0 }}>Meus pacientes</h1>
            <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>{pacientes.length} paciente{pacientes.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => setMostrarForm(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 16px', borderRadius: 8, border: 'none', background: '#6043C1', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Novo paciente
          </button>
        </div>

        {/* Filtros */}
        <div style={{ padding: '8px 28px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={filtroSexo} onChange={e => setFiltroSexo(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, color: '#374151', background: 'white', cursor: 'pointer' }}>
            <option value="">Todos os sexos</option>
            <option value="M">Masculino</option>
            <option value="F">Feminino</option>
          </select>
          <select value={filtroConvenio} onChange={e => setFiltroConvenio(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, color: '#374151', background: 'white', cursor: 'pointer' }}>
            <option value="">Todos os convênios</option>
            <option value="particular">Particular</option>
            <option value="convenio">Com convênio</option>
          </select>
          <select value={ordenar} onChange={e => setOrdenar(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, color: '#374151', background: 'white', cursor: 'pointer' }}>
            <option value="nome">A → Z</option>
            <option value="recente">Mais recentes</option>
          </select>
          {(filtroSexo || filtroConvenio || busca) && (
            <button onClick={() => { setFiltroSexo(''); setFiltroConvenio(''); setBusca('') }}
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #fecaca', fontSize: 12, color: '#dc2626', background: '#fef2f2', cursor: 'pointer' }}>
              Limpar filtros
            </button>
          )}
          <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 4 }}>{pacientesFiltrados.length} resultado{pacientesFiltrados.length !== 1 ? 's' : ''}</span>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          <div style={{ maxWidth: 760, margin: '0 auto' }}>

            {mostrarForm && (
              <div style={{ background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', borderRadius: 14, padding: 24, marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0 }}>Cadastrar novo paciente</h2>
                  <button onClick={() => setMostrarForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 18 }}>✕</button>
                </div>
                <form onSubmit={salvarPaciente} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Nome completo *</label>
                    <input required value={form.nome} onChange={e => setForm(f => ({...f, nome: e.target.value}))}
                      style={{ width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 8, border: '1.5px solid #e5e7eb' }} placeholder="Nome completo do paciente"/>
                  </div>
                  {[
                    { label: 'CPF', key: 'cpf', type: 'text', placeholder: '000.000.000-00' },
                    { label: 'Data de nascimento', key: 'data_nascimento', type: 'date', placeholder: '' },
                    { label: 'Telefone', key: 'telefone', type: 'text', placeholder: '(11) 99999-9999' },
                    { label: 'E-mail', key: 'email', type: 'email', placeholder: 'email@paciente.com' },
                  ].map(({ label, key, type, placeholder }) => (
                    <div key={key}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>{label}</label>
                      <input type={type} value={(form as any)[key]} onChange={e => setForm(f => ({...f, [key]: e.target.value}))}
                        style={{ width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 8, border: '1.5px solid #e5e7eb' }} placeholder={placeholder}/>
                    </div>
                  ))}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Sexo</label>
                    <select value={form.sexo} onChange={e => setForm(f => ({...f, sexo: e.target.value}))}
                      style={{ width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 8, border: '1.5px solid #e5e7eb' }}>
                      <option value="">Selecionar</option>
                      <option value="Masculino">Masculino</option>
                      <option value="Feminino">Feminino</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>
                  <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10 }}>
                    <button type="submit" disabled={salvando} style={{ flex: 1, padding: '11px', borderRadius: 9, border: 'none', background: '#6043C1', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      {salvando ? 'Cadastrando...' : 'Cadastrar e abrir ficha'}
                    </button>
                    <button type="button" onClick={() => setMostrarForm(false)} style={{ padding: '11px 20px', borderRadius: 9, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', background: 'white', color: '#6b7280', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
                  </div>
                </form>
              </div>
            )}

            <div style={{ position: 'relative', marginBottom: 16 }}>
              <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input value={busca} onChange={e => setBusca(e.target.value)}
                style={{ width: '100%', padding: '10px 12px 10px 36px', fontSize: 13, borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', background: 'white' }}
                placeholder="Buscar paciente por nome ou telefone..."/>
            </div>

            {carregando ? (
              <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, padding: 40 }}>Carregando...</p>
            ) : pacientesFiltrados.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60 }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: '#f3f0fd', border: '1.5px solid #d4c9f7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#6043C1" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8z"/></svg>
                </div>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#374151', margin: '0 0 6px' }}>{busca ? 'Nenhum paciente encontrado' : 'Nenhum paciente cadastrado'}</p>
                <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>{busca ? 'Tente outro nome' : 'Clique em "Novo paciente" para começar'}</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pacientesFiltrados.map(p => {
                  const idade = calcularIdade(p.data_nascimento)
                  const ini = p.nome.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
                  return (
                    <div key={p.id} onClick={() => router.push(`/pacientes/${p.id}`)}
                      style={{ background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', transition: 'all 0.15s' }}
                      onMouseOver={e => { e.currentTarget.style.borderColor = '#d4c9f7'; e.currentTarget.style.background = '#fafffe' }}
                      onMouseOut={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.background = 'white' }}>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#f3f0fd', border: '1.5px solid #d4c9f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#6043C1', flexShrink: 0 }}>{ini}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 }}>{p.nome}</p>
                        <p style={{ fontSize: 12, color: '#9ca3af', margin: '2px 0 0' }}>{[p.sexo, idade ? `${idade} anos` : null, p.telefone].filter(Boolean).join(' · ')}</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={e=>e.stopPropagation()}>
                        {p.email && <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>{p.email}</p>}
                        <button onClick={async(e)=>{
                          e.stopPropagation()
                          if(!confirm(`Deletar ${p.nome}? Isso remove todas as consultas e agendamentos.`)) return
                          await fetch(`/api/pacientes?id=${p.id}`,{method:'DELETE'})
                          setPacientes((prev:any[])=>prev.filter((x:any)=>x.id!==p.id))
                        }} style={{background:'none',border:'none',cursor:'pointer',color:'#ef4444',padding:'4px 6px',borderRadius:6,fontSize:11,opacity:0.6,transition:'opacity 0.15s'}}
                        onMouseOver={e=>(e.currentTarget.style.opacity='1')}
                        onMouseOut={e=>(e.currentTarget.style.opacity='0.6')}>
                          🗑
                        </button>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
