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
  const [form, setForm] = useState({ nome: '', data_nascimento: '', sexo: '', telefone: '', email: '' })
  const [salvando, setSalvando] = useState(false)
  const [busca, setBusca] = useState('')

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
      setPacientes(prev => [data.paciente, ...prev])
      setForm({ nome: '', data_nascimento: '', sexo: '', telefone: '', email: '' })
      setMostrarForm(false)
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

  const filtrados = pacientes.filter(p => p.nome.toLowerCase().includes(busca.toLowerCase()))

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f8fafb', overflow: 'hidden' }}>
      <Sidebar activeHref="/pacientes" />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '16px 28px', borderBottom: '1px solid #e8eeed', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: '#0d1f1c', margin: 0 }}>Meus pacientes</h1>
            <p style={{ fontSize: 12, color: '#8aa8a5', margin: 0 }}>{pacientes.length} paciente{pacientes.length !== 1 ? 's' : ''} cadastrado{pacientes.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => setMostrarForm(true)} style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 8,
            background: '#16a34a', border: 'none', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Novo paciente
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 28 }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>

            {/* Form modal inline */}
            {mostrarForm && (
              <div style={{ background: 'white', border: '1px solid #e8eeed', borderRadius: 14, padding: 24, marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0d1f1c', margin: 0 }}>Cadastrar paciente</h2>
                  <button onClick={() => setMostrarForm(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#8aa8a5', fontSize: 18 }}>✕</button>
                </div>
                <form onSubmit={salvarPaciente} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  {[
                    { label: 'Nome completo', key: 'nome', type: 'text', placeholder: 'Nome do paciente', full: true, required: true },
                    { label: 'Data de nascimento', key: 'data_nascimento', type: 'date', placeholder: '', full: false, required: false },
                    { label: 'Telefone', key: 'telefone', type: 'text', placeholder: '(11) 99999-9999', full: false, required: false },
                    { label: 'E-mail', key: 'email', type: 'email', placeholder: 'email@paciente.com', full: false, required: false },
                  ].map(({ label, key, type, placeholder, full, required }) => (
                    <div key={key} style={{ gridColumn: full ? '1 / -1' : 'span 1' }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#8aa8a5', display: 'block', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        {label}{required && <span style={{ color: '#16a34a', marginLeft: 3 }}>*</span>}
                      </label>
                      <input type={type} required={required} value={(form as any)[key]}
                        onChange={e => setForm(f => ({...f, [key]: e.target.value}))}
                        style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8 }}
                        placeholder={placeholder}/>
                    </div>
                  ))}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#8aa8a5', display: 'block', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Sexo</label>
                    <select value={form.sexo} onChange={e => setForm(f => ({...f, sexo: e.target.value}))}
                      style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8 }}>
                      <option value="">Selecionar</option>
                      <option value="Masculino">Masculino</option>
                      <option value="Feminino">Feminino</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>
                  <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10 }}>
                    <button type="submit" disabled={salvando} style={{ flex: 1, padding: '10px', borderRadius: 9, border: 'none', background: '#16a34a', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      {salvando ? 'Salvando...' : 'Salvar paciente'}
                    </button>
                    <button type="button" onClick={() => setMostrarForm(false)} style={{ padding: '10px 20px', borderRadius: 9, border: '1px solid #e8eeed', background: 'white', color: '#3d5452', fontSize: 13, cursor: 'pointer' }}>
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Busca */}
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8aa8a5" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input value={busca} onChange={e => setBusca(e.target.value)}
                style={{ width: '100%', padding: '10px 12px 10px 36px', fontSize: 13, borderRadius: 10, background: 'white' }}
                placeholder="Buscar paciente por nome..."/>
            </div>

            {/* Lista */}
            {carregando ? (
              <p style={{ textAlign: 'center', color: '#8aa8a5', fontSize: 13, padding: 40 }}>Carregando...</p>
            ) : filtrados.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60 }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: '#f0fdf4', border: '1.5px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
                </div>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#0d1f1c', margin: '0 0 6px' }}>
                  {busca ? 'Nenhum paciente encontrado' : 'Nenhum paciente cadastrado'}
                </p>
                <p style={{ fontSize: 13, color: '#8aa8a5', margin: 0 }}>
                  {busca ? 'Tente outro nome' : 'Clique em "Novo paciente" para começar'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filtrados.map(p => {
                  const idade = calcularIdade(p.data_nascimento)
                  const ini = p.nome.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
                  return (
                    <div key={p.id} style={{ background: 'white', border: '1px solid #e8eeed', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, transition: 'border-color 0.15s' }}>
                      <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#f0fdf4', border: '1.5px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#16a34a', flexShrink: 0 }}>
                        {ini}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 600, color: '#0d1f1c', margin: 0 }}>{p.nome}</p>
                        <p style={{ fontSize: 12, color: '#8aa8a5', margin: '2px 0 0' }}>
                          {[p.sexo, idade ? `${idade} anos` : null, p.telefone].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      {p.email && <p style={{ fontSize: 12, color: '#8aa8a5', margin: 0 }}>{p.email}</p>}
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
