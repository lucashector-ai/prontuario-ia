'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/useAuth'
import { tokens } from '@/lib/design-tokens'
import {
  parsePlanilha, normalizarValor, normalizarData,
  importarDespesas, importarRecebimentos, type PlanilhaParseada,
} from '@/lib/financeiro/importacao'
import { PageHeader, Card, Button, Select, Field } from '@/components/ui'

const brl = (v: number) => 'R$ ' + (Number(v) || 0).toFixed(2).replace('.', ',')

type Tipo = 'despesas' | 'recebimentos'

const CAMPOS: Record<Tipo, { key: string; label: string; obrigatorio: boolean }[]> = {
  despesas: [
    { key: 'descricao', label: 'Descrição', obrigatorio: true },
    { key: 'valor', label: 'Valor', obrigatorio: true },
    { key: 'vencimento', label: 'Vencimento', obrigatorio: false },
    { key: 'categoria', label: 'Categoria', obrigatorio: false },
    { key: 'fornecedor', label: 'Fornecedor', obrigatorio: false },
  ],
  recebimentos: [
    { key: 'valor', label: 'Valor', obrigatorio: true },
    { key: 'vencimento', label: 'Vencimento', obrigatorio: false },
    { key: 'observacoes', label: 'Descrição / observação', obrigatorio: false },
  ],
}

// adivinha qual coluna corresponde a cada campo pelo nome
function adivinhar(campo: string, colunas: string[]): string {
  const alvo = colunas.find((c) => c.toLowerCase().includes(campo.toLowerCase().slice(0, 5)))
  return alvo || ''
}

