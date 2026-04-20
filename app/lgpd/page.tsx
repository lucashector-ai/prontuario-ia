'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'

export default function LGPD() {
  const router = useRouter()
  const [medico, setMedico] = useState<any>(null)
  const [exportando, setExportando] = useState(false)
  const [deletando, setDeletando] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState('')
  const [msg, setMsg] = useState<{tipo:'ok'|'erro', texto:string}|null>(null)

  useEffect(() => {
    const m = localStorage.getItem('medico')
    if (!m) { router.push('/login'); return }
    setMedico(JSON.parse(m))
  }, [router])

  const exportarDados = async () => {
    setExportando(true)
    try {
      const [
        { data: pacientes },
        { data: consultas },
        { data: agendamentos },
      ] = await Promise.all([
        supabase.from('pacientes').select('*').eq('medico_id', medico.id),
        supabase.from('consultas').select('*').eq('medico_id', medico.id),
        supabase.from('agendamentos').select('*').eq('medico_id', medico.id),
      ])

      const exportData = {
        exportado_em: new Date().toISOString(),
        medico: { id: medico.id, nome: medico.nome, email: medico.email },
        resumo: {
          total_pacientes: pacientes?.length || 0,
          total_consultas: consultas?.length || 0,
          total_agendamentos: agendamentos?.length || 0,
        },
        pacientes: pacientes || [],
        consultas: (consultas || []).map((c: any) => ({
          id: c.id,
          data: c.criado_em,
          paciente_id: c.paciente_id,
          diagnostico: c.diagnostico_principal,
          cids: c.cids,
        })),
        agendamentos: agendamentos || [],
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `media-dados-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      setMsg({ tipo: 'ok', texto: 'Dados exportados com sucesso!' })
    } catch (e: any) {
      setMsg({ tipo: 'erro', texto: e.message })
    }
    setExportando(false)
  }

  const deletarConta = async () => {
    if (confirmDelete !== medico?.email) {
      setMsg({ tipo: 'erro', texto: 'Email não confere' })
      return
    }
    setDeletando(true)
    try {
      await supabase.from('consultas').delete().eq('medico_id', medico.id)
      await supabase.from('agendamentos').delete().eq('medico_id', medico.id)
      await supabase.from('pacientes').delete().eq('medico_id', medico.id)
      await supabase.from('medicos').delete().eq('id', medico.id)
      localStorage.clear()
      router.push('/cadastro')
    } catch (e: any) {
      setMsg({ tipo: 'erro', texto: e.message })
      setDeletando(false)
    }
  }

  if (!medico) return null

  const Card = ({ children, border = '#e5e7eb' }: any) => (
    <div style={{ background: 'white', borderRadius: 14, padding: 24, marginBottom: 20 }}>
      {children}
    </div>
  )

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#FAFAFA', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <main style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: 32 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Privacidade e LGPD</h1>
          <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 32px' }}>Gerencie seus dados conforme a Lei Geral de Proteção de Dados</p>

          <Card>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>📋 Seus direitos (LGPD)</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
              {[
                { icon: '👁', titulo: 'Acesso', desc: 'Acesse todos os dados armazenados sobre você' },
                { icon: '📤', titulo: 'Portabilidade', desc: 'Exporte seus dados em formato legível' },
                { icon: '✏️', titulo: 'Correção', desc: 'Corrija dados incorretos no perfil' },
                { icon: '🗑', titulo: 'Eliminação', desc: 'Delete sua conta e todos os dados' },
              ].map(d => (
                <div key={d.titulo} style={{ background: '#FAFAFA', borderRadius: 10, padding: 14 }}>
                  <p style={{ fontSize: 18, margin: '0 0 4px' }}>{d.icon}</p>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>{d.titulo}</p>
                  <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>{d.desc}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>📤 Exportar meus dados</h2>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 16px', lineHeight: 1.6 }}>
              Baixe todos os seus dados — pacientes, consultas e agendamentos — em formato JSON.
            </p>
            <button onClick={exportarDados} disabled={exportando}
              style={{ padding: '10px 20px', borderRadius: 9, border: 'none', background: '#6043C1', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {exportando ? 'Exportando...' : '⬇️ Exportar todos os dados'}
            </button>
          </Card>

          <Card>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>🔒 Consentimento</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Armazenamento de prontuários médicos', desc: 'Essencial para o funcionamento da plataforma', obrig: true },
                { label: 'Transcrição de consultas com IA', desc: 'Áudios processados pela Deepgram e Anthropic', obrig: true },
                { label: 'Envio de mensagens pelo WhatsApp', desc: 'Integração com Meta WhatsApp Business API', obrig: false },
                { label: 'Análise de métricas e relatórios', desc: 'Dados aggregados para o dashboard', obrig: false },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 14px', background: '#FAFAFA', borderRadius: 8 }}>
                  <div style={{ width: 18, height: 18, borderRadius: 4, background: '#6043C1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: '0 0 2px' }}>{item.label}</p>
                    <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>{item.desc} {item.obrig && <span style={{ color: '#dc2626', fontSize: 11 }}>• Obrigatório</span>}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card border="#fecaca">
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#dc2626', margin: '0 0 8px' }}>⚠️ Deletar minha conta</h2>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 16px', lineHeight: 1.6 }}>
              Esta ação é <strong>irreversível</strong>. Todos os seus dados serão permanentemente deletados — pacientes, consultas, agendamentos e configurações.
            </p>
            <p style={{ fontSize: 13, color: '#374151', margin: '0 0 8px' }}>Digite seu email para confirmar: <strong>{medico.email}</strong></p>
            <input value={confirmDelete} onChange={e => setConfirmDelete(e.target.value)}
              placeholder="seu@email.com"
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #fecaca', outline: 'none', fontSize: 14, marginBottom: 12, color: '#111827', background: 'white' }}/>
            <button onClick={deletarConta} disabled={deletando || confirmDelete !== medico?.email}
              style={{ padding: '10px 20px', borderRadius: 9, border: 'none', background: confirmDelete === medico?.email ? '#dc2626' : '#f3f4f6', color: confirmDelete === medico?.email ? 'white' : '#9ca3af', fontSize: 13, fontWeight: 600, cursor: confirmDelete === medico?.email ? 'pointer' : 'not-allowed' }}>
              {deletando ? 'Deletando...' : '🗑 Deletar minha conta permanentemente'}
            </button>
          </Card>

          {msg && <div style={{ padding: '12px 16px', borderRadius: 10, background: msg.tipo === 'ok' ? '#f0fdf4' : '#fef2f2', color: msg.tipo === 'ok' ? '#166534' : '#dc2626', fontSize: 13, border: `1px solid ${msg.tipo === 'ok' ? '#bbf7d0' : '#fecaca'}` }}>{msg.texto}</div>}
        </div>
      </main>
    </div>
  )
}
