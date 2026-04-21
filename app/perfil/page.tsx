'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const ACCENT = '#1F9D5C'
const ACCENT_LIGHT = '#E8F7EF'
const BG = '#F5F5F5'
const CARD_RADIUS = 16

export default function PerfilPage() {
  const router = useRouter()
  const [medico, setMedico] = useState<any>(null)
  const [form, setForm] = useState({ nome: '', especialidade: '', crm: '', telefone: '', clinica: '', bio: '' })
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<{tipo: 'ok'|'erro', texto: string} | null>(null)
  const [senhaForm, setSenhaForm] = useState({ atual: '', nova: '', confirma: '' })
  const [salvandoSenha, setSalvandoSenha] = useState(false)
  const [uploadandoFoto, setUploadandoFoto] = useState(false)
  const fotoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const m = localStorage.getItem('medico')
    if (!m) { router.push('/login'); return }
    const med = JSON.parse(m)
    setMedico(med)
    setForm({
      nome: med.nome || '',
      especialidade: med.especialidade || '',
      crm: med.crm || '',
      telefone: med.telefone || '',
      clinica: med.clinica || '',
      bio: med.bio || '',
    })
  }, [router])

  const mostrarMsg = (tipo: 'ok'|'erro', texto: string) => {
    setMsg({ tipo, texto })
    setTimeout(() => setMsg(null), 3500)
  }

  const uploadFoto = async (file: File) => {
    if (!file || !medico) return
    setUploadandoFoto(true)
    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64 = e.target?.result as string
      await supabase.from('medicos').update({ foto_url: base64 }).eq('id', medico.id)
      const novoMedico = { ...medico, foto_url: base64 }
      localStorage.setItem('medico', JSON.stringify(novoMedico))
      setMedico(novoMedico)
      setUploadandoFoto(false)
      mostrarMsg('ok', 'Foto atualizada')
    }
    reader.readAsDataURL(file)
  }

  async function salvarPerfil() {
    setSalvando(true)
    try {
      const { error } = await supabase.from('medicos').update({
        nome: form.nome,
        especialidade: form.especialidade,
        crm: form.crm,
        telefone: form.telefone,
        clinica: form.clinica,
        bio: form.bio,
      }).eq('id', medico.id)
      if (error) throw error
      const novoMedico = { ...medico, ...form }
      localStorage.setItem('medico', JSON.stringify(novoMedico))
      setMedico(novoMedico)
      mostrarMsg('ok', 'Perfil atualizado')
    } catch (e: any) {
      mostrarMsg('erro', e.message || 'Erro ao salvar')
    }
    setSalvando(false)
  }

  async function salvarSenha() {
    if (!senhaForm.nova || senhaForm.nova.length < 6) return mostrarMsg('erro', 'Senha deve ter ao menos 6 caracteres')
    if (senhaForm.nova !== senhaForm.confirma) return mostrarMsg('erro', 'Senhas não coincidem')
    setSalvandoSenha(true)
    try {
      const res = await fetch('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medico_id: medico.id, senha_atual: senhaForm.atual, senha_nova: senhaForm.nova })
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)
      mostrarMsg('ok', 'Senha alterada com sucesso')
      setSenhaForm({ atual: '', nova: '', confirma: '' })
    } catch (e: any) {
      mostrarMsg('erro', e.message || 'Erro ao alterar senha')
    }
    setSalvandoSenha(false)
  }

  if (!medico) return null

  const iniciais = medico.nome?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() || '??'

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
    letterSpacing: '0.02em',
  }

  const cardStyle: React.CSSProperties = {
    background: 'white',
    borderRadius: CARD_RADIUS,
    padding: 24,
  }

  const h3Style: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 700,
    color: '#111827',
    margin: '0 0 4px',
  }

  const pSubStyle: React.CSSProperties = {
    fontSize: 12,
    color: '#9ca3af',
    margin: '0 0 20px',
  }

  return (
    <main style={{ height: '100%', overflow: 'auto', padding: 24, background: BG }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Meu perfil</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Gerencie suas informações pessoais e de acesso</p>
        </div>

        {/* Toast de mensagem */}
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
            
            {/* Card de perfil com foto grande */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <div style={{ position: 'relative', cursor: 'pointer', marginBottom: 16 }}
                  onClick={() => fotoInputRef.current?.click()}>
                  {medico.foto_url ? (
                    <img src={medico.foto_url} style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: 120, height: 120, borderRadius: '50%', background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, fontWeight: 700, color: 'white' }}>
                      {iniciais}
                    </div>
                  )}
                  <div style={{
                    position: 'absolute', bottom: 4, right: 4,
                    width: 32, height: 32, borderRadius: '50%',
                    background: ACCENT, border: '3px solid white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                  </div>
                  {uploadandoFoto && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.8)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: 24, height: 24, border: `3px solid ${ACCENT}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}/>
                    </div>
                  )}
                </div>
                <input ref={fotoInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => e.target.files?.[0] && uploadFoto(e.target.files[0])}/>
                
                <p style={{ fontSize: 17, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>{medico.nome || 'Sem nome'}</p>
                <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 2px' }}>{medico.email}</p>
                {medico.especialidade && (
                  <p style={{ fontSize: 12, color: ACCENT, background: ACCENT_LIGHT, padding: '4px 12px', borderRadius: 20, margin: '8px 0 0', fontWeight: 600 }}>
                    {medico.especialidade}
                  </p>
                )}
              </div>
            </div>

            {/* Card de alterar senha */}
            <div style={cardStyle}>
              <h3 style={h3Style}>Alterar senha</h3>
              <p style={pSubStyle}>Atualize sua senha periodicamente</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Senha atual</label>
                  <input type="password" value={senhaForm.atual}
                    onChange={e => setSenhaForm(p => ({ ...p, atual: e.target.value }))}
                    placeholder="••••••••" style={inputStyle}/>
                </div>
                <div>
                  <label style={labelStyle}>Nova senha</label>
                  <input type="password" value={senhaForm.nova}
                    onChange={e => setSenhaForm(p => ({ ...p, nova: e.target.value }))}
                    placeholder="Mínimo 6 caracteres" style={inputStyle}/>
                </div>
                <div>
                  <label style={labelStyle}>Confirmar nova senha</label>
                  <input type="password" value={senhaForm.confirma}
                    onChange={e => setSenhaForm(p => ({ ...p, confirma: e.target.value }))}
                    placeholder="••••••••" style={inputStyle}/>
                </div>
                <button onClick={salvarSenha} disabled={salvandoSenha}
                  style={{
                    padding: '11px 20px',
                    background: salvandoSenha ? '#9ca3af' : ACCENT,
                    color: 'white', border: 'none', borderRadius: 10,
                    fontSize: 13, fontWeight: 600, cursor: salvandoSenha ? 'not-allowed' : 'pointer',
                    marginTop: 4,
                  }}>
                  {salvandoSenha ? 'Alterando...' : 'Alterar senha'}
                </button>
              </div>
            </div>
          </div>

          {/* COLUNA DIREITA */}
          <div style={cardStyle}>
            <h3 style={h3Style}>Informações profissionais</h3>
            <p style={pSubStyle}>Seus dados aparecem nos prontuários e para seus pacientes</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={labelStyle}>Nome completo</label>
                <input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                  placeholder="Dr. João Silva" style={inputStyle}/>
              </div>
              <div>
                <label style={labelStyle}>Especialidade</label>
                <input value={form.especialidade} onChange={e => setForm(p => ({ ...p, especialidade: e.target.value }))}
                  placeholder="Ex: Clínica Geral" style={inputStyle}/>
              </div>
              <div>
                <label style={labelStyle}>CRM</label>
                <input value={form.crm} onChange={e => setForm(p => ({ ...p, crm: e.target.value }))}
                  placeholder="Ex: 12345-SP" style={inputStyle}/>
              </div>
              <div>
                <label style={labelStyle}>Telefone</label>
                <input value={form.telefone} onChange={e => setForm(p => ({ ...p, telefone: e.target.value }))}
                  placeholder="(11) 99999-9999" style={inputStyle}/>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Nome da clínica</label>
                <input value={form.clinica} onChange={e => setForm(p => ({ ...p, clinica: e.target.value }))}
                  placeholder="Ex: Clínica São Paulo" style={inputStyle}/>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Bio / Apresentação</label>
                <textarea value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))}
                  placeholder="Breve descrição sobre você, sua abordagem clínica e experiência..."
                  rows={4}
                  style={{ ...inputStyle, resize: 'vertical' as const, fontFamily: 'inherit' }}/>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20, paddingTop: 20, borderTop: '1px solid #f3f4f6' }}>
              <button onClick={salvarPerfil} disabled={salvando}
                style={{
                  padding: '11px 24px',
                  background: salvando ? '#9ca3af' : ACCENT,
                  color: 'white', border: 'none', borderRadius: 10,
                  fontSize: 13, fontWeight: 600, cursor: salvando ? 'not-allowed' : 'pointer',
                }}>
                {salvando ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </div>
      <style jsx>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  )
}
