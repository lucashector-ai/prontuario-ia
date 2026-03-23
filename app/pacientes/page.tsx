'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

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

  const carregarPacientes = async (medicoId: string) => {
    const res = await fetch(`/api/pacientes?medico_id=${medicoId}`)
    const data = await res.json()
    setPacientes(data.pacientes || [])
    setCarregando(false)
  }

  const salvarPaciente = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!medico) return
    setSalvando(true)
    const res = await fetch('/api/pacientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    const hoje = new Date()
    const dn = new Date(nasc)
    let idade = hoje.getFullYear() - dn.getFullYear()
    if (hoje.getMonth() < dn.getMonth() || (hoje.getMonth() === dn.getMonth() && hoje.getDate() < dn.getDate())) idade--
    return idade
  }

  const pacientesFiltrados = pacientes.filter(p => p.nome.toLowerCase().includes(busca.toLowerCase()))

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/')} className="text-slate-400 hover:text-slate-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7"/>
              </svg>
            </button>
            <h1 className="text-lg font-semibold text-slate-900">Meus pacientes</h1>
          </div>
          <button onClick={() => setMostrarForm(true)}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
            </svg>
            Novo paciente
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {mostrarForm && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h2 className="text-base font-semibold text-slate-800 mb-4">Cadastrar paciente</h2>
            <form onSubmit={salvarPaciente} className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1.5">Nome completo *</label>
                <input required value={form.nome} onChange={e => setForm(f => ({...f, nome: e.target.value}))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="Nome do paciente"/>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1.5">Data de nascimento</label>
                <input type="date" value={form.data_nascimento} onChange={e => setForm(f => ({...f, data_nascimento: e.target.value}))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"/>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1.5">Sexo</label>
                <select value={form.sexo} onChange={e => setForm(f => ({...f, sexo: e.target.value}))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300">
                  <option value="">Selecionar</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Feminino">Feminino</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1.5">Telefone</label>
                <input value={form.telefone} onChange={e => setForm(f => ({...f, telefone: e.target.value}))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="(11) 99999-9999"/>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1.5">E-mail</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="email@paciente.com"/>
              </div>
              <div className="col-span-2 flex gap-3">
                <button type="submit" disabled={salvando}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-400 text-white font-medium py-2.5 rounded-xl transition-colors text-sm">
                  {salvando ? 'Salvando...' : 'Salvar paciente'}
                </button>
                <button type="button" onClick={() => setMostrarForm(false)}
                  className="px-6 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-xl text-sm">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="relative">
          <svg className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input value={busca} onChange={e => setBusca(e.target.value)}
            className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white"
            placeholder="Buscar paciente por nome..."/>
        </div>

        {carregando ? (
          <div className="text-center py-12 text-slate-400 text-sm">Carregando...</div>
        ) : pacientesFiltrados.length === 0 ? (
          <div className="text-center py-12 text-slate-300">
            <svg className="w-10 h-10 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            <p className="text-sm text-slate-400">{busca ? 'Nenhum paciente encontrado' : 'Nenhum paciente cadastrado ainda'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pacientesFiltrados.map((p) => {
              const idade = calcularIdade(p.data_nascimento)
              const iniciais = p.nome.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
              return (
                <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 hover:border-slate-300 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-sm font-semibold text-slate-600 shrink-0">
                    {iniciais}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 text-sm">{p.nome}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {[p.sexo, idade ? `${idade} anos` : null, p.telefone].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
