'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/useAuth'
import { tokens } from '@/lib/design-tokens'
import { listarUnidades, criarUnidade, atualizarUnidade } from '@/lib/financeiro/unidades'
import {
  obterGatewayConfig, salvarGatewayConfig, gatewayOperacional,
  PROVEDORES_SUPORTADOS, PROVEDORES, type GatewayConfig,
} from '@/lib/financeiro/gateway'
import type { Unidade } from '@/lib/financeiro/types'
import { PageHeader, Card, Button, Input, Select, Field } from '@/components/ui'

export default function ConfiguracoesFinanceiroPage() {
  const router = useRouter()
  const { usuario } = useAuth()
  const clinicaId = usuario?.clinica_id || null

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        titulo="Configurações do financeiro"
        descricao="Unidades da clínica e integração de pagamentos."
      />

      {clinicaId && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
          <SecaoUnidades clinicaId={clinicaId} />
          <SecaoMedicos clinicaId={clinicaId} />
          <SecaoGateway clinicaId={clinicaId} />
        </div>
      )}

      <Button variant="ghost" size="sm" onClick={() => router.push('/financeiro')} style={{ marginTop: 16, paddingLeft: 0 }}>
        ← Voltar ao financeiro
      </Button>
    </div>
  )
}

const titulo: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: tokens.text.primary, margin: '0 0 4px' }
const descSecao: React.CSSProperties = { fontSize: 12.5, color: tokens.text.secondary, margin: '0 0 14px' }

// ───────────────────────────────── Unidades ────────────────────────────────

