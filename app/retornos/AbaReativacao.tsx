'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { UserRoundSearch, Megaphone, TriangleAlert, PhoneOff, MessageCircle, Clock, CircleCheck, CircleX, Send, Info } from 'lucide-react'
import { tokens } from '@/lib/design-tokens'
import {
  Avatar, Badge, Button, Checkbox, EmptyState, Field, Input, Modal, ProgressBar, SearchInput, SegmentedControl, Textarea, Chip,
} from '@/components/ui'
import { confirmar, notificar } from '@/components/ui/dialogos'
import { fmtDataHora, telefoneBonito } from '@/components/retornos/datas'
import type { MedicoCtx } from './page'
import { MENSAGEM_PADRAO, inativosDemo, type Inativo } from './tipos'

const T = tokens
type Meses = '3' | '6' | '12'
const PAUSA_S = 2.5 // igual a PAUSA_MS do servidor
const TONS = ['purple', 'pink', 'blue', 'green'] as const
const tomDe = (s: string) => TONS[Math.abs(s.split("").reduce((h, c) => c.charCodeAt(0) + ((h << 5) - h), 0)) % 4]

function tempoDesde(iso: string | null) {
  if (!iso) return 'Nunca consultou'
  const meses = Math.floor((Date.now() - new Date(iso).getTime()) / (30.44 * 86400000))
  if (meses < 12) return `há ${meses} ${meses === 1 ? 'mês' : 'meses'}`
  const anos = Math.floor(meses / 12), resto = meses % 12
  return `há ${anos} ${anos === 1 ? 'ano' : 'anos'}${resto ? ` e ${resto} ${resto === 1 ? 'mês' : 'meses'}` : ''}`
}

