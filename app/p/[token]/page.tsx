'use client'
/**
 * Portal do paciente: link pessoal enviado pela clínica (sem login, sem instalar nada).
 * Próxima consulta (confirmar, pedir para remarcar, "Cheguei" ou entrar na teleconsulta),
 * formulários da pré-consulta e retorno previsto. Celular primeiro: letras e botões grandes.
 */
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  CalendarCheck, CalendarClock, CheckCircle2, ClipboardList, MapPin, MessageCircle, Phone, Stethoscope, Video, Hand, CircleAlert, LinkIcon,
  FileText, Upload, Camera, Paperclip, Receipt,
} from 'lucide-react'
import { tokens as T } from '@/lib/design-tokens'
import { Button, Chip, Textarea, Icon } from '@/components/ui'
import { CascaPublica, cartaoPublico, Spinner } from '@/components/publico/CascaPublica'
import { supabase } from '@/lib/supabase'

type Portal = {
  clinica: { nome: string; logo_url: string | null; telefone: string | null; endereco: string | null }
  paciente: { primeiro_nome: string }
  proxima: null | {
    id: string; data_hora: string; duracao: number; tipo: string | null; confirmada: boolean; remarcar_pedido: boolean
    medico: string | null; especialidade: string | null; teleconsulta: string | null; pode_checkin: boolean; checkin: { senha: string } | null
  }
  formularios: { nome: string; url: string }[]
  retorno: { data_prevista: string; motivo: string | null } | null
  documentos: { id: string; tipo: string; titulo: string; criado_em: string }[]
  anexos: { id: string; nome_arquivo: string; criado_em: string }[]
  orcamentos: { id: string; numero: number; status: string; validade: string; total: number; desconto: number; condicoes: string[]; condicao_escolhida: string | null; observacoes: string | null; respondido_em: string | null; aceito_por: string | null; itens: { descricao: string; quantidade: number; valor_unitario: number }[] }[]
}

const TZ = 'America/Sao_Paulo'
const diaSemana = (d: Date) => d.toLocaleDateString('pt-BR', { weekday: 'long', timeZone: TZ })
const dataLonga = (d: Date) => d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', timeZone: TZ })
const hora = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
const mesAno = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
const ehHoje = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: TZ }) === new Date().toLocaleDateString('en-CA', { timeZone: TZ })
const soDigitos = (s: string | null) => String(s || '').replace(/\D/g, '')

const cartao: React.CSSProperties = { ...cartaoPublico, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }
const tituloCartao: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: T.text.tertiary }
const botaoGrande: React.CSSProperties = { height: 52, fontSize: 16, borderRadius: 14 }

const PERIODOS = ['Manhã', 'Tarde', 'Noite']
const QUANDO = ['Esta semana', 'Próxima semana', 'Daqui a 15 dias']

