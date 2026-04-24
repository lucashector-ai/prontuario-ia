'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

const ACCENT = '#6043C1'
const ACCENT_LIGHT = '#ede9fb'
const BG = '#F5F5F5'
const CARD_RADIUS = 16

const PALETA_CORES = [
  '#6043C1', '#2563eb', '#059669', '#d97706', '#db2777',
  '#0891b2', '#9333ea', '#e11d48', '#65a30d', '#0d9488',
]

export default function Admin() {
  const router = useRouter()
  const { toast } = useToast()
  const [medico, setMedico] = useState<any>(null)
  const [medicos, setMedicos] = useState<any[]>([])
  const [stats, setStats] = useState<Record<string, any>>({})
  const [kpis, setKpis] = useState({ totalPacientes: 0, consultasMes: 0, consultasTotal: 0 })
  const [carregando, setCarregando] = useState(true)

  const [aba, setAba] = useState<'medicos' | 'recepcionistas'>('medicos')
  const [novoDropdownOpen, setNovoDropdownOpen] = useState(false)
  const [modalNovoTipo, setModalNovoTipo] = useState<'medico' | 'recepcionista' | null>(null)
  const [modalEditar, setModalEditar] = useState<any>(null)
  const [modalExcluir, setModalExcluir] = useState<any>(null)
  const [senhaGerada, setSenhaGerada] = useState<{ pessoa: any; senha: string; tipo: 'medico' | 'recepcionista' } | null>(null)
  const [senhaCopiada, setSenhaCopiada] = useState(false)

  const [form, setForm] = useState({ nome: '', email: '', crm: '', especialidade: '', cor: '#6043C1' })
  const [formEditar, setFormEditar] = useState({ nome: '', email: '', crm: '', especialidade: '', cargo: 'medico' })
  const [salvando, setSalvando] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ca = localStorage.getItem('clinica_admin')
    if (ca) {
      const admin = JSON.parse(ca)
      setMedico({ ...admin, cargo: 'admin' })
      carregarDados(admin.clinica_id)
      return
    }
    const m = localStorage.getItem('medico')
    if (!m) { router.push('/login'); return }
    const med = JSON.parse(m)
    if (med.cargo !== 'admin') { router.push('/dashboard'); return }
    setMedico(med)
    carregarDados(med.clinica_id)
  }, [router])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setNovoDropdownOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const carregarDados = async (clinicaId: string) => {
    setCarregando(true)
    try {
      const { data: meds } = await supabase
        .from('medicos')
        .select('id, nome, email, crm, especialidade, ativo, criado_em, cargo, foto_url, clinica_id')
        .eq('clinica_id', clinicaId)
        .order('criado_em')

      const lista = meds || []
      setMedicos(lista)

      const statsMap: Record<string, any> = {}
      let totalConsultas = 0
      let totalConsultasMes = 0
      let totalPacientes = 0
      const inicioMes = new Date()
      inicioMes.setDate(1)
      inicioMes.setHours(0, 0, 0, 0)

      await Promise.all(lista.filter(m => m.cargo !== 'recepcionista').map(async (m: any) => {
        try {
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
        } catch (e) {
          statsMap[m.id] = { consultas: 0, consultasMes: 0, pacientes: 0 }
        }
      }))

      setStats(statsMap)
      setKpis({ totalPacientes, consultasMes: totalConsultasMes, consultasTotal: totalConsultas })
    } catch (e) {
      console.error('Erro:', e)
    } finally {
      setCarregando(false)
    }
  }

  const handleCriar = async () => {
    if (!form.nome || !form.email) { toast('Preencha nome e email', 'error'); return }
    setSalvando(true)
    try {
      const payload: any = {
        nome: form.nome,
        email: form.email,
        clinica_id: medico.clinica_id,
        cargo: modalNovoTipo,
      }
      if (modalNovoTipo === 'medico') {
        payload.crm = form.crm
        payload.especialidade = form.especialidade
        payload.cor = form.cor
      }

      const res = await fetch('/api/medicos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.medico && data.senha_provisoria_gerada) {
        const tipoSalvo = modalNovoTipo!
        setModalNovoTipo(null)
        setForm({ nome: '', email: '', crm: '', especialidade: '', cor: '#6043C1' })
        setSenhaGerada({ pessoa: data.medico, senha: data.senha_provisoria_gerada, tipo: tipoSalvo })
        await carregarDados(medico.clinica_id)
      } else throw new Error(data.error || 'Erro ao criar')
    } catch (e: any) { toast(e.message, 'error') }
    finally { setSalvando(false) }
  }

  const handleEditar = async () => {
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
        toast('Atualizado!')
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
        toast('Removido')
      } else throw new Error(data.error)
    } catch (e: any) { toast(e.message, 'error') }
    finally { setSalvando(false) }
  }

  const toggleAtivo = async (id: string, ativo: boolean) => {
    await supabase.from('medicos').update({ ativo: !ativo }).eq('id', id)
    setMedicos(prev => prev.map(m => m.id === id ? { ...m, ativo: !ativo } : m))
    toast(ativo ? 'Desativado' : 'Reativado', ativo ? 'error' : 'success')
  }

  const abrirEditar = (m: any) => {
    setFormEditar({
      nome: m.nome || '', email: m.email || '',
      crm: m.crm || '', especialidade: m.especialidade || '',
      cargo: m.cargo || 'medico',
    })
    setModalEditar(m)
  }

  const copiarSenha = () => {
    if (!senhaGerada) return
    navigator.clipboard.writeText(senhaGerada.senha)
    setSenhaCopiada(true)
    setTimeout(() => setSenhaCopiada(false), 2000)
  }

  const copiarCredenciais = () => {
    if (!senhaGerada) return
    const label = senhaGerada.tipo === 'recepcionista' ? 'Recepcionista' : 'Médico'
    const texto = `Acesso MedIA — ${label} ${senhaGerada.pessoa.nome}\nEmail: ${senhaGerada.pessoa.email}\nSenha provisória: ${senhaGerada.senha}\n\nNo primeiro login você vai precisar trocar a senha.`
    navigator.clipboard.writeText(texto)
    setSenhaCopiada(true)
    setTimeout(() => setSenhaCopiada(false), 2000)
  }

  if (!medico) return null

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })

  const listaMedicos = medicos.filter(m => m.cargo !== 'recepcionista')
  const listaRecepcionistas = medicos.filter(m => m.cargo === 'recepcionista')

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', fontSize: 14,
    borderRadius: 10, border: '1px solid #e5e7eb',
    background: 'white', outline: 'none', boxSizing: 'border-box', color: '#111827',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: '#6b7280',
    display: 'block', marginBottom: 6,
  }

  const listaAtual = aba === 'medicos' ? listaMedicos : listaRecepcionistas
  const labelAba = aba === 'medicos' ? 'médico' : 'recepcionista'
  const labelPlural = aba === 'medicos' ? 'médicos' : 'recepcionistas'

  return (
    <main style={{ height: '100%', overflow: 'auto', padding: 24, background: BG }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Painel administrativo</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
            {listaMedicos.length} médico{listaMedicos.length !== 1 ? 's' : ''} · {listaRecepcionistas.length} recepcionista{listaRecepcionistas.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button onClick={() => setNovoDropdownOpen(!novoDropdownOpen)} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '10px 18px', borderRadius: 10, border: 'none',
            background: ACCENT, color: 'white',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Novo
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          {novoDropdownOpen && (
            <div style={{
              position: 'absolute', top: 44, right: 0, width: 200,
              background: 'white', borderRadius: 10, zIndex: 50,
              padding: 6, boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            }}>
              <button
                onClick={() => { setModalNovoTipo('medico'); setNovoDropdownOpen(false); setForm({ nome: '', email: '', crm: '', especialidade: '', cor: '#6043C1' }) }}
                style={{ display: 'block', width: '100%', padding: '9px 12px', fontSize: 13, color: '#374151', background: 'transparent', border: 'none', borderRadius: 7, cursor: 'pointer', textAlign: 'left' as const }}
                onMouseEnter={e => e.currentTarget.style.background = '#F5F5F5'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                + Médico
              </button>
              <button
                onClick={() => { setModalNovoTipo('recepcionista'); setNovoDropdownOpen(false); setForm({ nome: '', email: '', crm: '', especialidade: '', cor: '#6043C1' }) }}
                style={{ display: 'block', width: '100%', padding: '9px 12px', fontSize: 13, color: '#374151', background: 'transparent', border: 'none', borderRadius: 7, cursor: 'pointer', textAlign: 'left' as const }}
                onMouseEnter={e => e.currentTarget.style.background = '#F5F5F5'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                + Recepcionista
              </button>
            </div>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Médicos ativos', valor: listaMedicos.filter(m => m.ativo).length, sub: `${listaMedicos.length} total` },
          { label: 'Recepcionistas', valor: listaRecepcionistas.filter(m => m.ativo).length, sub: 'atendentes WhatsApp' },
          { label: 'Pacientes cadastrados', valor: kpis.totalPacientes, sub: 'na clínica' },
          { label: 'Consultas este mês', valor: kpis.consultasMes, sub: 'todos os médicos' },
        ].map(k => (
          <div key={k.label} style={{ background: 'white', borderRadius: CARD_RADIUS, padding: 20 }}>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 8px', fontWeight: 500 }}>{k.label}</p>
            <p style={{ fontSize: 28, fontWeight: 700, color: '#111827', margin: '0 0 4px', lineHeight: 1 }}>{k.valor}</p>
            <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid #e5e7eb' }}>
        {([{ key: 'medicos', label: `Médicos (${listaMedicos.length})` }, { key: 'recepcionistas', label: `Recepcionistas (${listaRecepcionistas.length})` }] as const).map(t => (
          <button key={t.key} onClick={() => setAba(t.key)} style={{
            padding: '10px 18px', border: 'none', cursor: 'pointer',
            background: 'transparent', color: aba === t.key ? ACCENT : '#6b7280',
            fontSize: 13, fontWeight: aba === t.key ? 700 : 500,
            borderBottom: `2px solid ${aba === t.key ? ACCENT : 'transparent'}`,
            marginBottom: -1,
          }}>{t.label}</button>
        ))}
      </div>

      {/* Lista */}
      {carregando ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 32, height: 32, border: `3px solid ${ACCENT_LIGHT}`, borderTopColor: ACCENT, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : listaAtual.length === 0 ? (
        <div style={{ background: 'white', borderRadius: CARD_RADIUS, padding: 40, textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>Nenhum {labelAba} cadastrado ainda.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {listaAtual.map(m => {
            const s = stats[m.id] || { consultas: 0, consultasMes: 0, pacientes: 0 }
            const iniciais = m.nome.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
            const isRecep = m.cargo === 'recepcionista'
            return (
              <div key={m.id} style={{ background: 'white', borderRadius: CARD_RADIUS, padding: 20, opacity: m.ativo ? 1 : 0.6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: isRecep ? 0 : 16 }}>
                  {m.foto_url ? (
                    <img src={m.foto_url} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}/>
                  ) : (
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: ACCENT_LIGHT, color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, flexShrink: 0 }}>
                      {iniciais}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                      <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0 }}>{m.nome}</p>
                      {isRecep && <span style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6', background: '#eff6ff', padding: '2px 8px', borderRadius: 10 }}>recepcionista</span>}
                      {!m.ativo && <span style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', background: '#fef2f2', padding: '2px 8px', borderRadius: 10, border: '1px solid #fecaca' }}>inativo</span>}
                    </div>
                    <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
                      {isRecep ? m.email : (m.especialidade || 'Sem especialidade') + (m.crm ? ' · CRM ' + m.crm : '') + ' · ' + m.email}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => abrirEditar(m)} style={{ padding: '8px 12px', borderRadius: 9, border: '1px solid #e5e7eb', background: 'white', color: '#374151', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>Editar</button>
                    {m.id !== medico.id && (
                      <>
                        <button onClick={() => toggleAtivo(m.id, m.ativo)} style={{
                          padding: '8px 12px', borderRadius: 9,
                          border: m.ativo ? '1px solid #fecaca' : '1px solid #bbf7d0',
                          background: m.ativo ? '#fef2f2' : '#f0fdf4',
                          color: m.ativo ? '#dc2626' : '#16a34a',
                          fontSize: 12, fontWeight: 500, cursor: 'pointer',
                        }}>{m.ativo ? 'Desativar' : 'Reativar'}</button>
                        <button onClick={() => setModalExcluir(m)} style={{ padding: '8px 10px', borderRadius: 9, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {!isRecep && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, paddingTop: 16, borderTop: '1px solid #f3f4f6' }}>
                    <div>
                      <p style={{ fontSize: 10, color: '#9ca3af', margin: '0 0 4px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Pacientes</p>
                      <p style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0, lineHeight: 1 }}>{s.pacientes}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 10, color: '#9ca3af', margin: '0 0 4px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Consultas totais</p>
                      <p style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0, lineHeight: 1 }}>{s.consultas}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 10, color: '#9ca3af', margin: '0 0 4px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Este mês</p>
                      <p style={{ fontSize: 20, fontWeight: 700, color: ACCENT, margin: 0, lineHeight: 1 }}>{s.consultasMes}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 10, color: '#9ca3af', margin: '0 0 4px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Cadastrado em</p>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: 0 }}>{fmt(m.criado_em)}</p>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Novo (médico ou recepcionista) */}
      {modalNovoTipo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => { if (e.target === e.currentTarget) setModalNovoTipo(null) }}>
          <div style={{ background: 'white', borderRadius: CARD_RADIUS, padding: 28, width: 460 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
              Novo {modalNovoTipo === 'medico' ? 'médico' : 'recepcionista'}
            </h2>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 20px' }}>
              {modalNovoTipo === 'medico' ? 'Cadastre um novo profissional na clínica' : 'Cadastre um atendente pra gerenciar agenda e WhatsApp'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Nome completo *</label>
                <input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                  placeholder={modalNovoTipo === 'medico' ? 'Dr. João Silva' : 'Maria Santos'} style={inputStyle}/>
              </div>
              <div>
                <label style={labelStyle}>E-mail *</label>
                <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="email@clinica.com.br" style={inputStyle}/>
              </div>
              {modalNovoTipo === 'medico' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>CRM</label>
                    <input value={form.crm} onChange={e => setForm(p => ({ ...p, crm: e.target.value }))} placeholder="CRM/SP 123456" style={inputStyle}/>
                  </div>
                  <div>
                    <label style={labelStyle}>Especialidade</label>
                    <input value={form.especialidade} onChange={e => setForm(p => ({ ...p, especialidade: e.target.value }))} placeholder="Clínico Geral" style={inputStyle}/>
                  </div>
                </div>
              )}
              {modalNovoTipo === 'medico' && (
                <div>
                  <label style={labelStyle}>Cor na agenda</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8 }}>
                    {PALETA_CORES.map(cor => {
                      const selecionada = form.cor === cor
                      return (
                        <button
                          key={cor}
                          type="button"
                          onClick={() => setForm(p => ({ ...p, cor }))}
                          title={cor}
                          style={{
                            width: 36, height: 36, borderRadius: '50%',
                            background: cor, cursor: 'pointer',
                            border: selecionada ? '3px solid #111827' : '3px solid transparent',
                            transform: selecionada ? 'scale(1.1)' : 'scale(1)',
                            transition: 'all 0.15s',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          {selecionada && (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          )}
                        </button>
                      )
                    })}
                  </div>
                  <p style={{ fontSize: 11, color: '#9ca3af', margin: '8px 0 0' }}>
                    Essa cor aparece nos agendamentos do médico na agenda.
                  </p>
                </div>
              )}
              <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#0369a1', lineHeight: 1.5 }}>
                ℹ Uma senha provisória será gerada. No primeiro login, {modalNovoTipo === 'medico' ? 'o médico' : 'a pessoa'} precisa criar uma senha própria.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
              <button onClick={() => setModalNovoTipo(null)} style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid #e5e7eb', background: 'white', color: '#6b7280', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleCriar} disabled={salvando} style={{ padding: '10px 22px', borderRadius: 10, border: 'none', background: salvando ? '#9ca3af' : ACCENT, color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {salvando ? 'Criando...' : 'Criar ' + (modalNovoTipo === 'medico' ? 'médico' : 'recepcionista')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar */}
      {modalEditar && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => { if (e.target === e.currentTarget) setModalEditar(null) }}>
          <div style={{ background: 'white', borderRadius: CARD_RADIUS, padding: 28, width: 460 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Editar {modalEditar.cargo === 'recepcionista' ? 'recepcionista' : 'médico'}</h2>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 20px' }}>Atualize informações</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Nome completo</label>
                <input value={formEditar.nome} onChange={e => setFormEditar(p => ({ ...p, nome: e.target.value }))} style={inputStyle}/>
              </div>
              <div>
                <label style={labelStyle}>E-mail</label>
                <input value={formEditar.email} onChange={e => setFormEditar(p => ({ ...p, email: e.target.value }))} style={inputStyle}/>
              </div>
              {modalEditar.cargo !== 'recepcionista' && (
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
              )}
              <div>
                <label style={labelStyle}>Cargo</label>
                <select value={formEditar.cargo} onChange={e => setFormEditar(p => ({ ...p, cargo: e.target.value }))} style={inputStyle}>
                  <option value="medico">Médico</option>
                  <option value="recepcionista">Recepcionista</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
              <button onClick={() => setModalEditar(null)} style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid #e5e7eb', background: 'white', color: '#6b7280', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleEditar} disabled={salvando} style={{ padding: '10px 22px', borderRadius: 10, border: 'none', background: salvando ? '#9ca3af' : ACCENT, color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Excluir */}
      {modalExcluir && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => { if (e.target === e.currentTarget) setModalExcluir(null) }}>
          <div style={{ background: 'white', borderRadius: CARD_RADIUS, padding: 28, width: 420 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#dc2626', margin: '0 0 8px' }}>Excluir?</h2>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 20px', lineHeight: 1.6 }}>
              Você está prestes a excluir <strong style={{ color: '#111827' }}>{modalExcluir.nome}</strong> permanentemente.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModalExcluir(null)} style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid #e5e7eb', background: 'white', color: '#6b7280', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleExcluir} disabled={salvando} style={{ padding: '10px 22px', borderRadius: 10, border: 'none', background: salvando ? '#9ca3af' : '#dc2626', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {salvando ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de senha gerada */}
      {senhaGerada && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'white', borderRadius: CARD_RADIUS, padding: 32, width: '100%', maxWidth: 480 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: ACCENT_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>
              {senhaGerada.tipo === 'medico' ? 'Médico' : 'Recepcionista'} cadastrado!
            </h2>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 20px', lineHeight: 1.6 }}>
              Envie essas credenciais para <strong style={{ color: '#111827' }}>{senhaGerada.pessoa.nome}</strong>. No primeiro login, {senhaGerada.tipo === 'medico' ? 'ele' : 'ela'} vai precisar criar uma senha própria.
            </p>

            <div style={{ background: '#F5F5F5', borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Email</p>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: '0 0 12px', wordBreak: 'break-all' }}>{senhaGerada.pessoa.email}</p>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Senha provisória</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'white', borderRadius: 8, padding: '8px 12px' }}>
                <code style={{ flex: 1, fontSize: 15, fontWeight: 700, color: ACCENT, fontFamily: 'monospace', letterSpacing: '0.02em', wordBreak: 'break-all' }}>{senhaGerada.senha}</code>
                <button onClick={copiarSenha} style={{ padding: '5px 10px', borderRadius: 6, background: senhaCopiada ? '#16a34a' : ACCENT, color: 'white', border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                  {senhaCopiada ? '✓ Copiado' : 'Copiar'}
                </button>
              </div>
            </div>

            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 14px', marginBottom: 20 }}>
              <p style={{ fontSize: 12, color: '#92400e', margin: 0, lineHeight: 1.5 }}>
                ⚠ Esta senha <strong>só aparece agora</strong>. Anote ou copie antes de fechar.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={copiarCredenciais} style={{ flex: 1, padding: '11px', borderRadius: 10, background: 'white', color: '#374151', border: '1px solid #e5e7eb', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Copiar tudo
              </button>
              <button onClick={() => { setSenhaGerada(null); setSenhaCopiada(false); toast('Cadastrado com sucesso!') }} style={{ flex: 1, padding: '11px', borderRadius: 10, background: ACCENT, color: 'white', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Pronto
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </main>
  )
}
