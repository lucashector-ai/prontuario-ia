'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'

export default function Configuracoes() {
  const router = useRouter()
  const [medico, setMedico] = useState<any>(null)
  const [config, setConfig] = useState<any>(null)
  const [form, setForm] = useState({ phone_number_id: '', access_token: '', nome_exibicao: '' })
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [removendo, setRemovendo] = useState(false)

  useEffect(() => {
    const m = localStorage.getItem('medico')
    if (!m) { router.push('/login'); return }
    const med = JSON.parse(m); setMedico(med)
    carregarConfig(med.id)
  }, [router])

  const carregarConfig = async (medicoId: string) => {
    const r = await fetch('/api/whatsapp-config?medico_id=' + medicoId)
    const d = await r.json()
    if (d.config) { setConfig(d.config); setForm(f => ({ ...f, nome_exibicao: d.config.nome_exibicao || '' })) }
  }

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault(); setSalvando(true); setMsg(null)
    try {
      const r = await fetch('/api/whatsapp-config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medico_id: medico.id, ...form })
      })
      const d = await r.json()
      if (d.error) { setMsg({ tipo: 'erro', texto: d.error }) }
      else { setConfig(d.config); setMsg({ tipo: 'ok', texto: 'WhatsApp conectado com sucesso! Numero: ' + d.meta.phone }); setForm(f => ({ ...f, access_token: '', phone_number_id: '' })) }
    } catch (e: any) { setMsg({ tipo: 'erro', texto: e.message }) }
    finally { setSalvando(false) }
  }

  const remover = async () => {
    if (!confirm('Desconectar o WhatsApp desta clinica?')) return
    setRemovendo(true)
    await fetch('/api/whatsapp-config?medico_id=' + medico.id, { method: 'DELETE' })
    setConfig(null); setMsg({ tipo: 'ok', texto: 'WhatsApp desconectado.' })
    setRemovendo(false)
  }

  const WEBHOOK_URL = 'https://prontuario-ia-five.vercel.app/api/whatsapp'
  const VERIFY_TOKEN = 'media_whatsapp_2026'

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F5F5F5', overflow: 'hidden' }}>
      <main style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ maxWidth: 680 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#111827', margin: '0 0 6px', letterSpacing: '-0.3px' }}>Configuracoes</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 32px' }}>Gerencie as integracoes da sua clinica</p>

          {/* Status atual */}
          {config && (
            <div style={{ background: '#F5F5F5', border: '1px solid #A7E0BF', borderRadius: 12, padding: '16px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: '#1F9D5C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#1F9D5C', margin: 0 }}>WhatsApp conectado</p>
                  <p style={{ fontSize: 12, color: '#1F9D5C', margin: 0 }}>{config.phone_number || config.phone_number_id} · {config.nome_exibicao}</p>
                </div>
              </div>
              <button onClick={remover} disabled={removendo} style={{ fontSize: 12, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '6px 14px', borderRadius: 7, cursor: 'pointer', fontWeight: 600 }}>
                {removendo ? 'Removendo...' : 'Desconectar'}
              </button>
            </div>
          )}

          {/* Card de conexao */}
          <div style={{ background: 'white', borderRadius: 14, overflow: 'hidden', marginBottom: 24 }}>
            <div style={{ padding: '18px 24px', borderBottom: 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#E8F7EF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📱</div>
              <div>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0 }}>{config ? 'Atualizar' : 'Conectar'} WhatsApp Business</h2>
                <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>Cada clinica usa seu proprio numero oficial</p>
              </div>
            </div>
            <form onSubmit={salvar} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Phone Number ID <span style={{ color: '#dc2626' }}>*</span></label>
                <input required value={form.phone_number_id} onChange={e => setForm(f => ({ ...f, phone_number_id: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 8, border: '1.5px solid #e5e7eb', fontFamily: 'monospace' }}
                  placeholder="2271401213668054"/>
                <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 0' }}>Meta for Developers → WhatsApp → Configuracao da API → Phone Number ID</p>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Token de acesso permanente <span style={{ color: '#dc2626' }}>*</span></label>
                <input required type="password" value={form.access_token} onChange={e => setForm(f => ({ ...f, access_token: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 8, border: '1.5px solid #e5e7eb', fontFamily: 'monospace' }}
                  placeholder="EAANoj..."/>
                <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 0' }}>Meta Business Manager → Usuarios do sistema → Gerar token permanente</p>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Nome de exibicao da clinica</label>
                <input value={form.nome_exibicao} onChange={e => setForm(f => ({ ...f, nome_exibicao: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 8, border: '1.5px solid #e5e7eb' }}
                  placeholder="Clínica Dr. Silva"/>
              </div>
              {msg && (
                <div style={{ background: msg.tipo === 'ok' ? '#F5F5F5' : '#fef2f2', border: '1px solid ' + (msg.tipo === 'ok' ? '#A7E0BF' : '#fecaca'), borderRadius: 9, padding: '10px 14px' }}>
                  <p style={{ fontSize: 13, color: msg.tipo === 'ok' ? '#1F9D5C' : '#dc2626', margin: 0 }}>{msg.texto}</p>
                </div>
              )}
              <button type="submit" disabled={salvando} style={{ padding: '11px', borderRadius: 9, border: 'none', background: salvando ? '#b9a9ef' : '#1F9D5C', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                {salvando ? 'Validando e conectando...' : config ? 'Atualizar conexao' : 'Conectar WhatsApp'}
              </button>
            </form>
          </div>

          {/* Instrucoes do webhook */}
          <div style={{ background: 'white', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '18px 24px', borderBottom: 'none' }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0 }}>Configurar webhook no Meta</h2>
              <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0' }}>Configure uma vez e todas as mensagens chegam automaticamente</p>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { n: 1, txt: 'Acesse developers.facebook.com → seu app → WhatsApp → Configuracao' },
                { n: 2, txt: 'Clique em "Editar" na secao Webhooks' },
                { n: 3, txt: 'Cole a URL do callback e o token abaixo, clique em Verificar' },
                { n: 4, txt: 'Marque o campo "messages" em Campos do webhook' },
              ].map(s => (
                <div key={s.n} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#1F9D5C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'white', flexShrink: 0, marginTop: 1 }}>{s.n}</div>
                  <p style={{ fontSize: 13, color: '#374151', margin: 0, lineHeight: 1.5 }}>{s.txt}</p>
                </div>
              ))}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                {[
                  { label: 'URL do callback', valor: WEBHOOK_URL },
                  { label: 'Token de verificacao', valor: VERIFY_TOKEN },
                ].map(item => (
                  <div key={item.label}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</p>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <code style={{ flex: 1, padding: '8px 12px', background: '#F5F5F5', borderRadius: 7, fontSize: 12, color: '#374151', fontFamily: 'monospace' }}>{item.valor}</code>
                      <button onClick={() => navigator.clipboard.writeText(item.valor)} style={{ padding: '7px 12px', background: 'white', borderRadius: 7, fontSize: 11, color: '#6b7280', cursor: 'pointer', fontWeight: 600, flexShrink: 0 }}>Copiar</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
