'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

const ACCENT = '#6043C1'
const ACCENT_LIGHT = '#ede9fb'
const BG = '#F5F5F5'
const CARD_RADIUS = 16

const CATEGORIAS = ['Medicamento', 'Patologia', 'Procedimento', 'Anatomia', 'Sigla', 'Outro']

export default function Dicionario() {
  const router = useRouter()
  const { toast } = useToast()
  const [medico, setMedico] = useState<any>(null)
  const [termos, setTermos] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const [novoTermo, setNovoTermo] = useState('')
  const [novaDescricao, setNovaDescricao] = useState('')
  const [novaCategoria, setNovaCategoria] = useState('Medicamento')
  const [salvando, setSalvando] = useState(false)
  const [filtro, setFiltro] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todas')

  useEffect(() => {
    const ca_ = localStorage.getItem('clinica_admin')
    const m = ca_ || localStorage.getItem('medico')
    if (!m) { router.push('/login'); return }
    const med = JSON.parse(m)
    setMedico(med)
    carregarTermos(med.id)
  }, [router])

  const carregarTermos = async (medicoId: string) => {
    const { data } = await supabase
      .from('dicionario_clinico')
      .select('*')
      .eq('medico_id', medicoId)
      .order('categoria', { ascending: true })
    setTermos(data || [])
    setCarregando(false)
  }

  const handleAdicionar = async () => {
    if (!novoTermo.trim()) { toast('Digite o termo', 'error'); return }
    setSalvando(true)
    const { data, error } = await supabase
      .from('dicionario_clinico')
      .insert({ medico_id: medico.id, termo: novoTermo.trim(), descricao: novaDescricao.trim(), categoria: novaCategoria })
      .select().single()
    if (!error && data) {
      setTermos(prev => [...prev, data])
      setNovoTermo(''); setNovaDescricao('')
      toast('Termo adicionado!')
    } else {
      toast(error?.message || 'Erro ao salvar', 'error')
    }
    setSalvando(false)
  }

  const handleDeletar = async (id: string) => {
    await supabase.from('dicionario_clinico').delete().eq('id', id)
    setTermos(prev => prev.filter(t => t.id !== id))
    toast('Termo removido', 'info')
  }

  if (!medico) return null

  const termosFiltrados = termos.filter(t => {
    const txtOk = !filtro || t.termo.toLowerCase().includes(filtro.toLowerCase()) || t.descricao?.toLowerCase().includes(filtro.toLowerCase())
    const catOk = filtroCategoria === 'todas' || t.categoria === filtroCategoria
    return txtOk && catOk
  })

  const corCategoria: Record<string, string> = {
    'Medicamento': '#2563eb', 'Patologia': '#dc2626', 'Procedimento': ACCENT,
    'Anatomia': '#059669', 'Sigla': '#d97706', 'Outro': '#6b7280'
  }
  const bgCategoria: Record<string, string> = {
    'Medicamento': '#eff6ff', 'Patologia': '#fef2f2', 'Procedimento': ACCENT_LIGHT,
    'Anatomia': '#f0fdf4', 'Sigla': '#fffbeb', 'Outro': '#F5F5F5'
  }

  // Contagem por categoria pra chips de filtro
  const contagem: Record<string, number> = { todas: termos.length }
  for (const cat of CATEGORIAS) contagem[cat] = termos.filter(t => t.categoria === cat).length

  const inputBase: React.CSSProperties = {
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
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Dicionário clínico</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Termos personalizados pra melhorar a transcrição da IA e gerar prontuários mais precisos</p>
        </div>
        <span style={{
          fontSize: 12, color: ACCENT, background: ACCENT_LIGHT,
          padding: '6px 14px', borderRadius: 20, fontWeight: 700,
          flexShrink: 0,
        }}>
          {termos.length} {termos.length === 1 ? 'termo' : 'termos'}
        </span>
      </div>

      {/* Grid horizontal 2 colunas */}
      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20, alignItems: 'start' }}>

        {/* COLUNA ESQUERDA — adicionar + info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ background: 'white', borderRadius: CARD_RADIUS, padding: 24 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Adicionar termo</h2>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 20px' }}>Amplie o vocabulário da IA</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Termo *</label>
                <input
                  value={novoTermo}
                  onChange={e => setNovoTermo(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAdicionar()}
                  placeholder="Ex: BDZ, Quetiapina, PCR..."
                  style={inputBase}
                />
              </div>
              <div>
                <label style={labelStyle}>Descrição</label>
                <input
                  value={novaDescricao}
                  onChange={e => setNovaDescricao(e.target.value)}
                  placeholder="Ex: Benzodiazepínico"
                  style={inputBase}
                />
              </div>
              <div>
                <label style={labelStyle}>Categoria</label>
                <select
                  value={novaCategoria}
                  onChange={e => setNovaCategoria(e.target.value)}
                  style={{ ...inputBase, cursor: 'pointer' }}
                >
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <button
                onClick={handleAdicionar}
                disabled={salvando}
                style={{
                  padding: 12, borderRadius: 10, border: 'none',
                  background: salvando ? '#9ca3af' : ACCENT,
                  color: 'white', fontSize: 13, fontWeight: 700,
                  cursor: salvando ? 'not-allowed' : 'pointer',
                  marginTop: 4,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                {salvando ? 'Salvando...' : 'Adicionar ao dicionário'}
              </button>
            </div>
          </div>

          <div style={{ background: 'white', borderRadius: CARD_RADIUS, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: ACCENT_LIGHT, color: ACCENT,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="16" x2="12" y2="12"/>
                  <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>Como funciona</p>
                <p style={{ fontSize: 12, color: '#6b7280', margin: 0, lineHeight: 1.6 }}>
                  Os termos aqui cadastrados são usados pela IA pra corrigir a transcrição da consulta e gerar prontuários mais precisos pra sua especialidade.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA — busca + chips + grid de termos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Barra de busca */}
          <div style={{
            background: 'white', borderRadius: 12,
            padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              value={filtro}
              onChange={e => setFiltro(e.target.value)}
              placeholder="Buscar termo..."
              style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 14, outline: 'none', color: '#374151' }}
            />
            {filtro && (
              <button onClick={() => setFiltro('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0, display: 'flex' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>

          {/* Chips de categoria */}
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
            {['todas', ...CATEGORIAS].map(cat => {
              const ativo = filtroCategoria === cat
              const count = contagem[cat] || 0
              const label = cat === 'todas' ? 'Todas' : cat
              return (
                <button
                  key={cat}
                  onClick={() => setFiltroCategoria(cat)}
                  disabled={count === 0 && cat !== 'todas'}
                  style={{
                    padding: '6px 12px', borderRadius: 20,
                    border: `1px solid ${ativo ? ACCENT : '#e5e7eb'}`,
                    background: ativo ? ACCENT : 'white',
                    color: ativo ? 'white' : (count === 0 && cat !== 'todas' ? '#d1d5db' : '#374151'),
                    fontSize: 12, fontWeight: 600,
                    cursor: count === 0 && cat !== 'todas' ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {label}
                  <span style={{
                    fontSize: 10,
                    padding: '1px 6px', borderRadius: 10,
                    background: ativo ? 'rgba(255,255,255,0.25)' : '#F5F5F5',
                    color: ativo ? 'white' : '#9ca3af',
                    fontWeight: 700,
                  }}>{count}</span>
                </button>
              )
            })}
          </div>

          {/* Lista */}
          {carregando ? (
            <div style={{ background: 'white', borderRadius: CARD_RADIUS, padding: 60, display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: 28, height: 28, border: `3px solid ${ACCENT_LIGHT}`, borderTopColor: ACCENT, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : termosFiltrados.length === 0 ? (
            <div style={{ background: 'white', borderRadius: CARD_RADIUS, padding: 48, textAlign: 'center' as const }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 12px', color: '#9ca3af',
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
                </svg>
              </div>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>
                {termos.length === 0 ? 'Nenhum termo cadastrado' : 'Nenhum resultado'}
              </p>
              <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>
                {termos.length === 0 ? 'Adicione termos específicos da sua especialidade no formulário ao lado' : 'Tente outro filtro ou busca'}
              </p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 12,
            }}>
              {termosFiltrados.map(t => (
                <div key={t.id} style={{
                  background: 'white', borderRadius: 12, padding: 14,
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10,
                  transition: 'transform 0.15s',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' as const }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{t.termo}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 700,
                        color: corCategoria[t.categoria] || '#6b7280',
                        background: bgCategoria[t.categoria] || '#F5F5F5',
                        padding: '2px 8px', borderRadius: 10, flexShrink: 0,
                        textTransform: 'uppercase' as const, letterSpacing: '0.02em',
                      }}>
                        {t.categoria}
                      </span>
                    </div>
                    {t.descricao && (
                      <p style={{ fontSize: 12, color: '#6b7280', margin: 0, lineHeight: 1.5 }}>{t.descricao}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeletar(t.id)}
                    title="Remover"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#d1d5db', padding: 4, flexShrink: 0,
                      display: 'flex', alignItems: 'center',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#d1d5db')}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </main>
  )
}
