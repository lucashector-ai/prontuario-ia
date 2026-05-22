'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useAuth } from '@/lib/useAuth'
import { tokens } from '@/lib/design-tokens'
import { listarContas } from '@/lib/financeiro/contas'
import {
  parseOFX, listarNaoConciliadas, casarExtrato, conciliarMovimentacao,
  criarLancamentoConciliado, type TransacaoExtrato, type MovNaoConciliada,
} from '@/lib/financeiro/conciliacao'
import type { ContaBancaria } from '@/lib/financeiro/types'
import { PageHeader, Card, Button, Select, Field, Badge } from '@/components/ui'

const brl = (v: number) =>
  (v < 0 ? '− ' : '') + 'R$ ' + Math.abs(Number(v) || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
const fmtData = (d: string) => {
  const [a, m, dia] = d.slice(0, 10).split('-')
  return `${dia}/${m}/${a}`
}

export default function ConciliacaoPage() {
  const router = useRouter()
  const { usuario } = useAuth()
  const clinicaId = usuario?.clinica_id || null

  const [contas, setContas] = useState<ContaBancaria[]>([])
  const [contaId, setContaId] = useState('')
  const [extrato, setExtrato] = useState<TransacaoExtrato[]>([])
  const [movs, setMovs] = useState<MovNaoConciliada[]>([])
  const [feitos, setFeitos] = useState<Set<number>>(new Set())
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!clinicaId) return
    listarContas(clinicaId, true).then(({ data }) => {
      setContas(data || [])
      if (data?.[0]) setContaId(data[0].id)
    })
  }, [clinicaId])

  async function aoEscolherArquivo(file: File) {
    setErro(''); setFeitos(new Set())
    if (!contaId) { setErro('Selecione uma conta primeiro.'); return }
    try {
      const texto = await file.text()
      const txs = parseOFX(texto)
      if (!txs.length) { setErro('Nenhuma transação encontrada no arquivo OFX.'); return }
      const { data } = await listarNaoConciliadas(clinicaId!, contaId)
      setMovs(data || [])
      setExtrato(txs)
    } catch {
      setErro('Não consegui ler o arquivo. Exporte o extrato no formato OFX.')
    }
  }

  const pares = useMemo(() => casarExtrato(extrato, movs), [extrato, movs])
  const conciliados = feitos.size
  const pendentes = pares.length - conciliados

  async function conciliar(idx: number, movId: string) {
    const { error } = await conciliarMovimentacao(movId)
    if (error) { setErro(error); return }
    setFeitos((s) => new Set(s).add(idx))
  }

  async function criarLancamento(idx: number, t: TransacaoExtrato) {
    const { error } = await criarLancamentoConciliado({
      clinica_id: clinicaId!,
      conta_id: contaId,
      data: t.data,
      descricao: t.descricao,
      valor: t.valor,
      criado_por: usuario?.id || null,
    })
    if (error) { setErro(error); return }
    setFeitos((s) => new Set(s).add(idx))
  }

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        titulo="Conciliação bancária"
        descricao="Importe o extrato (OFX) e confira lançamento por lançamento contra o sistema."
      />

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end' }}>
          <Field label="Conta">
            <Select value={contaId} onChange={(e) => { setContaId(e.target.value); setExtrato([]) }} style={{ width: 'auto', minWidth: 200 }}>
              {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </Select>
          </Field>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: tokens.text.secondary, display: 'block', marginBottom: 6 }}>
              Extrato bancário (.ofx)
            </label>
            <input type="file" accept=".ofx,.OFX"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) aoEscolherArquivo(f) }}
              style={{ fontSize: 13 }} />
          </div>
        </div>
        {erro && <p style={{ color: tokens.status.danger, fontSize: 12.5, margin: '10px 0 0' }}>{erro}</p>}
      </Card>

      {extrato.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 12.5, color: tokens.text.secondary }}>
            <span>{pares.length} transação(ões) no extrato</span>
            <span>Conciliadas: <strong style={{ color: tokens.status.success }}>{conciliados}</strong></span>
            <span>Pendentes: <strong style={{ color: tokens.text.primary }}>{pendentes}</strong></span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pares.map((par, idx) => {
              const feito = feitos.has(idx)
              const t = par.transacao
              return (
                <Card key={idx} style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: tokens.text.primary, margin: 0 }}>{t.descricao}</p>
                    <p style={{ fontSize: 11.5, color: tokens.text.tertiary, margin: '2px 0 0' }}>
                      Extrato · {fmtData(t.data)}
                    </p>
                  </div>
                  <span style={{
                    fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                    color: t.valor < 0 ? tokens.status.danger : tokens.status.success,
                  }}>{brl(t.valor)}</span>
                  <div style={{ minWidth: 180, fontSize: 12, color: tokens.text.secondary }}>
                    {par.sugestao
                      ? <>Casa com: <strong>{par.sugestao.descricao || 'lançamento'}</strong> ({fmtData(par.sugestao.data_movimentacao)})</>
                      : <span style={{ color: tokens.text.tertiary }}>Sem correspondência no sistema</span>}
                  </div>
                  <div>
                    {feito ? (
                      <Badge tone="success">Conciliado</Badge>
                    ) : par.sugestao ? (
                      <Button size="sm" onClick={() => conciliar(idx, par.sugestao!.id)}>Conciliar</Button>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => criarLancamento(idx, t)}>
                        Criar lançamento
                      </Button>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        </>
      )}

      <Button variant="ghost" size="sm" onClick={() => router.push('/financeiro')} style={{ marginTop: 16, paddingLeft: 0 }}>
        ← Voltar ao financeiro
      </Button>
    </div>
  )
}
