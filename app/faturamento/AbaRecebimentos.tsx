'use client'
import React, { useMemo, useState } from 'react'
import { Wallet, CircleSlash, Clock, RotateCcw, HandCoins, CalendarClock, Gavel } from 'lucide-react'
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
type Filtro = 'aguardando' | 'glosas' | 'recursos' | 'pagas' | 'todas'

/** Modelos de justificativa por motivo de glosa (ponto de partida, a clínica completa). */
const JUSTIFICATIVAS: Record<string, string> = {
  'Carteirinha inválida ou vencida': 'O beneficiário estava com a carteirinha ativa na data do atendimento, conforme consulta de elegibilidade. Segue cópia da carteirinha e do comprovante de elegibilidade.',
  'Procedimento sem autorização prévia': 'O procedimento foi realizado em caráter de urgência/conforme autorização nº ____, emitida em __/__/____. Segue cópia da autorização.',
  'Valor acima da tabela negociada': 'O valor cobrado segue a tabela vigente do contrato (versão __/____), item ____. Segue cópia da tabela contratada.',
  'Prazo de apresentação excedido': 'A guia foi apresentada dentro do prazo contratual, no lote nº ____, protocolo ____, em __/__/____.',
  'Guia em duplicidade': 'Não há duplicidade: trata-se de atendimento distinto, realizado em __/__/____, com guia própria nº ____.',
  'Falta de assinatura do beneficiário': 'Segue a guia com a assinatura do beneficiário / termo de comparecimento assinado.',
}
const DIA_MS = 86400000
const somarDias = (iso: string, n: number) => new Date(new Date(iso).getTime() + n * DIA_MS).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
const diasAte = (data: string) => Math.ceil((new Date(data + 'T23:59:59-03:00').getTime() - Date.now()) / DIA_MS)
const NOME_RESULTADO: Record<string, string> = { aceito: 'Recurso aceito', parcial: 'Recurso aceito em parte', negado: 'Recurso negado' }
const COLS = '1.5fr 1fr 0.8fr 0.9fr 0.9fr 0.9fr 1.1fr'

