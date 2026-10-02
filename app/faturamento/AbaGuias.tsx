'use client'
import React, { useMemo, useState } from 'react'
import { FileText, Layers, Send, CircleSlash, Plus, CheckCircle2, Wand2, X } from 'lucide-react'
import { tokens as T } from '@/lib/design-tokens'
import { KpiCard, Button, Card, Select, SearchInput, Checkbox, Badge } from '@/components/ui'
import { notificar } from '@/components/ui/dialogos'
import { ConvenioBadge } from '@/components/ConvenioBadge'
import type { Guia, StatusGuia } from '@/lib/tiss/tipos'
import { STATUS_GUIA, competenciaDe } from '@/lib/tiss/tipos'
import type { Faturamento, Pendente } from './useFaturamento'
import { brl, dataBR, competenciaBR, StatusGuiaBadge, PassosFluxo } from './comum'

const COLS = '36px 1.6fr 1.1fr 0.8fr 0.9fr 0.9fr 0.9fr'

export function AbaGuias({ fat, abrirGuia, irPara }: { fat: Faturamento; abrirGuia: (g: Guia) => void; irPara: (aba: string) => void }) {
  const [busca, setBusca] = useState('')
  const [fOp, setFOp] = useState('')
  const [fStatus, setFStatus] = useState<string>('')
  const [fComp, setFComp] = useState('')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [gerando, setGerando] = useState(false)

  const mesAtual = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7)
  const soma = (l: Guia[], f: (g: Guia) => number = g => Number(g.valor_total) || 0) => l.reduce((s, g) => s + f(g), 0)
  const kpi = useMemo(() => {
    const G = fat.guias
    const aFaturar = G.filter(g => g.status === 'rascunho' || g.status === 'pronta')
    const emLote = G.filter(g => g.status === 'em_lote')
    const enviadas = G.filter(g => g.status === 'enviada')
    const glosadasMes = G.filter(g => (g.retorno_em || '').slice(0, 7) === mesAtual && Number(g.valor_glosado) > 0)
    return { aFaturar, emLote, enviadas, glosado: soma(glosadasMes, g => Number(g.valor_glosado) || 0), nGlosas: glosadasMes.length }
  }, [fat.guias, mesAtual])

  const competencias = useMemo(() => Array.from(new Set(fat.guias.map(g => competenciaDe(g.data_atendimento)))).sort().reverse(), [fat.guias])

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase()
    return fat.guias.filter(g =>
      (!fOp || g.operadora_id === fOp) &&
      (!fStatus || g.status === fStatus) &&
      (!fComp || competenciaDe(g.data_atendimento) === fComp) &&
      (!t || (g.nome_beneficiario || '').toLowerCase().includes(t) || g.numero_guia_prestador.includes(t) || (g.numero_carteira || '').includes(t)))
  }, [fat.guias, busca, fOp, fStatus, fComp])

  const selecionaveis = lista.filter(g => g.status === 'rascunho' || g.status === 'pronta')
  const selecionadas = fat.guias.filter(g => sel.has(g.id))
  const nProntas = selecionadas.filter(g => g.status === 'pronta').length
  const nRascunho = selecionadas.filter(g => g.status === 'rascunho').length
  const alternar = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const todas = selecionaveis.length > 0 && selecionaveis.every(g => sel.has(g.id))

  async function montar() {
    const r = await fat.montarLote(Array.from(sel))
    if (!r.ok) { notificar(r.mensagem || 'Não foi possível montar o lote', 'erro'); return }
    setSel(new Set())
    irPara('lotes')
  }
  async function prontas() {
    const falhas = await fat.marcarProntas(Array.from(sel))
    setSel(new Set(falhas.map(f => f.id)))
    if (falhas.length === 1) abrirGuia(fat.guias.find(g => g.id === falhas[0].id) || falhas[0])
    else if (!falhas.length) notificar('Guias prontas para lote')
  }
  async function gerarTodas(lista: Pendente[]) {
    setGerando(true)
    let ok = 0
    const erros: string[] = []
    for (const p of lista) {
      const r = await fat.gerarDaConsulta(p)
      if (r.ok) ok++
      else if (r.mensagem && !erros.includes(r.mensagem)) erros.push(r.mensagem)
    }
    setGerando(false)
    if (ok) notificar(`${ok} guia(s) gerada(s) em rascunho`)
    if (erros.length) notificar(erros[0], 'erro')
  }

  const semOperadora = fat.operadoras.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="c360-kpis" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <KpiCard label="A faturar" icon={FileText} cor={T.data.purple} carregando={fat.carregando}
          valor={brl(soma(kpi.aFaturar))} delta={`${kpi.aFaturar.length} guia${kpi.aFaturar.length === 1 ? '' : 's'}`} tendencia="flat" comparacao="rascunho e prontas" />
        <KpiCard label="Em lote" icon={Layers} cor={T.data.blue} carregando={fat.carregando}
          valor={brl(soma(kpi.emLote))} delta={`${kpi.emLote.length}`} tendencia="flat" comparacao="aguardando envio" />
        <KpiCard label="Enviadas" icon={Send} cor={T.data.orange} carregando={fat.carregando}
          valor={brl(soma(kpi.enviadas))} delta={`${kpi.enviadas.length}`} tendencia="flat" comparacao="aguardando retorno" />
        <KpiCard label="Glosado no mês" icon={CircleSlash} cor={T.data.pink} carregando={fat.carregando}
          valor={brl(kpi.glosado)} delta={`${kpi.nGlosas}`} tendencia={kpi.nGlosas ? 'down' : 'flat'} comparacao="guias com glosa" />
      </div>

      {fat.pendentes.length > 0 && !semOperadora && (
        <Card padding={16} titulo={`Consultas de convênio sem guia (${fat.pendentes.length})`}
          acao={<Button size="sm" icon={Wand2} disabled={gerando} onClick={() => gerarTodas(fat.pendentes)}>{gerando ? 'Gerando…' : 'Gerar todas'}</Button>}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {fat.pendentes.slice(0, 5).map(p => (
              <div key={p.consulta_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: `1px solid ${T.border.muted}`, flexWrap: 'wrap' }}>
                <span style={{ flex: 1, minWidth: 140, fontSize: 13, fontWeight: 600, color: T.text.strong }}>{p.paciente}</span>
                <ConvenioBadge convenio={p.convenio} size="sm" />
                <span className="mono" style={{ fontSize: 12, color: T.text.quaternary }}>{dataBR(p.data)}</span>
                {!p.carteira && <Badge tone="warning">sem carteirinha</Badge>}
                <Button size="sm" variant="secondary" disabled={gerando} onClick={async () => {
                  const r = await fat.gerarDaConsulta(p)
                  if (r.ok && r.guia) abrirGuia(r.guia)
                  else notificar(r.mensagem || 'Erro ao gerar guia', 'erro')
                }}>Gerar guia</Button>
              </div>
            ))}
            {fat.pendentes.length > 5 && <span style={{ fontSize: 12, color: T.text.quaternary, paddingTop: 8 }}>e mais {fat.pendentes.length - 5}…</span>}
          </div>
        </Card>
      )}

      {fat.carregando ? (
        <Card padding={16}>{[0, 1, 2, 3].map(i => <div key={i} className="c360-skel" style={{ height: 44, borderRadius: 10, marginBottom: 8 }} />)}</Card>
      ) : fat.guias.length === 0 ? (
        <Card padding={0}>
          <PassosFluxo atual={semOperadora ? 1 : 2} acao={semOperadora
            ? <Button icon={Plus} onClick={() => irPara('operadoras')}>Cadastrar operadora</Button>
            : <Button icon={Plus} onClick={() => abrirGuia(fat.novaGuia())}>Nova guia</Button>} />
        </Card>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <SearchInput value={busca} onChange={setBusca} placeholder="Buscar paciente, nº da guia ou carteirinha" style={{ flex: '1 1 240px' }} />
            <Select value={fOp} onChange={(e) => setFOp(e.target.value)} style={{ width: 170, flex: '0 1 170px' }}>
              <option value="">Todas as operadoras</option>
              {fat.operadoras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </Select>
            <Select value={fStatus} onChange={(e) => setFStatus(e.target.value)} style={{ width: 150, flex: '0 1 150px' }}>
              <option value="">Todos os status</option>
              {(Object.keys(STATUS_GUIA) as StatusGuia[]).map(s => <option key={s} value={s}>{STATUS_GUIA[s].label}</option>)}
            </Select>
            <Select value={fComp} onChange={(e) => setFComp(e.target.value)} style={{ width: 140, flex: '0 1 140px' }}>
              <option value="">Competência</option>
              {competencias.map(c => <option key={c} value={c}>{competenciaBR(c)}</option>)}
            </Select>
            <Button icon={Plus} onClick={() => abrirGuia(fat.novaGuia(fOp || undefined))} disabled={semOperadora}>Nova guia</Button>
          </div>

          {sel.size > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 14px', borderRadius: 14,
              background: T.night[800], color: '#fff', fontSize: 13,
            }}>
              <b>{sel.size} selecionada{sel.size > 1 ? 's' : ''}</b>
              <span style={{ color: 'rgba(255,255,255,.6)' }}>{nProntas} pronta{nProntas === 1 ? '' : 's'} · {nRascunho} rascunho</span>
              <span style={{ flex: 1 }} />
              {nRascunho > 0 && <Button size="sm" variant="secondary" icon={CheckCircle2} onClick={prontas}>Validar e marcar prontas</Button>}
              <Button size="sm" icon={Layers} disabled={!nProntas} onClick={montar}>Montar lote</Button>
              <Button size="sm" variant="dark" icon={X} onClick={() => setSel(new Set())} aria-label="Limpar seleção">Limpar</Button>
            </div>
          )}

          <Card padding={0} style={{ overflow: 'hidden' }}>
            <div className="fat-tabela">
              <div className="fat-cab" style={{ gridTemplateColumns: COLS }}>
                <span onClick={(e) => e.stopPropagation()}>
                  <Checkbox checked={todas} onChange={() => setSel(todas ? new Set() : new Set(selecionaveis.map(g => g.id)))} />
                </span>
                <span>Paciente</span><span>Operadora</span><span>Guia</span><span>Atendimento</span><span className="fat-num">Valor</span><span>Status</span>
              </div>
              {lista.length === 0 && <p style={{ padding: 24, textAlign: 'center', fontSize: 13, color: T.text.quaternary, margin: 0 }}>Nenhuma guia com esses filtros.</p>}
              {lista.map(g => {
                const pode = g.status === 'rascunho' || g.status === 'pronta'
                return (
                  <div key={g.id} className={`fat-linha clicavel${sel.has(g.id) ? ' selecionada' : ''}`} style={{ gridTemplateColumns: COLS }} onClick={() => abrirGuia(g)}>
                    <span onClick={(e) => e.stopPropagation()} className="fat-esconde-mobile">
                      {pode ? <Checkbox checked={sel.has(g.id)} onChange={() => alternar(g.id)} /> : null}
                    </span>
                    <span className="fat-largo" style={{ minWidth: 0 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {pode && <span className="fat-rotulo" onClick={(e) => e.stopPropagation()}><Checkbox checked={sel.has(g.id)} onChange={() => alternar(g.id)} /></span>}
                        <span style={{ fontWeight: 600, color: T.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.nome_beneficiario || 'Sem nome'}</span>
                      </span>
                      <span className="mono" style={{ display: 'block', fontSize: 11.5, color: T.text.quaternary }}>{g.numero_carteira || 'sem carteirinha'}</span>
                    </span>
                    <span style={{ minWidth: 0 }}><span className="fat-rotulo">Operadora</span><ConvenioBadge convenio={fat.opMap[g.operadora_id]?.nome} size="sm" /></span>
                    <span><span className="fat-rotulo">Guia</span><span className="mono">{g.numero_guia_prestador}</span> <span style={{ fontSize: 11.5, color: T.text.quaternary }}>{g.tipo === 'sp_sadt' ? 'SP/SADT' : 'Consulta'}</span></span>
                    <span><span className="fat-rotulo">Atendimento</span><span className="mono">{dataBR(g.data_atendimento)}</span></span>
                    <span className="fat-num"><span className="fat-rotulo">Valor</span>{brl(g.valor_total)}</span>
                    <span><span className="fat-rotulo">Status</span><StatusGuiaBadge status={g.status} /></span>
                  </div>
                )
              })}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
