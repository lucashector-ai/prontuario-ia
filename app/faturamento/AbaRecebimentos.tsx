'use client'
import React, { useMemo, useState } from 'react'
import { Wallet, CircleSlash, Clock, RotateCcw, HandCoins, CalendarClock } from 'lucide-react'
import { tokens as T } from '@/lib/design-tokens'
import { Button, Card, KpiCard, Modal, Field, Input, Textarea, SegmentedControl, Chip } from '@/components/ui'
import { confirmar, notificar } from '@/components/ui/dialogos'
import { ConvenioBadge } from '@/components/ConvenioBadge'
import type { Guia } from '@/lib/tiss/tipos'
import { statusRetorno } from '@/lib/tiss/lotes'
import type { Faturamento } from './useFaturamento'
import { brl, dataBR, StatusGuiaBadge, PassosFluxo } from './comum'

const MOTIVOS = [
  'Carteirinha inválida ou vencida', 'Procedimento sem autorização prévia', 'Valor acima da tabela negociada',
  'Prazo de apresentação excedido', 'Guia em duplicidade', 'Falta de assinatura do beneficiário',
]
type Filtro = 'aguardando' | 'glosas' | 'pagas' | 'todas'
const COLS = '1.5fr 1fr 0.8fr 0.9fr 0.9fr 0.9fr 1.1fr'

