'use client'
import React, { useState } from 'react'
import { Download, Send, Undo2, ChevronDown, ChevronRight, Layers, Pencil } from 'lucide-react'
import { tokens as T } from '@/lib/design-tokens'
import { Button, Card, IconButton, Modal, Field, Input, Icon } from '@/components/ui'
import { confirmar, notificar } from '@/components/ui/dialogos'
import { ConvenioBadge } from '@/components/ConvenioBadge'
import type { Guia, Lote } from '@/lib/tiss/tipos'
import type { Faturamento } from './useFaturamento'
import { brl, dataBR, competenciaBR, StatusLoteBadge, StatusGuiaBadge, AvisoEnvio, PassosFluxo } from './comum'

export function AbaLotes({ fat, abrirGuia, irPara }: { fat: Faturamento; abrirGuia: (g: Guia) => void; irPara: (aba: string) => void }) {
  const [aberto, setAberto] = useState<string | null>(null)
  const [envio, setEnvio] = useState<{ lote: Lote; modo: 'enviar' | 'protocolo' } | null>(null)
  const [protocolo, setProtocolo] = useState('')
  const [ocupado, setOcupado] = useState<string | null>(null)

  async function exportar(l: Lote) {
    setOcupado(l.id)
    const r = await fat.exportarXml(l)
    setOcupado(null)
    if (!r.ok) notificar(r.mensagem || 'Erro ao exportar', 'erro')
  }
  async function desfazer(l: Lote) {
    if (!(await confirmar({ titulo: `Desfazer o lote ${l.numero_lote}?`, mensagem: 'As guias voltam para "pronta" e podem ser editadas.', confirmar: 'Desfazer lote', perigo: true }))) return
    fat.desfazerLote(l)
  }
  async function confirmarEnvio() {
    if (!envio) return
    if (envio.modo === 'protocolo') { await fat.salvarProtocolo(envio.lote, protocolo.trim()); setEnvio(null); return }
    const r = await fat.marcarEnviado(envio.lote, protocolo.trim())
    if (!r.ok) { notificar(r.mensagem || 'Erro', 'erro'); return }
    setEnvio(null)
  }

  if (fat.carregando) return <Card padding={16}>{[0, 1, 2].map(i => <div key={i} className="c360-skel" style={{ height: 56, borderRadius: 10, marginBottom: 8 }} />)}</Card>

  if (!fat.lotes.length) {
    const temProntas = fat.guias.some(g => g.status === 'pronta')
    return (
      <Card padding={0}>
        <PassosFluxo atual={!fat.operadoras.length ? 1 : temProntas ? 3 : 2}
          acao={<Button icon={Layers} onClick={() => irPara('guias')}>{temProntas ? 'Selecionar guias prontas' : 'Ir para guias'}</Button>} />
        <AvisoEnvio style={{ padding: '0 20px 20px', justifyContent: 'center' }} />
      </Card>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <AvisoEnvio />
      {fat.lotes.map(l => {
        const op = fat.opMap[l.operadora_id]
        const gs = fat.guias.filter(g => g.lote_id === l.id)
        const exp = aberto === l.id
        return (
          <Card key={l.id} padding={0} style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', flexWrap: 'wrap' }}>
              <IconButton icon={exp ? ChevronDown : ChevronRight} size={30} onClick={() => setAberto(exp ? null : l.id)} aria-label="Ver guias do lote" />
              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14.5, fontWeight: 700, color: T.text.primary }}>Lote {l.numero_lote}</span>
                  <ConvenioBadge convenio={op?.nome} size="sm" />
                  <StatusLoteBadge status={l.status} />
                </div>
                <div style={{ fontSize: 12.5, color: T.text.quaternary, marginTop: 4, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <span>{l.tipo_guia === 'sp_sadt' ? 'SP/SADT' : 'Consulta'} · {competenciaBR(l.competencia)}</span>
                  <span>{l.quantidade_guias} guia{l.quantidade_guias === 1 ? '' : 's'}</span>
                  {l.enviado_em && <span>Enviado em {dataBR(l.enviado_em)}</span>}
                  {l.protocolo && <span>Protocolo <span className="mono" style={{ color: T.text.strong }}>{l.protocolo}</span></span>}
                  {l.xml_hash && <span title="Hash MD5 do epílogo TISS">Hash <span className="mono">{l.xml_hash.slice(0, 8)}…</span></span>}
                </div>
              </div>
              <span style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: T.text.primary }}>{brl(l.valor_total)}</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button size="sm" variant="secondary" icon={Download} disabled={ocupado === l.id} onClick={() => exportar(l)}>Exportar XML</Button>
                {l.status === 'aberto' && <Button size="sm" icon={Send} onClick={() => { setProtocolo(l.protocolo || ''); setEnvio({ lote: l, modo: 'enviar' }) }}>Marcar enviado</Button>}
                {l.status !== 'aberto' && <Button size="sm" variant="ghost" icon={Pencil} onClick={() => { setProtocolo(l.protocolo || ''); setEnvio({ lote: l, modo: 'protocolo' }) }}>Protocolo</Button>}
                {l.status === 'aberto' && <IconButton icon={Undo2} variant="outline" size={32} title="Desfazer lote" aria-label="Desfazer lote" onClick={() => desfazer(l)} />}
              </div>
            </div>
            {exp && (
              <div style={{ borderTop: `1px solid ${T.border.muted}`, background: T.bg.cardSubtle }}>
                {gs.length === 0 && <p style={{ margin: 0, padding: 16, fontSize: 12.5, color: T.text.quaternary }}>Nenhuma guia carregada para este lote.</p>}
                {gs.map(g => (
                  <div key={g.id} onClick={() => abrirGuia(g)} className="fat-linha clicavel" style={{ gridTemplateColumns: '0.6fr 1.6fr 0.9fr 0.9fr 0.9fr' }}>
                    <span className="mono"><span className="fat-rotulo">Guia</span>{g.numero_guia_prestador}</span>
                    <span className="fat-largo" style={{ fontWeight: 600 }}>{g.nome_beneficiario}</span>
                    <span className="mono"><span className="fat-rotulo">Data</span>{dataBR(g.data_atendimento)}</span>
                    <span className="fat-num"><span className="fat-rotulo">Valor</span>{brl(g.valor_total)}</span>
                    <span><StatusGuiaBadge status={g.status} /></span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )
      })}

      {envio && (
        <Modal titulo={envio.modo === 'enviar' ? `Marcar lote ${envio.lote.numero_lote} como enviado` : 'Protocolo do lote'} onClose={() => setEnvio(null)}
          rodape={<>
            <Button variant="secondary" onClick={() => setEnvio(null)}>Cancelar</Button>
            <Button icon={envio.modo === 'enviar' ? Send : undefined} onClick={confirmarEnvio}>{envio.modo === 'enviar' ? 'Confirmar envio' : 'Salvar'}</Button>
          </>}>
          {envio.modo === 'enviar' && (
            <p style={{ fontSize: 13, color: T.text.secondary, margin: '0 0 14px', lineHeight: 1.5 }}>
              Use depois de enviar o XML no portal ou webservice da <b>{fat.opMap[envio.lote.operadora_id]?.nome}</b>. As guias passam para “enviada” e entram em Recebimentos.
            </p>
          )}
          <Field label="Protocolo de recebimento" hint="Número que o portal da operadora devolve ao receber o lote (opcional)">
            <Input className="mono" value={protocolo} onChange={(e) => setProtocolo(e.target.value)} autoFocus />
          </Field>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 12, color: T.text.quaternary }}>
            <Icon icon={Layers} size={13} /> {envio.lote.quantidade_guias} guia(s) · {brl(envio.lote.valor_total)}
          </div>
        </Modal>
      )}
    </div>
  )
}
