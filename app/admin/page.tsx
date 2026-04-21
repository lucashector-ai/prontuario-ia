'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Sidebar } from '@/components/Sidebar'
import { useToast } from '@/components/Toast'

export default function Admin() {
  const router = useRouter()
  const { toast } = useToast()
  const [medico, setMedico] = useState<any>(null)
  const [medicos, setMedicos] = useState<any[]>([])
  const [stats, setStats] = useState<Record<string, any>>({})
  const [carregando, setCarregando] = useState(true)
  const [modalNovoMedico, setModalNovoMedico] = useState(false)
  const [form, setForm] = useState({ nome: '', email: '', crm: '', especialidade: '', senha: '' })
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    const m = localStorage.getItem('medico')
    if (!m) { router.push('/login'); return }
    const med = JSON.parse(m)
    if (med.cargo !== 'admin') { router.push('/dashboard'); return }
    setMedico(med)
    carregarDados(med.clinica_id)
  }, [router])

  const carregarDados = async (clinicaId: string) => {
    const { data: meds } = await supabase
      .from('medicos')
      .select('id, nome, email, crm, especialidade, ativo, criado_em, cargo')
      .eq('clinica_id', clinicaId)
      .order('criado_em')

    if (meds) {
      setMedicos(meds)
      const statsMap: Record<string, any> = {}
      await Promise.all(meds.map(async (m: any) => {
        const [{ count: consultas }, { count: pacientes }] = await Promise.all([
          supabase.from('consultas').select('*', { count: 'exact', head: true }).eq('medico_id', m.id),
          supabase.from('pacientes').select('*', { count: 'exact', head: true }).eq('medico_id', m.id),
        ])
        statsMap[m.id] = { consultas: consultas || 0, pacientes: pacientes || 0 }
      }))
      setStats(statsMap)
    }
    setCarregando(false)
  }

  const handleCriarMedico = async () => {
    if (!form.nome || !form.email || !form.senha) { toast('Preencha nome, email e senha', 'error'); return }
    setSalvando(true)
    try {
      const res = await fetch('/api/medicos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, clinica_id: medico.clinica_id }),
      })
      const data = await res.json()
      if (data.medico) {
        setMedicos(prev => [...prev, data.medico])
        setModalNovoMedico(false)
        setForm({ nome: '', email: '', crm: '', especialidade: '', senha: '' })
        toast('Médico cadastrado com sucesso!')
      } else throw new Error(data.error)
    } catch (e: any) { toast(e.message, 'error') }
    finally { setSalvando(false) }
  }

  const toggleAtivo = async (id: string, ativo: boolean) => {
    await supabase.from('medicos').update({ ativo: !ativo }).eq('id', id)
    setMedicos(prev => prev.map(m => m.id === id ? { ...m, ativo: !ativo } : m))
    toast(ativo ? 'Médico desativado' : 'Médico reativado', ativo ? 'error' : 'success')
  }

  if (!medico) return null

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F5F5F5', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h1 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0 }}>Painel administrativo</h1>
            <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>{medicos.length} médico{medicos.length !== 1 ? 's' : ''} na clínica</p>
          </div>
          <button onClick={() => setModalNovoMedico(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#1F9D5C', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Novo médico
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          {carregando ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
              <div style={{ width: 32, height: 32, border: '3px solid #E8F7EF', borderTopColor: '#1F9D5C', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 900 }}>
              {medicos.map(m => (
                <div key={m.id} style={{ background: 'white', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#E8F7EF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#1F9D5C', flexShrink: 0 }}>
                    {m.nome.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 }}>{m.nome}</p>
                      {m.cargo === 'admin' && <span style={{ fontSize: 10, fontWeight: 700, color: '#1F9D5C', background: '#E8F7EF', padding: '1px 7px', borderRadius: 10 }}>admin</span>}
                      {!m.ativo && <span style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', background: '#fef2f2', padding: '1px 7px', borderRadius: 10, border: '1px solid #fecaca' }}>inativo</span>}
                    </div>
                    <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>{m.especialidade || 'Sem especialidade'} {m.crm ? '· CRM ' + m.crm : ''} · {m.email}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 20, flexShrink: 0 }}>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: 18, fontWeight: 800, color: '#111827', margin: 0 }}>{stats[m.id]?.consultas || 0}</p>
                      <p style={{ fontSize: 10, color: '#9ca3af', margin: 0 }}>consultas</p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: 18, fontWeight: 800, color: '#111827', margin: 0 }}>{stats[m.id]?.pacientes || 0}</p>
                      <p style={{ fontSize: 10, color: '#9ca3af', margin: 0 }}>pacientes</p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>desde</p>
                      <p style={{ fontSize: 12, fontWeight: 500, color: '#374151', margin: 0 }}>{fmt(m.criado_em)}</p>
                    </div>
                  </div>
                  {m.id !== medico.id && (
                    <button onClick={() => toggleAtivo(m.id, m.ativo)} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 7, border: m.ativo ? '1px solid #fecaca' : '1px solid #bbf7d0', background: m.ativo ? '#fef2f2' : '#f0fdf4', color: m.ativo ? '#dc2626' : '#16a34a', cursor: 'pointer', fontWeight: 500, flexShrink: 0 }}>
                      {m.ativo ? 'Desativar' : 'Reativar'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {modalNovoMedico && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => { if (e.target === e.currentTarget) setModalNovoMedico(false) }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 24, width: 420 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 20px' }}>Novo médico</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Nome completo *', key: 'nome', placeholder: 'Dr. João Silva' },
                { label: 'E-mail *', key: 'email', placeholder: 'joao@clinica.com.br' },
                { label: 'Senha *', key: 'senha', placeholder: '••••••••', type: 'password' },
                { label: 'CRM', key: 'crm', placeholder: 'CRM/SP 123456' },
                { label: 'Especialidade', key: 'especialidade', placeholder: 'Clínico Geral' },
              ].map(f => (
                <div key={f.key}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: '#374151', margin: '0 0 5px' }}>{f.label}</p>
                  <input
                    type={f.type || 'text'}
                    value={(form as any)[f.key]}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 8, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setModalNovoMedico(false)} style={{ padding: '9px 18px', borderRadius: 8, background: 'white', color: '#6b7280', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleCriarMedico} disabled={salvando} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#1F9D5C', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {salvando ? 'Salvando...' : 'Criar médico'}
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )
}
