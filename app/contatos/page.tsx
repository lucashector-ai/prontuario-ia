'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Sidebar } from '@/components/Sidebar'

export default function Contatos() {
  const router = useRouter()
  const [medico, setMedico] = useState<any>(null)
  const [contatos, setContatos] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')

  useEffect(() => {
    const m = localStorage.getItem('medico')
    if (!m) { router.push('/login'); return }
    const med = JSON.parse(m); setMedico(med)
    carregar(med.id)
  }, [router])

  const carregar = async (medicoId: string) => {
    const { data } = await supabase
      .from('whatsapp_conversas')
      .select('*, whatsapp_mensagens(conteudo, criado_em, tipo)')
      .eq('medico_id', medicoId)
      .order('ultimo_contato', { ascending: false })
    setContatos(data || [])
    setCarregando(false)
  }

  const filtrados = contatos.filter(c =>
    (c.nome_contato || c.telefone).toLowerCase().includes(busca.toLowerCase()) ||
    c.telefone.includes(busca)
  )

  const ini = (nome: string) => nome?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() || '?'
  const fmt = (iso: string) => iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : ''

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f9fafb', overflow: 'hidden', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <Sidebar />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '20px 28px', borderBottom: '1px solid #e5e7eb', background: 'white', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>Contatos</h1>
            <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>{contatos.length} contatos no total</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ position: 'relative' }}>
              <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar contato..." style={{ padding: '8px 12px 8px 34px', borderRadius: 8, outline: 'none', fontSize: 14, width: 220, color: '#111827' }} />
            </div>
            <button onClick={() => router.push('/whatsapp-app')} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#00a884', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Abrir Chat
            </button>
          </div>
        </div>

        {/* Lista */}
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          {carregando ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #e5e7eb', borderTopColor: '#00a884', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : filtrados.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#6b7280' }}>
              <p style={{ fontSize: 40, margin: '0 0 12px' }}>👥</p>
              <p style={{ fontSize: 16, fontWeight: 600, color: '#111827', margin: '0 0 4px' }}>Nenhum contato encontrado</p>
              <p style={{ fontSize: 14, margin: 0 }}>Os contatos aparecem quando alguém manda mensagem pelo Chat</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {filtrados.map(c => {
                const nome = c.nome_contato || c.telefone
                const ultima = c.whatsapp_mensagens?.sort((a: any, b: any) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime())[0]
                const totalMsgs = c.whatsapp_mensagens?.length || 0
                return (
                  <div key={c.id} style={{ background: 'white', borderRadius: 12, padding: 16, cursor: 'pointer', transition: 'box-shadow 0.15s' }}
                    onClick={() => router.push('/whatsapp-app')}
                    onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      {c.foto_url
                        ? <img src={c.foto_url} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                        : <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#d9fdd3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#00a884', flexShrink: 0 }}>{ini(nome)}</div>
                      }
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                          <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome}</p>
                          <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0, marginLeft: 8 }}>{fmt(c.ultimo_contato)}</span>
                        </div>
                        <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.telefone}</p>
                        {ultima && <p style={{ fontSize: 12, color: '#9ca3af', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ultima.conteudo?.substring(0, 50)}</p>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: c.modo === 'ia' ? '#d9fdd3' : '#dbeafe', color: c.modo === 'ia' ? '#166534' : '#1e40af', fontWeight: 500 }}>
                        {c.modo === 'ia' ? '🤖 Sofia IA' : '👤 Humano'}
                      </span>
                      {c.status === 'encerrada' && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#f3f4f6', color: '#6b7280', fontWeight: 500 }}>✅ Encerrado</span>}
                      {c.nps_nota && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#fef9c3', color: '#854d0e', fontWeight: 500 }}>{'⭐'.repeat(c.nps_nota)} {c.nps_nota}/5</span>}
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#f9fafb', color: '#6b7280' }}>{totalMsgs} msgs</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
