'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'

export default function Exames() {
  const router = useRouter()
  const [medico, setMedico] = useState<any>(null)
  const [imagem, setImagem] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [contexto, setContexto] = useState('')
  const [analisando, setAnalisando] = useState(false)
  const [analise, setAnalise] = useState<any>(null)
  const [erro, setErro] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const m = localStorage.getItem('medico')
    if (!m) { router.push('/login'); return }
    setMedico(JSON.parse(m))
  }, [router])

  const handleImagem = (file: File) => {
    setImagem(file)
    setAnalise(null)
    setErro('')
    const reader = new FileReader()
    reader.onload = e => setPreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) handleImagem(file)
  }

  const handleAnalisar = async () => {
    if (!imagem) return
    setAnalisando(true); setErro('')
    try {
      const form = new FormData()
      form.append('imagem', imagem)
      if (contexto) form.append('contexto', contexto)
      const res = await fetch('/api/analisar-exame', { method: 'POST', body: form })
      const data = await res.json()
      if (data.analise) setAnalise(data.analise)
      else setErro(data.error || 'Erro ao analisar')
    } catch (e: any) { setErro(e.message) }
    finally { setAnalisando(false) }
  }

  const statusCor = (s: string) => {
    if (s === 'critico') return { bg: '#fef2f2', border: '#fecaca', text: '#dc2626', badge: '#dc2626', badgeBg: '#fef2f2' }
    if (s === 'alterado') return { bg: '#fffbeb', border: '#fde68a', text: '#92400e', badge: '#d97706', badgeBg: '#fffbeb' }
    return { bg: '#F5F5F5', border: '#A7E0BF', text: '#1F9D5C', badge: '#1F9D5C', badgeBg: '#F5F5F5' }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F5F5F5', overflow: 'hidden' }}>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '0 32px', height: 56, borderBottom: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h1 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0 }}>Análise de exames</h1>
            <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>IA interpreta laudos e resultados laboratoriais</p>
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 28, display: 'grid', gridTemplateColumns: analise ? '1fr 1fr' : '1fr', gap: 20 }}>

          {/* Upload + contexto */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => !preview && inputRef.current?.click()}
              style={{
                background: 'white', border: `2px dashed ${preview ? '#A7E0BF' : '#e5e7eb'}`,
                borderRadius: 14, overflow: 'hidden', cursor: preview ? 'default' : 'pointer',
                minHeight: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                transition: 'border-color 0.15s',
              }}>
              {preview ? (
                <div style={{ position: 'relative', width: '100%' }}>
                  <img src={preview} alt="Exame" style={{ width: '100%', maxHeight: 400, objectFit: 'contain' }}/>
                  <button onClick={e => { e.stopPropagation(); setImagem(null); setPreview(null); setAnalise(null) }}
                    style={{ position: 'absolute', top: 10, right: 10, background: 'white', borderRadius: 8, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: '#6b7280' }}>
                    Trocar imagem
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <div style={{ width: 56, height: 56, borderRadius: 14, background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1F9D5C" strokeWidth="1.5">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                    </svg>
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: '0 0 6px' }}>Enviar exame ou laudo</p>
                  <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 16px' }}>Arraste a imagem aqui ou clique para selecionar</p>
                  <span style={{ fontSize: 11, color: '#9ca3af', background: '#f3f4f6', padding: '3px 10px', borderRadius: 20 }}>JPG, PNG, PDF • Máx. 10MB</span>
                </div>
              )}
            </div>
            <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImagem(f) }}/>

            <div style={{ background: '#F5F5F5', borderRadius: 12, padding: '16px 20px' }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>
                Contexto clínico <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>(opcional)</span>
              </label>
              <textarea value={contexto} onChange={e => setContexto(e.target.value)}
                style={{ width: '100%', minHeight: 80, fontSize: 13, borderRadius: 8, padding: '10px 12px', resize: 'vertical', color: '#374151', lineHeight: 1.6 }}
                placeholder="Ex: Paciente com diabetes e hipertensão, 58 anos, em acompanhamento por dislipidemia..."/>
            </div>

            {erro && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px' }}>
                <p style={{ fontSize: 13, color: '#dc2626', margin: 0 }}>{erro}</p>
              </div>
            )}

            <button onClick={handleAnalisar} disabled={!imagem || analisando} style={{
              padding: '12px', borderRadius: 10, border: 'none', cursor: imagem ? 'pointer' : 'not-allowed',
              background: !imagem ? '#f3f4f6' : analisando ? '#A7E0BF' : '#1F9D5C',
              color: !imagem ? '#9ca3af' : 'white', fontSize: 14, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              {analisando ? (
                <>
                  <svg style={{ animation: 'spin 0.8s linear infinite' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M2 12h4M18 12h4"/>
                  </svg>
                  Analisando exame com IA...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                  </svg>
                  Analisar exame
                </>
              )}
            </button>
          </div>

          {/* Resultado da análise */}
          {analise && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflow: 'auto' }}>
              {/* Header do exame */}
              <div style={{ background: '#F5F5F5', borderRadius: 12, padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 2px' }}>{analise.tipo_exame}</p>
                    {analise.data_exame && <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>Data: {analise.data_exame}</p>}
                  </div>
                  <span style={{ fontSize: 11, color: '#1F9D5C', background: '#F5F5F5', padding: '3px 10px', borderRadius: 20, fontWeight: 600, flexShrink: 0 }}>
                    ✓ Analisado pela IA
                  </span>
                </div>
                <p style={{ fontSize: 13, color: '#374151', margin: 0, lineHeight: 1.6, background: '#F5F5F5', borderRadius: 8, padding: '10px 12px' }}>{analise.resumo}</p>
              </div>

              {/* Alertas */}
              {analise.alertas?.length > 0 && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderLeft: '4px solid #dc2626', borderRadius: '0 10px 10px 0', padding: '12px 16px' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>⚠ Achados importantes</p>
                  {analise.alertas.map((a: string, i: number) => (
                    <p key={i} style={{ fontSize: 12, color: '#b91c1c', margin: '3px 0', display: 'flex', gap: 6 }}><span>·</span>{a}</p>
                  ))}
                </div>
              )}

              {/* Valores */}
              {analise.valores?.length > 0 && (
                <div style={{ background: 'white', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: 'none' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Valores encontrados</p>
                  </div>
                  {analise.valores.map((v: any, i: number) => {
                    const c = statusCor(v.status)
                    return (
                      <div key={i} style={{ padding: '12px 16px', borderBottom: i < analise.valores.length - 1 ? '1px solid #F5F5F5' : 'none', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0 }}>{v.nome}</p>
                            <span style={{ fontSize: 10, fontWeight: 700, color: c.badge, background: c.badgeBg, padding: '1px 7px', borderRadius: 20, border: `1px solid ${c.border}`, textTransform: 'uppercase' }}>
                              {v.status}
                            </span>
                          </div>
                          <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>{v.interpretacao}</p>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <p style={{ fontSize: 14, fontWeight: 700, color: c.badge, margin: '0 0 2px' }}>{v.valor}</p>
                          <p style={{ fontSize: 10, color: '#9ca3af', margin: 0 }}>Ref: {v.referencia}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Conclusão */}
              <div style={{ background: '#F5F5F5', borderRadius: 12, padding: '16px 20px' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Conclusão clínica</p>
                <p style={{ fontSize: 13, color: '#374151', margin: 0, lineHeight: 1.7 }}>{analise.conclusao}</p>
              </div>

              {/* Recomendações */}
              {analise.recomendacoes?.length > 0 && (
                <div style={{ background: '#F5F5F5', borderRadius: 12, padding: '16px 20px' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#1F9D5C', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Recomendações</p>
                  {analise.recomendacoes.map((r: string, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#1F9D5C', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                      </div>
                      <p style={{ fontSize: 13, color: '#1F9D5C', margin: 0, lineHeight: 1.6 }}>{r}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
