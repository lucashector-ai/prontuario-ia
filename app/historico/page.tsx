'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Pencil, Trash2, Plus, Download, Sparkles, SearchX, ScrollText, Pill } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { tokens } from '@/lib/design-tokens'
import {
  Avatar, Badge, Button, EmptyState, Icon, IconButton, PageHeader, SearchInput, SegmentedControl, Textarea,
} from '@/components/ui'
import { confirmar } from '@/components/ui/dialogos'

const T = tokens

type FiltroTipo = 'Todos' | 'Presencial' | 'Teleconsulta'
type AbaDetalhe = 'pront' | 'rx' | 'tx' | 'files'

const ehTeleconsulta = (c: any) => !!(c.meet_link || c.sala_id)

/** Rótulo de seção do prontuário (11.5/700 +.05em). */
function RotuloSecao({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: T.text.tertiary }}>
      {children}
    </span>
  )
}

export default function Historico() {
  const router = useRouter()
  const [medico, setMedico] = useState<any>(null)
  const [consultas, setConsultas] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const [selecionada, setSelecionada] = useState<any>(null)
  const [editando, setEditando] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [salvando, setSalvando] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('Todos')
  const [aba, setAba] = useState<AbaDetalhe>('pront')
  const [toast, setToast] = useState<{tipo: string, texto: string} | null>(null)
  const [mapaMedicos, setMapaMedicos] = useState<Record<string, { nome: string, cor: string }>>({})

  useEffect(() => {
    const ca = localStorage.getItem('clinica_admin')
    const m = ca || localStorage.getItem('medico')
    if (!m) { router.push('/login'); return }
    const med = JSON.parse(m)
    setMedico(med)
    carregar(med.id)
  }, [router])

  const carregar = async (id: string) => {
    // Clinica admin: busca de todos os medicos da clinica
    const caStr = localStorage.getItem('clinica_admin')
    let medicoIds = [id]
    if (caStr) {
      const admin = JSON.parse(caStr)
      if (admin.clinica_id) {
        const { data: meds } = await supabase.from('medicos').select('id').eq('clinica_id', admin.clinica_id).eq('cargo', 'medico').eq('ativo', true)
        if (meds && meds.length > 0) medicoIds = meds.map((m: any) => m.id)
      }
    }

    const { data } = await supabase
      .from('consultas')
      .select('*, pacientes(id, nome)')
      .in('medico_id', medicoIds)
      .order('criado_em', { ascending: false })
    setConsultas(data || [])

    // Carrega mapa de medicos da clinica pra exibir nome no card
    if (caStr) {
      const admin = JSON.parse(caStr)
      if (admin.clinica_id) {
        const { data: meds } = await supabase.from('medicos').select('id, nome, cor').eq('clinica_id', admin.clinica_id).eq('cargo', 'medico')
        const mapa: Record<string, { nome: string, cor: string }> = {}
        ;(meds || []).forEach((m: any) => { mapa[m.id] = { nome: m.nome, cor: m.cor || tokens.brand.primary } })
        setMapaMedicos(mapa)
      }
    } else {
      // Medico logado: ele mesmo
      const m = localStorage.getItem('medico')
      if (m) {
        const med = JSON.parse(m)
        setMapaMedicos({ [med.id]: { nome: med.nome, cor: tokens.brand.primary } })
      }
    }

    setCarregando(false)
  }

  const showToast = (tipo: string, texto: string) => {
    setToast({ tipo, texto })
    setTimeout(() => setToast(null), 3000)
  }

  const selecionar = (c: any) => {
    setSelecionada(c)
    setEditando(false)
    setAba('pront')
    setEditForm({
      subjetivo: c.subjetivo || '',
      objetivo: c.objetivo || '',
      avaliacao: c.avaliacao || '',
      plano: c.plano || '',
    })
  }

  const salvar = async () => {
    if (!selecionada) return
    setSalvando(true)
    const { data, error } = await supabase
      .from('consultas')
      .update(editForm)
      .eq('id', selecionada.id)
      .select()
      .single()
    if (!error && data) {
      // mantém o join de pacientes (o update não o retorna)
      const atualizada = { ...selecionada, ...data }
      setSelecionada(atualizada)
      setConsultas(prev => prev.map(c => c.id === data.id ? { ...c, ...data } : c))
      setEditando(false)
      showToast('ok', 'Alterações salvas')
    } else {
      showToast('erro', 'Erro ao salvar')
    }
    setSalvando(false)
  }

  const deletar = async (id: string) => {
    if (!(await confirmar({ titulo: 'Excluir esta consulta?', mensagem: 'O prontuário, a prescrição e os anexos dela serão apagados. Essa ação não pode ser desfeita.', confirmar: 'Excluir', perigo: true }))) return
    await supabase.from('consultas').delete().eq('id', id)
    setConsultas(prev => prev.filter(c => c.id !== id))
    if (selecionada && selecionada.id === id) setSelecionada(null)
    showToast('ok', 'Consulta removida')
  }

  const fmtCurto = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })

  const fmtLongo = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  const filtradas = consultas.filter(c => {
    if (filtroTipo === 'Teleconsulta' && !ehTeleconsulta(c)) return false
    if (filtroTipo === 'Presencial' && ehTeleconsulta(c)) return false
    if (!busca.trim()) return true
    const b = busca.toLowerCase()
    const campos = [c.subjetivo, c.avaliacao, c.plano, c.pacientes?.nome].filter(Boolean).join(' ').toLowerCase()
    if (campos.includes(b)) return true
    if (c.cids) {
      return c.cids.some((cid: any) =>
        (cid.codigo || '').toLowerCase().includes(b) ||
        (cid.descricao || '').toLowerCase().includes(b)
      )
    }
    return false
  })

  const secoes = [
    { key: 'subjetivo', titulo: 'Subjetivo', letra: 'S' },
    { key: 'objetivo', titulo: 'Objetivo', letra: 'O' },
    { key: 'avaliacao', titulo: 'Avaliação', letra: 'A' },
    { key: 'plano', titulo: 'Plano', letra: 'P' },
  ]

  const abrirPdf = (tipo: string) => {
    if (!selecionada || !medico) return
    const url = '/api/pdf-' + tipo + '?consulta_id=' + selecionada.id + '&medico_id=' + medico.id
    window.open(url, '_blank')
  }

  // Abas: só as que têm dado real na consulta
  const temReceita = !!(selecionada && typeof selecionada.receita === 'string' && selecionada.receita.trim())
  const temTranscricao = !!(selecionada && typeof selecionada.transcricao === 'string' && selecionada.transcricao.trim())
  const abas: { value: AbaDetalhe; label: string }[] = [
    { value: 'pront', label: 'Prontuário' },
    ...(temReceita ? [{ value: 'rx' as const, label: 'Prescrição' }] : []),
    ...(temTranscricao ? [{ value: 'tx' as const, label: 'Transcrição' }] : []),
    { value: 'files', label: 'Anexos' },
  ]
  const abaAtiva: AbaDetalhe = abas.some(a => a.value === aba) ? aba : 'pront'

  const contagem = `${filtradas.length}${(busca || filtroTipo !== 'Todos') ? ' de ' + consultas.length : ''} consulta${filtradas.length !== 1 ? 's' : ''}`

  return (
    <div style={{ padding: 20 }}>
      <PageHeader
        titulo="Histórico de consultas"
        descricao="Prontuários gerados e registros anteriores"
      />

      {toast && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 300,
          padding: '11px 16px', borderRadius: 12,
          background: toast.tipo === 'ok' ? T.status.successBg : T.status.dangerBg,
          color: toast.tipo === 'ok' ? T.status.success : T.status.danger,
          fontSize: 13, fontWeight: 600, boxShadow: T.shadow.lg,
        }}>
          {toast.texto}
        </div>
      )}

      <div className="hist-grid">
        {/* ── Lista ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          <SearchInput value={busca} onChange={setBusca} placeholder="CID, sintoma, conduta ou paciente" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <SegmentedControl<FiltroTipo> options={['Todos', 'Presencial', 'Teleconsulta']} value={filtroTipo} onChange={setFiltroTipo} />
            {!carregando && <span style={{ fontSize: 12, color: T.text.quaternary }}>{contagem}</span>}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 'calc(100vh - 250px)', minHeight: 200, overflow: 'auto', scrollbarWidth: 'thin' }}>
            {carregando ? (
              [0, 1, 2, 3, 4].map(i => (
                <div key={i} style={{ padding: '12px 14px', borderRadius: 14, border: `1px solid ${T.border.default}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="c360-skel" style={{ height: 14, width: '60%', borderRadius: 6 }} />
                  <div className="c360-skel" style={{ height: 11, width: '40%', borderRadius: 6 }} />
                  <div className="c360-skel" style={{ height: 11, width: '85%', borderRadius: 6 }} />
                </div>
              ))
            ) : filtradas.length === 0 ? (
              <EmptyState
                icon={SearchX}
                titulo={consultas.length === 0 ? 'Nenhuma consulta registrada' : 'Nada encontrado'}
                descricao={consultas.length === 0 ? 'As consultas gravadas aparecem aqui.' : 'Busque por outro termo ou troque o filtro.'}
              />
            ) : (
              filtradas.map((c: any) => (
                <ItemConsulta
                  key={c.id}
                  c={c}
                  ativa={!!selecionada && selecionada.id === c.id}
                  data={fmtCurto(c.criado_em)}
                  medico={mapaMedicos[c.medico_id]}
                  onClick={() => selecionar(c)}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Detalhe ───────────────────────────────────────── */}
        <div style={{ minWidth: 0 }}>
          {selecionada ? (
            <div style={{ border: `1px solid ${T.border.default}`, borderRadius: 16, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '18px 20px', borderBottom: `1px solid ${T.border.muted}`, flexWrap: 'wrap' }}>
                <Avatar nome={selecionada.pacientes?.nome || 'Paciente'} size={46} />
                <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-.01em', color: T.text.primary }}>
                    {selecionada.pacientes?.nome || 'Consulta avulsa'}
                  </span>
                  <span style={{ fontSize: 12.5, color: T.text.quaternary }}>
                    <span style={{ textTransform: 'capitalize' }}>{fmtLongo(selecionada.criado_em)}</span>
                    {' · '}{ehTeleconsulta(selecionada) ? 'Teleconsulta' : 'Consulta'}
                    {mapaMedicos[selecionada.medico_id]?.nome ? ' · ' + mapaMedicos[selecionada.medico_id].nome : ''}
                  </span>
                  {temTranscricao && (
                    <Badge tone="accent" icon={Sparkles} style={{ alignSelf: 'flex-start', marginTop: 4 }}>
                      Gerado a partir da transcrição
                    </Badge>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {editando ? (
                    <>
                      <Button variant="secondary" onClick={() => setEditando(false)} disabled={salvando}>Cancelar</Button>
                      <Button onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar alterações'}</Button>
                    </>
                  ) : (
                    <>
                      <IconButton icon={Pencil} variant="outline" title="Editar" aria-label="Editar" onClick={() => { setAba('pront'); setEditando(true) }} />
                      <IconButton icon={Trash2} variant="outline" tone="danger" title="Deletar consulta" aria-label="Deletar consulta" onClick={() => deletar(selecionada.id)} />
                      <Button icon={Download} onClick={() => abrirPdf('prontuario')}>PDF</Button>
                    </>
                  )}
                </div>
              </div>

              {!editando && (
                <div style={{ padding: '14px 20px 0' }}>
                  <SegmentedControl<AbaDetalhe> options={abas} value={abaAtiva} onChange={setAba} />
                </div>
              )}

              {abaAtiva === 'pront' && (
                <div style={{ padding: '18px 20px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                  {secoes.map(s => (
                    <div key={s.key} style={{ display: 'flex', gap: 14 }}>
                      <span style={{
                        width: 30, height: 30, borderRadius: 10, background: T.brand.primarySubtle, color: T.brand.primary,
                        display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0,
                      }}>{s.letra}</span>
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <RotuloSecao>{s.titulo}</RotuloSecao>
                        {editando ? (
                          <Textarea
                            value={editForm[s.key] || ''}
                            onChange={e => setEditForm((f: any) => ({ ...f, [s.key]: e.target.value }))}
                            style={{ minHeight: 100, fontSize: 13.5, lineHeight: 1.6 }}
                          />
                        ) : (
                          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: T.text.strong, whiteSpace: 'pre-wrap' }}>
                            {selecionada[s.key] || '—'}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}

                  {selecionada.cids && selecionada.cids.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <RotuloSecao>CID-10 sugeridos</RotuloSecao>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {selecionada.cids.map((cid: any, i: number) => (
                          <span key={i} title={cid.justificativa || undefined} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 10,
                            border: `1px solid ${T.border.default}`, fontSize: 13, color: T.text.primary,
                          }}>
                            <span className="mono" style={{ fontSize: 11.5, color: T.brand.primary, fontWeight: 500 }}>{cid.codigo}</span>
                            {cid.descricao}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <ListaHipoteses hipoteses={selecionada.hipoteses} />
                </div>
              )}

              {abaAtiva === 'rx' && temReceita && (
                <div style={{ padding: '18px 20px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', borderRadius: 12, background: T.bg.page }}>
                    <span style={{
                      width: 34, height: 34, borderRadius: 10, background: '#fff', color: T.brand.primary,
                      display: 'grid', placeItems: 'center', flexShrink: 0, border: `1px solid ${T.border.default}`,
                    }}><Icon icon={Pill} size={16} /></span>
                    <p style={{ flex: 1, minWidth: 0, margin: 0, fontSize: 13.5, lineHeight: 1.6, color: T.text.strong, whiteSpace: 'pre-wrap' }}>
                      {selecionada.receita}
                    </p>
                  </div>
                </div>
              )}

              {abaAtiva === 'tx' && temTranscricao && (
                <div style={{ padding: '18px 20px 22px' }}>
                  <p style={{
                    margin: 0, padding: '14px 16px', borderRadius: 12, background: T.bg.cardSubtle, border: `1px solid ${T.border.muted}`,
                    fontSize: 13.5, lineHeight: 1.7, color: T.text.strong, whiteSpace: 'pre-wrap', maxHeight: 520, overflow: 'auto',
                  }}>{selecionada.transcricao}</p>
                </div>
              )}

              {abaAtiva === 'files' && (
                <div style={{ padding: '18px 20px 22px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <ItemAnexo icon={FileText} nome="Prontuário da consulta.pdf" meta="PDF · gerado automaticamente" onBaixar={() => abrirPdf('prontuario')} />
                  <ItemAnexo icon={ScrollText} nome="Receita.pdf" meta="PDF · receita da consulta" onBaixar={() => abrirPdf('receita')} />
                </div>
              )}
            </div>
          ) : (
            <div style={{
              border: `1px solid ${T.border.default}`, borderRadius: 16, minHeight: 400,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <EmptyState
                icon={FileText}
                titulo={consultas.length === 0 ? 'Nenhuma consulta ainda' : 'Selecione uma consulta'}
                descricao={consultas.length === 0
                  ? 'Comece gravando sua primeira consulta — o prontuário é gerado automaticamente.'
                  : 'Clique em qualquer consulta na lista para ver os detalhes.'}
                acao={consultas.length === 0 ? <Button icon={Plus} onClick={() => router.push('/nova-consulta')}>Nova consulta</Button> : undefined}
              />
            </div>
          )}
        </div>
      </div>

      <style>{`
        .hist-grid { display: grid; grid-template-columns: 340px minmax(0, 1fr); gap: 20px; align-items: start; }
        @media (max-width: 1000px) { .hist-grid { grid-template-columns: minmax(0, 1fr); } }
      `}</style>
    </div>
  )
}

// ── Item da lista ────────────────────────────────────────────────────────────

function ItemConsulta({ c, ativa, data, medico, onClick }: {
  c: any
  ativa: boolean
  data: string
  medico?: { nome: string; cor: string }
  onClick: () => void
}) {
  const [h, setH] = useState(false)
  const tele = ehTeleconsulta(c)
  const nomePaciente = c.pacientes?.nome || 'Consulta avulsa'
  const primNomeMed = (medico?.nome || '').split(' ')[0] || ''
  const cid = c.cids && c.cids.length > 0 ? c.cids[0]?.codigo : null
  const resumo = (c.subjetivo || 'Consulta sem detalhes')
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        all: 'unset', cursor: 'pointer', boxSizing: 'border-box', width: '100%',
        display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 14px', borderRadius: 14,
        border: `1px solid ${ativa ? T.brand.primary : h ? T.brand.primaryAccentSoft : T.border.default}`,
        background: ativa ? T.brand.primarySoftBg : '#fff', transition: 'border-color .15s, background .15s',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700, color: T.text.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nomePaciente}</span>
        <span style={{ fontSize: 11.5, color: T.text.quaternary, whiteSpace: 'nowrap' }}>{data}</span>
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.text.quaternary }}>
        {primNomeMed && <span style={{ width: 7, height: 7, borderRadius: '50%', background: medico?.cor || T.brand.primary, flexShrink: 0 }} />}
        {tele ? 'Teleconsulta' : 'Consulta'}{primNomeMed ? ' · Dr(a). ' + primNomeMed : ''}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        {cid && (
          <span className="mono" style={{ fontSize: 11, fontWeight: 500, padding: '2px 6px', borderRadius: 6, background: T.brand.primarySubtle, color: T.brand.primary, flexShrink: 0 }}>{cid}</span>
        )}
        <span style={{ fontSize: 12, color: T.text.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{resumo}</span>
      </span>
    </button>
  )
}

const PROB: Record<string, { tone: 'success' | 'pending' | 'neutral'; label: string }> = {
  alta: { tone: 'success', label: 'Alta' },
  media: { tone: 'pending', label: 'Média' },
  baixa: { tone: 'neutral', label: 'Baixa' },
}

/** Hipóteses diagnósticas da consulta (mesmos dados do HipotesesCard, no visual novo). */
function ListaHipoteses({ hipoteses }: { hipoteses: any }) {
  const lista: { nome: string; probabilidade?: string; justificativa?: string }[] = Array.isArray(hipoteses) ? hipoteses : []
  if (lista.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <RotuloSecao>Hipóteses diagnósticas</RotuloSecao>
      <div style={{ display: 'flex', flexDirection: 'column', border: `1px solid ${T.border.default}`, borderRadius: 12 }}>
        {lista.map((h, i) => {
          const p = PROB[(h.probabilidade || '').toLowerCase()]
          return (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 12px', borderTop: i ? `1px solid ${T.border.muted}` : 'none' }}>
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: T.brand.primaryLight, color: T.brand.primary, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: T.text.primary }}>{h.nome}</span>
                  {h.probabilidade && <Badge tone={p?.tone || 'neutral'}>{p?.label || h.probabilidade}</Badge>}
                </span>
                {h.justificativa && <span style={{ fontSize: 12.5, color: T.text.secondary, lineHeight: 1.5 }}>{h.justificativa}</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ItemAnexo({ icon, nome, meta, onBaixar }: { icon: any; nome: string; meta: string; onBaixar: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, border: `1px solid ${T.border.default}` }}>
      <span style={{ width: 34, height: 34, borderRadius: 10, background: T.brand.primarySubtle, color: T.brand.primary, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <Icon icon={icon} size={16} />
      </span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: T.text.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nome}</span>
        <span style={{ fontSize: 11.5, color: T.text.quaternary }}>{meta}</span>
      </span>
      <IconButton icon={Download} size={32} title="Baixar" aria-label="Baixar" onClick={onBaixar} />
    </div>
  )
}
