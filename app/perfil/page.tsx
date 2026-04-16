'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'

export default function PerfilPage() {
  const router = useRouter()
  const [medico, setMedico] = useState<any>(null)
  const [form, setForm] = useState({ nome: '', especialidade: '', crm: '', telefone: '', clinica: '', bio: '' })
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<{tipo: 'ok'|'erro', texto: string} | null>(null)
  const [senhaForm, setSenhaForm] = useState({ atual: '', nova: '', confirma: '' })
  const [salvandoSenha, setSalvandoSenha] = useState(false)
  const [tab, setTab] = useState<'perfil'|'senha'>('perfil')

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

  async function salvarPerfil() {
    setSalvando(true); setMsg(null)
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
      setMsg({ tipo: 'ok', texto: 'Perfil atualizado com sucesso!' })
    } catch (e: any) {
      setMsg({ tipo: 'erro', texto: e.message || 'Erro ao salvar' })
    }
    setSalvando(false)
    setTimeout(() => setMsg(null), 3000)
  }

  async function salvarSenha() {
    if (!senhaForm.nova || senhaForm.nova.length < 6) return setMsg({ tipo: 'erro', texto: 'Senha deve ter ao menos 6 caracteres' })
    if (senhaForm.nova !== senhaForm.confirma) return setMsg({ tipo: 'erro', texto: 'Senhas não coincidem' })
    setSalvandoSenha(true); setMsg(null)
    try {
      const res = await fetch('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medico_id: medico.id, senha_atual: senhaForm.atual, senha_nova: senhaForm.nova })
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)
      setMsg({ tipo: 'ok', texto: 'Senha alterada com sucesso!' })
      setSenhaForm({ atual: '', nova: '', confirma: '' })
    } catch (e: any) {
      setMsg({ tipo: 'erro', texto: e.message || 'Erro ao alterar senha' })
    }
    setSalvandoSenha(false)
    setTimeout(() => setMsg(null), 3000)
  }

  if (!medico) return null

  const iniciais = medico.nome?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() || '??'

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F9FAFC' }}>
      <Sidebar />
      <main style={{ flex: 1, overflow: 'auto', padding: '32px 40px' }}>
        <div style={{ maxWidth: 640 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Meu perfil</h1>
          <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 32px' }}>Gerencie suas informações pessoais e senha</p>

          {/* Avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32, padding: 20, background: 'white', borderRadius: 12, border: '1px solid #f0f0f0' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#6043C1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: 'white', flexShrink: 0 }}>
              {iniciais}
            </div>
            <div>
              <p style={{ fontWeight: 600, fontSize: 16, margin: '0 0 2px', color: '#111827' }}>{medico.nome || 'Sem nome'}</p>
              <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>{medico.email} • {medico.especialidade || 'Especialidade não informada'}</p>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid #f0f0f0' }}>
            {(['perfil', 'senha'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500,
                background: 'transparent', borderBottom: tab === t ? '2px solid #6043C1' : '2px solid transparent',
                color: tab === t ? '#6043C1' : '#6b7280', marginBottom: -1, textTransform: 'capitalize'
              }}>{t === 'perfil' ? 'Dados pessoais' : 'Alterar senha'}</button>
            ))}
          </div>

          {msg && (
            <div style={{ padding: '10px 16px', borderRadius: 8, marginBottom: 20, fontSize: 13, fontWeight: 500,
              background: msg.tipo === 'ok' ? '#f0fdf4' : '#fef2f2',
              color: msg.tipo === 'ok' ? '#16a34a' : '#dc2626',
              border: `1px solid ${msg.tipo === 'ok' ? '#bbf7d0' : '#fecaca'}` }}>
              {msg.tipo === 'ok' ? '✓' : '⚠'} {msg.texto}
            </div>
          )}

          {tab === 'perfil' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { key: 'nome', label: 'Nome completo', placeholder: 'Dr. João Silva' },
                { key: 'especialidade', label: 'Especialidade', placeholder: 'Ex: Clínica Geral' },
                { key: 'crm', label: 'CRM', placeholder: 'Ex: 12345-SP' },
                { key: 'telefone', label: 'Telefone', placeholder: '(11) 99999-9999' },
                { key: 'clinica', label: 'Nome da clínica', placeholder: 'Ex: Clínica São Paulo' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>{f.label}</label>
                  <input value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    style={{ width: '100%', padding: '10px 14px', fontSize: 14, borderRadius: 8, border: '1.5px solid #e5e7eb', boxSizing: 'border-box' }} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Bio / Apresentação</label>
                <textarea value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))}
                  placeholder="Breve descrição sobre você e sua especialidade..."
                  rows={3}
                  style={{ width: '100%', padding: '10px 14px', fontSize: 14, borderRadius: 8, border: '1.5px solid #e5e7eb', boxSizing: 'border-box', resize: 'vertical' }} />
              </div>
              <button onClick={salvarPerfil} disabled={salvando}
                style={{ padding: '12px 24px', background: salvando ? '#b9a9ef' : '#6043C1', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start' }}>
                {salvando ? 'Salvando...' : 'Salvar perfil'}
              </button>
            </div>
          )}

          {tab === 'senha' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { key: 'atual', label: 'Senha atual', placeholder: '••••••••' },
                { key: 'nova', label: 'Nova senha', placeholder: 'Mínimo 6 caracteres' },
                { key: 'confirma', label: 'Confirmar nova senha', placeholder: '••••••••' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>{f.label}</label>
                  <input type="password" value={(senhaForm as any)[f.key]}
                    onChange={e => setSenhaForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    style={{ width: '100%', padding: '10px 14px', fontSize: 14, borderRadius: 8, border: '1.5px solid #e5e7eb', boxSizing: 'border-box' }} />
                </div>
              ))}
              <button onClick={salvarSenha} disabled={salvandoSenha}
                style={{ padding: '12px 24px', background: salvandoSenha ? '#b9a9ef' : '#6043C1', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start' }}>
                {salvandoSenha ? 'Alterando...' : 'Alterar senha'}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
