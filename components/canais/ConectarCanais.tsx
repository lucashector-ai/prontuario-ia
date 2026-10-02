'use client'
/**
 * Canais de atendimento — a clínica conecta WhatsApp, Instagram e Messenger sozinha,
 * pela janela oficial da Meta (sem copiar tokens).
 *
 *  - WhatsApp: "Cadastro incorporado" (Embedded Signup) → o servidor troca o código pelo
 *    token do negócio, inscreve o app no número e registra na Cloud API.
 *  - Instagram/Messenger: login da Meta → escolha da página → o servidor guarda o token
 *    da página e inscreve a página no webhook.
 *
 * ?demo=1 mostra canais de exemplo e não grava nada.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, CircleAlert, LoaderCircle, Plug, ShieldCheck, Unplug, Clock, Info } from 'lucide-react'
import { tokens as T, tint } from '@/lib/design-tokens'
import { Badge, Button, Card, Checkbox, EmptyState, Icon, Modal, Select } from '@/components/ui'
import { confirmar, notificar } from '@/components/ui/dialogos'
import { CanalIcone } from '@/app/chat/pecas'

type Canal = 'whatsapp' | 'instagram' | 'messenger'
type Conectado = { id: string; canal: Canal; conta_id: string; nome: string | null; foto_url: string | null; status: string; erro: string | null; conectado_em: string; medico_id: string }
type Pagina = { id: string; nome: string; foto: string | null; instagram: { id: string; username: string; foto: string | null } | null }
type Estado = {
  canais: Conectado[]; medicos: { id: string; nome: string }[]; configurado: boolean
  app_id: string | null; config_whatsapp: string | null; config_paginas: string | null; aviso?: string
}

const INFO: Record<Canal, { nome: string; cor: string; descricao: string; requisito: string }> = {
  whatsapp: {
    nome: 'WhatsApp', cor: '#25D366',
    descricao: 'Receba e responda pacientes no Chat, com a Sofia, confirmações e lembretes automáticos.',
    requisito: 'Um número que ainda não esteja no aplicativo WhatsApp do celular (ou que você aceite migrar para a API).',
  },
  instagram: {
    nome: 'Instagram', cor: '#E1306C',
    descricao: 'Mensagens diretas (Direct) do perfil da clínica chegam no Chat.',
    requisito: 'Conta profissional do Instagram vinculada a uma página do Facebook.',
  },
  messenger: {
    nome: 'Messenger', cor: '#0084FF',
    descricao: 'Mensagens da página do Facebook da clínica chegam no Chat.',
    requisito: 'Ser administrador da página do Facebook da clínica.',
  },
}

const ESCOPOS_PAGINAS = 'pages_show_list,pages_messaging,pages_manage_metadata,pages_read_engagement,instagram_basic,instagram_manage_messages,business_management'

declare global { interface Window { FB?: any; fbAsyncInit?: () => void } }

let sdkCarregando: Promise<void> | null = null
function carregarSdkMeta(appId: string): Promise<void> {
  if (window.FB) return Promise.resolve()
  if (sdkCarregando) return sdkCarregando
  sdkCarregando = new Promise((ok, falha) => {
    window.fbAsyncInit = () => {
      window.FB.init({ appId, autoLogAppEvents: true, xfbml: false, version: 'v23.0' })
      ok()
    }
    const s = document.createElement('script')
    s.src = 'https://connect.facebook.net/pt_BR/sdk.js'
    s.async = true; s.defer = true; s.crossOrigin = 'anonymous'
    s.onerror = () => { sdkCarregando = null; falha(new Error('Não foi possível carregar o login da Meta. Desative bloqueadores de anúncio e tente de novo.')) }
    document.body.appendChild(s)
  })
  return sdkCarregando
}

const DEMO: Estado = {
  configurado: true, app_id: 'demo', config_whatsapp: 'demo', config_paginas: null,
  medicos: [{ id: 'm1', nome: 'Dra. Helena Prado' }, { id: 'm2', nome: 'Dr. Rafael Montenegro' }],
  canais: [
    { id: 'c1', canal: 'whatsapp', conta_id: '1', nome: '+55 11 98765-4321', foto_url: null, status: 'ativo', erro: null, conectado_em: new Date(Date.now() - 12 * 864e5).toISOString(), medico_id: 'm1' },
    { id: 'c2', canal: 'instagram', conta_id: '2', nome: '@clinicabemviver', foto_url: null, status: 'ativo', erro: null, conectado_em: new Date(Date.now() - 3 * 864e5).toISOString(), medico_id: 'm1' },
  ],
}

export default function ConectarCanais() {
  const demo = useMemo(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === '1', [])
  const [estado, setEstado] = useState<Estado | null>(null)
  const [erroCarga, setErroCarga] = useState('')
  const [medicoId, setMedicoId] = useState('')
  const [ocupado, setOcupado] = useState<Canal | null>(null)
  const [paginas, setPaginas] = useState<{ token: string; lista: Pagina[]; foco: Canal } | null>(null)

  const carregar = useCallback(async () => {
    if (demo) { setEstado(DEMO); setMedicoId('m1'); return }
    try {
      const r = await fetch('/api/canais')
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Falha ao carregar')
      setEstado(j)
      setMedicoId(m => m || j.medicos?.[0]?.id || '')
    } catch (e: any) { setErroCarga(e.message) }
  }, [demo])
  useEffect(() => { carregar() }, [carregar])

  const conectadosDe = (c: Canal) => (estado?.canais || []).filter(x => x.canal === c)
  const nomeMedico = (id: string) => estado?.medicos.find(m => m.id === id)?.nome

  // ── WhatsApp: cadastro incorporado ──────────────────────────────────────
  async function conectarWhatsApp() {
    if (demo) { notificar('Modo demonstração: abriria a janela oficial da Meta para escolher o número', 'info'); return }
    if (!estado?.app_id || !estado.config_whatsapp) { notificar('Conexão do WhatsApp ainda não liberada para esta conta', 'erro'); return }
    setOcupado('whatsapp')
    try {
      await carregarSdkMeta(estado.app_id)
      let sessao: { phone_number_id?: string; waba_id?: string } | null = null
      let cancelado: string | null = null
      const ouvir = (ev: MessageEvent) => {
        if (!/facebook\.com$/.test(new URL(ev.origin).hostname)) return
        try {
          const d = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data
          if (d?.type !== 'WA_EMBEDDED_SIGNUP') return
          if (String(d.event).startsWith('FINISH')) sessao = d.data
          else if (d.event === 'CANCEL') cancelado = d.data?.current_step || 'cancelado'
          else if (d.event === 'ERROR') cancelado = d.data?.error_message || 'erro'
        } catch { /* outras mensagens */ }
      }
      window.addEventListener('message', ouvir)
      const code: string | null = await new Promise(ok => {
        window.FB.login((r: any) => ok(r?.authResponse?.code || null), {
          config_id: estado.config_whatsapp, response_type: 'code', override_default_response_type: true,
          extras: { setup: {}, featureType: '', sessionInfoVersion: '3' },
        })
      })
      // os dados do número às vezes chegam logo depois do login
      for (let i = 0; i < 20 && code && !sessao && !cancelado; i++) await new Promise(r => setTimeout(r, 150))
      window.removeEventListener('message', ouvir)
      const s = sessao as { phone_number_id?: string; waba_id?: string } | null
      if (!code || !s?.phone_number_id || !s?.waba_id) {
        notificar(cancelado && cancelado !== 'cancelado' ? `A Meta interrompeu a conexão: ${cancelado}` : 'Conexão cancelada antes de terminar', cancelado ? 'erro' : 'info')
        return
      }
      const r = await fetch('/api/canais/meta/whatsapp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, waba_id: s.waba_id, phone_number_id: s.phone_number_id, medico_id: medicoId }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error)
      notificar(`WhatsApp ${j.numero} conectado`)
      carregar()
    } catch (e: any) {
      notificar(e?.message || 'Não foi possível conectar o WhatsApp', 'erro')
    } finally { setOcupado(null) }
  }

  // ── Instagram / Messenger: login → escolher a página ───────────────────
  async function conectarPagina(foco: Canal) {
    if (demo) {
      setPaginas({ token: 'demo', foco, lista: [
        { id: 'p1', nome: 'Clínica Bem Viver', foto: null, instagram: { id: 'i1', username: 'clinicabemviver', foto: null } },
        { id: 'p2', nome: 'Dra. Helena Prado — Cardiologia', foto: null, instagram: null },
      ] })
      return
    }
    if (!estado?.app_id) { notificar('Conexão com a Meta ainda não liberada para esta conta', 'erro'); return }
    setOcupado(foco)
    try {
      await carregarSdkMeta(estado.app_id)
      const token: string | null = await new Promise(ok => {
        window.FB.login((r: any) => ok(r?.authResponse?.accessToken || null),
          estado.config_paginas ? { config_id: estado.config_paginas } : { scope: ESCOPOS_PAGINAS, auth_type: 'rerequest' })
      })
      if (!token) { notificar('Login na Meta cancelado', 'info'); return }
      const r = await fetch('/api/canais/meta/paginas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token_usuario: token }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error)
      if (!j.paginas?.length) { notificar('Nenhuma página do Facebook encontrada nesta conta. Você precisa ser administrador da página.', 'erro'); return }
      setPaginas({ token, lista: j.paginas, foco })
    } catch (e: any) {
      notificar(e?.message || 'Não foi possível entrar na Meta', 'erro')
    } finally { setOcupado(null) }
  }

  async function desconectar(c: Conectado) {
    const ok = await confirmar({
      titulo: `Desconectar ${c.nome || INFO[c.canal].nome}?`,
      mensagem: 'As mensagens deste canal deixam de chegar no Chat e a Sofia para de responder por ele. As conversas antigas continuam salvas.',
      confirmar: 'Desconectar', perigo: true,
    })
    if (!ok) return
    if (demo) { setEstado(e => e && { ...e, canais: e.canais.filter(x => x.id !== c.id) }); notificar('Modo demonstração: nada foi alterado', 'info'); return }
    const r = await fetch('/api/canais?id=' + c.id, { method: 'DELETE' })
    if (!r.ok) { notificar('Não foi possível desconectar', 'erro'); return }
    notificar('Canal desconectado')
    carregar()
  }

  if (erroCarga) return <EmptyState icon={CircleAlert} titulo="Não foi possível carregar os canais" descricao={erroCarga} acao={<Button variant="secondary" onClick={() => { setErroCarga(''); carregar() }}>Tentar de novo</Button>} />
  if (!estado) return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
      {[0, 1, 2].map(i => <div key={i} className="c360-skel" style={{ height: 260, borderRadius: 16 }} />)}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {estado.aviso && <Badge tone="warning" dot style={{ alignSelf: 'flex-start' }}>{estado.aviso}</Badge>}
      {demo && <Badge tone="pending" dot style={{ alignSelf: 'flex-start' }}>Modo demonstração — dados de exemplo</Badge>}

      <Card>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: T.brand.primarySubtle, color: T.brand.primary, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Icon icon={Plug} size={20} />
          </div>
          <div style={{ flex: '1 1 320px', minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 650, color: T.text.primary }}>Conecte seus canais em poucos minutos</div>
            <p style={{ margin: '4px 0 0', fontSize: 13, lineHeight: 1.6, color: T.text.secondary }}>
              Clique em conectar, entre com a sua conta do Facebook e escolha o número ou a página. A janela é oficial da Meta — a Clinical 360 nunca vê sua senha.
            </p>
          </div>
          {estado.medicos.length > 1 && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: T.text.secondary, minWidth: 220 }}>
              As novas conexões atendem
              <Select value={medicoId} onChange={e => setMedicoId(e.target.value)}>
                {estado.medicos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </Select>
            </label>
          )}
        </div>
      </Card>

      {!estado.configurado && (
        <div role="status" style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 12, background: T.status.infoBg, color: T.status.info, fontSize: 13, lineHeight: 1.55 }}>
          <Icon icon={Clock} size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>A conexão automática com a Meta está sendo ativada para a sua conta. Enquanto isso, o botão de conectar fica indisponível.</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 14 }}>
        {(['whatsapp', 'instagram', 'messenger'] as Canal[]).map(canal => {
          const info = INFO[canal]
          const lista = conectadosDe(canal)
          const carregando = ocupado === canal
          const indisponivel = !estado.configurado || (canal === 'whatsapp' && !estado.config_whatsapp)
          return (
            <Card key={canal} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <CanalIcone canal={canal} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 650, color: T.text.primary }}>{info.nome}</div>
                  {lista.length
                    ? <span style={{ fontSize: 12, fontWeight: 600, color: T.status.success }}>{lista.length === 1 ? '1 conta conectada' : `${lista.length} contas conectadas`}</span>
                    : <span style={{ fontSize: 12, color: T.text.tertiary }}>Não conectado</span>}
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: T.text.secondary }}>{info.descricao}</p>

              {lista.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {lista.map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, border: `1px solid ${c.status === 'erro' ? tint(T.status.danger, 0.4) : T.border.default}`, background: c.status === 'erro' ? T.status.dangerBg : T.bg.card }}>
                      <Icon icon={c.status === 'erro' ? CircleAlert : CheckCircle2} size={16} color={c.status === 'erro' ? T.status.danger : T.status.success} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: T.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome || c.conta_id}</div>
                        <div style={{ fontSize: 11.5, color: c.status === 'erro' ? T.status.danger : T.text.tertiary }}>
                          {c.status === 'erro' ? 'Precisa reconectar' : (estado.medicos.length > 1 && nomeMedico(c.medico_id)) || `Desde ${new Date(c.conectado_em).toLocaleDateString('pt-BR')}`}
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" icon={Unplug} onClick={() => desconectar(c)} aria-label={`Desconectar ${c.nome}`}>Desconectar</Button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ display: 'flex', gap: 6, fontSize: 11.5, lineHeight: 1.5, color: T.text.tertiary }}>
                  <Icon icon={Info} size={13} style={{ flexShrink: 0, marginTop: 2 }} />{info.requisito}
                </span>
                <Button
                  variant={lista.length ? 'secondary' : 'primary'}
                  disabled={carregando || indisponivel}
                  onClick={() => canal === 'whatsapp' ? conectarWhatsApp() : conectarPagina(canal)}
                  style={{ width: '100%' }}
                >
                  {carregando
                    ? <><Icon icon={LoaderCircle} size={16} style={{ animation: 'spin 1s linear infinite' }} />Aguardando a Meta…</>
                    : lista.length ? `Conectar outra conta` : `Conectar ${info.nome}`}
                </Button>
              </div>
            </Card>
          )
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: T.text.tertiary }}>
        <Icon icon={ShieldCheck} size={14} />
        Os acessos ficam guardados só no servidor e você pode desconectar quando quiser — também pelo painel da Meta.
      </div>

      {paginas && (
        <EscolherPagina
          paginas={paginas.lista}
          foco={paginas.foco}
          onFechar={() => setPaginas(null)}
          onConfirmar={async (pageId, canais) => {
            if (demo) { setPaginas(null); notificar('Modo demonstração: nada foi conectado', 'info'); return }
            const r = await fetch('/api/canais/meta/conectar', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token_usuario: paginas.token, page_id: pageId, canais, medico_id: medicoId }),
            })
            const j = await r.json()
            if (!r.ok) { notificar(j.error || 'Não foi possível conectar', 'erro'); if (j.conectados?.length) carregar(); return }
            setPaginas(null)
            notificar(j.conectados.length === 2 ? `Messenger e Instagram (@${j.instagram}) conectados` : j.conectados[0] === 'instagram' ? `Instagram @${j.instagram} conectado` : `Página ${j.pagina} conectada ao Messenger`)
            carregar()
          }}
        />
      )}
    </div>
  )
}

