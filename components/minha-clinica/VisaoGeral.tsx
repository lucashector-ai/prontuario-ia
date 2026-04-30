'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const ACCENT = '#6043C1'
const ACCENT_LIGHT = '#ede9fb'
const BG = '#F5F5F5'

function formatarTelefone(v: string) {
  const nums = v.replace(/\D/g, '').slice(0, 11)
  if (nums.length <= 2) return nums
  if (nums.length <= 6) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`
  if (nums.length <= 10) return `(${nums.slice(0, 2)}) ${nums.slice(2, 6)}-${nums.slice(6)}`
  return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7)}`
}

type CampoKey = 'nome' | 'telefone' | 'endereco' | 'site' | 'horarios' | 'descricao'

const CAMPOS: Array<{
  key: CampoKey
  label: string
  placeholder: string
  textarea?: boolean
  gridSpan?: 'half' | 'full'
  mascara?: (v: string) => string
}> = [
  { key: 'nome', label: 'Nome fantasia', placeholder: 'Ex: Clínica São Lucas', gridSpan: 'half' },
  { key: 'telefone', label: 'Telefone', placeholder: '(11) 99999-9999', gridSpan: 'half', mascara: formatarTelefone },
  { key: 'endereco', label: 'Endereço', placeholder: 'Rua das Flores, 123 - Centro, São Paulo/SP', gridSpan: 'full' },
  { key: 'site', label: 'Site', placeholder: 'www.suaclinica.com.br', gridSpan: 'half' },
  { key: 'horarios', label: 'Horários de funcionamento', placeholder: 'Seg-Sex 8h-18h, Sáb 8h-12h', gridSpan: 'half' },
  { key: 'descricao', label: 'Descrição / Especialidades', placeholder: 'Clínica especializada em cardiologia e medicina geral...', textarea: true, gridSpan: 'full' },
]

