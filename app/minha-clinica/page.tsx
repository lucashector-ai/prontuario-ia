'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'

export default function MinhaClinica() {
  const router = useRouter()
  const [medico, setMedico] = useState<any>(null)
  const [clinica, setClinica] = useState<any>(null)
  const [form, setForm] = useState({ nome: '', endereco: '', telefone: '', site: '', horarios: '', descricao: '' })
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<{tipo:'ok'|'erro', texto:string}|null>(null)
  const [uploadandoLogo, setUploadandoLogo] = useState(false)

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
    }
  }

  const salvar = async () => {
    setSalvando(true); setMsg(null)
    const { error } = await supabase.from('clinicas').update(form).eq('id', clinica.id)
    if (error) setMsg({ tipo: 'erro', texto: error.message })
    else { setMsg({ tipo: 'ok', texto: 'Clínica atualizada!' }); setClinica({...clinica, ...form}) }
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

  const inp = { padding: '10px 14px', borderRadius: 8, outline: 'none', fontSize: 14, width: '100%', fontFamily: 'inherit', color: '#111827', background: 'white' }

  if (!medico) return null

  const iniciais = clinica?.nome?.split(' ').map((n:string)=>n[0]).slice(0,2).join('').toUpperCase() || '??'

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F5F5F5', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <main style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: 32 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Minha Clínica</h1>
          <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 32px' }}>Configure as informações da sua clínica</p>

          {/* Card logo */}
          <div style={{ background: 'white', borderRadius: 14, padding: 24, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }}
              onClick={() => (document.getElementById('logo-input') as HTMLInputElement)?.click()}>
              {clinica?.logo_url
                ? <img src={clinica.logo_url} style={{ width: 80, height: 80, borderRadius: 14, objectFit: 'cover', border: '2px solid #e5e7eb' }} />
                : <div style={{ width: 80, height: 80, borderRadius: 14, background: 'linear-gradient(135deg, #6043C1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 700, color: 'white' }}>{iniciais}</div>
              }
              <div style={{ position: 'absolute', bottom: -4, right: -4, width: 22, height: 22, background: '#6043C1', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
              </div>
              {uploadandoLogo && <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.8)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: 20, height: 20, border: '2px solid #6043C1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}/></div>}
            </div>
            <input id="logo-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && uploadLogo(e.target.files[0])}/>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>{clinica?.nome || 'Sua Clínica'}</p>
              <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 8px' }}>Clique no logo para trocar a imagem</p>
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#f0fdf4', color: '#16a34a', fontWeight: 600, border: '1px solid #bbf7d0' }}>
                Plano Starter
              </span>
            </div>
          </div>

          {/* Formulário */}
          <div style={{ background: 'white', borderRadius: 14, padding: 24 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 20px' }}>Informações da clínica</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Nome da clínica</label>
                <input value={form.nome} onChange={e => setForm(p=>({...p,nome:e.target.value}))} style={inp} placeholder="Ex: Clínica São Lucas"/>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Telefone</label>
                <input value={form.telefone} onChange={e => setForm(p=>({...p,telefone:e.target.value}))} style={inp} placeholder="(11) 99999-9999"/>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Endereço</label>
              <input value={form.endereco} onChange={e => setForm(p=>({...p,endereco:e.target.value}))} style={inp} placeholder="Rua das Flores, 123 - Centro, São Paulo/SP"/>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Site</label>
                <input value={form.site} onChange={e => setForm(p=>({...p,site:e.target.value}))} style={inp} placeholder="www.suaclinica.com.br"/>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Horários de funcionamento</label>
                <input value={form.horarios} onChange={e => setForm(p=>({...p,horarios:e.target.value}))} style={inp} placeholder="Seg-Sex 8h-18h, Sáb 8h-12h"/>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Descrição / Especialidades</label>
              <textarea value={form.descricao} onChange={e => setForm(p=>({...p,descricao:e.target.value}))} rows={3}
                style={{...inp, resize: 'vertical'}} placeholder="Clínica especializada em cardiologia e medicina geral..."/>
            </div>

            {msg && <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, background: msg.tipo==='ok'?'#f0fdf4':'#fef2f2', color: msg.tipo==='ok'?'#16a34a':'#dc2626', fontSize: 13, border: `1px solid ${msg.tipo==='ok'?'#bbf7d0':'#fecaca'}` }}>{msg.texto}</div>}

            <button onClick={salvar} disabled={salvando} style={{ padding: '12px 24px', borderRadius: 10, border: 'none', background: '#6043C1', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              {salvando ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>

          {/* Médicos da clínica */}
          <div style={{ background: 'white', borderRadius: 14, padding: 24, marginTop: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Equipe médica</h2>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 16px' }}>Médicos cadastrados na sua clínica</p>
            <div style={{ padding: 20, background: '#F5F5F5', borderRadius: 10, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
              <p style={{ margin: 0 }}>Gerencie os médicos em <strong>Painel Admin</strong></p>
            </div>
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </main>
    </div>
  )
}
