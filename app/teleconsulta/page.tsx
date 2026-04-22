'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const ACCENT = '#6043C1'
const ACCENT_LIGHT = '#ede9fb'
const BG = '#F5F5F5'
const CARD_RADIUS = 16

export default function Teleconsulta() {
  const router = useRouter()
  const [medico, setMedico] = useState<any>(null)
  const [consultas, setConsultas] = useState<any[]>([])
  const [pacientes, setPacientes] = useState<any[]>([])
  const [criandoAgora, setCriandoAgora] = useState(false)
  const [linkCopiado, setLinkCopiado] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro', texto: string } | null>(null)

  useEffect(() => {
    (async () => {
      const ca = localStorage.getItem('clinica_admin')
      if (ca) {
        const admin = JSON.parse(ca)
        if (!admin.clinica_id) { router.push('/admin'); return }
        // Busca primeiro medico ativo da clinica
        const { data: primeiroMedico } = await supabase
          .from('medicos').select('*')
          .eq('clinica_id', admin.clinica_id).eq('cargo', 'medico').eq('ativo', true)
          .order('criado_em', { ascending: true }).limit(1).maybeSingle()
        if (!primeiroMedico) { router.push('/admin'); return }
        setMedico(primeiroMedico)
        carregar(primeiroMedico.id)
        supabase.from('pacientes').select('id,nome').eq('medico_id', primeiroMedico.id).order('nome').then(({ data }) => setPacientes(data || []))
        return
      }
      const m = localStorage.getItem('medico')
      if (!m) { router.push('/login'); return }
      const med = JSON.parse(m); setMedico(med)
      carregar(med.id)
      supabase.from('pacientes').select('id,nome').eq('medico_id', med.id).order('nome').then(({ data }) => setPacientes(data || []))
    })()
  }, [router])

  const carregar = useCallback(async (mid: string) => {
    const r = await fetch('/api/teleconsulta?medico_id=' + mid)
    const d = await r.json()
    setConsultas((d.teleconsultas || []).filter((c: any) => c.status !== 'encerrada'))
  }, [])

  const mostrarMsg = (tipo: 'ok' | 'erro', texto: string) => {
    setMsg({ tipo, texto })
    setTimeout(() => setMsg(null), 3500)
  }

  const criarAgora = async () => {
    if (!medico || criandoAgora) return
    setCriandoAgora(true)
    const codigo = Math.random().toString(36).slice(-4).toUpperCase()
    const r = await fetch('/api/teleconsulta', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ medico_id: medico.id, titulo: 'Consulta - ' + codigo })
    })
    const d = await r.json()
    if (d.teleconsulta) {
      const link = window.location.origin + '/sala/' + d.teleconsulta.sala_id
      navigator.clipboard.writeText(link).catch(() => {})
      setLinkCopiado(link)
      await carregar(medico.id)
      window.open('/sala/' + d.teleconsulta.sala_id, '_blank')
    }
    setCriandoAgora(false)
  }

  const abrirAgendamento = () => router.push('/agenda?nova_teleconsulta=1')

  const entrar = (salaId: string) => window.open('/sala/' + salaId, '_blank')

  const copiar = (salaId: string) => {
    const link = window.location.origin + '/sala/' + salaId
    navigator.clipboard.writeText(link)
    setLinkCopiado(link)
    setTimeout(() => setLinkCopiado(null), 3000)
    mostrarMsg('ok', 'Link copiado!')
  }

  const enviarWpp = async (consulta: any) => {
    const link = window.location.origin + '/sala/' + consulta.sala_id
    const msgTxt = 'Olá! Dr(a). ' + medico.nome + ' te convidou para uma teleconsulta.\n\nAcesse pelo link (não precisa instalar nada):\n' + link
    if (consulta.pacientes?.telefone) {
      await fetch('/api/whatsapp/enviar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone: consulta.pacientes.telefone, texto: msgTxt, medico_id: medico.id })
      })
      mostrarMsg('ok', 'Enviado por WhatsApp!')
    } else {
      navigator.clipboard.writeText(msgTxt)
      mostrarMsg('ok', 'Mensagem copiada (paciente sem telefone)')
    }
  }

  const encerrar = async (id: string) => {
    if (!confirm('Encerrar esta sala?')) return
    await supabase.from('teleconsultas').update({ status: 'encerrada', encerrada_em: new Date().toISOString() }).eq('id', id)
    carregar(medico.id)
    mostrarMsg('ok', 'Sala encerrada')
  }

  const statusInfo = (s: string): { txt: string; bg: string; cor: string } => {
    const map: Record<string, { txt: string; bg: string; cor: string }> = {
      aguardando: { txt: 'Aguardando', bg: '#fef3c7', cor: '#92400e' },
      em_andamento: { txt: 'Em andamento', bg: ACCENT_LIGHT, cor: ACCENT },
    }
    return map[s] || { txt: s, bg: '#f3f4f6', cor: '#6b7280' }
  }

  const fmtData = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

  const emAndamento = consultas.filter(c => c.status === 'em_andamento').length
  const aguardando = consultas.filter(c => c.status === 'aguardando').length

  return (
    <main style={{ height: '100%', overflow: 'auto', padding: 24, background: BG }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Teleconsulta</h1>
        <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Vídeo em tempo real — o paciente entra pelo link, sem precisar instalar nada</p>
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

      {/* Grid horizontal: 360px esquerda (botões) + resto direita (lista) */}
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20, alignItems: 'start' }}>

        {/* COLUNA ESQUERDA: 2 botões empilhados */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <button
            onClick={criarAgora}
            disabled={criandoAgora}
            style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: 24, background: ACCENT, color: 'white',
              border: 'none', borderRadius: CARD_RADIUS,
              cursor: criandoAgora ? 'not-allowed' : 'pointer',
              opacity: criandoAgora ? 0.7 : 1,
              textAlign: 'left' as const,
              boxShadow: '0 2px 12px rgba(96,67,193,0.15)',
            }}
          >
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M15 10l4.553-2.169A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14v-4zM3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px' }}>
                {criandoAgora ? 'Criando sala...' : 'Nova consulta agora'}
              </p>
              <p style={{ fontSize: 12, margin: 0, opacity: 0.9, lineHeight: 1.5 }}>
                Cria sala, copia o link e abre em nova aba
              </p>
            </div>
          </button>

          <button
            onClick={abrirAgendamento}
            style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: 24, background: 'white', color: '#111827',
              border: 'none', borderRadius: CARD_RADIUS,
              cursor: 'pointer', textAlign: 'left' as const,
            }}
          >
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: ACCENT_LIGHT,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px' }}>Agendar teleconsulta</p>
              <p style={{ fontSize: 12, color: '#6b7280', margin: 0, lineHeight: 1.5 }}>
                Programa no calendário e envia o link no horário
              </p>
            </div>
          </button>
        </div>

        {/* COLUNA DIREITA: banner + lista de salas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Banner de confirmação após criar */}
          {linkCopiado && (
            <div style={{
              background: ACCENT_LIGHT, borderRadius: 12,
              padding: '14px 18px',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', background: ACCENT,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, color: ACCENT, fontWeight: 700, margin: '0 0 3px' }}>Sala criada!</p>
                <p style={{ fontSize: 12, color: ACCENT, margin: 0, opacity: 0.8 }}>
                  Link copiado e sala aberta em nova aba.
                </p>
              </div>
            </div>
          )}

          {/* Header da seção */}
          <div>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 2px' }}>Salas ativas</h2>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>
              {consultas.length === 0
                ? 'Nenhuma sala ativa no momento'
                : `${consultas.length} sala${consultas.length !== 1 ? 's' : ''} — ${emAndamento} em andamento, ${aguardando} aguardando`
              }
            </p>
          </div>

          {/* Lista */}
          {consultas.length === 0 ? (
            <div style={{
              background: 'white', borderRadius: CARD_RADIUS,
              padding: 48, textAlign: 'center' as const,
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: 14,
                background: '#F5F5F5', color: '#9ca3af',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 14px',
              }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M15 10l4.553-2.169A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14v-4zM3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>
                </svg>
              </div>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Nenhuma sala ativa</p>
              <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>
                Crie uma consulta nos cards ao lado pra começar
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {consultas.map(c => {
                const st = statusInfo(c.status)
                const ehAndamento = c.status === 'em_andamento'
                return (
                  <div key={c.id} style={{
                    background: 'white', borderRadius: CARD_RADIUS,
                    padding: '16px 20px',
                    display: 'flex', alignItems: 'center', gap: 16,
                    border: ehAndamento ? `1.5px solid ${ACCENT_LIGHT}` : '1px solid transparent',
                  }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: ehAndamento ? ACCENT_LIGHT : '#F5F5F5',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                        stroke={ehAndamento ? ACCENT : '#9ca3af'} strokeWidth="2">
                        <path d="M15 10l4.553-2.169A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14v-4zM3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>
                      </svg>
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' as const }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0 }}>{c.titulo}</p>
                        <span style={{
                          fontSize: 10, fontWeight: 700,
                          color: st.cor, background: st.bg,
                          padding: '3px 10px', borderRadius: 20,
                          textTransform: 'uppercase' as const, letterSpacing: '0.04em',
                        }}>
                          {st.txt}
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
                        {c.pacientes?.nome ? c.pacientes.nome + ' · ' : ''}
                        Criada em {fmtData(c.criado_em)}
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => copiar(c.sala_id)} style={{
                        padding: '8px 12px', borderRadius: 9,
                        background: 'white', border: '1px solid #e5e7eb',
                        fontSize: 12, color: '#374151', fontWeight: 500,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2"/>
                          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                        </svg>
                        Copiar
                      </button>
                      <button onClick={() => enviarWpp(c)} style={{
                        padding: '8px 12px', borderRadius: 9,
                        background: '#ecfdf5', color: '#059669',
                        border: '1px solid #a7f3d0',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 5,
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                        WhatsApp
                      </button>
                      <button onClick={() => entrar(c.sala_id)} style={{
                        padding: '8px 16px', borderRadius: 9,
                        background: ACCENT, color: 'white', border: 'none',
                        fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      }}>
                        Entrar
                      </button>
                      <button onClick={() => encerrar(c.id)} title="Encerrar sala" style={{
                        padding: '8px 10px', borderRadius: 9,
                        background: '#fef2f2', color: '#dc2626',
                        border: '1px solid #fecaca',
                        fontSize: 12, cursor: 'pointer',
                        display: 'flex', alignItems: 'center',
                      }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18"/>
                          <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