export function VisaoGeral() {
  const router = useRouter()
  const [medico, setMedico] = useState<any>(null)
  const [clinica, setClinica] = useState<any>(null)
  const [form, setForm] = useState<Record<CampoKey, string>>({
    nome: '', endereco: '', telefone: '', site: '', horarios: '', descricao: '',
  })
  const [editando, setEditando] = useState<CampoKey | null>(null)
  const [valorOriginal, setValorOriginal] = useState<string>('')
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<{tipo:'ok'|'erro', texto:string}|null>(null)
  const [uploadandoLogo, setUploadandoLogo] = useState(false)
  const [stats, setStats] = useState({ medicos: 0, pacientes: 0 })

  useEffect(() => {
    const ca_ = localStorage.getItem('clinica_admin')
    const m = ca_ || localStorage.getItem('medico')
    if (!m) { router.push('/login'); return }
    const med = JSON.parse(m); setMedico(med)
    carregar(med.clinica_id || med.id)
  }, [router])

  const carregar = async (clinicaId: string) => {
    const { data } = await supabase.from('clinicas').select('*').eq('id', clinicaId).single()
    if (data) {
      setClinica(data)
      setForm({
        nome: data.nome || '',
        endereco: data.endereco || '',
        telefone: data.telefone || '',
        site: data.site || '',
        horarios: data.horarios || '',
        descricao: data.descricao || '',
      })
      // Carrega stats
      const [{ count: nMedicos }, { count: nPacientes }] = await Promise.all([
        supabase.from('medicos').select('*', { count: 'exact', head: true }).eq('clinica_id', clinicaId).eq('ativo', true),
        supabase.from('pacientes').select('*', { count: 'exact', head: true }).eq('clinica_id', clinicaId).then(r => r.error ? { count: 0 } : r),
      ])
      setStats({ medicos: nMedicos || 0, pacientes: nPacientes || 0 })
    }
  }

  const iniciarEdicao = (key: CampoKey) => {
    setValorOriginal(form[key])
    setEditando(key)
    setMsg(null)
  }

  const cancelarEdicao = () => {
    if (editando) {
      setForm(p => ({ ...p, [editando]: valorOriginal }))
    }
    setEditando(null)
  }

  const salvarCampo = async (key: CampoKey) => {
    if (!clinica) return
    setSalvando(true); setMsg(null)
    const update: any = { [key]: form[key] }
    const { error } = await supabase.from('clinicas').update(update).eq('id', clinica.id)
    if (error) {
      setMsg({ tipo: 'erro', texto: error.message })
      setForm(p => ({ ...p, [key]: valorOriginal }))
    } else {
      setMsg({ tipo: 'ok', texto: 'Atualizado!' })
      setClinica({ ...clinica, [key]: form[key] })
      setEditando(null)
      setTimeout(() => setMsg(null), 2500)
    }
    setSalvando(false)
  }

  const uploadLogo = async (file: File) => {
    setUploadandoLogo(true)
    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64 = e.target?.result as string
      await supabase.from('clinicas').update({ logo_url: base64 }).eq('id', clinica.id)
      setClinica((p: any) => ({...p, logo_url: base64}))
      setUploadandoLogo(false)
    }
    reader.readAsDataURL(file)
  }

  const handleChange = (key: CampoKey, valor: string) => {
    const campo = CAMPOS.find(c => c.key === key)
    const valorFinal = campo?.mascara ? campo.mascara(valor) : valor
    setForm(p => ({ ...p, [key]: valorFinal }))
  }

  if (!medico) return null

  const iniciais = clinica?.nome?.split(' ').map((n:string)=>n[0]).slice(0,2).join('').toUpperCase() || '??'
  const fmtData = clinica?.criado_em ? new Date(clinica.criado_em).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : ''

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

  const valorStyle: React.CSSProperties = {
    fontSize: 14, color: '#111827', fontWeight: 500,
    padding: '10px 14px', background: '#F9FAFB',
    borderRadius: 10, minHeight: 22,
  }

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Minha Clínica</h1>
        <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Configure as informações da sua clínica que aparecem nos prontuários e atendimentos</p>
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

      {/* Grid 2 colunas */}
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20, alignItems: 'start' }}>

        {/* COLUNA ESQUERDA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Card logo + nome */}
          <div style={{ background: 'white', borderRadius: 16, padding: 24, textAlign: 'center' }}>
            <div style={{ position: 'relative', cursor: 'pointer', width: 120, height: 120, margin: '0 auto 16px' }}
              onClick={() => (document.getElementById('logo-input') as HTMLInputElement)?.click()}>
              {clinica?.logo_url ? (
                <img src={clinica.logo_url} style={{ width: 120, height: 120, borderRadius: 20, objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 120, height: 120, borderRadius: 20, background: `linear-gradient(135deg, ${ACCENT}, #8b5cf6)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 700, color: 'white' }}>
                  {iniciais}
                </div>
              )}
              <div style={{ position: 'absolute', bottom: -4, right: -4, width: 32, height: 32, background: ACCENT, borderRadius: '50%', border: '3px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </div>
              {uploadandoLogo && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.8)', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 24, height: 24, border: `3px solid ${ACCENT}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}/>
                </div>
              )}
            </div>
            <input id="logo-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && uploadLogo(e.target.files[0])}/>

            <p style={{ fontSize: 17, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>{clinica?.nome || 'Sua Clínica'}</p>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 12px' }}>Clique na logo para editar</p>

            <span style={{ fontSize: 11, padding: '4px 12px', borderRadius: 20, background: ACCENT_LIGHT, color: ACCENT, fontWeight: 600 }}>
              Plano Starter
            </span>
          </div>

          {/* Card stats */}
          <div style={{ background: 'white', borderRadius: 16, padding: 24 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: '0 0 16px' }}>Visão geral</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#6b7280' }}>Médicos ativos</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{stats.medicos}</span>
              </div>
              <div style={{ height: 1, background: '#f3f4f6' }}/>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#6b7280' }}>Pacientes cadastrados</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{stats.pacientes}</span>
              </div>
              {fmtData && (
                <>
                  <div style={{ height: 1, background: '#f3f4f6' }}/>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>Cadastrada em</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#374151', textTransform: 'capitalize' as const }}>{fmtData}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA — formulário */}
        <div style={{ background: 'white', borderRadius: 16, padding: 28 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Informações da clínica</h2>
          <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 24px' }}>Clique no lápis ao lado de cada campo pra editar</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {CAMPOS.map(campo => {
              const ehEditando = editando === campo.key
              const valor = form[campo.key]
              const span = campo.gridSpan === 'full' ? '1 / -1' : 'auto'

              return (
                <div key={campo.key} style={{ gridColumn: span, position: 'relative' }}>
                  <label style={labelStyle}>{campo.label}</label>

                  {ehEditando ? (
                    <div>
                      {campo.textarea ? (
                        <textarea
                          value={valor}
                          onChange={e => handleChange(campo.key, e.target.value)}
                          placeholder={campo.placeholder}
                          rows={3}
                          autoFocus
                          style={{ ...inputStyle, resize: 'vertical' as const }}
                        />
                      ) : (
                        <input
                          value={valor}
                          onChange={e => handleChange(campo.key, e.target.value)}
                          placeholder={campo.placeholder}
                          autoFocus
                          style={inputStyle}
                          maxLength={campo.key === 'telefone' ? 15 : undefined}
                        />
                      )}
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button onClick={() => salvarCampo(campo.key)} disabled={salvando}
                          style={{ padding: '6px 14px', borderRadius: 8, background: ACCENT, color: 'white', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          {salvando ? 'Salvando...' : 'Salvar'}
                        </button>
                        <button onClick={cancelarEdicao} disabled={salvando}
                          style={{ padding: '6px 14px', borderRadius: 8, background: 'white', color: '#6b7280', border: '1px solid #e5e7eb', fontSize: 12, cursor: 'pointer' }}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ position: 'relative' }}>
                      <div style={{ ...valorStyle, paddingRight: 44, color: valor ? '#111827' : '#9ca3af', whiteSpace: campo.textarea ? 'pre-wrap' as const : 'nowrap' as const, overflow: campo.textarea ? 'visible' as const : 'hidden' as const, textOverflow: 'ellipsis' }}>
                        {valor || campo.placeholder}
                      </div>
                      <button
                        onClick={() => iniciarEdicao(campo.key)}
                        title="Editar"
                        style={{
                          position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                          width: 30, height: 30, borderRadius: '50%',
                          background: 'white', border: '1px solid #e5e7eb',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', color: '#6b7280',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = ACCENT_LIGHT
                          e.currentTarget.style.color = ACCENT
                          e.currentTarget.style.borderColor = ACCENT
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'white'
                          e.currentTarget.style.color = '#6b7280'
                          e.currentTarget.style.borderColor = '#e5e7eb'
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
