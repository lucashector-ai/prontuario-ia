'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function Notificacoes({ medicoId }: { medicoId: string }) {
  const [notifs, setNotifs] = useState<any[]>([])
  const [aberto, setAberto] = useState(false)

  useEffect(() => {
    if (!medicoId) return
    carregar()
    // Poll a cada 30s
    const interval = setInterval(carregar, 30000)
    return () => clearInterval(interval)
  }, [medicoId])

  async function carregar() {
    const { data } = await supabase
      .from('notificacoes_admin')
      .select('*')
      .eq('medico_id', medicoId)
      .eq('lida', false)
      .order('criado_em', { ascending: false })
      .limit(10)
    setNotifs(data || [])
  }

  async function marcarLida(id: string) {
    await supabase.from('notificacoes_admin').update({ lida: true }).eq('id', id)
    setNotifs(prev => prev.filter(n => n.id !== id))
  }

  async function marcarTodasLidas() {
    await supabase.from('notificacoes_admin').update({ lida: true }).eq('medico_id', medicoId)
    setNotifs([])
    setAberto(false)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setAberto(!aberto)} style={{
        position: 'relative', background: 'none', border: 'none', cursor: 'pointer',
        padding: 6, borderRadius: 8, color: '#6b7280',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
        </svg>
        {notifs.length > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            width: 16, height: 16, background: '#ef4444',
            borderRadius: '50%', fontSize: 10, fontWeight: 700,
            color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            {notifs.length > 9 ? '9+' : notifs.length}
          </span>
        )}
      </button>

      {aberto && (
        <>
          <div onClick={() => setAberto(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div style={{
            position: 'absolute', right: 0, top: '100%', marginTop: 8,
            width: 340, background: 'white', borderRadius: 12,
            border: '1px solid #f0f0f0',
            zIndex: 50, overflow: 'hidden'
          }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f9fafb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Notificações</span>
              {notifs.length > 0 && (
                <button onClick={marcarTodasLidas} style={{ fontSize: 12, color: '#6043C1', background: 'none', border: 'none', cursor: 'pointer' }}>
                  Marcar todas como lidas
                </button>
              )}
            </div>
            <div style={{ maxHeight: 360, overflow: 'auto' }}>
              {notifs.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center' }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>🔔</div>
                  <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>Sem notificações</p>
                </div>
              ) : notifs.map(n => (
                <div key={n.id} style={{ padding: '12px 16px', borderBottom: '1px solid #f9fafb', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6043C1', flexShrink: 0, marginTop: 4 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: '0 0 2px' }}>{n.titulo}</p>
                    <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 6px', lineHeight: 1.4 }}>{n.mensagem}</p>
                    <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>
                      {new Date(n.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <button onClick={() => marcarLida(n.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', flexShrink: 0, fontSize: 16, padding: 0 }}>×</button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