function SecaoUnidades({ clinicaId }: { clinicaId: string }) {
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [nome, setNome] = useState('')
  const [endereco, setEndereco] = useState('')
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    const { data } = await listarUnidades(clinicaId)
    setUnidades(data || [])
  }, [clinicaId])
  useEffect(() => { carregar() }, [carregar])

  async function adicionar() {
    if (!nome.trim()) return
    setSalvando(true)
    await criarUnidade({ clinica_id: clinicaId, nome: nome.trim(), endereco: endereco || null })
    setNome(''); setEndereco(''); setSalvando(false)
    carregar()
  }

  return (
    <Card>
      <p style={titulo}>Unidades</p>
      <p style={descSecao}>
        Cadastre as filiais da clínica. Lançamentos financeiros podem ser atribuídos a uma unidade,
        e o dashboard permite ver cada uma ou o consolidado.
      </p>

      {unidades.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
          {unidades.map((u) => (
            <div key={u.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
              background: tokens.bg.cardSubtle, borderRadius: 10,
            }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: tokens.text.primary, margin: 0 }}>{u.nome}</p>
                {u.endereco && <p style={{ fontSize: 11.5, color: tokens.text.tertiary, margin: '2px 0 0' }}>{u.endereco}</p>}
              </div>
              <button onClick={async () => { await atualizarUnidade(u.id, { ativo: !u.ativo }); carregar() }} style={{
                padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none',
                background: u.ativo ? tokens.status.successBg : tokens.bg.card,
                color: u.ativo ? tokens.status.success : tokens.text.tertiary,
              }}>{u.ativo ? 'Ativa' : 'Inativa'}</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da unidade" style={{ flex: 1, minWidth: 160 }} />
        <Input value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Endereço (opcional)" style={{ flex: 1, minWidth: 160 }} />
        <Button onClick={adicionar} disabled={salvando || !nome.trim()}>Adicionar</Button>
      </div>
    </Card>
  )
}

// ───────────────────────────── Médicos por unidade ─────────────────────────

function SecaoMedicos({ clinicaId }: { clinicaId: string }) {
  const [medicos, setMedicos] = useState<any[]>([])
  const [unidades, setUnidades] = useState<Unidade[]>([])

  const carregar = useCallback(async () => {
    const [mR, uR] = await Promise.all([
      fetch('/api/financeiro/medico-unidade?clinica_id=' + clinicaId).then((r) => r.json()),
      listarUnidades(clinicaId, true),
    ])
    setMedicos(mR.medicos || [])
    setUnidades(uR.data || [])
  }, [clinicaId])
  useEffect(() => { carregar() }, [carregar])

  async function vincular(medicoId: string, unidadeId: string) {
    await fetch('/api/financeiro/medico-unidade', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ medico_id: medicoId, unidade_id: unidadeId || null }),
    })
    carregar()
  }

  return (
    <Card>
      <p style={titulo}>Médicos por unidade</p>
      <p style={descSecao}>
        Vincule cada médico à sua unidade. Comandas geradas por agendamentos confirmados
        herdam automaticamente a unidade do médico responsável.
      </p>
      {unidades.length === 0 ? (
        <p style={{ fontSize: 12.5, color: tokens.text.tertiary, margin: 0 }}>
          Cadastre ao menos uma unidade acima para poder vincular os médicos.
        </p>
      ) : medicos.length === 0 ? (
        <p style={{ fontSize: 12.5, color: tokens.text.tertiary, margin: 0 }}>Nenhum médico cadastrado.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {medicos.map((m) => (
            <div key={m.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
              background: tokens.bg.cardSubtle, borderRadius: 10,
            }}>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: tokens.text.primary }}>{m.nome}</span>
              <Select
                value={m.unidade_id || ''}
                onChange={(e) => vincular(m.id, e.target.value)}
                style={{ width: 'auto', minWidth: 180 }}
              >
                <option value="">Sem unidade</option>
                {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </Select>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// ───────────────────────────────── Gateway ─────────────────────────────────

function SecaoGateway({ clinicaId }: { clinicaId: string }) {
  const [config, setConfig] = useState<GatewayConfig | null>(null)
  const [provedor, setProvedor] = useState('')
  const [ambiente, setAmbiente] = useState<'sandbox' | 'producao'>('sandbox')
  const [ativo, setAtivo] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    obterGatewayConfig(clinicaId).then(({ data }) => {
      if (data) {
        setConfig(data)
        setProvedor(data.provedor || '')
        setAmbiente(data.ambiente)
        setAtivo(data.ativo)
      }
    })
  }, [clinicaId])

  async function salvar() {
    setSalvando(true); setMsg('')
    const { data, error } = await salvarGatewayConfig(clinicaId, { provedor: provedor || null, ambiente, ativo })
    setSalvando(false)
    if (error) { setMsg(error); return }
    setConfig(data)
    setMsg('Configuração salva.')
  }

  const integrado = provedor ? !!PROVEDORES[provedor] : false
  const operacional = gatewayOperacional({ ...(config as any), provedor, ativo })

  return (
    <Card>
      <p style={titulo}>Gateway de pagamento</p>
      <p style={descSecao}>
        A estrutura de cobranças (PIX, cartão, boleto) já está pronta. A integração é ativada
        quando as credenciais da API do provedor forem conectadas.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Provedor">
          <Select value={provedor} onChange={(e) => setProvedor(e.target.value)}>
            <option value="">Nenhum</option>
            {PROVEDORES_SUPORTADOS.map((p) => <option key={p.codigo} value={p.codigo}>{p.nome}</option>)}
          </Select>
        </Field>
        <Field label="Ambiente">
          <Select value={ambiente} onChange={(e) => setAmbiente(e.target.value as any)}>
            <option value="sandbox">Sandbox (teste)</option>
            <option value="producao">Produção</option>
          </Select>
        </Field>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13, color: tokens.text.strong }}>
        <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
        Ativar cobranças por gateway
      </label>

      <div style={{
        marginTop: 12, padding: '10px 12px', borderRadius: 10, fontSize: 12,
        background: operacional ? tokens.status.successBg : tokens.status.warningBg,
        color: operacional ? tokens.status.success : tokens.status.warningTextStrong,
      }}>
        {operacional
          ? 'Gateway operacional — cobranças podem ser geradas.'
          : provedor && ativo && !integrado
            ? `Provedor ${provedor} selecionado, mas a integração da API ainda não foi conectada nesta instância.`
            : 'Nenhum gateway operacional. Selecione um provedor e conecte as credenciais para ativar.'}
      </div>

      {msg && <p style={{ fontSize: 12.5, color: tokens.text.secondary, margin: '10px 0 0' }}>{msg}</p>}
      <div style={{ marginTop: 14 }}>
        <Button onClick={salvar} disabled={salvando}>
          {salvando ? 'Salvando...' : 'Salvar configuração'}
        </Button>
      </div>
    </Card>
  )
}
