'use client'
/**
 * Ficha rápida do paciente — gaveta que abre por cima de qualquer tela
 * (abrirFicha(pacienteId)). Tudo que a recepção e o médico precisam para decidir
 * na hora: contato, alertas, números, próximos horários, retornos e a linha do tempo
 * (consultas, agendamentos, faltas, chegadas e esperas). Exporta em PDF ou arquivo.
 */
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle, CalendarCheck, CalendarPlus, CalendarX, ClipboardList, Copy, Download, FileText, MessageCircle, Pill, Printer, Stethoscope, Ticket,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { tokens as T } from '@/lib/design-tokens'
import { Avatar, Badge, Button, Drawer, EmptyState, IconButton } from '@/components/ui'
import { notificar } from '@/components/ui/dialogos'
import { registrarAcesso } from '@/lib/auditoria'
import { carregarFicha360, ehDemo, EVENTO_FICHA, type Ficha360 } from '@/lib/atendimento/cliente'
import { formatarTelefone } from '@/lib/atendimento/comum'

type Evento = { quando: string; icon: LucideIcon; cor: string; titulo: string; detalhe?: string | null; selo?: { texto: string; tom: 'success' | 'danger' | 'warning' | 'neutral' | 'accent' } }

const dataBR = (iso?: string | null, comHora = false) => iso
  ? new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', ...(comHora ? { hour: '2-digit', minute: '2-digit' } : {}) })
  : '—'
const minutos = (a?: string | null, b?: string | null) => (a && b ? Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000)) : null)
const idade = (n?: string | null) => {
  if (!n) return null
  const d = new Date(n + 'T12:00:00'), h = new Date()
  let i = h.getFullYear() - d.getFullYear()
  if (h.getMonth() < d.getMonth() || (h.getMonth() === d.getMonth() && h.getDate() < d.getDate())) i--
  return i
}

/** Montada uma vez no AppShell; escuta abrirFicha(). */
export function FichaRapidaGlobal() {
  const [pacienteId, setPacienteId] = useState<string | null>(null)
  useEffect(() => {
    const abrir = (e: Event) => setPacienteId((e as CustomEvent<string>).detail)
    window.addEventListener(EVENTO_FICHA, abrir)
    return () => window.removeEventListener(EVENTO_FICHA, abrir)
  }, [])
  if (!pacienteId) return null
  return <FichaRapida key={pacienteId} pacienteId={pacienteId} onClose={() => setPacienteId(null)} />
}