export default function AbaReativacao({ medico, demo, onCampanhaCriada, irParaCampanhas }: {
  medico: MedicoCtx; demo: boolean; onCampanhaCriada: () => void; irParaCampanhas: () => void
}) {
  const [meses, setMeses] = useState<Meses>('6')
  const [lista, setLista] = useState<Inativo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [aviso, setAviso] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [modal, setModal] = useState(false)

  const carregar = useCallback(async () => {
    setCarregando(true); setSel(new Set())
    if (demo) { await new Promise(r => setTimeout(r, 350)); setLista(inativosDemo(Number(meses))); setCarregando(false); return }
    try {
      const r = await fetch(`/api/reativacao?medico_id=${medico.id}&meses=${meses}`)
      const j = await r.json()
      if (!r.ok) { setAviso(j.error || 'Erro ao carregar'); setLista([]) } else { setAviso(null); setLista(j.pacientes || []) }
    } catch { setAviso('Sem conexão. Tente novamente.') }
    setCarregando(false)
  }, [demo, medico.id, meses])
  useEffect(() => { carregar() }, [carregar])

  const q = busca.trim().toLowerCase()
  const visiveis = useMemo(() => lista.filter(p => !q || p.nome.toLowerCase().includes(q)), [lista, q])
  const comTel = visiveis.filter(p => p.telefone)
  const todosMarcados = comTel.length > 0 && comTel.every(p => sel.has(p.id))
  const selecionados = lista.filter(p => sel.has(p.id))

  const alternar = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const alternarTodos = () => setSel(s => {
    const n = new Set(s)
    if (todosMarcados) comTel.forEach(p => n.delete(p.id)); else comTel.forEach(p => n.add(p.id))
    return n
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', borderRadius: 16, border: `1px solid ${T.border.default}`, background: T.bg.cardSubtle }}>
        <span style={{ width: 34, height: 34, borderRadius: 11, background: T.brand.primaryLight, color: T.brand.primary, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <UserRoundSearch size={17} strokeWidth={1.6} />
        </span>
        <div style={{ fontSize: 13, color: T.text.muted, lineHeight: 1.5, minWidth: 0 }}>
          <b style={{ color: T.text.primary }}>Pacientes inativos</b> são os que não têm consulta nem agendamento no período e nada marcado no futuro.
          Selecione quem convidar e crie uma campanha de WhatsApp.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: T.text.secondary, fontWeight: 600 }}>Sem consulta há</span>
        <SegmentedControl<Meses> value={meses} onChange={setMeses} options={[
          { value: '3', label: '3 meses' }, { value: '6', label: '6 meses' }, { value: '12', label: '12 meses' },
        ]} />
        <SearchInput value={busca} onChange={setBusca} placeholder="Buscar paciente" style={{ flex: '1 1 200px', minWidth: 0, maxWidth: 320 }} />
      </div>

      {aviso && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 12, background: T.status.warningBg, color: T.status.warning, fontSize: 13 }}>
          <TriangleAlert size={16} strokeWidth={1.6} style={{ flexShrink: 0 }} />{aviso}
        </div>
      )}

      {carregando ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="c360-skel" style={{ height: 56, borderRadius: 12 }} />)}
        </div>
      ) : lista.length === 0 ? (
        <div style={{ border: `1px solid ${T.border.default}`, borderRadius: 16 }}>
          <EmptyState icon={CircleCheck} titulo="Nenhum paciente inativo"
            descricao={`Todos os seus pacientes passaram por consulta nos últimos ${meses} meses ou têm algo marcado. Experimente um período maior.`}
            acao={meses !== '12' ? <Button variant="secondary" onClick={() => setMeses(meses === '3' ? '6' : '12')}>Ver {meses === '3' ? '6' : '12'} meses</Button> : undefined} />
        </div>
      ) : (
        <div style={{ border: `1px solid ${T.border.default}`, borderRadius: 16, background: '#fff', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: `1px solid ${T.border.muted}`, background: T.bg.muted, flexWrap: 'wrap' }}>
            <Checkbox checked={todosMarcados} onChange={alternarTodos} label={<span style={{ fontWeight: 600 }}>Selecionar todos</span>} />
            <span style={{ fontSize: 12.5, color: T.text.quaternary }}>
              {visiveis.length} paciente{visiveis.length === 1 ? '' : 's'}{visiveis.length !== comTel.length ? ` · ${visiveis.length - comTel.length} sem telefone` : ''}
            </span>
          </div>
          <div style={{ maxHeight: 'min(560px, 60vh)', overflowY: 'auto' }}>
            {visiveis.length === 0 && <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: T.text.tertiary }}>Nenhum paciente encontrado para &quot;{busca}&quot;.</div>}
            {visiveis.map((p, i) => {
              const marcado = sel.has(p.id)
              const semTel = !p.telefone
              return (
                <div key={p.id} onClick={() => !semTel && alternar(p.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', cursor: semTel ? 'default' : 'pointer',
                  borderTop: i ? `1px solid ${T.border.muted}` : 'none', background: marcado ? T.brand.primarySoftBg : '#fff', opacity: semTel ? 0.6 : 1,
                }}>
                  <span onClick={e => e.stopPropagation()} style={{ display: 'inline-flex', visibility: semTel ? 'hidden' : 'visible' }}>
                    <Checkbox checked={marcado} onChange={() => alternar(p.id)} />
                  </span>
                  <Avatar nome={p.nome} size={34} tom={tomDe(p.nome)} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nome}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.text.quaternary, flexWrap: 'wrap' }}>
                      {semTel
                        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: T.status.warning }}><PhoneOff size={12} strokeWidth={1.6} />Sem telefone</span>
                        : <span className="mono">{telefoneBonito(p.telefone)}</span>}
                      <span className="ret-ina-ultima" style={{ display: 'none' }}>· {tempoDesde(p.ultima_visita)}</span>
                    </div>
                  </div>
                  <div className="ret-ina-coluna" style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text.strong }}>{p.nunca_consultou ? 'Nunca consultou' : fmtDataHora(p.ultima_visita)}</div>
                    <div style={{ fontSize: 12, color: T.text.quaternary }}>{p.nunca_consultou ? 'cadastro antigo' : tempoDesde(p.ultima_visita)}</div>
                  </div>
                  {p.janela_aberta && <span className="ret-ina-coluna"><Badge tone="success" icon={MessageCircle}>Conversa recente</Badge></span>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Barra de ação (fixa no rodapé quando há seleção) */}
      {selecionados.length > 0 && (
        <div style={{
          position: 'sticky', bottom: 12, zIndex: 5, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          padding: '10px 12px 10px 16px', borderRadius: 14, background: T.night[800], color: '#fff', boxShadow: T.shadow.lg,
        }}>
          <span style={{ flex: '1 1 160px', fontSize: 13.5, fontWeight: 600 }}>
            {selecionados.length} selecionado{selecionados.length === 1 ? '' : 's'}
          </span>
          <Button size="sm" variant="ghost" onClick={() => setSel(new Set())} style={{ color: '#fff', background: 'transparent' }}>Limpar</Button>
          <Button size="sm" icon={Megaphone} onClick={() => setModal(true)}>Criar campanha</Button>
        </div>
      )}
      {selecionados.length === 0 && !carregando && lista.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button icon={Megaphone} disabled title="Selecione pacientes na lista">Criar campanha</Button>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 640px) { .ret-ina-coluna { display: none; } .ret-ina-ultima { display: inline !important; } }
      ` }} />

      {modal && (
        <ModalCampanha medico={medico} demo={demo} meses={Number(meses)} destinatarios={selecionados}
          onFechar={(concluiu) => { setModal(false); if (concluiu) { setSel(new Set()); onCampanhaCriada() } }}
          irParaCampanhas={() => { setModal(false); setSel(new Set()); onCampanhaCriada(); irParaCampanhas() }} />
      )}
    </div>
  )
}

// ── Modal de campanha: editar → confirmar → enviando ───────────────────────

type Etapa = 'editar' | 'confirmar' | 'enviando' | 'fim'

function ModalCampanha({ medico, demo, meses, destinatarios, onFechar, irParaCampanhas }: {
  medico: MedicoCtx; demo: boolean; meses: number; destinatarios: Inativo[]
  onFechar: (concluiu: boolean) => void; irParaCampanhas: () => void
}) {
  const [etapa, setEtapa] = useState<Etapa>('editar')
  const [nome, setNome] = useState(`Reativação · ${meses} meses`)
  const [mensagem, setMensagem] = useState(MENSAGEM_PADRAO)
  const [prog, setProg] = useState({ total: destinatarios.length, enviados: 0, falhas: 0, restantes: destinatarios.length })
  const [foraHorario, setForaHorario] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const parar = useRef(false)
  const caixaRef = useRef<HTMLDivElement>(null)

  const total = destinatarios.length
  const janelaAberta = destinatarios.filter(d => d.janela_aberta).length
  const minutos = Math.max(1, Math.ceil((total * (PAUSA_S + 0.6)) / 60))
  const medicoTitulo = !medico.nome ? '' : /^(dr|dra)\.?\s/i.test(medico.nome) ? medico.nome : `Dr(a). ${medico.nome}`
  const primeiro = destinatarios[0]
  const previa = mensagem.replace(/\{(\w+)\}/g, (_, k) => ({
    nome: (primeiro?.nome || '').split(' ')[0], medico: medicoTitulo, clinica: medico.clinicaNome || medicoTitulo,
  } as Record<string, string>)[k] ?? '')

  const inserir = (v: string) => {
    const el = caixaRef.current?.querySelector('textarea')
    if (!el) { setMensagem(m => m + v); return }
    const i = el.selectionStart ?? mensagem.length, f = el.selectionEnd ?? i
    const novo = mensagem.slice(0, i) + v + mensagem.slice(f)
    setMensagem(novo)
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(i + v.length, i + v.length) })
  }

  const enviar = async () => {
    setEtapa('enviando'); setErro(null); parar.current = false
    if (demo) {
      let env = 0, fal = 0
      for (let i = 0; i < total; i++) {
        if (parar.current) break
        await new Promise(r => setTimeout(r, 260))
        if (Math.random() < 0.08) fal++; else env++
        setProg({ total, enviados: env, falhas: fal, restantes: total - env - fal })
      }
      setEtapa('fim'); notificar('Campanha enviada (demonstração — nada foi gravado)')
      return
    }
    try {
      let r = await fetch('/api/reativacao', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medico_id: medico.id, nome, mensagem, meses, paciente_ids: destinatarios.map(d => d.id) }),
      })
      let j = await r.json()
      if (!r.ok) { setErro(j.error || 'Não foi possível criar a campanha'); setEtapa('confirmar'); return }
      const id = j.campanha.id
      const tot = j.campanha.total_destinatarios || total
      let enviados = j.enviados || 0, falhas = j.falhas || 0
      setProg({ total: tot, enviados, falhas, restantes: j.restantes })
      while (!j.concluida && !j.foraHorario && !parar.current) {
        r = await fetch('/api/reativacao', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'continuar', campanha_id: id }) })
        j = await r.json()
        if (!r.ok) { setErro(j.error || 'Envio interrompido'); break }
        enviados += j.enviados || 0; falhas += j.falhas || 0
        setProg({ total: tot, enviados, falhas, restantes: j.restantes })
      }
      if (j.foraHorario) setForaHorario(true)
      setEtapa('fim')
    } catch {
      setErro('Conexão perdida. O que faltou será enviado automaticamente no próximo ciclo (10h).'); setEtapa('fim')
    }
  }

  const fechar = async () => {
    if (etapa === 'enviando') {
      const ok = await confirmar({
        titulo: 'Interromper o envio?', confirmar: 'Interromper', perigo: true,
        mensagem: 'As mensagens que faltam ficam na fila e serão enviadas automaticamente no próximo ciclo diário (10h).',
      })
      if (!ok) return
      parar.current = true
    }
    onFechar(etapa !== 'editar' && etapa !== 'confirmar')
  }

  const feitos = prog.enviados + prog.falhas
  const pct = prog.total ? (feitos / prog.total) * 100 : 0

  return (
    <Modal titulo={etapa === 'editar' ? 'Nova campanha de reativação' : etapa === 'confirmar' ? 'Confirmar envio' : etapa === 'enviando' ? 'Enviando campanha' : 'Campanha enviada'}
      onClose={fechar} largura={etapa === 'editar' ? 760 : 520}
      rodape={etapa === 'editar' ? <>
        <Button variant="secondary" onClick={fechar}>Cancelar</Button>
        <Button disabled={mensagem.trim().length < 10 || !nome.trim()} onClick={() => setEtapa('confirmar')}>Continuar</Button>
      </> : etapa === 'confirmar' ? <>
        <Button variant="secondary" onClick={() => setEtapa('editar')}>Voltar</Button>
        <Button icon={Send} onClick={enviar}>Enviar para {total}</Button>
      </> : etapa === 'enviando' ? <>
        <Button variant="secondary" onClick={fechar}>Interromper</Button>
      </> : <>
        <Button variant="secondary" onClick={() => onFechar(true)}>Fechar</Button>
        <Button onClick={irParaCampanhas}>Ver campanhas</Button>
      </>}>

      {etapa === 'editar' && (
        <div className="ret-camp-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 1fr)', gap: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
            <Field label="Nome da campanha"><Input value={nome} onChange={e => setNome(e.target.value)} maxLength={120} /></Field>
            <Field label="Mensagem">
              <div ref={caixaRef} style={{ display: 'flex' }}><Textarea rows={8} value={mensagem} onChange={e => setMensagem(e.target.value)} maxLength={1000} /></div>
            </Field>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: T.text.quaternary, marginRight: 2 }}>Inserir:</span>
              {['{nome}', '{medico}', '{clinica}'].map(v => <Chip key={v} onClick={() => inserir(v)} style={{ height: 28 }}><span className="mono" style={{ fontSize: 12 }}>{v}</span></Chip>)}
              <span style={{ marginLeft: 'auto', fontSize: 12, color: T.text.tertiary }} className="mono">{mensagem.length}/1000</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: T.text.secondary }}>Pré-visualização · {primeiro?.nome}</span>
            <div style={{ borderRadius: 14, background: T.whatsapp.chatPattern, padding: 14, minHeight: 150 }}>
              <div style={{ marginLeft: 'auto', maxWidth: '92%', background: T.whatsapp.bubble, borderRadius: '12px 12px 4px 12px', padding: '8px 11px 6px', fontSize: 13, lineHeight: 1.45, color: T.text.chatPrimary, whiteSpace: 'pre-wrap', wordBreak: 'break-word', boxShadow: '0 1px 1px rgba(0,0,0,.08)' }}>
                {previa}
                <div className="mono" style={{ textAlign: 'right', fontSize: 10.5, color: T.text.chatSecondary, marginTop: 3 }}>10:00</div>
              </div>
            </div>
            <AvisoJanela total={total} janelaAberta={janelaAberta} />
          </div>
          <style dangerouslySetInnerHTML={{ __html: `@media (max-width: 720px) { .ret-camp-grid { grid-template-columns: minmax(0, 1fr) !important; } }` }} />
        </div>
      )}

      {etapa === 'confirmar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            {[
              { l: 'Destinatários', v: String(total) },
              { l: 'Tempo estimado', v: `~${minutos} min` },
              { l: 'Conversa recente', v: `${janelaAberta} de ${total}` },
            ].map(x => (
              <div key={x.l} style={{ border: `1px solid ${T.border.default}`, borderRadius: 12, padding: '10px 12px', minWidth: 0 }}>
                <div style={{ fontSize: 11.5, color: T.text.quaternary, fontWeight: 600 }}>{x.l}</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{x.v}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 13, color: T.text.muted, lineHeight: 1.55 }}>
            A campanha <b>{nome}</b> será enviada pelo WhatsApp da clínica, uma mensagem a cada {PAUSA_S}s, apenas entre 8h e 20h.
            Mantenha esta janela aberta até o fim — se fechar, o que faltar é enviado no próximo ciclo automático (10h).
            Cada mensagem aparece no Chat, e as respostas chegam lá.
          </div>
          <AvisoJanela total={total} janelaAberta={janelaAberta} />
          {erro && <div style={{ fontSize: 13, color: T.status.danger }}>{erro}</div>}
        </div>
      )}

      {(etapa === 'enviando' || etapa === 'fim') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-.03em', fontVariantNumeric: 'tabular-nums' }}>{feitos}</span>
            <span style={{ fontSize: 14, color: T.text.quaternary }}>de {prog.total} processados</span>
          </div>
          <ProgressBar valor={pct} altura={8} cor={etapa === 'fim' ? T.status.success : T.brand.primary} />
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: T.status.success }}><CircleCheck size={15} strokeWidth={1.6} />{prog.enviados} enviadas</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: prog.falhas ? T.status.danger : T.text.quaternary }}><CircleX size={15} strokeWidth={1.6} />{prog.falhas} falhas</span>
            {prog.restantes > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: T.text.quaternary }}><Clock size={15} strokeWidth={1.6} />{prog.restantes} na fila</span>}
          </div>
          {etapa === 'enviando' && <div style={{ fontSize: 12.5, color: T.text.quaternary }}>Enviando com pausa entre mensagens para proteger o número da clínica…</div>}
          {foraHorario && (
            <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderRadius: 12, background: T.status.infoBg, color: T.status.infoDarker, fontSize: 13, lineHeight: 1.45 }}>
              <Clock size={16} strokeWidth={1.6} style={{ flexShrink: 0, marginTop: 1 }} />
              Fora do horário comercial (8h–20h). As mensagens ficaram na fila e serão enviadas automaticamente amanhã às 10h.
            </div>
          )}
          {etapa === 'fim' && prog.falhas > 0 && (
            <div style={{ fontSize: 12.5, color: T.text.quaternary, lineHeight: 1.45 }}>
              Falhas costumam ser telefones inválidos ou contatos fora da janela de 24h do WhatsApp. Veja o motivo de cada uma no histórico da campanha.
            </div>
          )}
          {erro && <div style={{ fontSize: 13, color: T.status.danger }}>{erro}</div>}
        </div>
      )}
    </Modal>
  )
}

function AvisoJanela({ total, janelaAberta }: { total: number; janelaAberta: number }) {
  const fora = total - janelaAberta
  if (fora <= 0) return null
  return (
    <div style={{ display: 'flex', gap: 9, padding: '10px 12px', borderRadius: 12, background: T.status.warningBg, color: T.status.warningText, fontSize: 12.5, lineHeight: 1.5 }}>
      <Info size={16} strokeWidth={1.6} style={{ flexShrink: 0, marginTop: 1 }} />
      <span>
        <b>Regra do WhatsApp:</b> mensagem de texto livre só é entregue a quem falou com a clínica nas últimas 24h.
        {' '}{fora === total ? 'Nenhum destinatário selecionado tem' : `${fora} dos ${total} destinatários não ${fora === 1 ? 'tem' : 'têm'}`} conversa recente — para eles, o WhatsApp exige uma <b>mensagem de modelo aprovada pela Meta</b>, e sem ela o envio pode falhar.
      </span>
    </div>
  )
}
