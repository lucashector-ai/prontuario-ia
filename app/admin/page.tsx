'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

const ACCENT = '#1F9D5C'
const ACCENT_LIGHT = '#E8F7EF'
const BG = '#F5F5F5'
const CARD_RADIUS = 16

export default function Admin() {
  const router = useRouter()
  const { toast } = useToast()
  const [medico, setMedico] = useState<any>(null)
  const [medicos, setMedicos] = useState<any[]>([])
  const [stats, setStats] = useState<Record<string, any>>({})
  const [kpis, setKpis] = useState({ totalPacientes: 0, consultasMes: 0, consultasTotal: 0 })
  const [carregando, setCarregando] = useState(true)
  const [modalNovoMedico, setModalNovoMedico] = useState(false)
  const [modalEditar, setModalEditar] = useState<any>(null)
  const [modalExcluir, setModalExcluir] = useState<any>(null)
  const [form, setForm] = useState({ nome: '', email: '', crm: '', especialidade: '', senha: '' })
  const [formEditar, setFormEditar] = useState({ nome: '', email: '', crm: '', especialidade: '', cargo: 'medico' })
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
    setCarregando(true)
    const { data: meds } = await supabase
      .from('medicos')
      .select('id, nome, email, crm, especialidade, ativo, criado_em, cargo, telefone, foto_url')
      .eq('clinica_id', clinicaId)
      .order('criado_em')

    if (meds) {
      setMedicos(meds)
      const statsMap: Record<string, any> = {}
      let totalConsultas = 0
      let totalConsultasMes = 0
      let totalPacientes = 0
      const inicioMes = new Date()
      inicioMes.setDate(1)
      inicioMes.setHours(0, 0, 0, 0)

      await Promise.all(meds.map(async (m: any) => {
        const [{ count: consultas }, { count: consultasMes }, { count: pacientes }] = await Promise.all([
          supabase.from('consultas').select('*', { count: 'exact', head: true }).eq('medico_id', m.id),
          supabase.from('consultas').select('*', { count: 'exact', head: true }).eq('medico_id', m.id).gte('criado_em', inicioMes.toISOString()),
          supabase.from('pacientes').select('*', { count: 'exact', head: true }).eq('medico_id', m.id),
        ])
        statsMap[m.id] = {
          consultas: consultas || 0,
          consultasMes: consultasMes || 0,
          pacientes: pacientes || 0,
        }
        totalConsultas += consultas || 0
        totalConsultasMes += consultasMes || 0
        totalPacientes += pacientes || 0
      }))
      setStats(statsMap)
      setKpis({ totalPacientes, consultasMes: totalConsultasMes, consultasTotal: totalConsultas })
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
        await carregarDados(medico.clinica_id)
      } else throw new Error(data.error)
    } catch (e: any) { toast(e.message, 'error') }
    finally { setSalvando(false) }
  }

  const handleEditarMedico = async () => {
    if (!modalEditar) return
    setSalvando(true)
    try {
      const res = await fetch(`/api/medicos/${modalEditar.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formEditar),
      })
      const data = await res.json()
      if (data.medico) {
        setMedicos(prev => prev.map(m => m.id === modalEditar.id ? { ...m, ...formEditar } : m))
        setModalEditar(null)
        toast('Médico atualizado!')
      } else throw new Error(data.error)
    } catch (e: any) { toast(e.message, 'error') }
    finally { setSalvando(false) }
  }

  const handleExcluir = async () => {
    if (!modalExcluir) return
    setSalvando(true)
    try {
      const res = await fetch(`/api/medicos/${modalExcluir.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.ok) {
        setMedicos(prev => prev.filter(m => m.id !== modalExcluir.id))
        setModalExcluir(null)
        toast('Médico excluído')
      } else throw new Error(data.error)
    } catch (e: any) { toast(e.message, 'error') }
    finally { setSalvando(false) }
  }

  const toggleAtivo = async (id: string, ativo: boolean) => {
    await supabase.from('medicos').update({ ativo: !ativo }).eq('id', id)
    setMedicos(prev => prev.map(m => m.id === id ? { ...m, ativo: !ativo } : m))
    toast(ativo ? 'Médico desativado' : 'Médico reativado', ativo ? 'error' : 'success')
  }

  const abrirEditar = (m: any) => {
    setFormEditar({
      nome: m.nome || '',
      email: m.email || '',
      crm: m.crm || '',
      especialidade: m.especialidade || '',
      cargo: m.cargo || 'medico',
    })
    setModalEditar(m)
  }

  if (!medico) return null

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    fontSize: 14,
    borderRadius: 10,
    border: '1px solid #e5e7eb',
    background: 'white',
    outline: 'none',
    boxSizing: 'border-box',
    color: '#111827',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: '#6b7280',
    display: 'block',
    marginBottom: 6,
  }

  return (
    <main style={{ height: '100%', overflow: 'auto', padding: 24, background: BG }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Painel administrativo</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
            {medicos.length} médico{medicos.length !== 1 ? 's' : ''} na clínica · gerencie equipe e veja métricas
          </p>
        </div>
        <button onClick={() => setModalNovoMedico(true)} style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '10px 18px', borderRadius: 10, border: 'none',
          background: ACCENT, color: 'white',
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
          flexShrink: 0,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Novo médico
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total de médicos', valor: medicos.length, sub: `${medicos.filter(m => m.ativo).length} ativos` },
          { label: 'Pacientes cadastrados', valor: kpis.totalPacientes, sub: 'na clínica' },
          { label: 'Consultas este mês', valor: kpis.consultasMes, sub: 'todos os médicos' },
          { label: 'Consultas totais', valor: kpis.consultasTotal, sub: 'desde o início' },
        ].map(k => (
          <div key={k.label} style={{ background: 'white', borderRadius: CARD_RADIUS, padding: 20 }}>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 8px', fontWeight: 500 }}>{k.label}</p>
            <p style={{ fontSize: 28, fontWeight: 700, color: '#111827', margin: '0 0 4px', lineHeight: 1 }}>{k.valor}</p>
            <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Lista de médicos */}
      <h2 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 12px' }}>Médicos da clínica</h2>

      {carregando ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 32, height: 32, border: `3px solid ${ACCENT_LIGHT}`, borderTopColor: ACCENT, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {medicos.map(m => {
            const s = stats[m.id] || { consultas: 0, consultasMes: 0, pacientes: 0 }
            const iniciais = m.nome.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
            return (
              <div key={m.id} style={{
                background: 'white', borderRadius: CARD_RADIUS, padding: 20,
                display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, alignItems: 'center',
                opacity: m.ativo ? 1 : 0.6,
              }}>
                {/* Esquerda: identidade + métricas */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
                  {m.foto_url ? (
                    <img src={m.foto_url} style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}/>
                  ) : (
                    <div style={{
                      width: 52, height: 52, borderRadius: '50%',
                      background: ACCENT_LIGHT, color: ACCENT,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, fontWeight: 700, flexShrink: 0,
                    }}>
                      {iniciais}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0 }}>{m.nome}</p>
                      {m.cargo === 'admin' && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: ACCENT, background: ACCENT_LIGHT, padding: '2px 8px', borderRadius: 10 }}>admin</span>
                      )}
                      {!m.ativo && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', background: '#fef2f2', padding: '2px 8px', borderRadius: 10, border: '1px solid #fecaca' }}>inativo</span>
                      )}
                    </div>
                    <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.especialidade || 'Sem especialidade'}{m.crm ? ' · CRM ' + m.crm : ''} · {m.email}
                    </p>
                    {/* Mini-stats */}
                    <div style={{ display: 'flex', gap: 20 }}>
                      <div>
                        <p style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0, lineHeight: 1 }}>{s.pacientes}</p>
                        <p style={{ fontSize: 10, color: '#9ca3af', margin: '3px 0 0' }}>pacientes</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0, lineHeight: 1 }}>{s.consultas}</p>
                        <p style={{ fontSize: 10, color: '#9ca3af', margin: '3px 0 0' }}>consultas totais</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 18, fontWeight: 700, color: ACCENT, margin: 0, lineHeight: 1 }}>{s.consultasMes}</p>
                        <p style={{ fontSize: 10, color: '#9ca3af', margin: '3px 0 0' }}>este mês</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>desde</p>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', margin: '2px 0 0' }}>{fmt(m.criado_em)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Direita: ações */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => abrirEditar(m)} title="Editar" style={{
                    padding: '8px 12px', borderRadius: 9,
                    border: '1px solid #e5e7eb', background: 'white',
                    color: '#374151', fontSize: 12, fontWeight: 500,
                    cursor: 'pointer',
                  }}>Editar</button>
                  {m.id !== medico.id && (
                    <>
                      <button onClick={() => toggleAtivo(m.id, m.ativo)} style={{
                        padding: '8px 12px', borderRadius: 9,
                        border: m.ativo ? '1px solid #fecaca' : '1px solid #bbf7d0',
                        background: m.ativo ? '#fef2f2' : '#f0fdf4',
                        color: m.ativo ? '#dc2626' : '#16a34a',
                        fontSize: 12, fontWeight: 500, cursor: 'pointer',
                      }}>
                        {m.ativo ? 'Desativar' : 'Reativar'}
                      </button>
                      <button onClick={() => setModalExcluir(m)} title="Excluir" style={{
                        padding: '8px 10px', borderRadius: 9,
                        border: '1px solid #fecaca', background: '#fef2f2',
                        color: '#dc2626', cursor: 'pointer',
                        display: 'flex', alignItems: 'center',
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Novo médico */}
      {modalNovoMedico && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => { if (e.target === e.currentTarget) setModalNovoMedico(false) }}>
          <div style={{ background: 'white', borderRadius: CARD_RADIUS, padding: 28, width: 460 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Novo médico</h2>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 20px' }}>Cadastre um novo profissional na clínica</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Nome completo *', key: 'nome', placeholder: 'Dr. João Silva' },
                { label: 'E-mail *', key: 'email', placeholder: 'joao@clinica.com.br' },
                { label: 'Senha *', key: 'senha', placeholder: 'Mínimo 6 caracteres', type: 'password' },
                { label: 'CRM', key: 'crm', placeholder: 'CRM/SP 123456' },
                { label: 'Especialidade', key: 'especialidade', placeholder: 'Clínico Geral' },
              ].map(f => (
                <div key={f.key}>
                  <label style={labelStyle}>{f.label}</label>
                  <input
                    type={f.type || 'text'}
                    value={(form as any)[f.key]}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    style={inputStyle}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
              <button onClick={() => setModalNovoMedico(false)} style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid #e5e7eb', background: 'white', color: '#6b7280', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleCriarMedico} disabled={salvando} style={{ padding: '10px 22px', borderRadius: 10, border: 'none', background: salvando ? '#9ca3af' : ACCENT, color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {salvando ? 'Salvando...' : 'Criar médico'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar médico */}
      {modalEditar && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => { if (e.target === e.currentTarget) setModalEditar(null) }}>
          <div style={{ background: 'white', borderRadius: CARD_RADIUS, padding: 28, width: 460 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Editar médico</h2>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 20px' }}>Atualize informações do profissional</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Nome completo</label>
                <input value={formEditar.nome} onChange={e => setFormEditar(p => ({ ...p, nome: e.target.value }))} style={inputStyle}/>
              </div>
              <div>
                <label style={labelStyle}>E-mail</label>
                <input value={formEditar.email} onChange={e => setFormEditar(p => ({ ...p, email: e.target.value }))} style={inputStyle}/>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>CRM</label>
                  <input value={formEditar.crm} onChange={e => setFormEditar(p => ({ ...p, crm: e.target.value }))} style={inputStyle}/>
                </div>
                <div>
                  <label style={labelStyle}>Especialidade</label>
                  <input value={formEditar.especialidade} onChange={e => setFormEditar(p => ({ ...p, especialidade: e.target.value }))} style={inputStyle}/>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Cargo</label>
                <select value={formEditar.cargo} onChange={e => setFormEditar(p => ({ ...p, cargo: e.target.value }))} style={inputStyle}>
                  <option value="medico">Médico</option>
                  <option value="admin">Admin</option>
                  <option value="recepcionista">Recepcionista</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
              <button onClick={() => setModalEditar(null)} style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid #e5e7eb', background: 'white', color: '#6b7280', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleEditarMedico} disabled={salvando} style={{ padding: '10px 22px', borderRadius: 10, border: 'none', background: salvando ? '#9ca3af' : ACCENT, color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {salvando ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Excluir médico */}
      {modalExcluir && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => { if (e.target === e.currentTarget) setModalExcluir(null) }}>
          <div style={{ background: 'white', borderRadius: CARD_RADIUS, padding: 28, width: 420 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#dc2626', margin: '0 0 8px' }}>Excluir médico?</h2>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 20px', lineHeight: 1.6 }}>
              Você está prestes a excluir <strong style={{ color: '#111827' }}>{modalExcluir.nome}</strong> permanentemente. Esta ação não pode ser desfeita.
            </p>
            <div style={{ background: '#fef2f2', borderRadius: 10, padding: '12px 14px', marginBottom: 20, fontSize: 12, color: '#991b1b', lineHeight: 1.5 }}>
              Considere desativar em vez de excluir — manter histórico do profissional na clínica.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModalExcluir(null)} style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid #e5e7eb', background: 'white', color: '#6b7280', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleExcluir} disabled={salvando} style={{ padding: '10px 22px', borderRadius: 10, border: 'none', background: salvando ? '#9ca3af' : '#dc2626', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {salvando ? 'Excluindo...' : 'Sim, excluir permanentemente'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </main>
  )
}