export function FichaRapida({ pacienteId, onClose }: { pacienteId: string; onClose: () => void }) {
  const router = useRouter()
  const [f, setF] = useState<Ficha360 | null>(null)
  const [erro, setErro] = useState('')
  const [filtro, setFiltro] = useState<'tudo' | 'consultas' | 'agenda'>('tudo')

  useEffect(() => {
    carregarFicha360(pacienteId).then(d => { setF(d); registrarAcesso({ acao: 'visualizou', recurso: 'paciente', recursoId: pacienteId, pacienteId }) })
      .catch(e => setErro(e.message || 'Não foi possível abrir a ficha'))
  }, [pacienteId])

  const eventos = useMemo<Evento[]>(() => {
    if (!f) return []
    const l: Evento[] = []
    if (filtro !== 'agenda') f.consultas.forEach(c => l.push({
      quando: c.data_hora || c.criado_em, icon: Stethoscope, cor: T.brand.primary,
      titulo: c.diagnostico_principal || (Array.isArray(c.cids) && c.cids[0]?.descricao) || 'Consulta',
      detalhe: [c.medico, c.plano].filter(Boolean).join(' · '),
    }))
    if (filtro !== 'consultas') {
      f.agendamentos.filter(a => ['faltou', 'cancelado'].includes(a.status) || new Date(a.data_hora).getTime() > Date.now()).forEach(a => l.push({
        quando: a.data_hora, icon: a.status === 'faltou' || a.status === 'cancelado' ? CalendarX : CalendarCheck,
        cor: a.status === 'faltou' ? T.status.danger : a.status === 'cancelado' ? T.text.tertiary : T.status.info,
        titulo: `${a.tipo === 'retorno' ? 'Retorno' : 'Consulta'}${a.motivo ? ` · ${a.motivo}` : ''}`, detalhe: a.medico,
        selo: a.status === 'faltou' ? { texto: 'Faltou', tom: 'danger' } : a.status === 'cancelado' ? { texto: 'Cancelado', tom: 'neutral' } : { texto: 'Agendado', tom: 'accent' },
      }))
      f.atendimentos.forEach(t => {
        const espera = minutos(t.chegada_em, t.chamado_em), duracao = minutos(t.inicio_em, t.fim_em)
        l.push({
          quando: t.chegada_em, icon: Ticket, cor: T.data.orange, titulo: `Chegou à clínica · senha ${t.senha}`,
          detalhe: [t.medico, espera !== null ? `esperou ${espera} min` : null, duracao !== null ? `consulta de ${duracao} min` : null].filter(Boolean).join(' · '),
          selo: t.status === 'ausente' ? { texto: 'Não atendeu à chamada', tom: 'warning' } : undefined,
        })
      })
      f.retornos.forEach(r => l.push({
        quando: r.criado_em, icon: CalendarPlus, cor: T.status.success, titulo: `Retorno pedido para ~${dataBR(r.data_prevista)}`,
        detalhe: [r.medico, r.motivo].filter(Boolean).join(' · '),
        selo: r.status === 'agendado' || r.status === 'concluido' ? { texto: r.status === 'concluido' ? 'Feito' : 'Agendado', tom: 'success' } : { texto: 'Pendente', tom: 'warning' },
      }))
    }
    return l.sort((a, b) => b.quando.localeCompare(a.quando))
  }, [f, filtro])

  const p = f?.paciente
  const anos = idade(p?.data_nascimento)
  const pendentes = f?.retornos.filter(r => r.status === 'pendente' || r.status === 'lembrado') || []
  const futuros = (f?.agendamentos || []).filter(a => new Date(a.data_hora).getTime() > Date.now() && !['cancelado', 'faltou'].includes(a.status)).reverse()

  const ir = (url: string) => { onClose(); router.push(url + (ehDemo() ? (url.includes('?') ? '&' : '?') + 'demo=1' : '')) }
  const copiar = async (t: string) => { try { await navigator.clipboard.writeText(t); notificar('Copiado') } catch {} }

  const exportarArquivo = () => {
    if (!f) return
    registrarAcesso({ acao: 'exportou', recurso: 'paciente', recursoId: pacienteId, pacienteId, detalhes: { formato: 'json' } })
    const blob = new Blob([JSON.stringify({ exportado_em: new Date().toISOString(), origem: 'Clinical 360', ...f }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `ficha-${(p?.nome || 'paciente').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\W+/g, '-').toLowerCase()}.json`
    a.click(); URL.revokeObjectURL(a.href)
  }
  const imprimir = () => {
    if (!f || !p) return
    registrarAcesso({ acao: 'imprimiu', recurso: 'paciente', recursoId: pacienteId, pacienteId })
    const esc = (s: any) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
    const linha = (k: string, v: any) => v ? `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>` : ''
    const w = window.open('', '_blank')
    if (!w) { notificar('Libere pop-ups para imprimir', 'erro'); return }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Ficha — ${esc(p.nome)}</title><style>
      body{font-family:system-ui,sans-serif;color:#1d1b26;margin:32px;font-size:13px} h1{font-size:20px;margin:0 0 4px} h2{font-size:14px;margin:22px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px}
      table{border-collapse:collapse;width:100%} th{text-align:left;width:170px;color:#666;font-weight:600;padding:3px 0;vertical-align:top} td{padding:3px 0}
      .ev{padding:6px 0;border-bottom:1px solid #f0f0f0} .q{color:#666;font-size:12px} .alerta{color:#b42318;font-weight:700}
    </style></head><body>
      <h1>${esc(p.nome)}</h1><div class="q">Ficha emitida em ${new Date().toLocaleString('pt-BR')} · Clinical 360</div>
      <h2>Dados</h2><table>${linha('Nascimento', p.data_nascimento ? `${dataBR(p.data_nascimento)}${anos !== null ? ` (${anos} anos)` : ''}` : '')}${linha('CPF', p.cpf)}${linha('Celular', formatarTelefone(p.telefone))}${linha('E-mail', p.email)}${linha('Convênio', [p.convenio, p.nr_carteirinha].filter(Boolean).join(' · '))}${linha('Endereço', [p.endereco, p.cidade].filter(Boolean).join(' — '))}</table>
      <h2>Saúde</h2><table>${p.alergias ? `<tr><th>Alergias</th><td class="alerta">${esc(p.alergias)}</td></tr>` : ''}${linha('Doenças', p.comorbidades)}${linha('Remédios em uso', p.medicamentos_uso)}</table>
      <h2>Histórico</h2>${eventos.map(e => `<div class="ev"><b>${esc(e.titulo)}</b>${e.selo ? ` — ${esc(e.selo.texto)}` : ''}<div class="q">${dataBR(e.quando, true)}${e.detalhe ? ` · ${esc(e.detalhe)}` : ''}</div></div>`).join('') || '<div class="q">Sem registros.</div>'}
    </body></html>`)
    w.document.close(); setTimeout(() => w.print(), 300)
  }

  return (
    <Drawer titulo="Ficha do paciente" onClose={onClose} largura={560}
      rodape={f && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button icon={CalendarPlus} onClick={() => ir(`/agenda?novo=1&paciente_id=${pacienteId}&tipo=${pendentes.length ? 'retorno' : 'consulta'}${pendentes[0] ? `&data=${pendentes[0].data_prevista}` : ''}`)}>Agendar</Button>
          <Button variant="secondary" icon={MessageCircle} onClick={() => ir(`/chat?paciente_id=${pacienteId}${p?.telefone ? `&telefone=${String(p.telefone).replace(/\D/g, '')}` : ''}`)}>Conversa</Button>
          <Button variant="secondary" icon={FileText} onClick={() => ir(`/pacientes/${pacienteId}`)}>Prontuário completo</Button>
          <span style={{ flex: 1 }} />
          <IconButton icon={Printer} variant="outline" onClick={imprimir} title="Imprimir ou salvar a ficha em PDF" aria-label="Imprimir ou salvar em PDF" />
          <IconButton icon={Download} variant="outline" onClick={exportarArquivo} title="Baixar todos os dados do paciente (portabilidade LGPD)" aria-label="Baixar dados do paciente" />
        </div>
      )}>
      {erro ? <EmptyState icon={FileText} titulo="Não foi possível abrir" descricao={erro} />
        : !f || !p ? <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{[0, 1, 2, 3].map(i => <span key={i} className="c360-skel" style={{ height: i ? 18 : 56, borderRadius: 10 }} />)}</div>
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Identificação */}
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <Avatar nome={p.nome} size={52} src={p.foto_url} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-.01em' }}>{p.nome}</div>
                <div style={{ fontSize: 13, color: T.text.secondary, marginTop: 2 }}>
                  {[anos !== null ? `${anos} anos` : null, p.sexo, p.convenio ? `${p.convenio}${p.nr_carteirinha ? ` · ${p.nr_carteirinha}` : ''}` : 'Particular'].filter(Boolean).join(' · ')}
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4, fontSize: 12.5 }}>
                  {p.telefone && <button onClick={() => copiar(String(p.telefone))} style={linkCopia}><Copy size={12} /> {formatarTelefone(p.telefone)}</button>}
                  {p.cpf && <button onClick={() => copiar(String(p.cpf))} style={linkCopia}><Copy size={12} /> CPF {p.cpf}</button>}
                </div>
              </div>
            </div>

            {/* Alertas de saúde */}
            {(p.alergias || p.comorbidades || p.medicamentos_uso) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 12, background: T.bg.page }}>
                {p.alergias && <Linha icon={AlertTriangle} cor={T.status.danger} rotulo="Alergias" texto={p.alergias} forte />}
                {p.comorbidades && <Linha icon={ClipboardList} cor={T.text.tertiary} rotulo="Doenças" texto={p.comorbidades} />}
                {p.medicamentos_uso && <Linha icon={Pill} cor={T.text.tertiary} rotulo="Remédios em uso" texto={p.medicamentos_uso} />}
              </div>
            )}

            {/* Números */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
              <Numero valor={f.resumo.consultas} rotulo="consultas" />
              <Numero valor={f.resumo.faltas} rotulo={f.resumo.faltas === 1 ? 'falta' : 'faltas'} alerta={f.resumo.faltas >= 2} />
              <Numero valor={f.resumo.comparecimento === null ? '—' : `${f.resumo.comparecimento}%`} rotulo="comparecimento" />
            </div>

            {/* O que vem pela frente */}
            {(futuros.length > 0 || pendentes.length > 0) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={secao}>Próximos</div>
                {futuros.slice(0, 3).map(a => (
                  <div key={a.id} style={cartao}>
                    <CalendarCheck size={16} color={T.status.info} />
                    <span style={{ flex: 1, fontSize: 13 }}><b>{dataBR(a.data_hora, true)}</b> · {a.tipo === 'retorno' ? 'Retorno' : 'Consulta'}{a.medico ? ` com ${a.medico}` : ''}</span>
                  </div>
                ))}
                {pendentes.map(r => (
                  <div key={r.id} style={{ ...cartao, background: 'color-mix(in srgb, ' + T.data.orange + ' 10%, #fff)' }}>
                    <CalendarPlus size={16} color={T.data.orange} />
                    <span style={{ flex: 1, fontSize: 13 }}>Retorno <b>a agendar</b> · por volta de {dataBR(r.data_prevista)}{r.motivo ? ` · ${r.motivo}` : ''}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Linha do tempo */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ ...secao, flex: 1 }}>Histórico</span>
                {(['tudo', 'consultas', 'agenda'] as const).map(k => (
                  <button key={k} onClick={() => setFiltro(k)} style={{ height: 28, padding: '0 10px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, background: filtro === k ? T.brand.primaryLight : 'transparent', color: filtro === k ? T.brand.primary : T.text.secondary }}>
                    {k === 'tudo' ? 'Tudo' : k === 'consultas' ? 'Consultas' : 'Agenda e chegadas'}
                  </button>
                ))}
              </div>
              {eventos.length === 0 ? <div style={{ fontSize: 13, color: T.text.tertiary }}>Nada registrado ainda.</div> : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {eventos.map((e, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, paddingBottom: 14, position: 'relative' }}>
                      {i < eventos.length - 1 && <span style={{ position: 'absolute', left: 15, top: 32, bottom: 0, width: 1, background: T.border.default }} />}
                      <span style={{ width: 31, height: 31, borderRadius: 10, flexShrink: 0, display: 'grid', placeItems: 'center', background: `color-mix(in srgb, ${e.cor} 12%, transparent)`, color: e.cor }}><e.icon size={15} /></span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13.5, fontWeight: 650 }}>{e.titulo}</span>
                          {e.selo && <Badge tone={e.selo.tom}>{e.selo.texto}</Badge>}
                        </div>
                        <div style={{ fontSize: 12, color: T.text.tertiary, marginTop: 2 }}>{dataBR(e.quando, true)}</div>
                        {e.detalhe && <div style={{ fontSize: 12.5, color: T.text.secondary, marginTop: 2, lineHeight: 1.45 }}>{e.detalhe}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
    </Drawer>
  )
}

const secao: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, color: T.text.tertiary, textTransform: 'uppercase', letterSpacing: '.06em' }
const cartao: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: `1px solid ${T.border.default}`, background: '#fff' }
const linkCopia: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: T.text.secondary, fontFamily: 'inherit', fontSize: 12.5 }

function Linha({ icon: I, cor, rotulo, texto, forte }: { icon: LucideIcon; cor: string; rotulo: string; texto: string; forte?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <I size={15} color={cor} style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ fontSize: 13, lineHeight: 1.45 }}>
        <span style={{ fontWeight: 700, color: forte ? cor : T.text.secondary }}>{rotulo}: </span>
        <span style={{ color: forte ? cor : T.text.primary, fontWeight: forte ? 600 : 400 }}>{texto}</span>
      </div>
    </div>
  )
}

function Numero({ valor, rotulo, alerta }: { valor: React.ReactNode; rotulo: string; alerta?: boolean }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 12, border: `1px solid ${alerta ? T.status.danger : T.border.default}`, background: '#fff' }}>
      <div style={{ fontSize: 20, fontWeight: 750, color: alerta ? T.status.danger : T.text.primary }}>{valor}</div>
      <div style={{ fontSize: 11.5, color: T.text.secondary }}>{rotulo}</div>
    </div>
  )
}
