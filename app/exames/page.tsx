'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

const ACCENT = '#6043C1'
const ACCENT_LIGHT = '#ede9fb'
const BG = '#F5F5F5'
const CARD_RADIUS = 16

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
    const ca_ = localStorage.getItem('clinica_admin')
    const m = ca_ || localStorage.getItem('medico')
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
    if (s === 'critico') return { badge: '#dc2626', badgeBg: '#fef2f2', border: '#fecaca' }
    if (s === 'alterado') return { badge: '#d97706', badgeBg: '#fffbeb', border: '#fde68a' }
    return { badge: ACCENT, badgeBg: ACCENT_LIGHT, border: '#d4c9f7' }
  }

  return (
    <main style={{ height: '100%', overflow: 'auto', padding: 24, background: BG }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Análise de exames</h1>
        <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Envie um exame ou laudo e a IA interpreta pra você em segundos</p>
      </div>

      {/* Grid 2 colunas quando tem análise, 1 coluna caso contrário */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: analise ? '1fr 1fr' : '1fr',
        gap: 20,
        maxWidth: analise ? 'none' : 720,
      }}>

        {/* COLUNA ESQUERDA — upload + contexto + botão */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Dropzone */}
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => !preview && inputRef.current?.click()}
            style={{
              background: 'white',
              border: `2px dashed ${preview ? ACCENT : '#e5e7eb'}`,
              borderRadius: CARD_RADIUS,
              overflow: 'hidden',
              cursor: preview ? 'default' : 'pointer',
              minHeight: 300,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => { if (!preview) e.currentTarget.style.borderColor = ACCENT }}
            onMouseLeave={e => { if (!preview) e.currentTarget.style.borderColor = '#e5e7eb' }}
          >
            {preview ? (
              <div style={{ position: 'relative', width: '100%' }}>
                <img src={preview} alt="Exame" style={{ width: '100%', maxHeight: 400, objectFit: 'contain', display: 'block' }}/>
                <button onClick={e => { e.stopPropagation(); setImagem(null); setPreview(null); setAnalise(null) }}
                  style={{
                    position: 'absolute', top: 12, right: 12,
                    background: 'white', border: '1px solid #e5e7eb',
                    borderRadius: 10, padding: '6px 12px',
                    fontSize: 12, fontWeight: 600, color: '#374151',
                    cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  }}>
                  Trocar imagem
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 16,
                  background: ACCENT_LIGHT,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px',
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.8">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                  </svg>
                </div>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>Enviar exame ou laudo</p>
                <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 14px' }}>Arraste a imagem aqui ou clique pra selecionar</p>
                <span style={{
                  fontSize: 11, fontWeight: 500, color: '#6b7280',
                  background: '#f3f4f6', padding: '4px 12px', borderRadius: 20,
                }}>
                  JPG, PNG, PDF · Máx. 10MB
                </span>
              </div>
            )}
          </div>
          <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleImagem(f) }}/>

          {/* Contexto clínico */}
          <div style={{ background: 'white', borderRadius: CARD_RADIUS, padding: 20 }}>
            <label style={{
              fontSize: 11, fontWeight: 600, color: '#6b7280',
              display: 'block', marginBottom: 8,
              textTransform: 'uppercase' as const, letterSpacing: '0.04em',
            }}>
              Contexto clínico <span style={{ fontWeight: 400, textTransform: 'none' as const }}>(opcional)</span>
            </label>
            <textarea
              value={contexto}
              onChange={e => setContexto(e.target.value)}
              placeholder="Ex: Paciente com diabetes e hipertensão, 58 anos, em acompanhamento por dislipidemia..."
              style={{
                width: '100%', minHeight: 90, fontSize: 13,
                borderRadius: 10, padding: '10px 14px',
                border: '1px solid #e5e7eb', outline: 'none',
                resize: 'vertical' as const, color: '#374151',
                lineHeight: 1.6, fontFamily: 'inherit', boxSizing: 'border-box' as const,
              }}
            />
            <p style={{ margin: '8px 0 0', fontSize: 11, color: '#9ca3af', lineHeight: 1.5 }}>
              Quanto mais contexto, melhor a análise. A IA usa pra comparar valores com o histórico do paciente.
            </p>
          </div>

          {erro && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca',
              borderRadius: 10, padding: '12px 14px',
            }}>
              <p style={{ fontSize: 13, color: '#991b1b', margin: 0, fontWeight: 500 }}>{erro}</p>
            </div>
          )}

          <button
            onClick={handleAnalisar}
            disabled={!imagem || analisando}
            style={{
              padding: 14, borderRadius: 10, border: 'none',
              cursor: imagem && !analisando ? 'pointer' : 'not-allowed',
              background: !imagem ? '#f3f4f6' : analisando ? '#9ca3af' : ACCENT,
              color: !imagem ? '#9ca3af' : 'white',
              fontSize: 14, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {analisando ? (
              <>
                <svg style={{ animation: 'spin 0.8s linear infinite' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M2 12h4M18 12h4"/>
                </svg>
                Analisando exame com IA...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="M21 21l-4.35-4.35"/>
                </svg>
                Analisar exame
              </>
            )}
          </button>
        </div>

        {/* COLUNA DIREITA — resultado da análise */}
        {analise && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Card: tipo + resumo */}
            <div style={{ background: 'white', borderRadius: CARD_RADIUS, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 17, fontWeight: 700, color: '#111827', margin: '0 0 3px' }}>{analise.tipo_exame}</p>
                  {analise.data_exame && (
                    <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>Data do exame: {analise.data_exame}</p>
                  )}
                </div>
                <span style={{
                  fontSize: 11, color: ACCENT, background: ACCENT_LIGHT,
                  padding: '4px 12px', borderRadius: 20, fontWeight: 700,
                  flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Analisado pela IA
                </span>
              </div>
              <div style={{ background: '#F9FAFB', borderRadius: 10, padding: '12px 14px' }}>
                <p style={{ fontSize: 13, color: '#374151', margin: 0, lineHeight: 1.6 }}>{analise.resumo}</p>
              </div>
            </div>

            {/* Card: alertas críticos */}
            {analise.alertas?.length > 0 && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderLeft: '4px solid #dc2626',
                borderRadius: CARD_RADIUS,
                padding: 20,
              }}>
                <p style={{
                  fontSize: 11, fontWeight: 700, color: '#dc2626',
                  margin: '0 0 10px',
                  textTransform: 'uppercase' as const, letterSpacing: '0.06em',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  Achados importantes
                </p>
                {analise.alertas.map((a: string, i: number) => (
                  <p key={i} style={{
                    fontSize: 13, color: '#991b1b', margin: '4px 0',
                    display: 'flex', gap: 8, lineHeight: 1.5,
                  }}>
                    <span style={{ fontWeight: 700 }}>•</span>
                    {a}
                  </p>
                ))}
              </div>
            )}

            {/* Card: valores */}
            {analise.valores?.length > 0 && (
              <div style={{ background: 'white', borderRadius: CARD_RADIUS, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6' }}>
                  <p style={{
                    fontSize: 11, fontWeight: 700, color: '#9ca3af', margin: 0,
                    textTransform: 'uppercase' as const, letterSpacing: '0.06em',
                  }}>
                    Valores encontrados
                  </p>
                </div>
                {analise.valores.map((v: any, i: number) => {
                  const c = statusCor(v.status)
                  return (
                    <div key={i} style={{
                      padding: '14px 20px',
                      borderBottom: i < analise.valores.length - 1 ? '1px solid #f3f4f6' : 'none',
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' as const }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0 }}>{v.nome}</p>
                          <span style={{
                            fontSize: 10, fontWeight: 700,
                            color: c.badge, background: c.badgeBg,
                            padding: '2px 8px', borderRadius: 10,
                            border: `1px solid ${c.border}`,
                            textTransform: 'uppercase' as const,
                          }}>
                            {v.status}
                          </span>
                        </div>
                        <p style={{ fontSize: 12, color: '#6b7280', margin: 0, lineHeight: 1.5 }}>{v.interpretacao}</p>
                      </div>
                      <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                        <p style={{ fontSize: 16, fontWeight: 800, color: c.badge, margin: '0 0 2px' }}>{v.valor}</p>
                        <p style={{ fontSize: 10, color: '#9ca3af', margin: 0 }}>Ref: {v.referencia}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Card: conclusão */}
            <div style={{ background: 'white', borderRadius: CARD_RADIUS, padding: 20 }}>
              <p style={{
                fontSize: 11, fontWeight: 700, color: '#9ca3af', margin: '0 0 10px',
                textTransform: 'uppercase' as const, letterSpacing: '0.06em',
              }}>
                Conclusão clínica
              </p>
              <p style={{ fontSize: 14, color: '#374151', margin: 0, lineHeight: 1.7 }}>{analise.conclusao}</p>
            </div>

            {/* Card: recomendações */}
            {analise.recomendacoes?.length > 0 && (
              <div style={{ background: ACCENT_LIGHT, borderRadius: CARD_RADIUS, padding: 20 }}>
                <p style={{
                  fontSize: 11, fontWeight: 700, color: ACCENT, margin: '0 0 12px',
                  textTransform: 'uppercase' as const, letterSpacing: '0.06em',
                }}>
                  Recomendações
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {analise.recomendacoes.map((r: string, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: 10 }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%',
                        background: ACCENT,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, marginTop: 2,
                      }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5">
                          <path d="M20 6L9 17l-5-5"/>
                        </svg>
                      </div>
                      <p style={{ fontSize: 13, color: '#4c2f9f', margin: 0, lineHeight: 1.6, flex: 1 }}>{r}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </main>
  )
}