export function AbaRecebimentos({ fat, abrirGuia }: { fat: Faturamento; abrirGuia: (g: Guia) => void }) {
  const [filtro, setFiltro] = useState<Filtro>('aguardando')
  const [ret, setRet] = useState<Guia | null>(null)
  const [pago, setPago] = useState('')
  const [motivo, setMotivo] = useState('')
  const [rec, setRec] = useState<Guia | null>(null)
  const [recPrazo, setRecPrazo] = useState('')
  const [recTexto, setRecTexto] = useState('')
  const [recProtocolo, setRecProtocolo] = useState('')
  const [recRes, setRecRes] = useState<'aceito' | 'parcial' | 'negado' | null>(null)
  const [recValor, setRecValor] = useState('')

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
      : filtro === 'recursos' ? g.recurso?.status === 'em_recurso'
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
    if (!r.ok) { notificar(r.mensagem || 'Não foi possível concluir. Confira os dados e tente de novo.', 'erro'); return }
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
    else notificar(r.mensagem || 'Não foi possível concluir. Confira os dados e tente de novo.', 'erro')
  }

  const emRecurso = fat.guias.filter(g => g.recurso?.status === 'em_recurso')
  const abrirRecurso = (g: Guia) => {
    setRec(g); setRecRes(null); setRecValor('')
    setRecPrazo(g.recurso?.prazo || somarDias(g.retorno_em || new Date().toISOString(), 30))
    setRecTexto(g.recurso?.justificativa || JUSTIFICATIVAS[g.motivo_glosa || ''] || '')
    setRecProtocolo(g.recurso?.protocolo || '')
  }
  async function salvarRecurso() {
    if (!rec) return
    const r = recRes
      ? await fat.salvarRecurso(rec, { acao: 'recurso_resultado', resultado: recRes, valor_recuperado: Number(String(recValor).replace(',', '.')) || 0 })
      : await fat.salvarRecurso(rec, { acao: 'recurso', prazo: recPrazo, justificativa: recTexto, protocolo: recProtocolo })
    if (!r.ok) { notificar(r.mensagem || 'Não foi possível salvar. Confira os dados e tente de novo.', 'erro'); return }
    setRec(null)
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
        <KpiCard label="Em recurso" icon={Gavel} cor={T.data.purple} carregando={fat.carregando}
          valor={brl(emRecurso.reduce((s, g) => s + (Number(g.valor_glosado) || 0), 0))} delta={`${emRecurso.length}`} tendencia="flat" comparacao="guias aguardando resposta" />
        <KpiCard label="Aguardando retorno" icon={Clock} cor={T.data.orange} carregando={fat.carregando}
          valor={brl(aguardando.reduce((s, g) => s + g.valor_total, 0))} delta={`${aguardando.length}`} tendencia="flat" comparacao="guias enviadas" />
      </div>

      {!fat.carregando && !temEnvio ? (
        <Card padding={0}><PassosFluxo atual={!fat.operadoras.length ? 1 : fat.lotes.length ? 4 : fat.guias.length ? 3 : 2} /></Card>
      ) : (
        <>
          <SegmentedControl<Filtro> value={filtro} onChange={setFiltro} options={[
            { value: 'aguardando', label: `Aguardando (${aguardando.length})` },
            { value: 'glosas', label: 'Glosas' }, { value: 'recursos', label: `Em recurso (${emRecurso.length})` }, { value: 'pagas', label: 'Pagas' }, { value: 'todas', label: 'Todas' },
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
                    {g.recurso
                      ? (() => {
                        const em = g.recurso.status === 'em_recurso'
                        const d = em ? diasAte(g.recurso.prazo) : 0
                        const cor = !em ? (g.recurso.status === 'negado' ? T.status.danger : T.status.success) : d <= 5 ? T.status.danger : T.text.quaternary
                        return <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: cor, fontWeight: em && d <= 5 ? 600 : 400 }}>
                          <Gavel size={12} strokeWidth={1.6} />
                          {em ? `Em recurso · prazo ${dataBR(g.recurso.prazo)}${d < 0 ? ' (vencido)' : d <= 5 ? ` (${d === 0 ? 'hoje' : d === 1 ? 'amanhã' : `${d} dias`})` : ''}` : `${NOME_RESULTADO[g.recurso.status]}${g.recurso.valor_recuperado ? ` · ${brl(g.recurso.valor_recuperado)}` : ''}`}
                        </span>
                      })()
                      : g.motivo_glosa && (g.status === 'glosada' || g.status === 'paga_parcial')
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
                    {(g.status === 'glosada' || g.status === 'paga_parcial') && (!g.recurso || g.recurso.status === 'em_recurso') && (
                      <Button size="sm" variant={g.recurso ? 'secondary' : 'ghost'} icon={Gavel} onClick={() => abrirRecurso(g)}>{g.recurso ? 'Recurso' : 'Recorrer'}</Button>
                    )}
                    {(g.status === 'glosada' || g.status === 'paga_parcial') && !g.recurso && <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => reapresentar(g)}>Reapresentar</Button>}
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

      {rec && (
        <Modal titulo={`Recurso de glosa · guia ${rec.numero_guia_prestador}`} onClose={() => setRec(null)} largura={540}
          rodape={<><Button variant="secondary" onClick={() => setRec(null)}>Cancelar</Button><Button onClick={salvarRecurso}>{recRes ? 'Registrar resultado' : rec.recurso ? 'Salvar' : 'Abrir recurso'}</Button></>}>
          <p style={{ fontSize: 13, color: T.text.secondary, margin: '0 0 14px' }}>
            {rec.nome_beneficiario} · {fat.opMap[rec.operadora_id]?.nome} · glosado <b style={{ color: T.status.danger }}>{brl(rec.valor_glosado)}</b>{rec.motivo_glosa ? ` · ${rec.motivo_glosa}` : ''}
          </p>
          {!recRes ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <Field label="Prazo para recorrer" hint="Confira no contrato com a operadora">
                  <Input type="date" value={recPrazo} onChange={(e) => setRecPrazo(e.target.value)} />
                </Field>
                <Field label="Protocolo (opcional)" hint="Número dado pela operadora">
                  <Input value={recProtocolo} onChange={(e) => setRecProtocolo(e.target.value)} placeholder="Ex.: 2026001234" />
                </Field>
              </div>
              <Field label="Justificativa" hint="Explique por que a glosa deve ser revista e liste os documentos anexados">
                <Textarea rows={5} value={recTexto} onChange={(e) => setRecTexto(e.target.value)} />
              </Field>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard?.writeText(recTexto); notificar('Justificativa copiada') }}>Copiar justificativa</Button>
              </div>
            </div>
          ) : null}
          {rec.recurso?.status === 'em_recurso' && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.border.default}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: T.text.primary }}>A operadora respondeu?</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(['aceito', 'parcial', 'negado'] as const).map(x => (
                  <Chip key={x} ativo={recRes === x} onClick={() => setRecRes(recRes === x ? null : x)}>{x === 'aceito' ? 'Aceitou tudo' : x === 'parcial' ? 'Aceitou em parte' : 'Negou'}</Chip>
                ))}
              </div>
              {recRes === 'parcial' && (
                <Field label="Valor recuperado (R$)">
                  <Input type="number" min={0} step="0.01" value={recValor} onChange={(e) => setRecValor(e.target.value)} />
                </Field>
              )}
            </div>
          )}
        </Modal>
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