export default function PortalPaciente() {
  const { token } = useParams() as { token: string }
  const [dados, setDados] = useState<Portal | null>(null)
  const [estado, setEstado] = useState<'carregando' | 'ok' | 'invalido' | 'erro'>('carregando')
  const [enviando, setEnviando] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [remarcar, setRemarcar] = useState(false)
  const [periodo, setPeriodo] = useState<string | null>(null)
  const [quando, setQuando] = useState<string | null>(null)
  const [obs, setObs] = useState('')
  const [checkin, setCheckin] = useState<{ senha: string; na_frente?: number } | null>(null)
  const [enviandoArq, setEnviandoArq] = useState<string | null>(null)
  const [avisoArq, setAvisoArq] = useState<string | null>(null)

  async function post(corpo: any) {
    const r = await fetch(`/api/portal/${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
    const j = r.headers.get('content-type')?.includes('json') ? await r.json().catch(() => ({})) : null
    if (!r.ok) throw new Error(j?.erro || 'Não deu certo agora. Tente de novo.')
    return { r, j }
  }

  /** Envia direto do celular para o armazenamento da clínica (URL assinada), um arquivo por vez. */
  async function enviarArquivos(lista: FileList | null) {
    if (!lista?.length) return
    setAvisoArq(null)
    for (const f of Array.from(lista)) {
      setEnviandoArq(f.name)
      try {
        const { j } = await post({ acao: 'upload', nome: f.name, tipo: f.type || 'application/octet-stream', tamanho: f.size })
        const { error } = await supabase.storage.from('paciente-anexos').uploadToSignedUrl(j.caminho, j.token, f, { contentType: f.type })
        if (error) throw new Error('O envio falhou. Confira sua internet e tente de novo.')
        await post({ acao: 'upload_ok', anexo_id: j.id })
      } catch (e: any) { setAvisoArq(`${f.name}: ${e.message}`); break }
    }
    setEnviandoArq(null)
    carregar()
  }

  async function abrirDocumento(id: string) {
    const janela = window.open('', '_blank')
    try {
      const { r } = await post({ acao: 'documento', documento_id: id })
      const html = await r.text()
      if (janela) { janela.document.write(html); janela.document.close() }
    } catch (e: any) { janela?.close(); setAvisoArq(e.message) }
  }

  const carregar = useCallback(async () => {
    try {
      const r = await fetch(`/api/portal/${token}`, { cache: 'no-store' })
      if (r.status === 404) { setEstado('invalido'); return }
      if (!r.ok) throw new Error()
      const j: Portal = await r.json()
      setDados(j)
      if (j.proxima?.checkin) setCheckin(j.proxima.checkin)
      if (j.orcamentos?.some(o => o.status === 'enviado')) fetch(`/api/portal/${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'orcamentos_vistos' }) }).catch(() => {})
      setEstado('ok')
    } catch { setEstado('erro') }
  }, [token])
  useEffect(() => { carregar() }, [carregar])

  async function acao(nome: 'confirmar' | 'remarcar' | 'checkin', extra: Record<string, string> = {}) {
    if (!dados?.proxima) return
    setEnviando(nome); setAviso(null)
    try {
      const r = await fetch(`/api/portal/${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: nome, agendamento_id: dados.proxima.id, ...extra }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setAviso(j.erro || 'Não deu certo agora. Tente de novo.'); return }
      if (nome === 'checkin') setCheckin({ senha: j.senha, na_frente: j.na_frente })
      if (nome === 'remarcar') setRemarcar(false)
      await carregar()
    } catch { setAviso('Sem conexão. Confira sua internet e tente de novo.') }
    finally { setEnviando(null) }
  }

  if (estado === 'carregando') {
    return <CascaPublica largura={520}><div style={{ display: 'grid', placeItems: 'center', padding: 60 }}><Spinner tamanho={28} /></div></CascaPublica>
  }
  if (estado === 'invalido' || estado === 'erro' || !dados) {
    const inv = estado === 'invalido'
    return (
      <CascaPublica largura={520}>
        <div style={{ ...cartao, maxWidth: 520, margin: '0 auto', alignItems: 'center', textAlign: 'center', padding: 28 }}>
          <span style={{ width: 52, height: 52, borderRadius: 16, display: 'grid', placeItems: 'center', background: inv ? T.bg.hover : T.status.warningBg }}>
            <Icon icon={inv ? LinkIcon : CircleAlert} size={24} color={inv ? T.text.secondary : T.status.warning} />
          </span>
          <div style={{ fontSize: 20, fontWeight: 700, color: T.text.primary }}>{inv ? 'Este link não vale mais' : 'Não conseguimos carregar'}</div>
          <div style={{ fontSize: 15, color: T.text.secondary, lineHeight: 1.5 }}>
            {inv ? 'Por segurança, os links do portal expiram. Peça um novo à clínica, é rapidinho.' : 'Confira sua internet e tente de novo.'}
          </div>
          {!inv && <Button size="lg" block style={botaoGrande} onClick={() => { setEstado('carregando'); carregar() }}>Tentar de novo</Button>}
        </div>
      </CascaPublica>
    )
  }

  const { clinica, paciente, proxima, formularios, retorno } = dados
  const d = proxima ? new Date(proxima.data_hora) : null
  const hoje = d ? ehHoje(d) : false
  const tel = soDigitos(clinica.telefone)
  const whats = tel ? `https://wa.me/${tel.length <= 11 ? '55' + tel : tel}` : null

  return (
    <CascaPublica clinica={{ nome: clinica.nome, logo_url: clinica.logo_url }} largura={520}>
      <main style={{ maxWidth: 520, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ padding: '4px 4px 2px' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: T.text.primary, letterSpacing: '-.01em' }}>Olá{paciente.primeiro_nome ? `, ${paciente.primeiro_nome}` : ''}</div>
          <div style={{ fontSize: 15, color: T.text.secondary, marginTop: 4 }}>{hoje ? 'Sua consulta é hoje.' : 'Tudo o que você precisa para sua consulta está aqui.'}</div>
        </div>

        {/* Próxima consulta */}
        {proxima && d ? (
          <section style={{ ...cartao, borderColor: T.brand.primaryAccentLight }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={tituloCartao}><Icon icon={CalendarCheck} size={15} /> Sua próxima consulta</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, padding: '4px 10px', borderRadius: 99, background: proxima.confirmada ? T.status.successBg : proxima.remarcar_pedido ? T.bg.hover : T.status.warningBg, color: proxima.confirmada ? T.status.success : proxima.remarcar_pedido ? T.text.secondary : T.status.warning }}>
                {proxima.confirmada ? 'Confirmada' : proxima.remarcar_pedido ? 'Remarcação pedida' : 'A confirmar'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <div style={{ width: 64, flexShrink: 0, borderRadius: 14, border: `1px solid ${T.border.default}`, overflow: 'hidden', textAlign: 'center' }}>
                <div style={{ background: T.brand.primary, color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 0', textTransform: 'uppercase' }}>{d.toLocaleDateString('pt-BR', { month: 'short', timeZone: TZ }).replace('.', '')}</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: T.text.primary, padding: '4px 0 6px' }}>{d.toLocaleDateString('pt-BR', { day: 'numeric', timeZone: TZ })}</div>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: T.text.primary }}>{hoje ? 'Hoje' : diaSemana(d)}, às <span className="mono">{hora(d)}</span></div>
                <div style={{ fontSize: 15, color: T.text.secondary, marginTop: 2 }}>{dataLonga(d)}</div>
                {proxima.medico && <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14.5, color: T.text.secondary, marginTop: 6 }}><Icon icon={Stethoscope} size={15} />{proxima.medico}{proxima.especialidade ? ` · ${proxima.especialidade}` : ''}</div>}
              </div>
            </div>
            {proxima.teleconsulta ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14.5, color: T.text.secondary }}><Icon icon={Video} size={16} /> Consulta por vídeo, pelo celular ou computador</div>
            ) : clinica.endereco ? (
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clinica.endereco)}`} target="_blank" rel="noreferrer"
                style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14.5, color: T.text.secondary, textDecoration: 'none' }}>
                <Icon icon={MapPin} size={16} style={{ marginTop: 2, flexShrink: 0 }} />
                <span>{clinica.endereco} <span style={{ color: T.brand.primary, fontWeight: 600, whiteSpace: 'nowrap' }}>Abrir no mapa →</span></span>
              </a>
            ) : null}

            {aviso && <div style={{ padding: '10px 12px', borderRadius: 12, background: T.status.warningBg, color: T.status.warning, fontSize: 14, fontWeight: 600 }}>{aviso}</div>}

            {checkin ? (
              <div style={{ padding: 16, borderRadius: 16, background: T.status.successBg, textAlign: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.status.success }}>Pronto, avisamos a recepção</div>
                <div style={{ fontSize: 13, color: T.text.secondary, marginTop: 6 }}>Sua senha</div>
                <div className="mono" style={{ fontSize: 40, fontWeight: 800, color: T.text.primary, letterSpacing: '.04em' }}>{checkin.senha}</div>
                <div style={{ fontSize: 14, color: T.text.secondary }}>Fique de olho na TV da sala de espera.{checkin.na_frente !== undefined ? ` ${checkin.na_frente === 0 ? 'Você é o próximo.' : `${checkin.na_frente} ${checkin.na_frente === 1 ? 'pessoa' : 'pessoas'} na sua frente.`}` : ''}</div>
              </div>
            ) : proxima.teleconsulta && hoje ? (
              <Button size="lg" block icon={Video} style={botaoGrande} onClick={() => window.open(proxima.teleconsulta!, '_blank')}>Entrar na teleconsulta</Button>
            ) : proxima.pode_checkin ? (
              <Button size="lg" block icon={Hand} style={{ ...botaoGrande, height: 64, fontSize: 18 }} disabled={!!enviando} onClick={() => acao('checkin')}>
                {enviando === 'checkin' ? 'Avisando…' : 'Cheguei na clínica'}
              </Button>
            ) : null}

            {!checkin && !remarcar && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {!proxima.confirmada && !proxima.remarcar_pedido && (
                  <Button size="lg" block icon={CheckCircle2} style={botaoGrande} disabled={!!enviando} onClick={() => acao('confirmar')}>
                    {enviando === 'confirmar' ? 'Confirmando…' : 'Confirmar presença'}
                  </Button>
                )}
                {!proxima.remarcar_pedido && (
                  <Button size="lg" block variant="secondary" icon={CalendarClock} style={botaoGrande} disabled={!!enviando} onClick={() => setRemarcar(true)}>Preciso remarcar</Button>
                )}
                {proxima.remarcar_pedido && <div style={{ fontSize: 14.5, color: T.text.secondary, lineHeight: 1.5 }}>A recepção recebeu seu pedido e vai entrar em contato com um novo horário.</div>}
              </div>
            )}

            {remarcar && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 4 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: T.text.primary }}>Qual horário fica melhor?</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{PERIODOS.map(p => <Chip key={p} ativo={periodo === p} onClick={() => setPeriodo(periodo === p ? null : p)}>{p}</Chip>)}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{QUANDO.map(q => <Chip key={q} ativo={quando === q} onClick={() => setQuando(quando === q ? null : q)}>{q}</Chip>)}</div>
                <Textarea rows={2} value={obs} onChange={e => setObs(e.target.value)} placeholder="Quer avisar mais alguma coisa? (opcional)" style={{ fontSize: 15 }} />
                <div style={{ fontSize: 13.5, color: T.text.tertiary }}>Sua consulta continua marcada até a recepção confirmar o novo horário.</div>
                <Button size="lg" block style={botaoGrande} disabled={!!enviando} onClick={() => acao('remarcar', { preferencia: [periodo, quando, obs.trim()].filter(Boolean).join(' · ') })}>
                  {enviando === 'remarcar' ? 'Enviando…' : 'Pedir novo horário'}
                </Button>
                <Button size="lg" block variant="ghost" style={botaoGrande} onClick={() => setRemarcar(false)}>Voltar</Button>
              </div>
            )}
          </section>
        ) : (
          <section style={{ ...cartao, alignItems: 'center', textAlign: 'center' }}>
            <Icon icon={CalendarCheck} size={28} color={T.text.tertiary} />
            <div style={{ fontSize: 18, fontWeight: 700, color: T.text.primary }}>Nenhuma consulta marcada</div>
            <div style={{ fontSize: 15, color: T.text.secondary }}>Quando quiser, é só falar com a clínica.</div>
          </section>
        )}

        {/* Pré-consulta */}
        {formularios.length > 0 && (
          <section style={cartao}>
            <span style={tituloCartao}><Icon icon={ClipboardList} size={15} /> Prepare sua consulta</span>
            <div style={{ fontSize: 15, color: T.text.secondary, lineHeight: 1.5 }}>Responder antes ajuda o médico a se preparar e deixa a consulta mais rápida.</div>
            {formularios.map(f => (
              <a key={f.url} href={f.url} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, border: `1px solid ${T.border.default}`, textDecoration: 'none' }}>
                <span style={{ flex: 1, fontSize: 15.5, fontWeight: 600, color: T.text.primary }}>{f.nome}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: T.brand.primary }}>Preencher →</span>
              </a>
            ))}
          </section>
        )}

        {/* Orçamentos */}
        {dados.orcamentos?.map(o => <CartaoOrcamento key={o.id} o={o} token={token} aoResponder={carregar} />)}

        {/* Documentos liberados pelo médico */}
        {dados.documentos?.length > 0 && (
          <section style={cartao}>
            <span style={tituloCartao}><Icon icon={FileText} size={15} /> Seus documentos</span>
            {dados.documentos.map(d => (
              <button key={d.id} onClick={() => abrirDocumento(d.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, border: `1px solid ${T.border.default}`, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                <Icon icon={FileText} size={18} color={T.brand.primary} />
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 15.5, fontWeight: 600, color: T.text.primary }}>{d.titulo}</span>
                  <span style={{ display: 'block', fontSize: 13, color: T.text.tertiary }}>{new Date(d.criado_em).toLocaleDateString('pt-BR', { timeZone: TZ })}</span>
                </span>
                <span style={{ fontSize: 15, fontWeight: 700, color: T.brand.primary }}>Abrir →</span>
              </button>
            ))}
          </section>
        )}

        {/* Enviar exames e documentos */}
        <section style={cartao}>
          <span style={tituloCartao}><Icon icon={Paperclip} size={15} /> Enviar exames e documentos</span>
          <div style={{ fontSize: 15, color: T.text.secondary, lineHeight: 1.5 }}>Mande fotos ou PDFs de exames anteriores, pedidos e receitas. O médico vê antes da consulta.</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <label style={{ ...botaoGrande, flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: `1px solid ${T.border.default}`, background: '#fff', fontWeight: 600, color: T.text.primary, cursor: 'pointer' }}>
              <Icon icon={Camera} size={18} /> Tirar foto
              <input type="file" accept="image/*" capture="environment" hidden disabled={!!enviandoArq} onChange={e => { enviarArquivos(e.target.files); e.target.value = '' }} />
            </label>
            <label style={{ ...botaoGrande, flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: `1px solid ${T.border.default}`, background: '#fff', fontWeight: 600, color: T.text.primary, cursor: 'pointer' }}>
              <Icon icon={Upload} size={18} /> Escolher arquivo
              <input type="file" accept="image/*,application/pdf" multiple hidden disabled={!!enviandoArq} onChange={e => { enviarArquivos(e.target.files); e.target.value = '' }} />
            </label>
          </div>
          <div style={{ fontSize: 13, color: T.text.tertiary }}>JPG, PNG ou PDF, até 15 MB cada.</div>
          {enviandoArq && <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: T.text.secondary }}><Spinner tamanho={16} /> Enviando {enviandoArq}…</div>}
          {avisoArq && <div style={{ padding: '10px 12px', borderRadius: 12, background: T.status.warningBg, color: T.status.warning, fontSize: 14, fontWeight: 600 }}>{avisoArq}</div>}
          {dados.anexos?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {dados.anexos.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: T.text.secondary }}>
                  <Icon icon={CheckCircle2} size={15} color={T.status.success} />
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nome_arquivo}</span>
                  <span style={{ fontSize: 12.5, color: T.text.tertiary }}>enviado</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Retorno */}
        {retorno && (
          <section style={cartao}>
            <span style={tituloCartao}><Icon icon={CalendarClock} size={15} /> Seu retorno</span>
            <div style={{ fontSize: 16, color: T.text.primary }}>Seu retorno está previsto para <b>{mesAno(retorno.data_prevista)}</b>.</div>
            {whats && (
              <Button size="lg" block variant="secondary" icon={MessageCircle} style={botaoGrande}
                onClick={() => window.open(`${whats}?text=${encodeURIComponent(`Olá! Quero marcar meu retorno${paciente.primeiro_nome ? ` (${paciente.primeiro_nome})` : ''}.`)}`, '_blank')}>
                Marcar meu retorno
              </Button>
            )}
          </section>
        )}

        {/* Contato */}
        {(whats || tel) && (
          <section style={{ ...cartao, flexDirection: 'row', gap: 10 }}>
            {whats && <Button size="lg" variant="secondary" icon={MessageCircle} style={{ ...botaoGrande, flex: 1 }} onClick={() => window.open(whats, '_blank')}>WhatsApp</Button>}
            {tel && <Button size="lg" variant="secondary" icon={Phone} style={{ ...botaoGrande, flex: 1 }} onClick={() => { location.href = `tel:${tel}` }}>Ligar</Button>}
          </section>
        )}
        <p style={{ fontSize: 12.5, color: T.text.tertiary, textAlign: 'center', lineHeight: 1.5, margin: '2px 12px 0' }}>
          Este link é pessoal, não compartilhe. Seus dados são usados só para o seu atendimento, conforme a LGPD.
        </p>
      </main>
    </CascaPublica>
  )
}

const brl = (n: number) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** Orçamento no portal: itens, total, forma de pagamento e aprovação com nome completo ("li e aceito"). */
function CartaoOrcamento({ o, token, aoResponder }: { o: Portal['orcamentos'][number]; token: string; aoResponder: () => void }) {
  const [condicao, setCondicao] = useState<string | null>(o.condicoes.length === 1 ? o.condicoes[0] : null)
  const [nome, setNome] = useState('')
  const [aceito, setAceito] = useState(false)
  const [recusando, setRecusando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const aberto = o.status === 'enviado' || o.status === 'visto'

  async function responder(resposta: 'aprovar' | 'recusar') {
    setEnviando(true); setErro(null)
    try {
      const r = await fetch(`/api/portal/${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'orcamento', orcamento_id: o.id, resposta, nome, condicao, motivo }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErro(j.erro || 'Não deu certo agora. Tente de novo.'); return }
      aoResponder()
    } catch { setErro('Sem conexão. Confira sua internet e tente de novo.') }
    finally { setEnviando(false) }
  }

  const bruto = o.itens.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0)
  return (
    <section style={{ ...cartao, borderColor: aberto ? T.brand.primaryAccentLight : T.border.default }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={tituloCartao}><Icon icon={Receipt} size={15} /> Orçamento nº {String(o.numero).padStart(4, '0')}</span>
        <span style={{ fontSize: 12.5, fontWeight: 700, padding: '4px 10px', borderRadius: 99,
          background: o.status === 'aprovado' ? T.status.successBg : o.status === 'recusado' || o.status === 'expirado' ? T.bg.hover : T.status.warningBg,
          color: o.status === 'aprovado' ? T.status.success : o.status === 'recusado' || o.status === 'expirado' ? T.text.secondary : T.status.warning }}>
          {o.status === 'aprovado' ? 'Aprovado' : o.status === 'recusado' ? 'Recusado' : o.status === 'expirado' ? 'Vencido' : 'Aguardando sua resposta'}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {o.itens.map((i, k) => (
          <div key={k} style={{ display: 'flex', gap: 10, fontSize: 15, color: T.text.primary }}>
            <span style={{ flex: 1 }}>{i.quantidade !== 1 ? `${i.quantidade}× ` : ''}{i.descricao}</span>
            <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{brl(i.quantidade * i.valor_unitario)}</span>
          </div>
        ))}
        {o.desconto > 0 && <div style={{ display: 'flex', fontSize: 14, color: T.status.success }}><span style={{ flex: 1 }}>Desconto</span><span>− {brl(o.desconto)}</span></div>}
        <div style={{ display: 'flex', alignItems: 'baseline', paddingTop: 8, borderTop: `1px solid ${T.border.default}` }}>
          <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: T.text.secondary }}>Total{o.desconto > 0 ? ` (de ${brl(bruto)})` : ''}</span>
          <span style={{ fontSize: 24, fontWeight: 800, color: T.text.primary }}>{brl(o.total)}</span>
        </div>
      </div>
      {o.observacoes && <div style={{ fontSize: 14.5, color: T.text.secondary, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{o.observacoes}</div>}
      <div style={{ fontSize: 13.5, color: T.text.tertiary }}>Válido até {new Date(o.validade + 'T12:00:00').toLocaleDateString('pt-BR')}</div>

      {o.status === 'aprovado' && (
        <div style={{ padding: 14, borderRadius: 14, background: T.status.successBg, fontSize: 14.5, color: T.text.primary, lineHeight: 1.5 }}>
          <b style={{ color: T.status.success }}>Aprovado</b>{o.aceito_por ? ` por ${o.aceito_por}` : ''}{o.respondido_em ? ` em ${new Date(o.respondido_em).toLocaleString('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}{o.condicao_escolhida ? ` · ${o.condicao_escolhida}` : ''}. A recepção vai falar com você para agendar.
        </div>
      )}
      {o.status === 'expirado' && <div style={{ fontSize: 14.5, color: T.text.secondary }}>Este orçamento venceu. Peça um novo à clínica.</div>}

      {aberto && !recusando && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {o.condicoes.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: T.text.primary }}>Como prefere pagar?</span>
              {o.condicoes.map(c => (
                <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 14, border: `1.5px solid ${condicao === c ? T.brand.primary : T.border.default}`, fontSize: 15, cursor: 'pointer' }}>
                  <input type="radio" name={'cond-' + o.id} checked={condicao === c} onChange={() => setCondicao(c)} /> {c}
                </label>
              ))}
            </div>
          )}
          <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome completo" autoComplete="name"
            style={{ height: 50, borderRadius: 14, border: `1px solid ${T.border.default}`, padding: '0 14px', fontSize: 16, fontFamily: 'inherit' }} />
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14.5, color: T.text.secondary, cursor: 'pointer', lineHeight: 1.45 }}>
            <input type="checkbox" checked={aceito} onChange={e => setAceito(e.target.checked)} style={{ marginTop: 3 }} />
            Li e aceito este orçamento. Entendo que a data e a hora da aprovação ficam registradas.
          </label>
          {erro && <div style={{ padding: '10px 12px', borderRadius: 12, background: T.status.warningBg, color: T.status.warning, fontSize: 14, fontWeight: 600 }}>{erro}</div>}
          <Button size="lg" block icon={CheckCircle2} style={botaoGrande} disabled={enviando || !aceito || nome.trim().length < 5 || (o.condicoes.length > 0 && !condicao)} onClick={() => responder('aprovar')}>
            {enviando ? 'Enviando…' : 'Aprovar orçamento'}
          </Button>
          <button onClick={() => setRecusando(true)} style={{ border: 'none', background: 'none', color: T.text.tertiary, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit' }}>Não quero agora</button>
        </div>
      )}
      {aberto && recusando && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Textarea rows={2} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Quer contar o motivo? (opcional)" style={{ fontSize: 15 }} />
          {erro && <div style={{ padding: '10px 12px', borderRadius: 12, background: T.status.warningBg, color: T.status.warning, fontSize: 14, fontWeight: 600 }}>{erro}</div>}
          <Button size="lg" block variant="secondary" style={botaoGrande} disabled={enviando} onClick={() => responder('recusar')}>{enviando ? 'Enviando…' : 'Recusar orçamento'}</Button>
          <Button size="lg" block variant="ghost" style={botaoGrande} onClick={() => setRecusando(false)}>Voltar</Button>
        </div>
      )}
    </section>
  )
}
