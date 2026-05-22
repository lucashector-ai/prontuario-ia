'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/useAuth'
import { tokens } from '@/lib/design-tokens'
import {
  obterSaldos, criarConta, registrarTransferencia, ajustarSaldo, type ResumoSaldos,
} from '@/lib/financeiro/contas'
import type { ContaTipo, SaldoConta } from '@/lib/financeiro/types'
import { PageHeader, Card, Button, Input, Select, Field, Modal, ModalAcoes, Badge } from '@/components/ui'

const brl = (v: number) =>
  'R$ ' + (Number(v) || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')

const TIPOS: { value: ContaTipo; label: string }[] = [
  { value: 'corrente', label: 'Conta corrente' },
  { value: 'poupanca', label: 'Poupança' },
  { value: 'caixa', label: 'Caixa' },
  { value: 'carteira_digital', label: 'Carteira digital' },
]
const tipoLabel = (t: string) => TIPOS.find((x) => x.value === t)?.label || t

export default function ContasPage() {
  const router = useRouter()
  const { usuario } = useAuth()
  const clinicaId = usuario?.clinica_id || null

  const [resumo, setResumo] = useState<ResumoSaldos | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal] = useState<'nova' | 'transferir' | 'ajustar' | null>(null)

  const carregar = useCallback(async () => {
    if (!clinicaId) return
    setCarregando(true)
    const { data } = await obterSaldos(clinicaId)
    setResumo(data)
    setCarregando(false)
  }, [clinicaId])
  useEffect(() => { carregar() }, [carregar])

  const contas = resumo?.contas || []

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        titulo="Contas"
        descricao="Bancos, caixa e carteiras da clínica — saldo de cada conta e consolidado."
        acao={<Button onClick={() => setModal('nova')}>+ Nova conta</Button>}
      />

      {/* Saldo total */}
      <Card style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ fontSize: 12.5, color: tokens.text.secondary, margin: 0 }}>Saldo total consolidado</p>
          <p style={{ fontSize: 30, fontWeight: 700, color: tokens.text.primary, margin: '6px 0 0', fontVariantNumeric: 'tabular-nums' }}>
            {carregando ? '—' : brl(resumo?.total || 0)}
          </p>
        </div>
        {contas.length >= 2 && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" onClick={() => setModal('transferir')}>Transferir</Button>
            <Button variant="secondary" onClick={() => setModal('ajustar')}>Ajustar saldo</Button>
          </div>
        )}
      </Card>

      {/* Lista de contas */}
      {carregando ? (
        <p style={{ fontSize: 13, color: tokens.text.tertiary }}>Carregando...</p>
      ) : contas.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: tokens.text.primary, margin: '0 0 4px' }}>Nenhuma conta cadastrada</p>
          <p style={{ fontSize: 13, color: tokens.text.secondary, margin: '0 0 16px' }}>
            Cadastre as contas onde o dinheiro da clínica fica — banco, caixa, carteira PIX.
          </p>
          <Button onClick={() => setModal('nova')}>+ Nova conta</Button>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
          {contas.map((c) => (
            <Card key={c.id} style={{ opacity: c.ativo ? 1 : 0.55 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: tokens.text.primary, margin: 0 }}>{c.nome}</p>
                  <p style={{ fontSize: 11.5, color: tokens.text.tertiary, margin: '2px 0 0' }}>
                    {c.instituicao ? c.instituicao + ' · ' : ''}{tipoLabel(c.tipo)}
                  </p>
                </div>
                {!c.ativo && <Badge tone="neutral">Inativa</Badge>}
              </div>
              <p style={{
                fontSize: 22, fontWeight: 700, margin: '14px 0 0', fontVariantNumeric: 'tabular-nums',
                color: c.saldoAtual < 0 ? tokens.status.danger : tokens.text.primary,
              }}>
                {brl(c.saldoAtual)}
              </p>
              <p style={{ fontSize: 11, color: tokens.text.tertiary, margin: '4px 0 0' }}>
                Inicial {brl(c.saldo_inicial)} · entrou {brl(c.entradas)} · saiu {brl(c.saidas)}
              </p>
            </Card>
          ))}
          {!!resumo && resumo.semConta !== 0 && (
            <Card style={{ background: tokens.bg.muted }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: tokens.text.secondary, margin: 0 }}>Sem conta atribuída</p>
              <p style={{ fontSize: 11.5, color: tokens.text.tertiary, margin: '2px 0 0' }}>Lançamentos antigos sem conta</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: tokens.text.secondary, margin: '14px 0 0', fontVariantNumeric: 'tabular-nums' }}>
                {brl(resumo.semConta)}
              </p>
            </Card>
          )}
        </div>
      )}

      <Button variant="ghost" size="sm" onClick={() => router.push('/financeiro')} style={{ marginTop: 16, paddingLeft: 0 }}>
        ← Voltar ao financeiro
      </Button>

      {modal === 'nova' && clinicaId && (
        <ModalNovaConta clinicaId={clinicaId} onClose={() => setModal(null)} onSalvo={() => { setModal(null); carregar() }} />
      )}
      {modal === 'transferir' && clinicaId && (
        <ModalTransferir clinicaId={clinicaId} contas={contas} usuarioId={usuario?.id || null}
          onClose={() => setModal(null)} onSalvo={() => { setModal(null); carregar() }} />
      )}
      {modal === 'ajustar' && clinicaId && (
        <ModalAjustar clinicaId={clinicaId} contas={contas} usuarioId={usuario?.id || null}
          onClose={() => setModal(null)} onSalvo={() => { setModal(null); carregar() }} />
      )}
    </div>
  )
}

