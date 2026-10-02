'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Stethoscope, Pencil, Power, RotateCcw, Check, Clock } from 'lucide-react'
import { tokens } from '@/lib/design-tokens'
import { Badge, Button, Card, EmptyState, Field, Icon, IconButton, IconTile, Input, Modal, ModalAcoes, Overline, Select } from '@/components/ui'
import { confirmar, notificar } from '@/components/ui/dialogos'

const T = tokens

export function Procedimentos() {
  const router = useRouter()
  const [clinicaId, setClinicaId] = useState<string>('')
  const [procedimentos, setProcedimentos] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [form, setForm] = useState({ nome: '', duracao: '30', valor: '', custo_insumos: '', custo_operacional: '' })
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  useEffect(() => {
    const ca = localStorage.getItem('clinica_admin')
    if (!ca) {
      // Só admin da clínica acessa
      notificar('Acesso restrito a administradores da clínica', 'erro')
      router.push('/dashboard')
      return
    }
    const admin = JSON.parse(ca)
    if (!admin.clinica_id) {
      router.push('/dashboard')
      return
    }
    setClinicaId(admin.clinica_id)
    carregar(admin.clinica_id)
  }, [router])

  const carregar = async (cid: string) => {
    setCarregando(true)
    const r = await fetch('/api/procedimentos?clinica_id=' + cid + '&incluir_inativos=1')
    const d = await r.json()
    setProcedimentos(d.procedimentos || [])
    setCarregando(false)
  }

  const toast = (tipo: 'ok' | 'erro', texto: string) => {
    setMsg({ tipo, texto })
    setTimeout(() => setMsg(null), 3000)
  }

  const abrirNovo = () => {
    setEditando(null)
    setForm({ nome: '', duracao: '30', valor: '', custo_insumos: '', custo_operacional: '' })
    setModalAberto(true)
  }

  const abrirEditar = (p: any) => {
    setEditando(p)
    setForm({
      nome: p.nome,
      duracao: String(p.duracao),
      valor: p.valor != null ? String(p.valor) : '',
      custo_insumos: p.custo_insumos != null ? String(p.custo_insumos) : '',
      custo_operacional: p.custo_operacional != null ? String(p.custo_operacional) : '',
    })
    setModalAberto(true)
  }

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nome.trim()) return toast('erro', 'Nome obrigatório')
    setSalvando(true)
    try {
      if (editando) {
        const r = await fetch('/api/procedimentos', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editando.id, ...form }),
        })
        const d = await r.json()
        if (d.error) throw new Error(d.error)
        toast('ok', 'Procedimento atualizado')
      } else {
        const r = await fetch('/api/procedimentos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clinica_id: clinicaId, ...form }),
        })
        const d = await r.json()
        if (d.error) throw new Error(d.error)
        toast('ok', 'Procedimento criado')
      }
      setModalAberto(false)
      carregar(clinicaId)
    } catch (err: any) {
      toast('erro', err.message)
    }
    setSalvando(false)
  }

  const toggleAtivo = async (p: any) => {
    await fetch('/api/procedimentos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, ativo: !p.ativo }),
    })
    carregar(clinicaId)
  }

  const excluir = async (p: any) => {
    if (!(await confirmar({ titulo: `Desativar “${p.nome}”?`, mensagem: 'Ele deixa de aparecer na agenda e nas comandas. Você pode reativar depois.', confirmar: 'Desativar' }))) return
    await fetch('/api/procedimentos?id=' + p.id, { method: 'DELETE' })
    carregar(clinicaId)
    toast('ok', 'Procedimento desativado')
  }

  const fmtValor = (v: number | null) => {
    if (v == null) return '—'
    return 'R$ ' + Number(v).toFixed(2).replace('.', ',')
  }

  const ativos = procedimentos.filter(p => p.ativo)
  const inativos = procedimentos.filter(p => !p.ativo)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {msg && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 300,
          padding: '11px 16px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8,
          background: '#fff', border: `1px solid ${T.border.default}`, boxShadow: T.shadow.lg,
          color: msg.tipo === 'ok' ? T.status.success : T.status.danger, fontSize: 13, fontWeight: 600,
        }}>
          {msg.tipo === 'ok' && <Icon icon={Check} size={15} />}
          {msg.texto}
        </div>
      )}

      <Card padding={0} style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-.01em', color: T.text.primary }}>Procedimentos</h3>
            <span style={{ fontSize: 12.5, color: T.text.quaternary }}>Consultas, exames e procedimentos que a clínica oferece — aparecem na agenda e nas comandas.</span>
          </div>
          <Button icon={Plus} onClick={abrirNovo}>Novo procedimento</Button>
        </div>

        {carregando ? (
          <div style={{ padding: '4px 18px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0, 1, 2].map(i => <div key={i} className="c360-skel" style={{ height: 44, borderRadius: 10 }} />)}
          </div>
        ) : ativos.length === 0 && inativos.length === 0 ? (
          <div style={{ borderTop: `1px solid ${T.border.muted}` }}>
            <EmptyState
              icon={Stethoscope}
              titulo="Nenhum procedimento cadastrado"
              descricao="Cadastre consultas, exames e procedimentos com valor e duração — eles aparecem na agenda e nas comandas."
              acao={<Button variant="secondary" icon={Plus} onClick={abrirNovo}>Cadastrar procedimento</Button>}
            />
          </div>
        ) : (
          <>
            {ativos.map(p => (
              <ProcedimentoLinha key={p.id} p={p} fmtValor={fmtValor}
                onEditar={() => abrirEditar(p)}
                onDesativar={() => excluir(p)} />
            ))}
            {ativos.length === 0 && (
              <div style={{ padding: '14px 18px', borderTop: `1px solid ${T.border.muted}`, fontSize: 12.5, color: T.text.quaternary }}>
                Nenhum procedimento ativo.
              </div>
            )}
          </>
        )}
      </Card>

      {!carregando && inativos.length > 0 && (
        <Card padding={0} style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px' }}>
            <Overline>Inativos ({inativos.length})</Overline>
          </div>
          {inativos.map(p => (
            <ProcedimentoLinha key={p.id} p={p} fmtValor={fmtValor} inativo
              onEditar={() => abrirEditar(p)}
              onDesativar={() => toggleAtivo(p)} />
          ))}
        </Card>
      )}

      {/* Modal criar/editar */}
      {modalAberto && (
        <Modal titulo={editando ? 'Editar procedimento' : 'Novo procedimento'} onClose={() => setModalAberto(false)} largura={480}>
          <form onSubmit={salvar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Nome *">
              <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                placeholder="Ex.: Consulta clínica geral, ECG, Holter 24h..." autoFocus />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Duração padrão">
                <Select value={form.duracao} onChange={e => setForm(f => ({ ...f, duracao: e.target.value }))}>
                  <option value="15">15 min</option>
                  <option value="30">30 min</option>
                  <option value="45">45 min</option>
                  <option value="60">1 hora</option>
                  <option value="90">1h30</option>
                  <option value="120">2 horas</option>
                </Select>
              </Field>
              <Field label="Valor (R$)">
                <Input type="number" step="0.01" value={form.valor}
                  onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
                  placeholder="Opcional" />
              </Field>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Custo de insumos (R$)">
                <Input type="number" step="0.01" value={form.custo_insumos}
                  onChange={e => setForm(f => ({ ...f, custo_insumos: e.target.value }))}
                  placeholder="0,00" />
              </Field>
              <Field label="Custo operacional (R$)">
                <Input type="number" step="0.01" value={form.custo_operacional}
                  onChange={e => setForm(f => ({ ...f, custo_operacional: e.target.value }))}
                  placeholder="0,00" />
              </Field>
            </div>

            {(() => {
              const v = parseFloat(form.valor) || 0
              const c = (parseFloat(form.custo_insumos) || 0) + (parseFloat(form.custo_operacional) || 0)
              if (v <= 0) return null
              const margem = v - c
              const pct = (margem / v) * 100
              return (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 12, background: T.bg.page, border: `1px solid ${T.border.default}`, fontSize: 12.5 }}>
                  <span style={{ color: T.text.secondary }}>Margem estimada</span>
                  <span style={{ fontWeight: 700, color: margem >= 0 ? T.status.success : T.status.danger, fontVariantNumeric: 'tabular-nums' }}>
                    R$ {margem.toFixed(2).replace('.', ',')} · {pct.toFixed(0)}%
                  </span>
                </div>
              )
            })()}

            <ModalAcoes>
              <Button type="button" variant="secondary" onClick={() => setModalAberto(false)}>Cancelar</Button>
              <Button type="submit" disabled={salvando}>
                {salvando ? 'Salvando…' : (editando ? 'Salvar alterações' : 'Criar procedimento')}
              </Button>
            </ModalAcoes>
          </form>
        </Modal>
      )}
    </div>
  )
}