function EscolherPagina({ paginas, foco, onFechar, onConfirmar }: {
  paginas: Pagina[]; foco: Canal
  onFechar: () => void
  onConfirmar: (pageId: string, canais: Canal[]) => Promise<void>
}) {
  const inicial = (foco === 'instagram' ? paginas.find(p => p.instagram) : undefined) || paginas[0]
  const [sel, setSel] = useState(inicial?.id || '')
  const pagina = paginas.find(p => p.id === sel)
  const [msg, setMsg] = useState(foco === 'messenger' || !inicial?.instagram)
  const [ig, setIg] = useState(!!inicial?.instagram)
  const [enviando, setEnviando] = useState(false)
  useEffect(() => { if (!pagina?.instagram) setIg(false) }, [pagina])

  const canais: Canal[] = [...(msg ? ['messenger' as Canal] : []), ...(ig && pagina?.instagram ? ['instagram' as Canal] : [])]
  return (
    <Modal titulo="Escolha a página da clínica" onClose={onFechar} largura={520} rodape={
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button variant="secondary" onClick={onFechar}>Cancelar</Button>
        <Button disabled={!sel || !canais.length || enviando} onClick={async () => { setEnviando(true); await onConfirmar(sel, canais); setEnviando(false) }}>
          {enviando ? 'Conectando…' : 'Conectar'}
        </Button>
      </div>
    }>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
        {paginas.map(p => {
          const ativa = p.id === sel
          return (
            <button key={p.id} type="button" onClick={() => setSel(p.id)} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
              border: `1px solid ${ativa ? T.brand.primary : T.border.default}`, background: ativa ? '#FAF9FF' : T.bg.card, font: 'inherit',
            }}>
              {p.foto ? <img src={p.foto} alt="" width={36} height={36} style={{ borderRadius: 10, objectFit: 'cover' }} /> : <CanalIcone canal="messenger" size={36} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text.primary }}>{p.nome}</div>
                <div style={{ fontSize: 12, color: p.instagram ? T.text.secondary : T.text.tertiary }}>
                  {p.instagram ? `Instagram @${p.instagram.username}` : 'Sem Instagram vinculado'}
                </div>
              </div>
              <span aria-hidden style={{ width: 18, height: 18, borderRadius: 99, border: `2px solid ${ativa ? T.brand.primary : T.border.strong}`, display: 'grid', placeItems: 'center' }}>
                {ativa && <span style={{ width: 8, height: 8, borderRadius: 99, background: T.brand.primary }} />}
              </span>
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.border.muted}` }}>
        <span style={{ fontSize: 12, fontWeight: 650, color: T.text.secondary }}>Receber mensagens de</span>
        <Checkbox checked={msg} onChange={setMsg} label="Messenger da página" />
        {pagina?.instagram
          ? <Checkbox checked={ig} onChange={setIg} label={`Instagram @${pagina.instagram.username}`} />
          : <span style={{ fontSize: 12.5, lineHeight: 1.5, color: T.text.tertiary }}>Esta página não tem Instagram profissional vinculado. Vincule no app do Instagram (Configurações → Conta → Compartilhamento com o Facebook) e conecte de novo.</span>}
      </div>
    </Modal>
  )
}