export function AbaRecebimentos({ fat, abrirGuia }: { fat: Faturamento; abrirGuia: (g: Guia) => void }) {
  const [filtro, setFiltro] = useState<Filtro>('aguardando')
  const [ret, setRet] = useState<Guia | null>(null)
  const [pago, setPago] = useState('')
  const [motivo, setMotivo] = useState('')

  const mes = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7)
  const doMes = fat.guias.filter(g => (g.retorno_em || '').slice(0, 7) === mes)
  const aguardando = fat.guias.filter(g => g.status === 'enviada')
  const lotesMap = useMemo(() => Object.fromEntries(fat.lotes.map(l => [l.id, l])), [fat.lotes])

  const previsao = (g: Guia) => {
    const l = g.lote_id ? lotesMap[g.lote_id] : null
    if (!l?.enviado_em) return null
    const d = new Date(l.enviado_em)
    d.setDate(d.getDate() + (Number(fat.opMap[g.operadora_id]?.prazo_pagamento_dias) || 30))
    return d.toISOString().slice(0, 10)
  }
  const hoje = new Date().toISOString().slice(0, 10)

  const lista = fat.guias.filter(g =>
    filtro === 'aguardando' ? g.status === 'enviada'
      : filtro === 'glosas' ? g.status === 'glosada' || g.status === 'paga_parcial'
        : filtro === 'pagas' ? g.status === 'paga'
          : ['enviada', 'paga', 'glosada', 'paga_parcial'].includes(g.status))

  const abrirRetorno = (g: Guia) => { setRet(g); setPago(String(g.valor_pago ?? g.valor_total)); setMotivo(g.motivo_glosa || '') }
  const valorPago = Number(String(pago).replace(',', '.'))
  const calc = ret ? statusRetorno(ret.valor_total, isFinite(valorPago) ? valorPago : 0) : null

  async function salvarRetorno() {
    if (!ret) return
    if (!isFinite(valorPago) || valorPago < 0) { notificar('Informe o valor pago (0 se glosa total)', 'erro'); return }
    if (valorPago > ret.valor_total + 0.001) { notificar('Valor pago maior que o valor da guia', 'erro'); return }
    const r = await fat.registrarRetorno(ret, valorPago, motivo)
    if (!r.ok) { notificar(r.mensagem || 'Erro', 'erro'); return }
    setRet(null)
  }
  async function reapresentar(g: Guia) {
    if (!(await confirmar({
      titulo: 'Reapresentar valor glosado?',
      mensagem: `Cria uma nova guia em rascunho com ${brl(g.valor_glosado)} da guia ${g.numero_guia_prestador}, para corrigir e incluir num novo lote. Recurso de glosa formal (mensagem TISS de recurso) não está incluso.`,
      confirmar: 'Criar guia',
    }))) return
    const r = await fat.reapresentar(g)
    if (r.ok && r.guia) abrirGuia(r.guia)
    else notificar(r.mensagem || 'Erro', 'erro')
  }

  const temEnvio = fat.guias.some(g => ['enviada', 'paga', 'glosada', 'paga_parcial'].includes(g.status))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="c360-kpis" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <KpiCard label="Recebido no mês" icon={Wallet} cor={T.data.green} carregando={fat.carregando}
          valor={brl(doMes.reduce((s, g) => s + (Number(g.valor_pago) || 0), 0))} delta={`${doMes.length}`} tendencia="flat" comparacao="retornos registrados" />
        <KpiCard label="Glosado no mês" icon={CircleSlash} cor={T.data.pink} carregando={fat.carregando}
          valor={brl(doMes.reduce((s, g) => s + (Number(g.valor_glosado) || 0), 0))}
          delta={(() => { const t = doMes.reduce((s, g) => s + g.valor_total, 0); const gl = doMes.reduce((s, g) => s + (Number(g.valor_glosado) || 0), 0); return t ? `${Math.round(gl / t * 100)}%` : '0%' })()}
          tendencia="flat" comparacao="do valor com retorno" />
        <KpiCard label="Aguardando retorno" icon={Clock} cor={T.data.orange} carregando={fat.carregando}
          valor={brl(aguardando.reduce((s, g) => s + g.valor_total, 0))} delta={`${aguardando.length}`} tendencia="flat" comparacao="guias enviadas" />
      </div>

      {!fat.carregando && !temEnvio ? (
        <Card padding={0}><PassosFluxo atual={!fat.operadoras.length ? 1 : fat.lotes.length ? 4 : fat.guias.length ? 3 : 2} /></Card>
      ) : (
        <>
          <SegmentedControl<Filtro> value={filtro} onChange={setFiltro} options={[
            { value: 'aguardando', label: `Aguardando (${aguardando.length})` },
            { value: 'glosas', label: 'Glosas' }, { value: 'pagas', label: 'Pagas' }, { value: 'todas', label: 'Todas' },
          ]} />
          <Card padding={0} style={{ overflow: 'hidden' }}>
            <div className="fat-cab" style={{ gridTemplateColumns: COLS }}>
              <span>Paciente</span><span>Operadora</span><span>Guia</span><span className="fat-num">Valor</span><span className="fat-num">Pago</span><span>Status</span><span />
            </div>
            {lista.length === 0 && <p style={{ padding: 24, textAlign: 'center', fontSize: 13, color: T.text.quaternary, margin: 0 }}>Nada por aqui.</p>}
            {lista.map(g => {
              const prev = previsao(g)
              const atrasada = g.status === 'enviada' && prev && prev < hoje
              return (
                <div key={g.id} className="fat-linha clicavel" style={{ gridTemplateColumns: COLS }} onClick={() => abrirGuia(g)}>
                  <span className="fat-largo" style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 600, color: T.text.primary }}>{g.nome_beneficiario}</span>
                    {g.motivo_glosa && (g.status === 'glosada' || g.status === 'paga_parcial')
                      ? <span style={{ display: 'block', fontSize: 11.5, color: T.status.danger }}>{g.motivo_glosa}</span>
                      : prev && g.status === 'enviada'
                        ? <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: atrasada ? T.status.warning : T.text.quaternary }}>
                          <CalendarClock size={12} strokeWidth={1.6} /> {atrasada ? 'Prazo vencido em' : 'Previsão'} {dataBR(prev)}
                        </span>
                        : null}
                  </span>
                  <span><span className="fat-rotulo">Operadora</span><ConvenioBadge convenio={fat.opMap[g.operadora_id]?.nome} size="sm" /></span>
                  <span><span className="fat-rotulo">Guia</span><span className="mono">{g.numero_guia_prestador}</span></span>
                  <span className="fat-num"><span className="fat-rotulo">Valor</span>{brl(g.valor_total)}</span>
                  <span className="fat-num"><span className="fat-rotulo">Pago</span>{g.valor_pago == null ? '—' : brl(g.valor_pago)}</span>
                  <span><StatusGuiaBadge status={g.status} /></span>
                  <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                    {(g.status === 'glosada' || g.status === 'paga_parcial') && <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => reapresentar(g)}>Reapresentar</Button>}
                    <Button size="sm" variant={g.status === 'enviada' ? 'primary' : 'secondary'} icon={HandCoins} onClick={() => abrirRetorno(g)}>
                      {g.status === 'enviada' ? 'Registrar retorno' : 'Corrigir'}
                    </Button>
                  </span>
                </div>
              )
            })}
          </Card>
        </>
      )}

      {ret && (
        <Modal titulo={`Retorno da guia ${ret.numero_guia_prestador}`} onClose={() => setRet(null)} largura={500}
          rodape={<><Button variant="secondary" onClick={() => setRet(null)}>Cancelar</Button><Button onClick={salvarRetorno}>Registrar</Button></>}>
          <p style={{ fontSize: 13, color: T.text.secondary, margin: '0 0 14px' }}>
            {ret.nome_beneficiario} · {fat.opMap[ret.operadora_id]?.nome} · valor apresentado <b>{brl(ret.valor_total)}</b>
          </p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <Chip ativo={valorPago === ret.valor_total} onClick={() => setPago(String(ret.valor_total))}>Pago integral</Chip>
            <Chip ativo={valorPago === 0} onClick={() => setPago('0')}>Glosa total</Chip>
          </div>
          <Field label="Valor pago pela operadora (R$)" hint="Conforme o demonstrativo de pagamento">
            <Input type="number" min={0} step="0.01" value={pago} onChange={(e) => setPago(e.target.value)} autoFocus />
          </Field>
          {calc && calc.valor_glosado > 0 && (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 13, color: T.status.danger, fontWeight: 600 }}>Glosa de {brl(calc.valor_glosado)} · {calc.status === 'glosada' ? 'glosa total' : 'pagamento parcial'}</span>
              <Field label="Motivo da glosa">
                <Textarea rows={2} value={motivo} placeholder="Código e descrição do demonstrativo" onChange={(e) => setMotivo(e.target.value)} />
              </Field>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {MOTIVOS.map(m => <Chip key={m} ativo={motivo === m} onClick={() => setMotivo(m)}>{m}</Chip>)}
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