function ProcedimentoLinha({ p, fmtValor, onEditar, onDesativar, inativo }: {
  p: any
  fmtValor: (v: number | null) => string
  onEditar: () => void
  onDesativar: () => void
  inativo?: boolean
}) {
  const custo = Number(p.custo_insumos || 0) + Number(p.custo_operacional || 0)
  const margem = p.valor > 0 && custo ? Math.round(((p.valor - custo) / p.valor) * 100) : null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderTop: `1px solid ${T.border.muted}`, flexWrap: 'wrap' }}>
      <IconTile icon={Stethoscope} color={inativo ? T.text.tertiary : T.data.purple} size={34} radius={10} />
      <div style={{ flex: 1, minWidth: 160, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: inativo ? T.text.secondary : T.text.primary }}>{p.nome}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.text.quaternary }}>
          <Icon icon={Clock} size={12} />
          <span className="mono">{p.duracao} min</span>
          {margem !== null && <span>· margem {margem}%</span>}
        </span>
      </div>
      <span style={{ fontSize: 13.5, fontWeight: 700, color: T.text.strong, fontVariantNumeric: 'tabular-nums', minWidth: 80, textAlign: 'right' }}>
        {p.valor != null ? fmtValor(p.valor) : '—'}
      </span>
      {inativo && <Badge>Inativo</Badge>}
      <div style={{ display: 'flex', gap: 2 }}>
        <IconButton icon={Pencil} size={32} onClick={onEditar} title="Editar" aria-label="Editar" />
        {inativo
          ? <IconButton icon={RotateCcw} size={32} onClick={onDesativar} title="Reativar" aria-label="Reativar" />
          : <IconButton icon={Power} size={32} tone="danger" onClick={onDesativar} title="Desativar" aria-label="Desativar" />}
      </div>
    </div>
  )
}
