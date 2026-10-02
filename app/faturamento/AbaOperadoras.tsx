'use client'
import React, { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Upload, Building2, Tag } from 'lucide-react'
import { tokens as T, tint } from '@/lib/design-tokens'
import { Button, Card, IconButton, Modal, Field, Input, Select, Textarea, Badge, EmptyState } from '@/components/ui'
import { confirmar, notificar } from '@/components/ui/dialogos'
import { CONVENIOS, corConvenio } from '@/lib/convenios'
import type { Operadora } from '@/lib/tiss/tipos'
import { validarOperadora, errosDoCampo, type ResultadoValidacao } from '@/lib/tiss/validar'
import type { Faturamento } from './useFaturamento'
import { brl, ErroCampo, estiloErro, PassosFluxo, TussInput } from './comum'

const VAZIA: Partial<Operadora> = { nome: '', registro_ans: '', codigo_prestador: '', cnes: '9999999', nome_contratado: '', cnpj_operadora: '', prazo_pagamento_dias: 30, versao_tiss: '4.01.00' }

export function AbaOperadoras({ fat }: { fat: Faturamento }) {
  const [form, setForm] = useState<Partial<Operadora> | null>(null)
  const [vForm, setVForm] = useState<ResultadoValidacao | null>(null)
  const [selId, setSelId] = useState<string | null>(null)
  const sel = fat.operadoras.find(o => o.id === selId) || fat.operadoras[0]

  useEffect(() => { if (sel) fat.carregarPrecos(sel.id) }, [sel?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function salvar() {
    if (!form) return
    const v = validarOperadora(form)
    setVForm(v)
    if (!v.ok) return
    const r = await fat.salvarOperadora(form)
    if (!r.ok) { notificar(r.mensagem || 'Erro ao salvar', 'erro'); if (r.erros) setVForm({ ok: false, erros: r.erros, avisos: [] }); return }
    setForm(null)
  }
  async function excluir(o: Operadora) {
    if (!(await confirmar({ titulo: `Excluir ${o.nome}?`, mensagem: 'Se já houver guias, a operadora só é desativada (o histórico fica).', confirmar: 'Excluir', perigo: true }))) return
    fat.excluirOperadora(o.id)
  }
  const e = (c: string) => errosDoCampo(vForm, c)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {fat.carregando ? (
        <Card padding={16}>{[0, 1].map(i => <div key={i} className="c360-skel" style={{ height: 64, borderRadius: 10, marginBottom: 8 }} />)}</Card>
      ) : !fat.operadoras.length ? (
        <Card padding={0}>
          <PassosFluxo atual={1} acao={<Button icon={Plus} onClick={() => { setForm({ ...VAZIA }); setVForm(null) }}>Cadastrar operadora</Button>} />
        </Card>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, color: T.text.quaternary }}>Dados do credenciamento: estão no contrato ou no portal do prestador de cada operadora.</span>
            <Button icon={Plus} onClick={() => { setForm({ ...VAZIA }); setVForm(null) }}>Nova operadora</Button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {fat.operadoras.map(o => {
              const ativa = sel?.id === o.id
              const cor = corConvenio(o.nome)
              return (
                <Card key={o.id} padding={16} onClick={() => setSelId(o.id)}
                  style={ativa ? { borderColor: T.brand.primaryAccent, background: T.brand.primarySoftBg } : undefined}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <span style={{ width: 38, height: 38, borderRadius: 12, background: tint(cor, 0.14), color: cor, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <Building2 size={18} strokeWidth={1.6} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 14.5, fontWeight: 700, color: T.text.primary }}>{o.nome}</span>
                        {o.ativo === false && <Badge>inativa</Badge>}
                      </div>
                      <div style={{ fontSize: 12, color: T.text.quaternary, marginTop: 4, lineHeight: 1.6 }}>
                        ANS <span className="mono" style={{ color: T.text.strong }}>{o.registro_ans}</span> · Prestador <span className="mono" style={{ color: T.text.strong }}>{o.codigo_prestador || '—'}</span>
                        <br />TISS {o.versao_tiss || '4.01.00'} · paga em {o.prazo_pagamento_dias || 30} dias
                      </div>
                    </div>
                    <span onClick={(ev) => ev.stopPropagation()} style={{ display: 'flex', gap: 2 }}>
                      <IconButton icon={Pencil} size={30} aria-label="Editar operadora" onClick={() => { setForm({ ...o }); setVForm(null) }} />
                      <IconButton icon={Trash2} size={30} tone="danger" aria-label="Excluir operadora" onClick={() => excluir(o)} />
                    </span>
                  </div>
                </Card>
              )
            })}
          </div>
          {sel && <TabelaPrecos fat={fat} op={sel} />}
        </>
      )}

      {form && (
        <Modal titulo={form.id ? `Editar ${form.nome}` : 'Nova operadora'} onClose={() => setForm(null)} largura={560}
          rodape={<><Button variant="secondary" onClick={() => setForm(null)}>Cancelar</Button><Button onClick={salvar}>Salvar</Button></>}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <Field label="Operadora">
              <Input list="tiss-convenios" value={form.nome || ''} onChange={(ev) => setForm({ ...form, nome: ev.target.value })} style={estiloErro(e('nome').length > 0)} placeholder="Ex.: Unimed" />
              <datalist id="tiss-convenios">{CONVENIOS.filter(c => c !== 'Particular' && c !== 'Outro').map(c => <option key={c} value={c} />)}</datalist>
              <ErroCampo msgs={e('nome')} />
            </Field>
            <Field label="Registro ANS" hint="6 dígitos, na carteirinha ou no site da ANS">
              <Input className="mono" maxLength={6} value={form.registro_ans || ''} onChange={(ev) => setForm({ ...form, registro_ans: ev.target.value.replace(/\D/g, '') })} style={estiloErro(e('registro_ans').length > 0)} />
              <ErroCampo msgs={e('registro_ans')} />
            </Field>
            <Field label="Código do prestador na operadora" hint="Seu código no credenciamento">
              <Input className="mono" maxLength={14} value={form.codigo_prestador || ''} onChange={(ev) => setForm({ ...form, codigo_prestador: ev.target.value })} style={estiloErro(e('codigo_prestador').length > 0)} />
              <ErroCampo msgs={e('codigo_prestador')} />
            </Field>
            <Field label="CNES do prestador" hint="9999999 se não possuir">
              <Input className="mono" maxLength={7} value={form.cnes || ''} onChange={(ev) => setForm({ ...form, cnes: ev.target.value.replace(/\D/g, '') })} style={estiloErro(e('cnes').length > 0)} />
              <ErroCampo msgs={e('cnes')} />
            </Field>
            <Field label="Nome do contratado (razão social)" style={{ gridColumn: '1 / -1' }}>
              <Input value={form.nome_contratado || ''} onChange={(ev) => setForm({ ...form, nome_contratado: ev.target.value })} />
            </Field>
            <Field label="CNPJ da operadora (opcional)">
              <Input className="mono" value={form.cnpj_operadora || ''} onChange={(ev) => setForm({ ...form, cnpj_operadora: ev.target.value })} />
            </Field>
            <Field label="Prazo de pagamento (dias)">
              <Input type="number" min={1} value={form.prazo_pagamento_dias ?? ''} onChange={(ev) => setForm({ ...form, prazo_pagamento_dias: Number(ev.target.value) || null })} />
            </Field>
            <Field label="Versão TISS">
              <Select value={form.versao_tiss || '4.01.00'} onChange={(ev) => setForm({ ...form, versao_tiss: ev.target.value })}>
                <option value="4.01.00">4.01.00</option>
              </Select>
            </Field>
            {form.id && (
              <Field label="Situação">
                <Select value={form.ativo === false ? 'n' : 's'} onChange={(ev) => setForm({ ...form, ativo: ev.target.value === 's' })}>
                  <option value="s">Ativa</option><option value="n">Inativa</option>
                </Select>
              </Field>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

function TabelaPrecos({ fat, op }: { fat: Faturamento; op: Operadora }) {
  const itens = fat.precos[op.id]
  const [novo, setNovo] = useState({ codigo_tuss: '', descricao: '', valor: '' })
  const [importar, setImportar] = useState(false)
  const [csv, setCsv] = useState('')
  const [resultado, setResultado] = useState<{ importados: number; ignorados: Array<{ linha: number; motivo: string }> } | null>(null)

  async function adicionar() {
    const valor = Number(String(novo.valor).replace(',', '.'))
    if (!/^\d{8}$/.test(novo.codigo_tuss)) { notificar('Código TUSS deve ter 8 dígitos', 'erro'); return }
    if (!(valor > 0)) { notificar('Informe um valor maior que zero', 'erro'); return }
    const r = await fat.salvarPreco(op.id, { codigo_tuss: novo.codigo_tuss, descricao: novo.descricao || novo.codigo_tuss, valor })
    if (r.ok) setNovo({ codigo_tuss: '', descricao: '', valor: '' })
  }
  async function enviarCsv() {
    const r = await fat.importarCsv(op.id, csv)
    if (!r) return
    setResultado(r)
    if (r.importados) notificar(`${r.importados} preço(s) importado(s)`)
  }

  return (
    <Card padding={0} style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 18px', flexWrap: 'wrap' }}>
        <Tag size={16} strokeWidth={1.6} color={T.brand.primary} />
        <h3 style={{ margin: 0, flex: 1, fontSize: 15, fontWeight: 700 }}>Tabela de preços · {op.nome}</h3>
        <Button size="sm" variant="secondary" icon={Upload} onClick={() => { setImportar(true); setResultado(null); setCsv('') }}>Importar CSV</Button>
      </div>
      <div className="fat-cab" style={{ gridTemplateColumns: '120px 1fr 120px 40px' }}>
        <span>Código TUSS</span><span>Descrição</span><span className="fat-num">Valor</span><span />
      </div>
      {!itens ? (
        <div style={{ padding: 16 }}><div className="c360-skel" style={{ height: 40, borderRadius: 10 }} /></div>
      ) : itens.length === 0 ? (
        <EmptyState icon={Tag} titulo="Sem preços cadastrados" descricao="Cadastre ao menos a consulta (10101012) para as guias virem com valor." />
      ) : itens.map(i => (
        <div key={i.id} className="fat-linha" style={{ gridTemplateColumns: '120px 1fr 120px 40px' }}>
          <span className="mono" style={{ color: T.brand.primary, fontWeight: 600 }}>{i.codigo_tuss}</span>
          <span className="fat-largo">{i.descricao}</span>
          <span className="fat-num">{brl(i.valor)}</span>
          <IconButton icon={Trash2} size={30} tone="danger" aria-label="Remover preço" onClick={async () => {
            if (await confirmar({ titulo: 'Remover este preço?', mensagem: `${i.codigo_tuss} · ${i.descricao}`, confirmar: 'Remover', perigo: true })) fat.excluirPreco(op.id, i.id)
          }} />
        </div>
      ))}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, padding: 14, borderTop: `1px solid ${T.border.muted}`, background: T.bg.cardSubtle, alignItems: 'start' }}>
        <TussInput codigo={novo.codigo_tuss} extras={[]} onDigitar={(c) => setNovo(n => ({ ...n, codigo_tuss: c }))}
          onEscolher={(t) => setNovo(n => ({ ...n, codigo_tuss: t.codigo, descricao: t.descricao }))} />
        <Input placeholder="Descrição" value={novo.descricao} onChange={(ev) => setNovo({ ...novo, descricao: ev.target.value })} style={{ minWidth: 0 }} />
        <Input placeholder="Valor" type="number" min={0} step="0.01" value={novo.valor} onChange={(ev) => setNovo({ ...novo, valor: ev.target.value })} />
        <Button icon={Plus} onClick={adicionar}>Adicionar</Button>
      </div>

      {importar && (
        <Modal titulo={`Importar preços · ${op.nome}`} onClose={() => setImportar(false)} largura={560}
          rodape={<><Button variant="secondary" onClick={() => setImportar(false)}>Fechar</Button><Button icon={Upload} disabled={!csv.trim()} onClick={enviarCsv}>Importar</Button></>}>
          <p style={{ fontSize: 13, color: T.text.secondary, margin: '0 0 12px', lineHeight: 1.5 }}>
            Uma linha por item no formato <span className="mono">codigo;descricao;valor</span>. Aceita cabeçalho e vírgula decimal. Códigos já cadastrados têm o preço atualizado.
          </p>
          <input type="file" accept=".csv,.txt" style={{ fontSize: 12.5, marginBottom: 10 }} onChange={async (ev) => {
            const f = ev.target.files?.[0]
            if (!f) return
            const buf = await f.arrayBuffer()
            let txt = new TextDecoder('utf-8').decode(buf)
            if (txt.includes('�')) txt = new TextDecoder('iso-8859-1').decode(buf) // planilhas do Excel em Latin-1
            setCsv(txt)
          }} />
          <Textarea rows={8} className="mono" value={csv} onChange={(ev) => setCsv(ev.target.value)}
            placeholder={'codigo;descricao;valor\n10101012;Consulta em consultório;150,00\n40304361;Hemograma completo;15,80'} style={{ fontSize: 12.5 }} />
          {resultado && (
            <div style={{ marginTop: 12, fontSize: 12.5, color: T.text.secondary }}>
              <b style={{ color: T.status.success }}>{resultado.importados} importado(s)</b>
              {resultado.ignorados.length > 0 && <>
                {' · '}<b style={{ color: T.status.danger }}>{resultado.ignorados.length} ignorado(s)</b>
                <ul style={{ margin: '6px 0 0', paddingLeft: 16, maxHeight: 120, overflowY: 'auto' }}>
                  {resultado.ignorados.slice(0, 30).map(i => <li key={i.linha}>Linha {i.linha}: {i.motivo}</li>)}
                </ul>
              </>}
            </div>
          )}
        </Modal>
      )}
    </Card>
  )
}
