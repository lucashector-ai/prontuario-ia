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
  const [tab, setTab] = useState<'perfil'|'senha'|'api'>('perfil')
  const [apiKey, setApiKey] = useState<string>('')
  const [gerandoKey, setGerandoKey] = useState(false)
  const [uploadandoFoto, setUploadandoFoto] = useState(false)

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
    if (med.api_key) setApiKey(med.api_key)
  }, [router])

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
    }
    reader.readAsDataURL(file)
  }

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
    <div style={{ display: 'flex', height: '100vh', background: '#FAFAFA' }}>
      <main style={{ flex: 1, overflow: 'auto', padding: '32px 40px' }}>
        <div style={{ maxWidth: 640 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Meu perfil</h1>
          <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 32px' }}>Gerencie suas informações pessoais e senha</p>

          {/* Avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32, padding: 20, background: 'white', borderRadius: 12 }}>
            <div style={{ position: 'relative', cursor: 'pointer', width: 64, height: 64, flexShrink: 0 }}
              onClick={() => (document.getElementById('foto-perfil-input') as HTMLInputElement)?.click()}
              title="Clique para trocar foto">
              {medico.foto_url
                ? <img src={medico.foto_url} style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} />
                : <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#6043C1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: 'white' }}>{iniciais}</div>
              }
              <div style={{ position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, background: '#6043C1', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
              </div>
              {uploadandoFoto && <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.7)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: 18, height: 18, border: '2px solid #6043C1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}/></div>}
            </div>
            <input id="foto-perfil-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && uploadFoto(e.target.files[0])}/>
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
                    style={{ width: '100%', padding: '10px 14px', fontSize: 14, borderRadius: 8, boxSizing: 'border-box' }} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Bio / Apresentação</label>
                <textarea value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))}
                  placeholder="Breve descrição sobre você e sua especialidade..."
                  rows={3}
                  style={{ width: '100%', padding: '10px 14px', fontSize: 14, borderRadius: 8, boxSizing: 'border-box', resize: 'vertical' }} />
              </div>
              <button onClick={salvarPerfil} disabled={salvando}
                style={{ padding: '12px 24px', background: salvando ? '#b9a9ef' : '#6043C1', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start' }}>
                {salvando ? 'Salvando...' : 'Salvar perfil'}
              </button>
            </div>
          )}

          {tab === 'api' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#166534', margin: '0 0 8px' }}>🔌 API Pública MedIA</h3>
            <p style={{ fontSize: 13, color: '#166534', margin: '0 0 16px', lineHeight: 1.6 }}>
              Use sua API key para integrar o MedIA com outros sistemas. Acesse pacientes, agendamentos e consultas via HTTP.
            </p>
            <div style={{ background: 'white', borderRadius: 8, padding: '12px 14px', border: '1px solid #bbf7d0', fontFamily: 'monospace', fontSize: 12, color: '#374151', marginBottom: 12, wordBreak: 'break-all' as const }}>
              {apiKey || 'Nenhuma API key gerada'}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={async () => {
                setGerandoKey(true)
                const res = await fetch('/api/public', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ medico_id: medico.id }) })
                const d = await res.json()
                if (d.api_key) {
                  setApiKey(d.api_key)
                  const novoMedico = { ...medico, api_key: d.api_key }
                  localStorage.setItem('medico', JSON.stringify(novoMedico))
                  setMedico(novoMedico)
                }
                setGerandoKey(false)
              }} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#16a34a', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {gerandoKey ? 'Gerando...' : apiKey ? '🔄 Regenerar key' : '✨ Gerar API key'}
              </button>
              {apiKey && <button onClick={() => navigator.clipboard.writeText(apiKey)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #bbf7d0', background: 'white', color: '#166534', fontSize: 13, cursor: 'pointer' }}>Copiar</button>}
            </div>
          </div>

          {apiKey && (
            <div style={{ background: '#FAFAFA', borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 14px' }}>Exemplos de uso</h3>
              {[
                { label: 'Listar pacientes', url: `https://prontuario-ia-five.vercel.app/api/public?key=${apiKey}&recurso=pacientes` },
                { label: 'Próximos agendamentos', url: `https://prontuario-ia-five.vercel.app/api/public?key=${apiKey}&recurso=agendamentos` },
                { label: 'Últimas consultas', url: `https://prontuario-ia-five.vercel.app/api/public?key=${apiKey}&recurso=consultas` },
              ].map(ex => (
                <div key={ex.label} style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', margin: '0 0 4px' }}>{ex.label}</p>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <code style={{ fontSize: 11, background: 'white', borderRadius: 6, padding: '4px 8px', flex: 1, wordBreak: 'break-all' as const, color: '#6043C1' }}>GET {ex.url}</code>
                    <button onClick={() => navigator.clipboard.writeText(ex.url)} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, background: 'white', cursor: 'pointer', flexShrink: 0 }}>Copiar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
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
                    style={{ width: '100%', padding: '10px 14px', fontSize: 14, borderRadius: 8, boxSizing: 'border-box' }} />
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
