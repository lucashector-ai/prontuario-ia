'use client'
/** Editor de guia (Drawer): campos agrupados, busca TUSS, validação inline e pré-visualização para imprimir. */
import React, { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Printer, CheckCircle2, Save, Pencil, AlertTriangle, History } from 'lucide-react'
import { tokens as T } from '@/lib/design-tokens'
import { Drawer, Button, IconButton, Field, Input, Select, Textarea, SegmentedControl, Overline, Icon } from '@/components/ui'
import { confirmar, notificar } from '@/components/ui/dialogos'
import type { Guia, Procedimento } from '@/lib/tiss/tipos'
import { TIPOS_CONSULTA, TIPOS_ATENDIMENTO, INDICACAO_ACIDENTE, CARATER_ATENDIMENTO, CONSELHOS, UF_IBGE, totalProcedimentos, profissionalDoMedico } from '@/lib/tiss/tipos'
import { validarGuia, errosDoCampo, type Problema, type ResultadoValidacao } from '@/lib/tiss/validar'
import type { Faturamento } from './useFaturamento'
import { brl, dataBR, ErroCampo, estiloErro, StatusGuiaBadge, TussInput } from './comum'
import { GuiaImpressao, RaizImpressao } from './GuiaImpressao'

const grade: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }
const secao: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 18, marginBottom: 18, borderBottom: `1px solid ${T.border.muted}` }

