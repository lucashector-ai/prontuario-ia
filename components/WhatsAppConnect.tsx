'use client'

import { useState } from 'react'

const ACCENT = '#6043C1'
const ACCENT_LIGHT = '#ede9fb'

interface Props {
  medicoId: string
  onConnected: () => void
}

export function WhatsAppConnect({ medicoId, onConnected }: Props) {
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [conectando, setConectando] = useState(false)
  const [erro, setErro] = useState('')

  const conectar = async () => {
    if (!phoneNumberId.trim() || !accessToken.trim()) {
      setErro('Preencha o Phone Number ID e o Access Token')
      return
    }
    setConectando(true)
    setErro('')
    try {
      const r = await fetch('/api/whatsapp-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medico_id: medicoId,
          phone_number_id: phoneNumberId.trim(),
          access_token: accessToken.trim(),
        }),
      })
      const d = await r.json()
      if (!r.ok || d.error) {
        setErro(d.error || 'Não foi possível conectar — verifique as credenciais')
        setConectando(false)
        return
      }
      // Sucesso — recarrega WhatsApp app
      onConnected()
    } catch (e: any) {
      setErro('Erro de rede: ' + (e?.message || 'tente novamente'))
      setConectando(false)
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', background: '#F5F5F5', overflow: 'auto' }}>
      {/* Coluna esquerda — ilustração + headline */}
      <div style={{
        flex: '1 1 auto', minWidth: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 40, gap: 24,
        background: `linear-gradient(135deg, ${ACCENT_LIGHT} 0%, #F5F5F5 100%)`,
      }}>
        {/* Ilustração: balões de chat sobrepostos */}
        <div style={{ position: 'relative', width: 220, height: 180 }}>
          <div style={{
            position: 'absolute', top: 30, left: 0,
            width: 130, height: 90, borderRadius: 18,
            background: ACCENT, color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(96,67,193,0.25)',
            transform: 'rotate(-6deg)',
          }}>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
          </div>
          <div style={{
            position: 'absolute', top: 0, right: 10,
            width: 110, height: 90, borderRadius: 18,
            background: '#25d366', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(37,211,102,0.3)',
            transform: 'rotate(8deg)',
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            </svg>
          </div>
        </div>
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: '0 0 10px', lineHeight: 1.2 }}>
            Conecte seu WhatsApp Business à MedIA
          </h1>
          <p style={{ fontSize: 14, color: '#6b7280', margin: 0, lineHeight: 1.6 }}>
            Atenda pacientes, envie lembretes e use a Sofia IA — tudo dentro da plataforma, sem precisar abrir o WhatsApp.
          </p>
        </div>
      </div>

      {/* Coluna direita — passos + form */}
      <div style={{
        width: 480, flexShrink: 0,
        background: 'white',
        borderLeft: '1px solid #e5e7eb',
        padding: 32, overflow: 'auto',
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: ACCENT, letterSpacing: '0.08em', margin: '0 0 6px', textTransform: 'uppercase' }}>
            Configuração inicial
          </p>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0 }}>
            Vamos conectar em 3 passos
          </h2>
        </div>

        {/* Passo 1 */}
        <Step n={1} titulo="Acesse o Meta for Developers">
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 6px', lineHeight: 1.5 }}>
            Abra <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" style={{ color: ACCENT, fontWeight: 600 }}>developers.facebook.com/apps</a> e selecione o app da sua clínica com WhatsApp Business configurado.
          </p>
        </Step>

        {/* Passo 2 */}
        <Step n={2} titulo="Copie suas credenciais">
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 4px', lineHeight: 1.5 }}>
            No menu WhatsApp → Configuração da API:
          </p>
          <ul style={{ fontSize: 13, color: '#6b7280', margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
            <li><strong>Phone Number ID</strong> — identificador do número Business</li>
            <li><strong>Access Token</strong> — gere um token permanente do System User</li>
          </ul>
        </Step>

        {/* Passo 3 — formulário */}
        <Step n={3} titulo="Cole abaixo e conecte">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
            <div>
              <label style={labelStyle}>Phone Number ID</label>
              <input
                value={phoneNumberId}
                onChange={e => setPhoneNumberId(e.target.value)}
                placeholder="Ex: 1030374870164992"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Access Token</label>
              <input
                type="password"
                value={accessToken}
                onChange={e => setAccessToken(e.target.value)}
                placeholder="EAAxxxxx..."
                style={inputStyle}
              />
            </div>
          </div>
        </Step>

        {erro && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#991b1b' }}>
            {erro}
          </div>
        )}

        <button
          onClick={conectar}
          disabled={conectando || !phoneNumberId.trim() || !accessToken.trim()}
          style={{
            width: '100%', padding: '12px', borderRadius: 10, border: 'none',
            background: ACCENT, color: 'white', fontSize: 14, fontWeight: 700,
            cursor: conectando ? 'default' : 'pointer',
            opacity: (conectando || !phoneNumberId.trim() || !accessToken.trim()) ? 0.6 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            marginTop: 4,
          }}>
          {conectando ? (
            <>
              <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', animation: 'spin 0.8s linear infinite' }}/>
              Validando com Meta...
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Conectar WhatsApp
            </>
          )}
        </button>

        <p style={{ fontSize: 11, color: '#9ca3af', margin: 0, lineHeight: 1.5, textAlign: 'center' }}>
          Suas credenciais ficam armazenadas com segurança. Você pode desconectar a qualquer momento nas configurações.
        </p>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}

function Step({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: ACCENT_LIGHT, color: ACCENT,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700, flexShrink: 0,
      }}>{n}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: '4px 0 4px' }}>{titulo}</p>
        {children}
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280',
  marginBottom: 5, letterSpacing: '0.05em', textTransform: 'uppercase' as const,
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8,
  border: '1px solid #e5e7eb', outline: 'none', background: 'white', color: '#111827',
}
