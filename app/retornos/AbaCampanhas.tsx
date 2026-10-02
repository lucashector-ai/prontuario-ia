'use client'
import { useCallback, useEffect, useState } from 'react'
import { Megaphone, Send, CircleCheck, CircleX, MessageCircleReply, Users, TriangleAlert, Play } from 'lucide-react'
import { tokens } from '@/lib/design-tokens'
import { Badge, Button, Drawer, EmptyState, ProgressBar, type BadgeTone } from '@/components/ui'
import { notificar } from '@/components/ui/dialogos'
import { fmtDataHora, telefoneBonito } from '@/components/retornos/datas'
import type { MedicoCtx } from './page'
import { campanhasDemo, type Campanha } from './tipos'

const T = tokens
const STATUS: Record<Campanha['status'], { label: string; tone: BadgeTone }> = {
  rascunho: { label: 'Rascunho', tone: 'neutral' },
  enviando: { label: 'Enviando', tone: 'accent' },
  concluida: { label: 'Concluída', tone: 'success' },
}
const ENVIO: Record<string, { label: string; tone: BadgeTone }> = {
  pendente: { label: 'Na fila', tone: 'neutral' },
  processando: { label: 'Enviando', tone: 'accent' },
  enviado: { label: 'Enviada', tone: 'info' },
  falhou: { label: 'Falhou', tone: 'danger' },
  respondeu: { label: 'Respondeu', tone: 'success' },
}

