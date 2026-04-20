'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Sidebar } from '@/components/Sidebar'
import { useToast } from '@/components/Toast'

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

  useEffect(() => {
    const m = localStorage.getItem('medico')
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

  const termosFiltrados = termos.filter(t =>
    !filtro || t.termo.toLowerCase().includes(filtro.toLowerCase()) || t.descricao?.toLowerCase().includes(filtro.toLowerCase())
  )

  const corCategoria: Record<string, string> = {
    'Medicamento': '#2563eb', 'Patologia': '#dc2626', 'Procedimento': '#1F9D5C',
    'Anatomia': '#059669', 'Sigla': '#d97706', 'Outro': '#6b7280'
  }
  const bgCategoria: Record<string, string> = {
    'Medicamento': '#eff6ff', 'Patologia': '#fef2f2', 'Procedimento': '#E8F7EF',
    'Anatomia': '#f0fdf4', 'Sigla': '#fffbeb', 'Outro': '#F5F5F5'
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F5F5F5', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '0 28px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h1 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0 }}>Dicionário clínico</h1>
            <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>Termos personalizados para melhorar a transcrição e o prontuário</p>
          </div>
          <span style={{ fontSize: 12, color: '#1F9D5C', background: '#E8F7EF', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>{termos.length} termos</span>
        </div>

        <div style={{ flex: 1, overflow: 'auto', display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20, alignContent: 'start' }}>

          {/* Formulário adicionar */}
          <div style={{ background: 'white', borderRadius: 12, padding: 20, height: 'fit-content' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: '0 0 16px' }}>Adicionar termo</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#374151', margin: '0 0 5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Termo *</p>
                <input value={novoTermo} onChange={e => setNovoTermo(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdicionar()}
                  placeholder="ex: BDZ, Quetiapina, PCR..."
                  style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 8, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#374151', margin: '0 0 5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Descrição</p>
                <input value={novaDescricao} onChange={e => setNovaDescricao(e.target.value)}
                  placeholder="ex: Benzodiazepínico"
                  style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 8, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#374151', margin: '0 0 5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Categoria</p>
                <select value={novaCategoria} onChange={e => setNovaCategoria(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 8, outline: 'none', background: 'white', boxSizing: 'border-box' }}>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <button onClick={handleAdicionar} disabled={salvando} style={{ padding: '9px', borderRadius: 8, border: 'none', background: '#1F9D5C', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 4 }}>
                {salvando ? 'Salvando...' : '+ Adicionar'}
              </button>
            </div>

            <div style={{ marginTop: 20, padding: '12px 14px', background: '#F5F5F5', borderRadius: 8 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Como funciona</p>
              <p style={{ fontSize: 12, color: '#6b7280', margin: 0, lineHeight: 1.6 }}>Os termos aqui cadastrados são usados pela IA para corrigir a transcrição e gerar prontuários mais precisos para a sua especialidade.</p>
            </div>
          </div>

          {/* Lista de termos */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'white', borderRadius: 8, padding: '7px 12px' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="Filtrar termos..."
                style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 13, outline: 'none', color: '#374151' }} />
            </div>

            {carregando ? (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: 28, height: 28, border: '3px solid #E8F7EF', borderTopColor: '#1F9D5C', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              </div>
            ) : termosFiltrados.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 24px', background: 'white', borderRadius: 12 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: '0 0 6px' }}>{termos.length === 0 ? 'Nenhum termo cadastrado' : 'Nenhum resultado'}</p>
                <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>{termos.length === 0 ? 'Adicione termos específicos da sua especialidade' : 'Tente outro filtro'}</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                {termosFiltrados.map(t => (
                  <div key={t.id} style={{ background: 'white', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{t.termo}</span>
                        <span style={{ fontSize: 10, fontWeight: 600, color: corCategoria[t.categoria] || '#6b7280', background: bgCategoria[t.categoria] || '#F5F5F5', padding: '1px 6px', borderRadius: 8, flexShrink: 0 }}>{t.categoria}</span>
                      </div>
                      {t.descricao && <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>{t.descricao}</p>}
                    </div>
                    <button onClick={() => handleDeletar(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', fontSize: 16, lineHeight: 1, flexShrink: 0, padding: 2 }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#d1d5db')}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )
}