export default function ImportarPage() {
  const router = useRouter()
  const { usuario } = useAuth()
  const clinicaId = usuario?.clinica_id || null

  const [tipo, setTipo] = useState<Tipo>('despesas')
  const [planilha, setPlanilha] = useState<PlanilhaParseada | null>(null)
  const [mapa, setMapa] = useState<Record<string, string>>({})
  const [importando, setImportando] = useState(false)
  const [resultado, setResultado] = useState<string | null>(null)
  const [erroArquivo, setErroArquivo] = useState('')

  async function aoEscolherArquivo(file: File) {
    setErroArquivo(''); setResultado(null)
    try {
      const buffer = await file.arrayBuffer()
      const p = parsePlanilha(buffer)
      if (!p.linhas.length) { setErroArquivo('A planilha está vazia.'); return }
      setPlanilha(p)
      const auto: Record<string, string> = {}
      for (const campo of CAMPOS[tipo]) auto[campo.key] = adivinhar(campo.key, p.colunas)
      setMapa(auto)
    } catch {
      setErroArquivo('Não consegui ler o arquivo. Use .xlsx, .xls ou .csv.')
    }
  }

  // monta os registros a partir do mapeamento + valida
  const registros = useMemo(() => {
    if (!planilha) return []
    return planilha.linhas.map((linha) => {
      const get = (k: string) => (mapa[k] ? linha[mapa[k]] : undefined)
      const valor = normalizarValor(get('valor'))
      const erros: string[] = []
      if (!valor || valor <= 0) erros.push('valor inválido')
      let descricao = ''
      if (tipo === 'despesas') {
        descricao = String(get('descricao') || '').trim()
        if (!descricao) erros.push('descrição vazia')
      }
      return {
        valor,
        vencimento: normalizarData(get('vencimento')),
        descricao,
        categoria: String(get('categoria') || '').trim() || null,
        fornecedor: String(get('fornecedor') || '').trim() || null,
        observacoes: String(get('observacoes') || '').trim() || null,
        erros,
      }
    })
  }, [planilha, mapa, tipo])

  const validos = registros.filter((r) => r.erros.length === 0)
  const invalidos = registros.length - validos.length

  async function importar() {
    if (!clinicaId || !validos.length) return
    setImportando(true); setResultado(null)
    const res = tipo === 'despesas'
      ? await importarDespesas(clinicaId, validos.map((r) => ({
          descricao: r.descricao, valor: r.valor, vencimento: r.vencimento,
          categoria: r.categoria, fornecedor: r.fornecedor,
        })))
      : await importarRecebimentos(clinicaId, validos.map((r) => ({
          valor: r.valor, vencimento: r.vencimento, observacoes: r.observacoes,
        })))
    setImportando(false)
    if (res.error) { setResultado('Erro ao importar: ' + res.error); return }
    setResultado(`${res.data} ${tipo === 'despesas' ? 'despesa(s)' : 'recebível(is)'} importado(s) com sucesso.`)
    setPlanilha(null); setMapa({})
  }

  function trocarTipo(t: Tipo) {
    setTipo(t); setPlanilha(null); setMapa({}); setResultado(null); setErroArquivo('')
  }

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        titulo="Importar planilha"
        descricao="Traga o histórico da clínica de uma planilha XLSX ou CSV para a plataforma."
      />

      {/* Tipo */}
      <Card style={{ marginBottom: 16 }}>
        <Field label="O que você quer importar?">
          <Select value={tipo} onChange={(e) => trocarTipo(e.target.value as Tipo)} style={{ width: 'auto' }}>
            <option value="despesas">Despesas (contas a pagar)</option>
            <option value="recebimentos">Recebimentos (contas a receber)</option>
          </Select>
        </Field>
        <div style={{ marginTop: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: tokens.text.secondary, display: 'block', marginBottom: 6 }}>
            Arquivo (.xlsx, .xls, .csv)
          </label>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) aoEscolherArquivo(f) }}
            style={{ fontSize: 13 }}
          />
        </div>
        {erroArquivo && <p style={{ color: tokens.status.danger, fontSize: 12.5, margin: '10px 0 0' }}>{erroArquivo}</p>}
        {resultado && <p style={{ color: tokens.status.success, fontSize: 13, fontWeight: 600, margin: '10px 0 0' }}>{resultado}</p>}
      </Card>

      {/* Mapeamento + preview */}
      {planilha && (
        <>
          <Card style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: tokens.text.primary, margin: '0 0 4px' }}>
              Relacione as colunas
            </p>
            <p style={{ fontSize: 12.5, color: tokens.text.secondary, margin: '0 0 14px' }}>
              Diga qual coluna da planilha corresponde a cada campo.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {CAMPOS[tipo].map((campo) => (
                <Field key={campo.key} label={campo.label + (campo.obrigatorio ? ' *' : '')}>
                  <Select
                    value={mapa[campo.key] || ''}
                    onChange={(e) => setMapa({ ...mapa, [campo.key]: e.target.value })}
                    style={{ width: 'auto', minWidth: 170 }}
                  >
                    <option value="">— ignorar —</option>
                    {planilha.colunas.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </Field>
              ))}
            </div>
          </Card>

          <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 12.5, color: tokens.text.secondary }}>
            <span>{registros.length} linha(s) na planilha</span>
            <span>Válidas: <strong style={{ color: tokens.status.success }}>{validos.length}</strong></span>
            {invalidos > 0 && <span>Com erro: <strong style={{ color: tokens.status.danger }}>{invalidos}</strong></span>}
          </div>

          <Card style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: tokens.bg.muted }}>
                  {['Linha', tipo === 'despesas' ? 'Descrição' : 'Observação', 'Valor', 'Vencimento', 'Situação'].map((h) => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {registros.slice(0, 12).map((r, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${tokens.border.subtle}` }}>
                    <td style={{ ...td, color: tokens.text.tertiary }}>{i + 2}</td>
                    <td style={td}>{tipo === 'despesas' ? r.descricao || '—' : r.observacoes || '—'}</td>
                    <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{brl(r.valor)}</td>
                    <td style={td}>{r.vencimento || '—'}</td>
                    <td style={td}>
                      {r.erros.length === 0
                        ? <span style={{ color: tokens.status.success, fontSize: 12, fontWeight: 600 }}>OK</span>
                        : <span style={{ color: tokens.status.danger, fontSize: 12 }}>{r.erros.join(', ')}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {registros.length > 12 && (
              <p style={{ fontSize: 11.5, color: tokens.text.tertiary, textAlign: 'center', padding: '8px 0', margin: 0 }}>
                + {registros.length - 12} linha(s) não exibida(s)
              </p>
            )}
          </Card>

          <Button onClick={importar} disabled={importando || validos.length === 0}>
            {importando ? 'Importando...' : `Importar ${validos.length} linha(s) válida(s)`}
          </Button>
        </>
      )}

      <div style={{ marginTop: 16 }}>
        <Button variant="ghost" size="sm" onClick={() => router.push('/financeiro')} style={{ paddingLeft: 0 }}>
          ← Voltar ao financeiro
        </Button>
      </div>
    </div>
  )
}

const th: React.CSSProperties = {
  textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700,
  color: tokens.text.secondary, textTransform: 'uppercase', letterSpacing: '0.04em',
}
const td: React.CSSProperties = { padding: '10px 14px', fontSize: 13, color: tokens.text.primary }
