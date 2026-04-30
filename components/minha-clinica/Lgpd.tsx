'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const ACCENT = '#6043C1'
const ACCENT_LIGHT = '#ede9fb'
const BG = '#F5F5F5'

export function Lgpd() {
  const router = useRouter()
  const [medico, setMedico] = useState<any>(null)
  const [exportando, setExportando] = useState(false)
  const [deletando, setDeletando] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState('')
  const [msg, setMsg] = useState<{tipo:'ok'|'erro', texto:string}|null>(null)

  useEffect(() => {
    const ca_ = localStorage.getItem('clinica_admin')
    const m = ca_ || localStorage.getItem('medico')
    if (!m) { router.push('/login'); return }
    setMedico(JSON.parse(m))
  }, [router])

  const mostrarMsg = (tipo: 'ok'|'erro', texto: string) => {
    setMsg({ tipo, texto })
    setTimeout(() => setMsg(null), 3500)
  }

  const exportarDados = async () => {
    setExportando(true)
    try {
      const [{ data: pacientes }, { data: consultas }, { data: agendamentos }] = await Promise.all([
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
      mostrarMsg('ok', 'Dados exportados com sucesso!')
    } catch (e: any) {
      mostrarMsg('erro', e.message)
    }
    setExportando(false)
  }

  const deletarConta = async () => {
    if (confirmDelete !== medico?.email) {
      mostrarMsg('erro', 'Email não confere')
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
      mostrarMsg('erro', e.message)
      setDeletando(false)
    }
  }

  if (!medico) return null

  const cardStyle: React.CSSProperties = {
    background: 'white',
    borderRadius: 16,
    padding: 24,
  }

  const direitos = [
    { titulo: 'Acesso', desc: 'Veja todos os dados armazenados sobre você', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth={1.8}>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    )},
    { titulo: 'Portabilidade', desc: 'Exporte em formato legível (JSON)', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth={1.8}>
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
    )},
    { titulo: 'Correção', desc: 'Ajuste dados incorretos no seu perfil', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth={1.8}>
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
    )},
    { titulo: 'Eliminação', desc: 'Delete sua conta permanentemente', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth={1.8}>
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
      </svg>
    )},
  ]

  const consentimentos = [
    { label: 'Armazenamento de prontuários médicos', desc: 'Essencial para o funcionamento da plataforma', obrig: true },
    { label: 'Transcrição de consultas com IA', desc: 'Áudios processados pela Deepgram e Anthropic', obrig: true },
    { label: 'Envio de mensagens pelo WhatsApp', desc: 'Integração com Meta WhatsApp Business API', obrig: false },
    { label: 'Análise de métricas e relatórios', desc: 'Dados agregados para o dashboard', obrig: false },
  ]

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Privacidade e LGPD</h1>
        <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Gerencie seus dados conforme a Lei Geral de Proteção de Dados</p>
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

          {/* Card seus direitos */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: ACCENT_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0 }}>Seus direitos (LGPD)</h3>
            </div>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 16px' }}>O que a lei te garante</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {direitos.map(d => (
                <div key={d.titulo} style={{ display: 'flex', gap: 12, padding: '10px 12px', background: '#F9FAFB', borderRadius: 10 }}>
                  <div style={{ flexShrink: 0, marginTop: 1 }}>{d.icon}</div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: '0 0 2px' }}>{d.titulo}</p>
                    <p style={{ fontSize: 11, color: '#6b7280', margin: 0, lineHeight: 1.4 }}>{d.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card consentimentos */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: ACCENT_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2"/>
                  <path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
              </div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0 }}>Consentimentos ativos</h3>
            </div>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 16px' }}>O que você autorizou ao se cadastrar</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {consentimentos.map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: '#F9FAFB', borderRadius: 10 }}>
                  <div style={{ width: 18, height: 18, borderRadius: 5, background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#111827', margin: '0 0 2px' }}>{item.label}</p>
                    <p style={{ fontSize: 11, color: '#6b7280', margin: 0, lineHeight: 1.4 }}>
                      {item.desc}
                      {item.obrig && <span style={{ color: '#dc2626', marginLeft: 4 }}> · Obrigatório</span>}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Card exportar */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: ACCENT_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0 }}>Exportar meus dados</h3>
            </div>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 16px' }}>Baixe tudo em formato JSON</p>

            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 16px', lineHeight: 1.6 }}>
              O arquivo inclui todos os seus pacientes, consultas e agendamentos. Ideal pra migrar de plataforma ou fazer backup pessoal.
            </p>

            <button onClick={exportarDados} disabled={exportando} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '11px 20px', borderRadius: 10, border: 'none',
              background: exportando ? '#9ca3af' : ACCENT, color: 'white',
              fontSize: 13, fontWeight: 600, cursor: exportando ? 'not-allowed' : 'pointer',
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              {exportando ? 'Exportando...' : 'Exportar tudo em JSON'}
            </button>
          </div>

          {/* Card deletar conta — danger zone */}
          <div style={{ ...cardStyle, border: '1px solid #fecaca' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                </svg>
              </div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#dc2626', margin: 0 }}>Zona de perigo</h3>
            </div>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 16px' }}>Ação irreversível</p>

            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
              <p style={{ fontSize: 12, color: '#991b1b', margin: 0, lineHeight: 1.5 }}>
                Ao deletar sua conta, <strong>todos os dados</strong> serão apagados permanentemente: pacientes, consultas, agendamentos e configurações. Não há como recuperar.
              </p>
            </div>

            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Digite <strong style={{ color: '#111827' }}>{medico.email}</strong> para confirmar
            </label>
            <input
              value={confirmDelete}
              onChange={e => setConfirmDelete(e.target.value)}
              placeholder="seu@email.com"
              style={{
                width: '100%', padding: '10px 14px',
                borderRadius: 10, border: '1px solid #fecaca',
                outline: 'none', fontSize: 14, marginBottom: 12,
                color: '#111827', background: 'white',
                boxSizing: 'border-box',
              }}
            />

            <button
              onClick={deletarConta}
              disabled={deletando || confirmDelete !== medico?.email}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '11px 20px', borderRadius: 10, border: 'none',
                background: confirmDelete === medico?.email ? '#dc2626' : '#f3f4f6',
                color: confirmDelete === medico?.email ? 'white' : '#9ca3af',
                fontSize: 13, fontWeight: 600,
                cursor: confirmDelete === medico?.email && !deletando ? 'pointer' : 'not-allowed',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
              </svg>
              {deletando ? 'Deletando...' : 'Deletar minha conta permanentemente'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
