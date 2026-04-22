'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Notificacao = {
  id: string
  tipo: 'confirmacao_recusada' | 'confirmacao_ignorada' | 'reagendamento_solicitado'
  titulo: string
  descricao: string | null
  agendamento_id: string | null
  lida: boolean
  criada_em: string
}

export function NotificacoesSofia({ medicoId }: { medicoId: string }) {
  const router = useRouter()
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [aberto, setAberto] = useState(false)

  const carregar = async () => {
    try {
      const r = await fetch(`/api/notificacoes-sofia?medico_id=${medicoId}&nao_lidas=true`)
      const d = await r.json()
      if (d.notificacoes) setNotificacoes(d.notificacoes)
    } catch {}
  }

  useEffect(() => {
    carregar()
    // Atualiza a cada 60s
    const i = setInterval(carregar, 60000)
    return () => clearInterval(i)
  }, [medicoId])

  const marcarLida = async (id: string) => {
    await fetch('/api/notificacoes-sofia', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, lida: true }),
    })
    setNotificacoes(prev => prev.filter(n => n.id !== id))
  }

  const iconePorTipo: Record<string, string> = {
    confirmacao_recusada: '❌',
    confirmacao_ignorada: '⏱',
    reagendamento_solicitado: '🔄',
  }

  const corPorTipo: Record<string, string> = {
    confirmacao_recusada: '#dc2626',
    confirmacao_ignorada: '#d97706',
    reagendamento_solicitado: '#6043C1',
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setAberto(!aberto)}
        style={{
          position: 'relative',
          width: 36, height: 36, borderRadius: 10,
          background: 'white', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 01-3.46 0"/>
        </svg>
        {notificacoes.length > 0 && (
          <span style={{
            position: 'absolute', top: 4, right: 4,
            minWidth: 16, height: 16, padding: '0 5px',
            background: '#dc2626', color: 'white',
            borderRadius: 10, fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {notificacoes.length > 9 ? '9+' : notificacoes.length}
          </span>
        )}
      </button>

      {aberto && (
        <>
          <div
            onClick={() => setAberto(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 99 }}
          />
          <div style={{
            position: 'absolute', top: 44, right: 0, width: 340,
            background: 'white', borderRadius: 12,
            boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
            zIndex: 100, overflow: 'hidden',
          }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6' }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#111827' }}>
                Notificações da Sofia
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9ca3af' }}>
                {notificacoes.length === 0 ? 'Tudo em dia 💜' : `${notificacoes.length} novas`}
              </p>
            </div>
            <div style={{ maxHeight: 400, overflow: 'auto' }}>
              {notificacoes.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>
                  Nenhuma notificação pendente
                </div>
              ) : (
                notificacoes.map(n => (
                  <div
                    key={n.id}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid #F5F5F5',
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      marcarLida(n.id)
                      if (n.agendamento_id) router.push('/agenda')
                      setAberto(false)
                    }}
                  >
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 16 }}>{iconePorTipo[n.tipo] || '🔔'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: corPorTipo[n.tipo] || '#111827' }}>
                          {n.titulo}
                        </p>
                        {n.descricao && (
                          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6b7280' }}>
                            {n.descricao}
                          </p>
                        )}
                        <p style={{ margin: '4px 0 0', fontSize: 10, color: '#9ca3af' }}>
                          {new Date(n.criada_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
