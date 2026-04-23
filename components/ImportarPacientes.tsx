'use client'

import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'

const ACCENT = '#6043C1'
const ACCENT_LIGHT = '#ede9fb'

type Etapa = 'origem' | 'preview' | 'importando' | 'resultado'

type LinhaPreview = {
  linha: number
  dados: {
    nome: string
    cpf: string | null
    data_nascimento: string | null
    telefone: string | null
    sexo: string | null
    email: string | null
  }
  status: 'valido' | 'duplicado' | 'invalido'
  motivo?: string
}

type PreviewResult = {
  total: number
  validos: number
  duplicados: number
  invalidos: number
  linhas: LinhaPreview[]
}

type ResultadoImport = {
  inseridos: number
  pulados: number
  invalidos: number
}

export function ImportarPacientes({ aberto, onFechar, onImportado, medicoId, clinicaId }: {
  aberto: boolean
  onFechar: () => void
  onImportado: () => void
  medicoId?: string
  clinicaId?: string
}) {
  const [etapa, setEtapa] = useState<Etapa>('origem')
  const [linhasBrutas, setLinhasBrutas] = useState<any[]>([])
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [resultado, setResultado] = useState<ResultadoImport | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [urlSheets, setUrlSheets] = useState('')
  const [nomeArquivo, setNomeArquivo] = useState('')
  const inputFileRef = useRef<HTMLInputElement>(null)

  const resetar = () => {
    setEtapa('origem')
    setLinhasBrutas([])
    setPreview(null)
    setResultado(null)
    setErro(null)
    setUrlSheets('')
    setNomeArquivo('')
  }

  const fechar = () => {
    resetar()
    onFechar()
  }

  const parsearCSV = (texto: string): any[] => {
    const linhas = texto.split(/\r?\n/).filter(l => l.trim())
    if (linhas.length < 2) return []
    const cabecalho = linhas[0].split(/[,;]/).map(c => c.trim().replace(/^["']|["']$/g, ''))
    return linhas.slice(1).map(l => {
      const valores = l.split(/[,;]/).map(v => v.trim().replace(/^["']|["']$/g, ''))
      const obj: any = {}
      cabecalho.forEach((col, i) => { obj[col] = valores[i] || '' })
      return obj
    })
  }

  const processarArquivo = async (file: File) => {
    setCarregando(true)
    setErro(null)
    setNomeArquivo(file.name)
    try {
      const ext = file.name.toLowerCase()
      let linhas: any[] = []

      if (ext.endsWith('.csv')) {
        const texto = await file.text()
        linhas = parsearCSV(texto)
      } else if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
        const buffer = await file.arrayBuffer()
        const workbook = XLSX.read(buffer, { type: 'array' })
        const primeiraPlanilha = workbook.SheetNames[0]
        const sheet = workbook.Sheets[primeiraPlanilha]
        linhas = XLSX.utils.sheet_to_json(sheet, { defval: '' })
      } else {
        throw new Error('Formato não suportado. Use CSV ou Excel (.xlsx)')
      }

      if (linhas.length === 0) throw new Error('Arquivo vazio ou sem dados')
      if (linhas.length > 2000) throw new Error('Limite de 2000 pacientes por importação')

      setLinhasBrutas(linhas)
      await fazerPreview(linhas)
    } catch (e: any) {
      setErro(e.message || 'Erro ao processar arquivo')
    } finally {
      setCarregando(false)
    }
  }

  const processarGoogleSheets = async () => {
    if (!urlSheets.trim()) {
      setErro('Cole o link do Google Sheets')
      return
    }
    setCarregando(true)
    setErro(null)
    try {
      // Extrai ID do link
      const match = urlSheets.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
      if (!match) throw new Error('Link inválido. Use o link de compartilhamento do Google Sheets.')
      const id = match[1]
      const csvUrl = 'https://docs.google.com/spreadsheets/d/' + id + '/export?format=csv'

      const res = await fetch(csvUrl)
      if (!res.ok) throw new Error('Não foi possível acessar a planilha. Verifique se está pública (qualquer pessoa com o link pode visualizar).')
      const texto = await res.text()
      const linhas = parsearCSV(texto)

      if (linhas.length === 0) throw new Error('Planilha vazia')
      if (linhas.length > 2000) throw new Error('Limite de 2000 pacientes por importação')

      setNomeArquivo('Google Sheets')
      setLinhasBrutas(linhas)
      await fazerPreview(linhas)
    } catch (e: any) {
      setErro(e.message || 'Erro ao buscar Google Sheets')
    } finally {
      setCarregando(false)
    }
  }

  const fazerPreview = async (linhas: any[]) => {
    const res = await fetch('/api/pacientes/importar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ medico_id: medicoId, clinica_id: clinicaId, linhas, modo: 'preview' }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Erro ao processar preview')
    setPreview(data)
    setEtapa('preview')
  }

  const baixarModelo = () => {
    const csv = 'nome,cpf,data_nascimento,telefone,sexo,email\nJoão Silva,123.456.789-00,1985-03-15,(11) 99999-9999,Masculino,joao@email.com\nMaria Santos,987.654.321-00,1990-07-22,(11) 88888-8888,Feminino,maria@email.com\n'
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'modelo-pacientes.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const confirmarImport = async () => {
    if (!preview || preview.validos === 0) return
    setEtapa('importando')
    setErro(null)
    try {
      const res = await fetch('/api/pacientes/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medico_id: medicoId, clinica_id: clinicaId, linhas: linhasBrutas, modo: 'import' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao importar')
      setResultado({
        inseridos: data.inseridos || 0,
        pulados: data.pulados || 0,
        invalidos: data.invalidos || 0,
      })
      setEtapa('resultado')
    } catch (e: any) {
      setErro(e.message || 'Erro ao importar')
      setEtapa('preview')
    }
  }

  const concluir = () => {
    onImportado()
    fechar()
  }

  if (!aberto) return null

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget && etapa !== 'importando') fechar() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div style={{
        background: 'white', borderRadius: 16, width: '100%',
        maxWidth: etapa === 'preview' ? 780 : 520,
        maxHeight: '90vh', overflow: 'auto',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: '1px solid #f3f4f6',
        }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#111827', margin: '0 0 2px' }}>
              Importar pacientes
            </h2>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>
              {etapa === 'origem' && 'Escolha de onde importar'}
              {etapa === 'preview' && 'Confira os dados antes de importar'}
              {etapa === 'importando' && 'Importando pacientes...'}
              {etapa === 'resultado' && 'Importação concluída'}
            </p>
          </div>
          {etapa !== 'importando' && (
            <button onClick={fechar} style={{
              width: 32, height: 32, borderRadius: 8,
              border: 'none', background: '#F5F5F5', color: '#6b7280',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>

        <div style={{ padding: 24 }}>
          {erro && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
              padding: '11px 14px', marginBottom: 16, fontSize: 13, color: '#991b1b',
            }}>
              {erro}
            </div>
          )}

          {/* ETAPA: ORIGEM */}
          {etapa === 'origem' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Upload */}
              <button
                onClick={() => inputFileRef.current?.click()}
                disabled={carregando}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: 18, background: 'white',
                  border: '1.5px solid #e5e7eb', borderRadius: 12,
                  cursor: 'pointer', textAlign: 'left' as const,
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = ACCENT}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#e5e7eb'}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: ACCENT_LIGHT, color: ACCENT,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 3px' }}>
                    Arquivo CSV ou Excel
                  </p>
                  <p style={{ fontSize: 12, color: '#6b7280', margin: 0, lineHeight: 1.5 }}>
                    Exporte sua planilha como CSV ou .xlsx e suba aqui
                  </p>
                </div>
              </button>
              <input
                ref={inputFileRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                style={{ display: 'none' }}
                onChange={e => e.target.files?.[0] && processarArquivo(e.target.files[0])}
              />

              {/* Google Sheets */}
              <div style={{
                padding: 18, background: 'white',
                border: '1.5px solid #e5e7eb', borderRadius: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 10,
                    background: '#dcfce7', color: '#16a34a',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                      <line x1="3" y1="9" x2="21" y2="9"/>
                      <line x1="9" y1="21" x2="9" y2="9"/>
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 3px' }}>
                      Google Sheets
                    </p>
                    <p style={{ fontSize: 12, color: '#6b7280', margin: 0, lineHeight: 1.5 }}>
                      Cole o link (precisa estar como "qualquer pessoa com o link")
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={urlSheets}
                    onChange={e => setUrlSheets(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    style={{
                      flex: 1, padding: '9px 12px', fontSize: 13,
                      borderRadius: 8, border: '1px solid #e5e7eb',
                      outline: 'none', color: '#111827',
                    }}
                  />
                  <button
                    onClick={processarGoogleSheets}
                    disabled={carregando || !urlSheets.trim()}
                    style={{
                      padding: '9px 16px', borderRadius: 8,
                      background: carregando || !urlSheets.trim() ? '#9ca3af' : ACCENT,
                      color: 'white', border: 'none',
                      fontSize: 12, fontWeight: 600,
                      cursor: carregando || !urlSheets.trim() ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {carregando ? 'Lendo...' : 'Ler'}
                  </button>
                </div>
              </div>

              {/* Modelo */}
              <div style={{
                background: '#fffbeb', borderRadius: 12, padding: '14px 16px',
                border: '1px solid #fde68a',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="16" x2="12" y2="12"/>
                  <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#92400e', margin: '0 0 2px' }}>
                    Primeira vez? Baixe o modelo
                  </p>
                  <p style={{ fontSize: 11, color: '#92400e', margin: 0, lineHeight: 1.5 }}>
                    Colunas aceitas: nome, cpf, data_nascimento, telefone, sexo, email
                  </p>
                </div>
                <button
                  onClick={baixarModelo}
                  style={{
                    padding: '7px 14px', borderRadius: 8,
                    background: '#92400e', color: 'white', border: 'none',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                  }}
                >
                  Baixar modelo
                </button>
              </div>
            </div>
          )}

          {/* ETAPA: PREVIEW */}
          {etapa === 'preview' && preview && (
            <div>
              {/* Resumo */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
                <div style={{ padding: '12px 16px', background: '#F9FAFB', borderRadius: 10 }}>
                  <p style={{ fontSize: 10, color: '#6b7280', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Total</p>
                  <p style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>{preview.total}</p>
                </div>
                <div style={{ padding: '12px 16px', background: '#ecfdf5', borderRadius: 10 }}>
                  <p style={{ fontSize: 10, color: '#065f46', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Válidos</p>
                  <p style={{ fontSize: 20, fontWeight: 700, color: '#065f46', margin: 0 }}>{preview.validos}</p>
                </div>
                <div style={{ padding: '12px 16px', background: '#fffbeb', borderRadius: 10 }}>
                  <p style={{ fontSize: 10, color: '#92400e', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Duplicados</p>
                  <p style={{ fontSize: 20, fontWeight: 700, color: '#92400e', margin: 0 }}>{preview.duplicados}</p>
                </div>
                <div style={{ padding: '12px 16px', background: '#fef2f2', borderRadius: 10 }}>
                  <p style={{ fontSize: 10, color: '#991b1b', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Inválidos</p>
                  <p style={{ fontSize: 20, fontWeight: 700, color: '#991b1b', margin: 0 }}>{preview.invalidos}</p>
                </div>
              </div>

              {/* Tabela de preview */}
              <div style={{
                border: '1px solid #f3f4f6', borderRadius: 10,
                maxHeight: 340, overflow: 'auto', marginBottom: 20,
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 12 }}>
                  <thead style={{ position: 'sticky' as const, top: 0, background: '#F9FAFB', zIndex: 1 }}>
                    <tr>
                      <th style={{ padding: '10px 12px', textAlign: 'left' as const, fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Linha</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' as const, fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Nome</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' as const, fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>CPF</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' as const, fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Telefone</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' as const, fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.linhas.slice(0, 100).map((l, i) => (
                      <tr key={i} style={{ borderTop: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '8px 12px', color: '#9ca3af' }}>{l.linha}</td>
                        <td style={{ padding: '8px 12px', color: '#111827', fontWeight: 500 }}>
                          {l.dados.nome || <span style={{ color: '#dc2626' }}>(vazio)</span>}
                        </td>
                        <td style={{ padding: '8px 12px', color: '#6b7280', fontFamily: 'monospace' as const, fontSize: 11 }}>
                          {l.dados.cpf || '—'}
                        </td>
                        <td style={{ padding: '8px 12px', color: '#6b7280' }}>
                          {l.dados.telefone || '—'}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          {l.status === 'valido' && (
                            <span style={{ fontSize: 10, color: '#065f46', background: '#ecfdf5', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>Válido</span>
                          )}
                          {l.status === 'duplicado' && (
                            <span style={{ fontSize: 10, color: '#92400e', background: '#fffbeb', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }} title={l.motivo}>Duplicado</span>
                          )}
                          {l.status === 'invalido' && (
                            <span style={{ fontSize: 10, color: '#991b1b', background: '#fef2f2', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }} title={l.motivo}>Inválido</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.linhas.length > 100 && (
                  <div style={{ padding: '10px 12px', background: '#F9FAFB', textAlign: 'center' as const, fontSize: 11, color: '#6b7280' }}>
                    Mostrando primeiras 100 de {preview.linhas.length} linhas. Todas serão processadas.
                  </div>
                )}
              </div>

              {/* Ações */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
                <button
                  onClick={() => { resetar() }}
                  style={{
                    padding: '10px 18px', borderRadius: 10,
                    background: 'white', color: '#6b7280',
                    border: '1px solid #e5e7eb',
                    fontSize: 13, cursor: 'pointer',
                  }}
                >
                  ← Trocar arquivo
                </button>
                <button
                  onClick={confirmarImport}
                  disabled={preview.validos === 0}
                  style={{
                    padding: '10px 22px', borderRadius: 10,
                    background: preview.validos === 0 ? '#9ca3af' : ACCENT,
                    color: 'white', border: 'none',
                    fontSize: 13, fontWeight: 700,
                    cursor: preview.validos === 0 ? 'not-allowed' : 'pointer',
                  }}
                >
                  Importar {preview.validos} paciente{preview.validos !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          )}

          {/* ETAPA: IMPORTANDO */}
          {etapa === 'importando' && (
            <div style={{ padding: 40, textAlign: 'center' as const }}>
              <div style={{
                width: 40, height: 40, border: '3px solid ' + ACCENT_LIGHT,
                borderTopColor: ACCENT, borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                margin: '0 auto 16px',
              }}/>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: '0 0 4px' }}>
                Importando pacientes...
              </p>
              <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>
                Não feche essa janela
              </p>
              <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
            </div>
          )}

          {/* ETAPA: RESULTADO */}
          {etapa === 'resultado' && resultado && (
            <div style={{ padding: '20px 0', textAlign: 'center' as const }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: '#ecfdf5', color: '#16a34a',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>
                Importação concluída!
              </h3>
              <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 24px' }}>
                {resultado.inseridos} paciente{resultado.inseridos !== 1 ? 's' : ''} adicionado{resultado.inseridos !== 1 ? 's' : ''} à sua base
              </p>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 24 }}>
                <div style={{ padding: '10px 16px', background: '#ecfdf5', borderRadius: 10, minWidth: 100 }}>
                  <p style={{ fontSize: 20, fontWeight: 700, color: '#065f46', margin: '0 0 2px' }}>{resultado.inseridos}</p>
                  <p style={{ fontSize: 11, color: '#065f46', margin: 0 }}>Importados</p>
                </div>
                {resultado.pulados > 0 && (
                  <div style={{ padding: '10px 16px', background: '#fffbeb', borderRadius: 10, minWidth: 100 }}>
                    <p style={{ fontSize: 20, fontWeight: 700, color: '#92400e', margin: '0 0 2px' }}>{resultado.pulados}</p>
                    <p style={{ fontSize: 11, color: '#92400e', margin: 0 }}>Duplicados</p>
                  </div>
                )}
                {resultado.invalidos > 0 && (
                  <div style={{ padding: '10px 16px', background: '#fef2f2', borderRadius: 10, minWidth: 100 }}>
                    <p style={{ fontSize: 20, fontWeight: 700, color: '#991b1b', margin: '0 0 2px' }}>{resultado.invalidos}</p>
                    <p style={{ fontSize: 11, color: '#991b1b', margin: 0 }}>Inválidos</p>
                  </div>
                )}
              </div>

              <button
                onClick={concluir}
                style={{
                  padding: '11px 28px', borderRadius: 10,
                  background: ACCENT, color: 'white', border: 'none',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Ver pacientes
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