function ModalNovaConta({ clinicaId, onClose, onSalvo }: {
  clinicaId: string; onClose: () => void; onSalvo: () => void
}) {
  const [nome, setNome] = useState('')
  const [instituicao, setInstituicao] = useState('')
  const [tipo, setTipo] = useState<ContaTipo>('corrente')
  const [saldoInicial, setSaldoInicial] = useState('0')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar() {
    if (!nome.trim()) { setErro('Informe o nome da conta'); return }
    setSalvando(true); setErro('')
    const { error } = await criarConta({
      clinica_id: clinicaId,
      nome: nome.trim(),
      instituicao: instituicao || null,
      tipo,
      saldo_inicial: Number(String(saldoInicial).replace(',', '.')) || 0,
    })
    setSalvando(false)
    if (error) { setErro(error); return }
    onSalvo()
  }

  return (
    <Modal titulo="Nova conta" onClose={onClose} largura={420}>
      <Field label="Nome da conta">
        <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Nubank PJ, Caixa da recepção" />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
        <Field label="Instituição">
          <Input value={instituicao} onChange={(e) => setInstituicao(e.target.value)} placeholder="Opcional" />
        </Field>
        <Field label="Tipo">
          <Select value={tipo} onChange={(e) => setTipo(e.target.value as ContaTipo)}>
            {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Saldo inicial (R$)" style={{ marginTop: 12 }}>
        <Input value={saldoInicial} onChange={(e) => setSaldoInicial(e.target.value)} placeholder="0,00" />
      </Field>
      {erro && <p style={erroMsg}>{erro}</p>}
      <ModalAcoes>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Criar conta'}</Button>
      </ModalAcoes>
    </Modal>
  )
}

function ModalTransferir({ clinicaId, contas, usuarioId, onClose, onSalvo }: {
  clinicaId: string; contas: SaldoConta[]; usuarioId: string | null; onClose: () => void; onSalvo: () => void
}) {
  const ativas = contas.filter((c) => c.ativo)
  const [origem, setOrigem] = useState(ativas[0]?.id || '')
  const [destino, setDestino] = useState(ativas[1]?.id || '')
  const [valor, setValor] = useState('')
  const [descricao, setDescricao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar() {
    setSalvando(true); setErro('')
    const { error } = await registrarTransferencia({
      clinica_id: clinicaId,
      conta_origem_id: origem,
      conta_destino_id: destino,
      valor: Number(String(valor).replace(',', '.')) || 0,
      descricao: descricao || undefined,
      criado_por: usuarioId,
    })
    setSalvando(false)
    if (error) { setErro(error); return }
    onSalvo()
  }

  return (
    <Modal titulo="Transferir entre contas" onClose={onClose} largura={420}>
      <Field label="Da conta">
        <Select value={origem} onChange={(e) => setOrigem(e.target.value)}>
          {ativas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </Select>
      </Field>
      <Field label="Para a conta" style={{ marginTop: 12 }}>
        <Select value={destino} onChange={(e) => setDestino(e.target.value)}>
          {ativas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </Select>
      </Field>
      <Field label="Valor (R$)" style={{ marginTop: 12 }}>
        <Input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
      </Field>
      <Field label="Descrição" style={{ marginTop: 12 }}>
        <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Opcional" />
      </Field>
      {erro && <p style={erroMsg}>{erro}</p>}
      <ModalAcoes>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button onClick={salvar} disabled={salvando}>{salvando ? 'Transferindo...' : 'Confirmar transferência'}</Button>
      </ModalAcoes>
    </Modal>
  )
}

function ModalAjustar({ clinicaId, contas, usuarioId, onClose, onSalvo }: {
  clinicaId: string; contas: SaldoConta[]; usuarioId: string | null; onClose: () => void; onSalvo: () => void
}) {
  const ativas = contas.filter((c) => c.ativo)
  const [contaId, setContaId] = useState(ativas[0]?.id || '')
  const [tipo, setTipo] = useState<'entrada' | 'saida'>('entrada')
  const [valor, setValor] = useState('')
  const [descricao, setDescricao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar() {
    const v = Number(String(valor).replace(',', '.')) || 0
    if (!v) { setErro('Informe o valor do ajuste'); return }
    setSalvando(true); setErro('')
    const { error } = await ajustarSaldo({
      clinica_id: clinicaId,
      conta_id: contaId,
      valor: tipo === 'entrada' ? v : -v,
      descricao: descricao || undefined,
      criado_por: usuarioId,
    })
    setSalvando(false)
    if (error) { setErro(error); return }
    onSalvo()
  }

  return (
    <Modal titulo="Ajuste manual de saldo" onClose={onClose} largura={420}>
      <p style={{ fontSize: 12.5, color: tokens.text.secondary, margin: '-8px 0 16px' }}>
        Registra uma entrada ou saída de ajuste para acertar o saldo da conta.
      </p>
      <Field label="Conta">
        <Select value={contaId} onChange={(e) => setContaId(e.target.value)}>
          {ativas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </Select>
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
        <Field label="Tipo">
          <Select value={tipo} onChange={(e) => setTipo(e.target.value as 'entrada' | 'saida')}>
            <option value="entrada">Entrada (+)</option>
            <option value="saida">Saída (−)</option>
          </Select>
        </Field>
        <Field label="Valor (R$)">
          <Input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
        </Field>
      </div>
      <Field label="Descrição" style={{ marginTop: 12 }}>
        <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Motivo do ajuste" />
      </Field>
      {erro && <p style={erroMsg}>{erro}</p>}
      <ModalAcoes>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Registrar ajuste'}</Button>
      </ModalAcoes>
    </Modal>
  )
}

const erroMsg: React.CSSProperties = { color: tokens.status.danger, fontSize: 12.5, margin: '12px 0 0' }
