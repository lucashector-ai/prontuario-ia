'use client'
/**
 * Orçamentos: a recepção monta a partir dos procedimentos, envia pelo WhatsApp com o link do portal
 * do paciente e acompanha (para enviar → aguardando → aprovado para agendar). O paciente aprova no portal.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Plus, Send, CalendarPlus, Pencil, X, Trash2, Clock, CircleCheck, Wallet, Copy } from 'lucide-react'
import { tokens as T } from '@/lib/design-tokens'
import { usePageHeader } from '@/components/shell/header-context'
import { Button, Card, Chip, Drawer, EmptyState, Field, Input, KpiCard, SegmentedControl, Textarea } from '@/components/ui'
import { confirmar, notificar } from '@/components/ui/dialogos'
import { ehDemo, avisoDemo, comDemo } from '@/lib/demo'
import { CONDICOES_PADRAO, hojeSP, statusVisivel, totalDe, type ItemOrcamento, type StatusOrcamento } from '@/lib/orcamentos/calculos'

type Orc = {
  id: string; numero: number; status: string; status_visivel: StatusOrcamento; validade: string; total: number; desconto: number
  condicoes: string[]; condicao_escolhida: string | null; observacoes: string | null; agendado: boolean; criado_em: string; respondido_em: string | null
  motivo_recusa: string | null; paciente_id: string; medico_id: string | null; paciente: { nome: string; telefone: string | null } | null
  itens: (ItemOrcamento & { id?: string })[]
}
type Filtro = 'todos' | 'enviar' | 'aguardando' | 'agendar' | 'encerrados'

const brl = (n: number) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const num = (n: number) => 'nº ' + String(n).padStart(4, '0')
const dataBR = (iso: string) => new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })

const STATUS: Record<StatusOrcamento, { label: string; cor: string; fundo: string }> = {
  rascunho: { label: 'Rascunho', cor: T.text.secondary, fundo: T.bg.hover },
  enviado: { label: 'Enviado', cor: T.status.info, fundo: T.status.infoBg },
  visto: { label: 'Visto pelo paciente', cor: T.brand.primary, fundo: T.brand.primaryLight },
  aprovado: { label: 'Aprovado', cor: T.status.success, fundo: T.status.successBg },
  recusado: { label: 'Recusado', cor: T.status.danger, fundo: T.status.dangerBg },
  cancelado: { label: 'Cancelado', cor: T.text.tertiary, fundo: T.bg.hover },
  expirado: { label: 'Vencido', cor: T.status.warning, fundo: T.status.warningBg },
}

function demoOrcamentos(): Orc[] {
  const d = (dias: number) => new Date(Date.now() + dias * 864e5).toLocaleDateString('en-CA')
  const base = (o: Partial<Orc>): Orc => ({ id: 'demo-' + o.numero, numero: 1, status: 'rascunho', status_visivel: 'rascunho', validade: d(15), total: 0, desconto: 0, condicoes: CONDICOES_PADRAO, condicao_escolhida: null, observacoes: null, agendado: false, criado_em: new Date().toISOString(), respondido_em: null, motivo_recusa: null, paciente_id: 'demo-pac-1', medico_id: null, paciente: { nome: 'Paciente', telefone: '11999990000' }, itens: [], ...o } as Orc)
  return [
    base({ numero: 6, status: 'aprovado', status_visivel: 'aprovado', total: 1180, paciente: { nome: 'Mariana Costa Ribeiro', telefone: '11988887777' }, condicao_escolhida: 'Cartão de crédito em até 3x', respondido_em: new Date().toISOString(), itens: [{ descricao: 'Toxina botulínica (3 regiões)', quantidade: 1, valor_unitario: 980 }, { descricao: 'Retorno de avaliação', quantidade: 1, valor_unitario: 200 }] }),
    base({ numero: 5, status: 'visto', status_visivel: 'visto', total: 450, validade: d(3), paciente: { nome: 'Roberto Nogueira', telefone: '11977776666' }, itens: [{ descricao: 'Ultrassom de abdome total', quantidade: 1, valor_unitario: 450 }] }),
    base({ numero: 4, status: 'enviado', status_visivel: 'enviado', total: 720, paciente: { nome: 'Juliana Ferreira Costa', telefone: '11966665555' }, itens: [{ descricao: 'Infiltração articular', quantidade: 2, valor_unitario: 360 }] }),
    base({ numero: 3, status: 'rascunho', status_visivel: 'rascunho', total: 300, paciente: { nome: 'Ana Beatriz Moura', telefone: null }, itens: [{ descricao: 'Eletrocardiograma com laudo', quantidade: 1, valor_unitario: 300 }] }),
    base({ numero: 2, status: 'recusado', status_visivel: 'recusado', total: 2400, motivo_recusa: 'Vou fazer pelo convênio', paciente: { nome: 'Marcos Vinícius Andrade', telefone: '11955554444' }, itens: [{ descricao: 'Pacote fisioterapia (10 sessões)', quantidade: 1, valor_unitario: 2400 }] }),
  ]
}

export default function OrcamentosPage() {
  usePageHeader('Orçamentos', 'Monte, envie pelo WhatsApp e acompanhe a aprovação do paciente')
  const router = useRouter()
  const [lista, setLista] = useState<Orc[]>([])
  const [carregando, setCarregando] = useState(true)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [editor, setEditor] = useState<Partial<Orc> | null>(null)
  const demo = typeof window !== 'undefined' && ehDemo()

  const carregar = useCallback(async () => {
    if (ehDemo()) { setLista(demoOrcamentos()); setCarregando(false); return }
    try {
      const r = await fetch('/api/orcamentos')
      const j = await r.json()
      setLista(j.orcamentos || [])
    } finally { setCarregando(false) }
  }, [])
  useEffect(() => { carregar() }, [carregar])

  // ?novo=1&paciente_id=… (da ficha do paciente) abre o editor já com o paciente
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    if (p.get('novo') === '1') setEditor({ paciente_id: p.get('paciente_id') || '', itens: [], condicoes: CONDICOES_PADRAO })
  }, [])
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id')
    if (id && lista.length) setTimeout(() => document.getElementById('orc-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200)
  }, [lista.length])

  const mes = hojeSP().slice(0, 7)
  const k = useMemo(() => ({
    enviar: lista.filter(o => o.status_visivel === 'rascunho'),
    aguardando: lista.filter(o => ['enviado', 'visto'].includes(o.status_visivel)),
    agendar: lista.filter(o => o.status_visivel === 'aprovado' && !o.agendado),
    aprovadoMes: lista.filter(o => o.status_visivel === 'aprovado' && (o.respondido_em || '').slice(0, 7) === mes).reduce((s, o) => s + Number(o.total), 0),
  }), [lista, mes])

  const visiveis = lista.filter(o =>
    filtro === 'enviar' ? o.status_visivel === 'rascunho'
      : filtro === 'aguardando' ? ['enviado', 'visto'].includes(o.status_visivel)
        : filtro === 'agendar' ? o.status_visivel === 'aprovado' && !o.agendado
          : filtro === 'encerrados' ? ['recusado', 'cancelado', 'expirado'].includes(o.status_visivel) || (o.status_visivel === 'aprovado' && o.agendado)
            : true)

  async function acao(nome: 'enviar' | 'cancelar' | 'agendado', o: Orc) {
    if (demo) { avisoDemo(); return null }
    const r = await fetch('/api/orcamentos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: nome, id: o.id }) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { notificar(j.error || 'Não foi possível concluir.', 'erro'); return null }
    return j
  }

  async function enviar(o: Orc) {
    const j = await acao('enviar', o)
    if (!j) return
    const tel = String(j.telefone || '').replace(/\D/g, '')
    if (tel) window.open(`https://wa.me/${tel.length <= 11 ? '55' + tel : tel}?text=${encodeURIComponent(j.texto)}`, '_blank')
    else { navigator.clipboard?.writeText(j.texto); notificar('Paciente sem telefone: a mensagem com o link foi copiada.') }
    carregar()
  }

  async function agendar(o: Orc) {
    const motivo = `Orçamento ${num(o.numero)}: ` + o.itens.map(i => i.descricao).join(', ')
    if (!demo) await acao('agendado', o)
    router.push(comDemo('/agenda?' + new URLSearchParams({ novo: '1', paciente_id: o.paciente_id, ...(o.medico_id ? { medico_id: o.medico_id } : {}), tipo: 'consulta', motivo: motivo.slice(0, 200) })))
  }

  async function cancelar(o: Orc) {
    if (!(await confirmar({ titulo: `Cancelar o orçamento ${num(o.numero)}?`, mensagem: 'Ele some do portal do paciente.', confirmar: 'Cancelar orçamento', perigo: true }))) return
    if (await acao('cancelar', o)) carregar()
  }

  return (
    <div className="c360-pagina" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="c360-kpis" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', flex: 1 }}>
          <KpiCard label="Para enviar" icon={Pencil} cor={T.data.blue} carregando={carregando} valor={String(k.enviar.length)} delta="" tendencia="flat" comparacao="rascunhos" />
          <KpiCard label="Aguardando resposta" icon={Clock} cor={T.data.orange} carregando={carregando} valor={String(k.aguardando.length)} delta="" tendencia="flat" comparacao="enviados ao paciente" />
          <KpiCard label="Aprovados para agendar" icon={CircleCheck} cor={T.data.green} carregando={carregando} valor={String(k.agendar.length)} delta="" tendencia="flat" comparacao="falta marcar" />
          <KpiCard label="Aprovado no mês" icon={Wallet} cor={T.data.purple} carregando={carregando} valor={brl(k.aprovadoMes)} delta="" tendencia="flat" comparacao="valor dos orçamentos" />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <SegmentedControl<Filtro> value={filtro} onChange={setFiltro} options={[
          { value: 'todos', label: 'Todos' }, { value: 'enviar', label: `Para enviar (${k.enviar.length})` },
          { value: 'aguardando', label: `Aguardando (${k.aguardando.length})` }, { value: 'agendar', label: `Para agendar (${k.agendar.length})` },
          { value: 'encerrados', label: 'Encerrados' },
        ]} />
        <span style={{ flex: 1 }} />
        <Button icon={Plus} onClick={() => setEditor({ itens: [], condicoes: CONDICOES_PADRAO })}>Novo orçamento</Button>
      </div>

      {!carregando && !lista.length ? (
        <Card><EmptyState icon={FileText} titulo="Nenhum orçamento ainda" descricao="Monte um orçamento com os procedimentos da clínica e envie pelo WhatsApp. O paciente aprova pelo celular." acao={<Button icon={Plus} onClick={() => setEditor({ itens: [], condicoes: CONDICOES_PADRAO })}>Novo orçamento</Button>} /></Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visiveis.map(o => {
            const st = STATUS[o.status_visivel]
            const dias = Math.ceil((new Date(o.validade + 'T23:59:59-03:00').getTime() - Date.now()) / 864e5)
            const aberto = ['rascunho', 'enviado', 'visto'].includes(o.status_visivel)
            return (
              <Card key={o.id} id={'orc-' + o.id} style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: T.text.primary }}>{o.paciente?.nome || 'Paciente'}</span>
                    <span className="mono" style={{ fontSize: 12, color: T.text.tertiary }}>{num(o.numero)}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 700, padding: '2px 9px', borderRadius: 99, color: st.cor, background: st.fundo }}>{o.status_visivel === 'aprovado' && o.agendado ? 'Aprovado · agendado' : st.label}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: T.text.secondary, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.itens.map(i => i.descricao).join(' · ')}</div>
                  <div style={{ fontSize: 12, color: aberto && dias <= 3 ? T.status.warning : T.text.quaternary, marginTop: 2 }}>
                    {o.status_visivel === 'aprovado' ? `Aprovado em ${dataBR(o.respondido_em || o.criado_em)}${o.condicao_escolhida ? ' · ' + o.condicao_escolhida : ''}`
                      : o.status_visivel === 'recusado' ? `Recusado${o.motivo_recusa ? `: “${o.motivo_recusa}”` : ''}`
                        : aberto ? (dias < 0 ? 'Vencido' : dias === 0 ? 'Vence hoje' : `Vence em ${dias} dia${dias > 1 ? 's' : ''} (${dataBR(o.validade)})`) : `Validade ${dataBR(o.validade)}`}
                  </div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 750, color: T.text.primary, letterSpacing: '-.02em' }}>{brl(o.total)}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {o.status_visivel === 'rascunho' && <Button size="sm" icon={Send} onClick={() => enviar(o)}>Enviar</Button>}
                  {['enviado', 'visto'].includes(o.status_visivel) && <Button size="sm" variant="secondary" icon={Send} onClick={() => enviar(o)}>Reenviar</Button>}
                  {o.status_visivel === 'aprovado' && !o.agendado && <Button size="sm" icon={CalendarPlus} onClick={() => agendar(o)}>Agendar</Button>}
                  {(aberto || o.status_visivel === 'expirado') && <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditor(o)}>Editar</Button>}
                  {aberto && <Button size="sm" variant="ghost" icon={X} onClick={() => cancelar(o)}>Cancelar</Button>}
                  {['recusado', 'cancelado', 'expirado'].includes(o.status_visivel) && <Button size="sm" variant="ghost" icon={Copy} onClick={() => setEditor({ ...o, id: undefined, validade: undefined })}>Copiar como novo</Button>}
                </div>
              </Card>
            )
          })}
          {!visiveis.length && <p style={{ fontSize: 13, color: T.text.quaternary, textAlign: 'center', margin: 16 }}>Nada por aqui.</p>}
        </div>
      )}

      {editor && <EditorOrcamento inicial={editor} demo={demo} onClose={() => setEditor(null)} onSalvo={(enviarDepois, o) => { setEditor(null); carregar().then(() => { if (enviarDepois && o) enviar(o) }) }} />}
    </div>
  )
}

function EditorOrcamento({ inicial, demo, onClose, onSalvo }: { inicial: Partial<Orc>; demo: boolean; onClose: () => void; onSalvo: (enviar: boolean, o?: Orc) => void }) {
  const [pacientes, setPacientes] = useState<{ id: string; nome: string; telefone: string | null }[]>([])
  const [procedimentos, setProcedimentos] = useState<{ id: string; nome: string; valor: number | null }[]>([])
  const [pacienteId, setPacienteId] = useState(inicial.paciente_id || '')
  const [buscaPac, setBuscaPac] = useState('')
  const [itens, setItens] = useState<ItemOrcamento[]>(inicial.itens?.length ? inicial.itens.map(i => ({ procedimento_id: i.procedimento_id, descricao: i.descricao, quantidade: Number(i.quantidade), valor_unitario: Number(i.valor_unitario) })) : [])
  const [desconto, setDesconto] = useState(String(inicial.desconto || ''))
  const [validade, setValidade] = useState(inicial.validade || new Date(Date.now() + 15 * 864e5).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }))
  const [condicoes, setCondicoes] = useState<string[]>(inicial.condicoes?.length ? inicial.condicoes : CONDICOES_PADRAO)
  const [novaCond, setNovaCond] = useState('')
  const [obs, setObs] = useState(inicial.observacoes || '')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (demo) {
      setPacientes([{ id: 'demo-pac-1', nome: 'Mariana Costa Ribeiro', telefone: '11988887777' }, { id: 'demo-pac-2', nome: 'Roberto Nogueira', telefone: '11977776666' }])
      setProcedimentos([{ id: 'p1', nome: 'Consulta clínica', valor: 300 }, { id: 'p2', nome: 'Eletrocardiograma com laudo', valor: 180 }, { id: 'p3', nome: 'Infiltração articular', valor: 360 }])
      return
    }
    fetch('/api/pacientes').then(r => r.json()).then(j => setPacientes(j.pacientes || [])).catch(() => {})
    const eu = JSON.parse(localStorage.getItem('clinica_admin') || localStorage.getItem('medico') || 'null')
    const cid = eu?.clinica_id
    if (cid) fetch('/api/procedimentos?clinica_id=' + cid).then(r => r.json()).then(j => setProcedimentos(j.procedimentos || [])).catch(() => {})
  }, [demo])

  const pac = pacientes.find(p => p.id === pacienteId)
  const achados = buscaPac.trim().length >= 2 ? pacientes.filter(p => p.nome.toLowerCase().includes(buscaPac.trim().toLowerCase())).slice(0, 6) : []
  const { bruto, total } = totalDe(itens, Number(String(desconto).replace(',', '.')) || 0)
  const setItem = (k: number, campo: keyof ItemOrcamento, v: any) => setItens(l => l.map((i, j) => j === k ? { ...i, [campo]: v } : i))

  async function salvar(enviarDepois: boolean) {
    if (!pacienteId) { notificar('Escolha o paciente.', 'erro'); return }
    if (!itens.some(i => i.descricao.trim())) { notificar('Inclua pelo menos um item.', 'erro'); return }
    if (demo) { avisoDemo(); onClose(); return }
    setSalvando(true)
    try {
      const r = await fetch('/api/orcamentos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        acao: 'salvar', id: inicial.id, paciente_id: pacienteId, medico_id: inicial.medico_id || null, itens,
        desconto: Number(String(desconto).replace(',', '.')) || 0, validade, condicoes, observacoes: obs.trim() || null,
      }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { notificar(j.error || 'Não foi possível salvar.', 'erro'); return }
      notificar(enviarDepois ? 'Orçamento salvo. Abrindo o WhatsApp…' : 'Rascunho salvo')
      onSalvo(enviarDepois, { id: j.id } as Orc)
    } finally { setSalvando(false) }
  }

  return (
    <Drawer titulo={inicial.id ? `Editar orçamento ${num(inicial.numero || 0)}` : 'Novo orçamento'} onClose={onClose} largura={520}
      rodape={<>
        <Button variant="secondary" onClick={() => salvar(false)} disabled={salvando}>Salvar rascunho</Button>
        <Button icon={Send} onClick={() => salvar(true)} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar e enviar'}</Button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Paciente">
          {pac ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 12, border: `1px solid ${T.border.default}` }}>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: T.text.primary }}>{pac.nome}</span>
              {!inicial.id && <Button size="sm" variant="ghost" onClick={() => setPacienteId('')}>Trocar</Button>}
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <Input value={buscaPac} onChange={e => setBuscaPac(e.target.value)} placeholder="Digite o nome do paciente" autoFocus />
              {achados.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 5, marginTop: 4, background: '#fff', border: `1px solid ${T.border.default}`, borderRadius: 12, boxShadow: T.shadow.lg, overflow: 'hidden' }}>
                  {achados.map(p => (
                    <button key={p.id} onClick={() => { setPacienteId(p.id); setBuscaPac('') }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5 }}>{p.nome}</button>
                  ))}
                </div>
              )}
            </div>
          )}
        </Field>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: T.text.secondary }}>Itens</span>
          {itens.map((i, k) => (
            <div key={k} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 64px 110px 32px', gap: 6, alignItems: 'center' }}>
              <Input value={i.descricao} onChange={e => setItem(k, 'descricao', e.target.value)} placeholder="Descrição" />
              <Input type="number" min={1} value={String(i.quantidade)} onChange={e => setItem(k, 'quantidade', Number(e.target.value) || 1)} aria-label="Quantidade" />
              <Input type="number" min={0} step="0.01" value={String(i.valor_unitario)} onChange={e => setItem(k, 'valor_unitario', Number(e.target.value) || 0)} aria-label="Valor unitário" />
              <button onClick={() => setItens(l => l.filter((_, j) => j !== k))} aria-label="Remover item" style={{ border: 'none', background: 'none', cursor: 'pointer', color: T.text.tertiary }}><Trash2 size={16} /></button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {procedimentos.slice(0, 12).map(p => (
              <Chip key={p.id} onClick={() => setItens(l => [...l, { procedimento_id: p.id, descricao: p.nome, quantidade: 1, valor_unitario: Number(p.valor) || 0 }])} icon={Plus}>
                {p.nome}{p.valor ? ` · ${brl(Number(p.valor))}` : ''}
              </Chip>
            ))}
            <Chip onClick={() => setItens(l => [...l, { descricao: '', quantidade: 1, valor_unitario: 0 }])} icon={Plus}>Item livre</Chip>
          </div>
          {!procedimentos.length && <span style={{ fontSize: 12, color: T.text.tertiary }}>Cadastre os procedimentos em Minha clínica → Procedimentos para o preço vir preenchido.</span>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Desconto (R$)"><Input type="number" min={0} step="0.01" value={desconto} onChange={e => setDesconto(e.target.value)} placeholder="0,00" /></Field>
          <Field label="Válido até"><Input type="date" value={validade} onChange={e => setValidade(e.target.value)} /></Field>
        </div>

        <Field label="Formas de pagamento oferecidas" hint="O paciente escolhe uma ao aprovar">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Array.from(new Set([...CONDICOES_PADRAO, ...condicoes])).map(c => (
              <Chip key={c} ativo={condicoes.includes(c)} onClick={() => setCondicoes(l => l.includes(c) ? l.filter(x => x !== c) : [...l, c])}>{c}</Chip>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <Input value={novaCond} onChange={e => setNovaCond(e.target.value)} placeholder="Outra (ex.: Cartão em até 6x)" />
            <Button variant="secondary" size="sm" onClick={() => { const c = novaCond.trim(); if (c) { setCondicoes(l => [...l, c]); setNovaCond('') } }}>Adicionar</Button>
          </div>
        </Field>

        <Field label="Observações para o paciente (opcional)">
          <Textarea rows={3} value={obs} onChange={e => setObs(e.target.value)} placeholder="Ex.: preparo, o que está incluso, prazo de retorno" />
        </Field>

        <div style={{ padding: '14px 16px', borderRadius: 14, background: T.brand.primaryLight, display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ flex: 1, fontSize: 13, color: T.brand.primary, fontWeight: 600 }}>{Number(desconto) > 0 ? `Subtotal ${brl(bruto)} · desconto ${brl(Number(desconto))}` : 'Total'}</span>
          <span style={{ fontSize: 24, fontWeight: 750, color: T.brand.primary }}>{brl(total)}</span>
        </div>
      </div>
    </Drawer>
  )
}