export default function AbaCampanhas({ medico, demo, irParaReativacao }: { medico: MedicoCtx; demo: boolean; irParaReativacao: () => void }) {
  const [lista, setLista] = useState<Campanha[]>([])
  const [carregando, setCarregando] = useState(true)
  const [aviso, setAviso] = useState<string | null>(null)
  const [aberta, setAberta] = useState<Campanha | null>(null)
  const [continuando, setContinuando] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    if (demo) { setLista(campanhasDemo()); setCarregando(false); return }
    try {
      const r = await fetch(`/api/reativacao?medico_id=${medico.id}&campanhas=1`)
      const j = await r.json()
      if (!r.ok) { setAviso(j.error || 'Erro ao carregar'); setLista([]) } else { setAviso(null); setLista(j.campanhas || []) }
    } catch { setAviso('Sem conexão. Tente novamente.') }
    setCarregando(false)
  }, [demo, medico.id])
  useEffect(() => { carregar() }, [carregar])

  const continuar = async (c: Campanha) => {
    setContinuando(c.id)
    try {
      for (let i = 0; i < 200; i++) {
        const r = await fetch('/api/reativacao', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'continuar', campanha_id: c.id }) })
        const j = await r.json()
        if (!r.ok) { notificar(j.error || 'Não foi possível continuar', 'erro'); break }
        setLista(l => l.map(x => x.id === c.id ? { ...x, ...j.campanha, respostas: x.respostas, pendentes: j.restantes } : x))
        if (j.foraHorario) { notificar('Fora do horário comercial — o envio continua amanhã às 10h', 'info'); break }
        if (j.concluida) { notificar('Campanha concluída'); break }
      }
    } finally { setContinuando(null) }
  }

  const tot = lista.reduce((a, c) => ({ env: a.env + c.enviados, resp: a.resp + (c.respostas || 0) }), { env: 0, resp: 0 })

  if (carregando) {
    return <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{[0, 1, 2].map(i => <div key={i} className="c360-skel" style={{ height: 132, borderRadius: 16 }} />)}</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
      {aviso && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 12, background: T.status.warningBg, color: T.status.warning, fontSize: 13 }}>
          <TriangleAlert size={16} strokeWidth={1.6} style={{ flexShrink: 0 }} />{aviso}
        </div>
      )}

      {lista.length === 0 ? (
        <div style={{ border: `1px solid ${T.border.default}`, borderRadius: 16 }}>
          <EmptyState icon={Megaphone} titulo="Nenhuma campanha ainda"
            descricao="Encontre pacientes que não aparecem há meses e convide-os de volta com uma mensagem no WhatsApp. As respostas chegam no Chat."
            acao={<Button icon={Megaphone} onClick={irParaReativacao}>Encontrar pacientes inativos</Button>} />
        </div>
      ) : (
        <>
          <div style={{ fontSize: 13, color: T.text.quaternary }}>
            {lista.length} campanha{lista.length === 1 ? '' : 's'} · {tot.env} mensagens entregues · <b style={{ color: T.status.success }}>{tot.resp} respostas</b>
            {tot.env ? ` (${Math.round((tot.resp / tot.env) * 100)}%)` : ''}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: 12 }}>
            {lista.map(c => {
              const feitos = c.enviados + c.falhas
              const taxa = c.enviados ? Math.round(((c.respostas || 0) / c.enviados) * 100) : 0
              return (
                <div key={c.id} role="button" tabIndex={0} onClick={() => setAberta(c)} onKeyDown={e => e.key === 'Enter' && setAberta(c)} className="ret-camp-card"
                  style={{ border: `1px solid ${T.border.default}`, borderRadius: 16, padding: 16, background: '#fff', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0, transition: 'all .25s' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: T.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</div>
                      <div style={{ fontSize: 12.5, color: T.text.quaternary }}>{fmtDataHora(c.criado_em)}{c.filtro?.meses ? ` · inativos há ${c.filtro.meses} meses` : ''}</div>
                    </div>
                    <Badge tone={STATUS[c.status].tone} dot>{STATUS[c.status].label}</Badge>
                  </div>
                  <div style={{ fontSize: 12.5, color: T.text.muted, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.mensagem}</div>
                  {c.status === 'enviando' && <ProgressBar valor={c.total_destinatarios ? (feitos / c.total_destinatarios) * 100 : 0} />}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
                    <Numero icon={Users} label="Destinatários" valor={c.total_destinatarios} />
                    <Numero icon={Send} label="Enviadas" valor={c.enviados} />
                    <Numero icon={CircleX} label="Falhas" valor={c.falhas} cor={c.falhas ? T.status.danger : undefined} />
                    <Numero icon={MessageCircleReply} label={`Respostas${c.enviados ? ` · ${taxa}%` : ''}`} valor={c.respostas || 0} cor={(c.respostas || 0) > 0 ? T.status.success : undefined} />
                  </div>
                  {c.status === 'enviando' && !demo && (
                    <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ flex: 1, fontSize: 12, color: T.text.quaternary }}>{c.pendentes ?? c.total_destinatarios - feitos} na fila · retoma às 10h automaticamente</span>
                      <Button size="sm" variant="secondary" icon={Play} disabled={continuando === c.id} onClick={() => continuar(c)}>{continuando === c.id ? 'Enviando…' : 'Continuar agora'}</Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      <style dangerouslySetInnerHTML={{ __html: `.ret-camp-card:hover { border-color: transparent !important; box-shadow: ${T.shadow.cardHover}; transform: translateY(-2px); }` }} />

      {aberta && <DetalheCampanha c={aberta} medico={medico} demo={demo} onFechar={() => setAberta(null)} />}
    </div>
  )
}

function Numero({ icon: I, label, valor, cor }: { icon: any; label: string; valor: number; cor?: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: cor || T.text.primary, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em' }}>{valor}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: T.text.quaternary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        <I size={12} strokeWidth={1.6} style={{ flexShrink: 0 }} />{label}
      </div>
    </div>
  )
}

function DetalheCampanha({ c, medico, demo, onFechar }: { c: Campanha; medico: MedicoCtx; demo: boolean; onFechar: () => void }) {
  const [envios, setEnvios] = useState<any[] | null>(null)
  useEffect(() => {
    if (demo) {
      const nomes = ['Adriana Lopes Martins', 'Bruno Carvalho', 'Cecília Duarte', 'Elaine Souza Campos', 'Fábio Guimarães', 'Gabriela Matos', 'Heitor Vasconcelos', 'Isabela Cunha']
      setEnvios(nomes.map((n, i) => ({
        id: String(i), paciente_nome: n, telefone: '551198' + String(1000000 + i * 1234567).slice(0, 7),
        status: i === 3 ? 'falhou' : i % 3 === 0 ? 'respondeu' : 'enviado', erro: i === 3 ? 'Re-engagement message: fora da janela de 24h' : null,
        enviado_em: c.criado_em,
      })))
      return
    }
    fetch(`/api/reativacao?medico_id=${medico.id}&campanha_id=${c.id}`).then(r => r.json()).then(j => setEnvios(j.envios || [])).catch(() => setEnvios([]))
  }, [c.id, c.criado_em, demo, medico.id])

  const ordem: Record<string, number> = { respondeu: 0, falhou: 1, enviado: 2, processando: 3, pendente: 4 }
  return (
    <Drawer titulo={c.nome} onClose={onFechar} largura={480}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.text.secondary, marginBottom: 6 }}>Mensagem</div>
          <div style={{ fontSize: 13, color: T.text.muted, lineHeight: 1.5, whiteSpace: 'pre-wrap', padding: 12, borderRadius: 12, background: T.bg.cardSubtle, border: `1px solid ${T.border.default}` }}>{c.mensagem}</div>
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: T.status.success }}><CircleCheck size={15} strokeWidth={1.6} />{c.enviados} enviadas</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: c.falhas ? T.status.danger : T.text.quaternary }}><CircleX size={15} strokeWidth={1.6} />{c.falhas} falhas</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: T.brand.primary }}><MessageCircleReply size={15} strokeWidth={1.6} />{c.respostas || 0} respostas</span>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.text.secondary, marginBottom: 6 }}>Destinatários</div>
          {envios === null ? (
            [0, 1, 2, 3].map(i => <div key={i} className="c360-skel" style={{ height: 44, borderRadius: 10, marginBottom: 6 }} />)
          ) : envios.length === 0 ? (
            <div style={{ fontSize: 13, color: T.text.tertiary, padding: '12px 0' }}>Nenhum destinatário registrado.</div>
          ) : (
            <div style={{ border: `1px solid ${T.border.default}`, borderRadius: 12, overflow: 'hidden' }}>
              {[...envios].sort((a, b) => (ordem[a.status] ?? 9) - (ordem[b.status] ?? 9)).map((e, i) => (
                <div key={e.id} style={{ padding: '9px 12px', borderTop: i ? `1px solid ${T.border.muted}` : 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.paciente_nome || 'Paciente'}</div>
                    <div className="mono" style={{ fontSize: 11.5, color: T.text.quaternary }}>{telefoneBonito(e.telefone)}</div>
                    {e.erro && <div style={{ fontSize: 11.5, color: T.status.danger, marginTop: 2 }}>{e.erro}</div>}
                  </div>
                  <Badge tone={(ENVIO[e.status] || ENVIO.pendente).tone}>{(ENVIO[e.status] || ENVIO.pendente).label}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Drawer>
  )
}