export function EditorGuia({ fat, guia: inicial, onClose }: { fat: Faturamento; guia: Guia; onClose: () => void }) {
  const [g, setG] = useState<Guia>(inicial)
  const [modo, setModo] = useState<'editar' | 'previa'>('editar')
  const [mostrarErros, setMostrarErros] = useState(!!inicial.id)
  const [errosServidor, setErrosServidor] = useState<Problema[]>([])
  const [salvando, setSalvando] = useState(false)
  useEffect(() => { setG(inicial) }, [inicial])

  const editavel = g.status === 'rascunho' || g.status === 'pronta'
  const novo = !g.id
  const op = fat.opMap[g.operadora_id]
  const precosOp = (fat.precos[g.operadora_id] || []).map(p => ({ codigo: p.codigo_tuss, descricao: p.descricao, valor: Number(p.valor) }))
  useEffect(() => { if (g.operadora_id) fat.carregarPrecos(g.operadora_id) }, [g.operadora_id]) // eslint-disable-line react-hooks/exhaustive-deps

  const v: ResultadoValidacao = useMemo(() => {
    const r = validarGuia({ ...g, numero_guia_prestador: g.numero_guia_prestador || 'novo' }, { operadora: op })
    return { ...r, erros: [...r.erros, ...errosServidor.filter(e => !r.erros.some(x => x.campo === e.campo))] }
  }, [g, op, errosServidor])
  const err = (campo: string) => (mostrarErros ? errosDoCampo(v, campo) : [])

  const set = (patch: Partial<Guia>) => { setG(x => ({ ...x, ...patch })); setErrosServidor([]) }
  const setProf = (patch: Record<string, string>) => set({ profissional: { ...(g.profissional || {}), ...patch } })
  const setProc = (i: number, patch: Partial<Procedimento>) => {
    const procedimentos = g.procedimentos.map((p, k) => k === i ? { ...p, ...patch } : p)
    set({ procedimentos, valor_total: totalProcedimentos(procedimentos) })
  }
  const addProc = () => set({ procedimentos: [...g.procedimentos, { codigo_tuss: '', descricao: '', quantidade: 1, valor_unitario: 0 }] })
  const delProc = (i: number) => {
    const procedimentos = g.procedimentos.filter((_, k) => k !== i)
    set({ procedimentos, valor_total: totalProcedimentos(procedimentos) })
  }

  async function salvar(acao?: 'pronta' | 'rascunho') {
    setMostrarErros(true)
    setSalvando(true)
    const r = await fat.salvarGuia(g, acao)
    setSalvando(false)
    if (!r.ok) {
      setErrosServidor(r.erros || [])
      notificar(r.mensagem || 'Não foi possível salvar', 'erro')
      return
    }
    if (r.guia) setG(r.guia)
    if (acao === 'pronta') onClose()
  }

  async function excluir() {
    if (!(await confirmar({ titulo: 'Excluir esta guia?', mensagem: `Guia ${g.numero_guia_prestador} de ${g.nome_beneficiario || 'paciente'}.`, confirmar: 'Excluir', perigo: true }))) return
    if (await fat.excluirGuia(g.id)) onClose()
  }

  const imprimir = () => { setModo('previa'); setTimeout(() => window.print(), 80) }

  const titulo = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <span>{novo ? 'Nova guia' : `Guia ${g.numero_guia_prestador}`}</span>
      {!novo && <StatusGuiaBadge status={g.status} />}
    </div>
  )

  const rodape = (
    <>
      {editavel && !novo && <IconButton icon={Trash2} tone="danger" variant="outline" onClick={excluir} aria-label="Excluir guia" title="Excluir guia" />}
      <span style={{ flex: 1 }} />
      <Button variant="secondary" icon={Printer} onClick={imprimir}>Imprimir</Button>
      {editavel && <Button variant="secondary" icon={Save} disabled={salvando} onClick={() => salvar(g.status === 'pronta' ? undefined : 'rascunho')}>Salvar</Button>}
      {editavel && g.status !== 'pronta' && <Button icon={CheckCircle2} disabled={salvando} onClick={() => salvar('pronta')}>Marcar como pronta</Button>}
      {!editavel && <Button variant="secondary" onClick={onClose}>Fechar</Button>}
    </>
  )

  return (
    <Drawer titulo={titulo} onClose={onClose} largura={660} rodape={rodape}>
      <RaizImpressao guia={g} operadora={op} />
      <SegmentedControl
        options={[{ value: 'editar', label: editavel ? 'Dados da guia' : 'Detalhes' }, { value: 'previa', label: 'Pré-visualização' }]}
        value={modo} onChange={setModo} style={{ marginBottom: 18 }}
      />

      {modo === 'previa' ? (
        <div style={{ border: `1px solid ${T.border.default}`, borderRadius: 12, padding: 12, overflowX: 'hidden' }}>
          <GuiaImpressao guia={g} operadora={op} />
        </div>
      ) : (
        <fieldset disabled={!editavel} style={{ border: 'none', padding: 0, margin: 0, minWidth: 0 }}>
          {mostrarErros && v.erros.length > 0 && (
            <div style={{ display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 12, background: T.status.dangerBg, color: T.status.dangerText, fontSize: 12.5, marginBottom: 16 }}>
              <Icon icon={AlertTriangle} size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <b>{v.erros.length} pendência{v.erros.length > 1 ? 's' : ''} antes de exportar</b>
                <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>{v.erros.slice(0, 6).map((e, i) => <li key={i}>{e.mensagem}</li>)}</ul>
              </div>
            </div>
          )}
          {!editavel && (
            <p style={{ fontSize: 12.5, color: T.text.quaternary, margin: '0 0 16px' }}>
              Guia já está em lote ou enviada — não pode ser editada. Para corrigir uma guia em lote ainda aberto, desfaça o lote.
            </p>
          )}

          <section style={secao}>
            <Overline>Operadora e guia</Overline>
            <div style={grade}>
              <Field label="Operadora">
                <Select value={g.operadora_id} disabled={!novo} onChange={(e) => set({ operadora_id: e.target.value })} style={estiloErro(err('operadora_id').length > 0)}>
                  <option value="">Selecione…</option>
                  {fat.operadoras.filter(o => o.ativo !== false || o.id === g.operadora_id).map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                </Select>
                <ErroCampo msgs={[...err('operadora_id'), ...err('operadora')]} />
              </Field>
              <Field label="Tipo de guia">
                <SegmentedControl stretch size="sm"
                  options={[{ value: 'consulta', label: 'Consulta' }, { value: 'sp_sadt', label: 'SP/SADT' }]}
                  value={g.tipo} onChange={(t) => editavel && set({ tipo: t })} />
              </Field>
              <Field label="Nº da guia na operadora (senha)" hint="Só se a operadora autorizou previamente">
                <Input value={g.numero_guia_operadora || ''} maxLength={20} onChange={(e) => set({ numero_guia_operadora: e.target.value })} />
              </Field>
            </div>
          </section>

          <section style={secao}>
            <Overline>Beneficiário</Overline>
            <div style={grade}>
              <Field label="Nome do paciente">
                <Input value={g.nome_beneficiario || ''} onChange={(e) => set({ nome_beneficiario: e.target.value })} />
              </Field>
              <Field label="Número da carteirinha">
                <Input className="mono" value={g.numero_carteira || ''} maxLength={24} onChange={(e) => set({ numero_carteira: e.target.value })} style={estiloErro(err('numero_carteira').length > 0)} />
                <ErroCampo msgs={err('numero_carteira')} />
              </Field>
            </div>
          </section>

          <section style={secao}>
            <Overline>Atendimento</Overline>
            <div style={grade}>
              <Field label="Data do atendimento">
                <Input type="date" value={g.data_atendimento} onChange={(e) => set({ data_atendimento: e.target.value })} style={estiloErro(err('data_atendimento').length > 0)} />
                <ErroCampo msgs={err('data_atendimento')} />
              </Field>
              {g.tipo === 'consulta' ? (
                <Field label="Tipo de consulta">
                  <Select value={g.tipo_consulta || ''} onChange={(e) => set({ tipo_consulta: e.target.value })} style={estiloErro(err('tipo_consulta').length > 0)}>
                    {Object.entries(TIPOS_CONSULTA).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </Select>
                  <ErroCampo msgs={err('tipo_consulta')} />
                </Field>
              ) : (
                <>
                  <Field label="Tipo de atendimento">
                    <Select value={g.tipo_atendimento || '05'} onChange={(e) => set({ tipo_atendimento: e.target.value })}>
                      {Object.entries(TIPOS_ATENDIMENTO).map(([k, l]) => <option key={k} value={k}>{k} · {l}</option>)}
                    </Select>
                  </Field>
                  <Field label="Caráter">
                    <Select value={g.carater_atendimento || '1'} onChange={(e) => set({ carater_atendimento: e.target.value })}>
                      {Object.entries(CARATER_ATENDIMENTO).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </Select>
                  </Field>
                </>
              )}
              <Field label="Indicação de acidente">
                <Select value={g.indicacao_acidente || '9'} onChange={(e) => set({ indicacao_acidente: e.target.value })}>
                  {Object.entries(INDICACAO_ACIDENTE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </Select>
              </Field>
              <Field label="CID principal" hint="Uso interno — a guia TISS não leva CID">
                <Input className="mono" value={g.cid_principal || ''} maxLength={6} placeholder="J06.9"
                  onChange={(e) => set({ cid_principal: e.target.value.toUpperCase() })} style={estiloErro(err('cid_principal').length > 0)} />
                <ErroCampo msgs={err('cid_principal')} />
              </Field>
            </div>
          </section>

          <section style={secao}>
            <Overline>Profissional executante</Overline>
            <div style={grade}>
              <Field label="Nome" style={{ gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Input value={g.profissional?.nome || ''} onChange={(e) => setProf({ nome: e.target.value })} style={{ flex: 1 }} />
                  {fat.medicos.length > 1 && editavel && (
                    <Select value="" onChange={(e) => {
                      const m = fat.medicos.find(x => x.id === e.target.value)
                      if (m) set({ profissional: profissionalDoMedico(m), medico_id: m.id })
                    }} style={{ width: 150 }}>
                      <option value="">Preencher de…</option>
                      {fat.medicos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                    </Select>
                  )}
                </div>
              </Field>
              <Field label="Conselho">
                <Select value={g.profissional?.conselho || '06'} onChange={(e) => setProf({ conselho: e.target.value })}>
                  {Object.entries(CONSELHOS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </Select>
              </Field>
              <Field label="Número no conselho">
                <Input className="mono" value={g.profissional?.numero || ''} onChange={(e) => setProf({ numero: e.target.value })} style={estiloErro(err('profissional.numero').length > 0)} />
                <ErroCampo msgs={err('profissional.numero')} />
              </Field>
              <Field label="UF do conselho">
                <Select value={g.profissional?.uf || ''} onChange={(e) => setProf({ uf: e.target.value })} style={estiloErro(err('profissional.uf').length > 0)}>
                  <option value="">—</option>
                  {Object.entries(UF_IBGE).filter(([s]) => s !== 'EX').sort().map(([s, c]) => <option key={c} value={c}>{s}</option>)}
                </Select>
                <ErroCampo msgs={err('profissional.uf')} />
              </Field>
              <Field label="CBO-S">
                <Input className="mono" value={g.profissional?.cbos || ''} maxLength={6} placeholder="225125" onChange={(e) => setProf({ cbos: e.target.value.replace(/\D/g, '') })} style={estiloErro(err('profissional.cbos').length > 0)} />
                <ErroCampo msgs={err('profissional.cbos')} />
              </Field>
            </div>
          </section>

          <section style={secao}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Overline style={{ flex: 1 }}>Procedimentos</Overline>
              {editavel && (g.tipo === 'sp_sadt' || g.procedimentos.length === 0) && <Button size="sm" variant="ghost" icon={Plus} onClick={addProc}>Adicionar</Button>}
            </div>
            <ErroCampo msgs={err('procedimentos')} />
            {g.procedimentos.map((p, i) => (
              <div key={i} style={{ border: `1px solid ${T.border.default}`, borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 160px) 1fr auto', gap: 8, alignItems: 'start' }}>
                  <TussInput
                    codigo={p.codigo_tuss}
                    extras={precosOp}
                    erro={err(`procedimentos.${i}.codigo_tuss`).length > 0}
                    onDigitar={(c) => setProc(i, { codigo_tuss: c })}
                    onEscolher={(t) => setProc(i, { codigo_tuss: t.codigo, descricao: t.descricao, ...(t.valor ? { valor_unitario: t.valor } : {}) })}
                  />
                  <Input value={p.descricao} placeholder="Descrição" onChange={(e) => setProc(i, { descricao: e.target.value })} style={{ minWidth: 0 }} />
                  {editavel && <IconButton icon={Trash2} size={36} onClick={() => delProc(i)} aria-label="Remover procedimento" />}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8, alignItems: 'end' }}>
                  <Field label="Quantidade">
                    <Input type="number" min={1} step={1} value={p.quantidade} onChange={(e) => setProc(i, { quantidade: Number(e.target.value) })} style={estiloErro(err(`procedimentos.${i}.quantidade`).length > 0)} />
                  </Field>
                  <Field label="Valor unitário (R$)">
                    <Input type="number" min={0} step="0.01" value={p.valor_unitario} onChange={(e) => setProc(i, { valor_unitario: Number(e.target.value) })} style={estiloErro(err(`procedimentos.${i}.valor_unitario`).length > 0)} />
                  </Field>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text.strong, paddingBottom: 10, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {brl(p.quantidade * p.valor_unitario)}
                  </div>
                </div>
                <ErroCampo msgs={[...err(`procedimentos.${i}.codigo_tuss`), ...err(`procedimentos.${i}.quantidade`), ...err(`procedimentos.${i}.valor_unitario`)]} />
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, fontWeight: 700 }}>
              <span>Total da guia</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{brl(totalProcedimentos(g.procedimentos))}</span>
            </div>
            {!precosOp.length && g.operadora_id && (
              <span style={{ fontSize: 12, color: T.text.quaternary }}>Dica: cadastre a tabela de preços da operadora para os valores virem preenchidos.</span>
            )}
          </section>

          <section style={{ ...secao, borderBottom: 'none' }}>
            <Field label="Observação / justificativa">
              <Textarea rows={2} maxLength={500} value={g.observacao || ''} onChange={(e) => set({ observacao: e.target.value })} />
            </Field>
          </section>

          {(g.status === 'glosada' || g.status === 'paga_parcial' || g.status === 'paga') && (
            <section style={secao}>
              <Overline>Retorno da operadora</Overline>
              <div style={{ fontSize: 13, color: T.text.strong, display: 'grid', gap: 4 }}>
                <span>Pago: <b>{brl(g.valor_pago)}</b> · Glosado: <b style={{ color: Number(g.valor_glosado) > 0 ? T.status.danger : undefined }}>{brl(g.valor_glosado)}</b></span>
                {g.motivo_glosa && <span>Motivo: {g.motivo_glosa}</span>}
              </div>
            </section>
          )}
          {!!g.historico?.length && (
            <section>
              <Overline style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon icon={History} size={13} /> Histórico</Overline>
              <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0', display: 'grid', gap: 6 }}>
                {g.historico.slice().reverse().map((h, i) => (
                  <li key={i} style={{ fontSize: 12.5, color: T.text.secondary }}>
                    <span className="mono" style={{ color: T.text.quaternary }}>{dataBR(h.em)}</span> · {h.evento.replace('_', ' ')}{h.detalhe ? ` — ${h.detalhe}` : ''}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </fieldset>
      )}
      {modo === 'previa' && editavel && (
        <div style={{ marginTop: 12 }}><Button size="sm" variant="ghost" icon={Pencil} onClick={() => setModo('editar')}>Voltar a editar</Button></div>
      )}
    </Drawer>
  )
}
