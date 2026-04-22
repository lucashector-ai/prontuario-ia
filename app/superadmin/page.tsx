'use client'

import { useState, useEffect } from 'react'
import { useToast } from '@/components/Toast'

const TOKEN = 'media_superadmin_2026'

async function api(action: string, extra?: any) {
  const r = await fetch('/api/superadmin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: TOKEN, action, ...extra }),
  })
  return r.json()
}

type Aba = 'stats' | 'clinicas' | 'medicos'

export default function SuperAdmin() {
  const { toast } = useToast()
  const [autenticado, setAutenticado] = useState(false)
  const [senha, setSenha] = useState('')
  const [aba, setAba] = useState<Aba>('stats')
  const [stats, setStats] = useState<any>(null)
  const [clinicas, setClinicas] = useState<any[]>([])
  const [medicos, setMedicos] = useState<any[]>([])
  const [carregando, setCarregando] = useState(false)
  const [busca, setBusca] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const login = () => {
    if (senha === TOKEN) { setAutenticado(true); carregarStats() }
    else toast('Token incorreto', 'error')
  }

  const carregarStats = async () => {
    setCarregando(true)
    const d = await api('stats')
    setStats(d)
    setCarregando(false)
  }

  const carregarClinicas = async () => {
    setCarregando(true)
    const d = await api('list_clinicas')
    setClinicas(d.clinicas || [])
    setCarregando(false)
  }

  const carregarMedicos = async () => {
    setCarregando(true)
    const d = await api('list_medicos')
    setMedicos(d.medicos || [])
    setCarregando(false)
  }

  useEffect(() => {
    if (!autenticado) return
    if (aba === 'stats') carregarStats()
    if (aba === 'clinicas') carregarClinicas()
    if (aba === 'medicos') carregarMedicos()
  }, [aba, autenticado])

  const deletarMedico = async (id: string) => {
    await api('delete_medico', { medico_id: id })
    setMedicos(prev => prev.filter(m => m.id !== id))
    setConfirmDelete(null)
    toast('Médico removido')
  }

  const deletarClinica = async (id: string) => {
    await api('delete_clinica', { clinica_id: id })
    setClinicas(prev => prev.filter(c => c.id !== id))
    setConfirmDelete(null)
    toast('Clínica removida')
  }

  const alterarPlano = async (clinica_id: string, plano: string) => {
    await api('change_plano', { clinica_id, plano })
    setClinicas(prev => prev.map(c => c.id === clinica_id ? { ...c, plano } : c))
    toast('Plano atualizado')
  }

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })

  if (!autenticado) return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 40, width: 360 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: '#6043C1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'white', margin: 0 }}>MedIA SuperAdmin</p>
            <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>Acesso restrito</p>
          </div>
        </div>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Token de acesso</p>
        <input
          type="password"
          value={senha}
          onChange={e => setSenha(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && login()}
          placeholder="••••••••••••••••"
          style={{ width: '100%', padding: '10px 14px', fontSize: 14, borderRadius: 9, border: '1px solid #334155', background: '#0f172a', color: 'white', outline: 'none', marginBottom: 16, boxSizing: 'border-box' as const, fontFamily: 'monospace' }}
        />
        <button onClick={login} style={{ width: '100%', padding: 12, borderRadius: 9, border: 'none', background: '#6043C1', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          Entrar
        </button>
      </div>
    </div>
  )

  const PLANOS = ['starter', 'pro', 'enterprise']
  const corPlano: Record<string, string> = { starter: '#6043C1', pro: '#0d9488', enterprise: '#d97706' }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: 'white', fontFamily: 'inherit' }}>

      {/* Header */}
      <div style={{ background: '#1e293b', borderBottom: '1px solid #334155', padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: '#6043C1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>MedIA SuperAdmin</span>
          <span style={{ fontSize: 11, color: '#64748b', background: '#334155', padding: '2px 8px', borderRadius: 10 }}>v1.0</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['stats', 'clinicas', 'medicos'] as Aba[]).map(t => (
            <button key={t} onClick={() => setAba(t)} style={{ padding: '6px 14px', borderRadius: 7, border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer', background: aba === t ? '#6043C1' : 'transparent', color: aba === t ? 'white' : '#94a3b8' }}>
              {t === 'stats' ? '📊 Visão geral' : t === 'clinicas' ? '🏥 Clínicas' : '👨‍⚕️ Médicos'}
            </button>
          ))}
          <button onClick={() => setAutenticado(false)} style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid #334155', fontSize: 12, background: 'transparent', color: '#64748b', cursor: 'pointer', marginLeft: 8 }}>Sair</button>
        </div>
      </div>

      <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>

        {/* STATS */}
        {aba === 'stats' && stats && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
              {[
                { label: 'Clínicas', valor: stats.totalClinicas || 0, icon: '🏥', cor: '#6043C1' },
                { label: 'Médicos', valor: stats.totalMedicos || 0, icon: '👨‍⚕️', cor: '#0d9488' },
                { label: 'Consultas', valor: stats.totalConsultas || 0, icon: '📋', cor: '#2563eb' },
                { label: 'Pacientes', valor: stats.totalPacientes || 0, icon: '👥', cor: '#d97706' },
              ].map(m => (
                <div key={m.label} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 14, padding: '20px 24px' }}>
                  <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 10px' }}>{m.icon} {m.label}</p>
                  <p style={{ fontSize: 32, fontWeight: 800, color: m.cor, margin: 0, lineHeight: 1 }}>{m.valor}</p>
                </div>
              ))}
            </div>

            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 14, padding: '20px 24px' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Clínicas por plano</p>
              <div style={{ display: 'flex', gap: 12 }}>
                {Object.entries(stats.planoMap || {}).map(([plano, total]: any) => (
                  <div key={plano} style={{ background: '#0f172a', border: `1px solid ${corPlano[plano] || '#334155'}`, borderRadius: 10, padding: '12px 20px', minWidth: 100, textAlign: 'center' }}>
                    <p style={{ fontSize: 24, fontWeight: 800, color: corPlano[plano] || 'white', margin: '0 0 4px' }}>{total}</p>
                    <p style={{ fontSize: 12, color: '#64748b', margin: 0, textTransform: 'capitalize' }}>{plano}</p>
                  </div>
                ))}
                {Object.keys(stats.planoMap || {}).length === 0 && <p style={{ color: '#64748b', fontSize: 13 }}>Nenhuma clínica cadastrada</p>}
              </div>
            </div>

            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '16px 24px', borderBottom: '1px solid #334155' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Últimos cadastros</p>
              </div>
              {(stats.ultimosCadastros || []).map((m: any) => (
                <div key={m.id} style={{ padding: '12px 24px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'white', margin: 0 }}>{m.nome}</p>
                    <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0' }}>{m.email}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {m.cargo === 'admin' && <span style={{ fontSize: 10, color: '#6043C1', background: '#1e1344', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>admin</span>}
                    <span style={{ fontSize: 11, color: '#64748b' }}>{fmt(m.criado_em)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CLÍNICAS */}
        {aba === 'clinicas' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>{clinicas.length} clínicas cadastradas</p>
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar clínica..." style={{ padding: '7px 12px', fontSize: 12, borderRadius: 8, border: '1px solid #334155', background: '#1e293b', color: 'white', outline: 'none', width: 220 }} />
            </div>
            {carregando ? <p style={{ color: '#64748b' }}>Carregando...</p> : clinicas.filter(c => !busca || c.nome?.toLowerCase().includes(busca.toLowerCase()) || c.email_admin?.toLowerCase().includes(busca.toLowerCase())).map(cl => (
              <div key={cl.id} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: 'white', margin: 0 }}>{cl.nome || 'Sem nome'}</p>
                    <span style={{ fontSize: 10, fontWeight: 700, color: corPlano[cl.plano] || 'white', background: '#0f172a', padding: '1px 8px', borderRadius: 10, border: `1px solid ${corPlano[cl.plano] || '#334155'}` }}>{cl.plano || 'free'}</span>
                    {!cl.ativo && <span style={{ fontSize: 10, color: '#dc2626', background: '#1f0000', padding: '1px 8px', borderRadius: 10 }}>inativa</span>}
                  </div>
                  <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>{cl.email_admin} · {cl.medicos || 0} médicos · desde {fmt(cl.criado_em)}</p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  <select value={cl.plano || 'starter'} onChange={e => alterarPlano(cl.id, e.target.value)}
                    style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid #334155', background: '#0f172a', color: 'white', fontSize: 12, cursor: 'pointer' }}>
                    {PLANOS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  {confirmDelete === cl.id ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => deletarClinica(cl.id)} style={{ padding: '5px 12px', borderRadius: 7, border: 'none', background: '#dc2626', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Confirmar</button>
                      <button onClick={() => setConfirmDelete(null)} style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid #334155', background: 'transparent', color: '#64748b', fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(cl.id)} style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid #7f1d1d', background: '#1f0000', color: '#f87171', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>Excluir</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* MÉDICOS */}
        {aba === 'medicos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>{medicos.length} médicos cadastrados</p>
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar médico..." style={{ padding: '7px 12px', fontSize: 12, borderRadius: 8, border: '1px solid #334155', background: '#1e293b', color: 'white', outline: 'none', width: 220 }} />
            </div>
            {carregando ? <p style={{ color: '#64748b' }}>Carregando...</p> : medicos.filter(m => !busca || m.nome?.toLowerCase().includes(busca.toLowerCase()) || m.email?.toLowerCase().includes(busca.toLowerCase())).map(m => (
              <div key={m.id} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#1e1344', border: '1px solid #6043C1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#6043C1', flexShrink: 0 }}>
                  {m.nome?.split(' ').map((n: string) => n[0]).slice(0,2).join('') || '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'white', margin: 0 }}>{m.nome}</p>
                    {m.cargo === 'admin' && <span style={{ fontSize: 10, color: '#6043C1', background: '#1e1344', padding: '1px 7px', borderRadius: 10, fontWeight: 700 }}>admin</span>}
                    {!m.ativo && <span style={{ fontSize: 10, color: '#dc2626', background: '#1f0000', padding: '1px 7px', borderRadius: 10 }}>inativo</span>}
                  </div>
                  <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>{m.email} · {m.especialidade || 'Sem especialidade'} {m.crm ? '· ' + m.crm : ''} · cadastrado {fmt(m.criado_em)}</p>
                </div>
                <div style={{ flexShrink: 0 }}>
                  {confirmDelete === m.id ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => deletarMedico(m.id)} style={{ padding: '5px 12px', borderRadius: 7, border: 'none', background: '#dc2626', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Confirmar</button>
                      <button onClick={() => setConfirmDelete(null)} style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid #334155', background: 'transparent', color: '#64748b', fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(m.id)} style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid #7f1d1d', background: '#1f0000', color: '#f87171', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>Excluir</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
