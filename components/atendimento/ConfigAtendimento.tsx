'use client'
/**
 * Minha clínica → Recepção e painel: salas de espera (cada uma com sua TV),
 * consultórios e o que o painel mostra (LGPD), fala e avisa no WhatsApp.
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, DoorOpen, ExternalLink, MonitorPlay, Plus, RefreshCw, Stethoscope, Trash2, UserCheck, Megaphone } from 'lucide-react'
import { tokens as T } from '@/lib/design-tokens'
import { Button, Card, EmptyState, Field, IconButton, Input, SegmentedControl, Switch } from '@/components/ui'
import { confirmar, notificar } from '@/components/ui/dialogos'
import { carregarConfig, ehDemo, excluirConfig, salvarConfig, ErroApi, type Config } from '@/lib/atendimento/cliente'
import type { Consultorio, ExibicaoPainel, Setor } from '@/lib/atendimento/comum'

const EXIBICOES: { value: ExibicaoPainel; label: string }[] = [
  { value: 'senha', label: 'Só a senha' },
  { value: 'senha_nome', label: 'Senha + nome e sobrenome' },
  { value: 'nome_completo', label: 'Nome completo' },
]

export default function ConfigAtendimento() {
  const router = useRouter()
  const [config, setConfig] = useState<Config | null>(null)
  const [erro, setErro] = useState<{ msg: string; migration: boolean } | null>(null)

  const recarregar = () => carregarConfig().then(c => { setConfig(c); setErro(null) })
    .catch(e => setErro({ msg: e.message, migration: e instanceof ErroApi && e.faltaMigration }))
  useEffect(() => { recarregar() }, [])

  const salvar = async (metodo: 'POST' | 'PATCH', corpo: any, ok?: string) => {
    try { await salvarConfig(metodo, corpo); if (ok) notificar(ok); await recarregar() }
    catch (e: any) { notificar(e.message, 'erro') }
  }

  if (erro?.migration) return <Card><EmptyState icon={MonitorPlay} titulo="Falta ativar o módulo de atendimento" descricao="Rode a migration 0018_atendimento_fila no Supabase (SQL Editor) e volte aqui." /></Card>
  if (erro) return <Card><EmptyState icon={MonitorPlay} titulo="Não foi possível carregar" descricao={erro.msg} acao={<Button variant="secondary" onClick={recarregar}>Tentar de novo</Button>} /></Card>
  if (!config) return <Card><span className="c360-skel" style={{ display: 'block', height: 120, borderRadius: 12 }} /></Card>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 920 }}>
      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          {[
            { icon: UserCheck, t: '1. Recepção', d: 'Confirma a chegada e gera a senha (com prioridade da lei).', href: '/recepcao' },
            { icon: Megaphone, t: '2. Painel na TV', d: 'Mostra e fala quem foi chamado e para qual consultório.', href: null },
            { icon: Stethoscope, t: '3. Consultório', d: 'O médico chama o próximo e finaliza com o retorno.', href: '/consultorio' },
          ].map(p => (
            <div key={p.t} style={{ display: 'flex', gap: 12 }}>
              <span style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, display: 'grid', placeItems: 'center', background: T.brand.primarySubtle, color: T.brand.primary }}><p.icon size={18} /></span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{p.t}</div>
                <div style={{ fontSize: 12.5, color: T.text.secondary, marginTop: 2, lineHeight: 1.45 }}>{p.d}</div>
                {p.href && <button onClick={() => router.push(p.href! + (ehDemo() ? '?demo=1' : ''))} style={linkBtn}>Abrir {p.t.slice(3).toLowerCase()} →</button>}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {config.setores.length === 0 ? <ConfigInicial onCriar={recarregar} /> : config.setores.map(s => (
        <CartaoSetor key={s.id} setor={s} consultorios={config.consultorios.filter(c => c.setor_id === s.id)} salvar={salvar} recarregar={recarregar} />
      ))}

      {config.setores.length > 0 && (
        <Button variant="secondary" icon={Plus} style={{ alignSelf: 'flex-start' }}
          onClick={() => salvar('POST', { tipo: 'setor', nome: `Sala de espera ${config.setores.length + 1}` }, 'Sala de espera criada')}>
          Outra sala de espera (outro andar ou ala)
        </Button>
      )}
    </div>
  )
}

const linkBtn: React.CSSProperties = { border: 'none', background: 'none', padding: 0, marginTop: 6, cursor: 'pointer', color: T.brand.primary, fontWeight: 600, fontSize: 12.5, fontFamily: 'inherit' }

function ConfigInicial({ onCriar }: { onCriar: () => void }) {
  const [nome, setNome] = useState('Recepção')
  const [qtd, setQtd] = useState('3')
  const [criando, setCriando] = useState(false)
  const criar = async () => {
    setCriando(true)
    try {
      const { item: setor } = await salvarConfig('POST', { tipo: 'setor', nome: nome.trim() || 'Recepção' })
      const n = Math.min(30, Math.max(1, Number(qtd) || 1))
      for (let i = 1; i <= n; i++) await salvarConfig('POST', { tipo: 'consultorio', setor_id: setor.id, nome: `Consultório ${i}`, ordem: i })
      notificar('Pronto! Abra o link do painel na TV da sala de espera.')
      onCriar()
    } catch (e: any) { notificar(e.message, 'erro'); setCriando(false) }
  }
  return (
    <Card titulo="Configurar em 1 minuto">
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Field label="Nome da sala de espera" style={{ flex: '1 1 220px' }}><Input value={nome} onChange={e => setNome(e.target.value)} /></Field>
        <Field label="Quantos consultórios?" style={{ width: 170 }}><Input value={qtd} onChange={e => setQtd(e.target.value.replace(/\D/g, '').slice(0, 2))} inputMode="numeric" /></Field>
        <Button icon={MonitorPlay} onClick={criar} disabled={criando}>{criando ? 'Criando…' : 'Criar'}</Button>
      </div>
      <div style={{ fontSize: 12.5, color: T.text.tertiary, marginTop: 10 }}>Depois dá para renomear (ex.: "Sala 204 — Cardiologia"), criar outras salas de espera e mudar o que a TV mostra.</div>
    </Card>
  )
}

function CartaoSetor({ setor, consultorios, salvar, recarregar }: {
  setor: Setor; consultorios: Consultorio[]
  salvar: (m: 'POST' | 'PATCH', corpo: any, ok?: string) => Promise<void>
  recarregar: () => void
}) {
  const [nome, setNome] = useState(setor.nome)
  const [mensagem, setMensagem] = useState(setor.painel_mensagem || '')
  const [novoConsultorio, setNovoConsultorio] = useState('')
  useEffect(() => { setNome(setor.nome); setMensagem(setor.painel_mensagem || '') }, [setor])

  const link = typeof window !== 'undefined' ? `${window.location.origin}/painel/${setor.painel_token}${ehDemo() ? '?demo=1' : ''}` : ''
  const patch = (c: any, ok?: string) => salvar('PATCH', { tipo: 'setor', id: setor.id, ...c }, ok)

  const copiar = async () => { try { await navigator.clipboard.writeText(link); notificar('Link copiado — abra na TV') } catch { notificar('Não deu para copiar. Selecione o link e copie.', 'erro') } }
  const novoLink = async () => {
    if (!(await confirmar({ titulo: 'Gerar um link novo?', mensagem: 'A TV com o link antigo para de funcionar. Use se o link vazou ou trocou de TV.', confirmar: 'Gerar novo link' }))) return
    await patch({ novo_link: true }, 'Link novo gerado — atualize na TV')
  }
  const excluirSetor = async () => {
    if (!(await confirmar({ titulo: `Excluir ${setor.nome}?`, mensagem: 'Os consultórios desta sala também saem. O histórico de atendimentos continua.', confirmar: 'Excluir', perigo: true }))) return
    try { await excluirConfig('setor', setor.id); notificar('Sala de espera excluída'); recarregar() } catch (e: any) { notificar(e.message, 'erro') }
  }
  const addConsultorio = async () => {
    const n = novoConsultorio.trim() || `Consultório ${consultorios.length + 1}`
    await salvar('POST', { tipo: 'consultorio', setor_id: setor.id, nome: n, ordem: consultorios.length + 1 })
    setNovoConsultorio('')
  }

  return (
    <Card padding={0}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 18px', borderBottom: `1px solid ${T.border.muted}` }}>
        <span style={{ width: 36, height: 36, borderRadius: 11, display: 'grid', placeItems: 'center', background: T.brand.primarySubtle, color: T.brand.primary, flexShrink: 0 }}><MonitorPlay size={18} /></span>
        <Input value={nome} onChange={e => setNome(e.target.value)} onBlur={() => nome.trim() && nome !== setor.nome && patch({ nome }, 'Nome salvo')}
          aria-label="Nome da sala de espera" style={{ fontWeight: 700, fontSize: 15, maxWidth: 360 }} />
        <span style={{ flex: 1 }} />
        <Switch checked={setor.ativo} onChange={v => patch({ ativo: v })} label={setor.ativo ? 'Ativa' : 'Desativada'} />
        <IconButton icon={Trash2} tone="danger" size={32} title="Excluir sala de espera" onClick={excluirSetor} />
      </div>

      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Link do painel (abra na TV)" hint="Smart TV, Chromecast ou mini PC com navegador. Na primeira vez, toque em “Ativar som e tela cheia”.">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Input value={link} readOnly onFocus={e => e.currentTarget.select()} className="mono" style={{ flex: '1 1 300px', fontSize: 12.5 }} />
            <Button variant="secondary" icon={Copy} onClick={copiar}>Copiar</Button>
            <Button variant="secondary" icon={ExternalLink} onClick={() => window.open(link, '_blank')}>Abrir</Button>
            <IconButton icon={RefreshCw} size={36} variant="outline" title="Gerar link novo" onClick={novoLink} />
          </div>
        </Field>

        <Field label="O que a TV mostra" hint="Padrão: primeiro e segundo nome (ex.: “Maria Silva”). Nunca mostramos motivo ou especialidade (LGPD).">
          <SegmentedControl options={EXIBICOES} value={setor.painel_exibicao} onChange={v => patch({ painel_exibicao: v })} />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          <Switch checked={setor.painel_voz} onChange={v => patch({ painel_voz: v })} label="Chamar por voz" descricao="A TV fala a senha, o nome e o consultório." />
          <Switch checked={setor.avisar_whatsapp} onChange={v => patch({ avisar_whatsapp: v })} label="Avisar no WhatsApp" descricao="“Você é o próximo” e “É a sua vez” para o paciente." />
        </div>

        <Field label="Mensagem no rodapé da TV (opcional)">
          <Input value={mensagem} onChange={e => setMensagem(e.target.value)} onBlur={() => mensagem !== (setor.painel_mensagem || '') && patch({ painel_mensagem: mensagem }, 'Mensagem salva')}
            placeholder="Ex.: Wi-Fi: Clinica-Pacientes · Mantenha o celular por perto" maxLength={200} />
        </Field>

        <Field label={`Consultórios · ${consultorios.length}`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {consultorios.map(c => <LinhaConsultorio key={c.id} c={c} salvar={salvar} recarregar={recarregar} />)}
            <div style={{ display: 'flex', gap: 8 }}>
              <Input value={novoConsultorio} onChange={e => setNovoConsultorio(e.target.value)} onKeyDown={e => e.key === 'Enter' && addConsultorio()}
                placeholder={`Consultório ${consultorios.length + 1}`} style={{ maxWidth: 300 }} />
              <Button variant="secondary" icon={Plus} onClick={addConsultorio}>Adicionar</Button>
            </div>
          </div>
        </Field>
      </div>
    </Card>
  )
}

function LinhaConsultorio({ c, salvar, recarregar }: { c: Consultorio; salvar: (m: 'POST' | 'PATCH', corpo: any, ok?: string) => Promise<void>; recarregar: () => void }) {
  const [nome, setNome] = useState(c.nome)
  useEffect(() => setNome(c.nome), [c.nome])
  const excluir = async () => {
    if (!(await confirmar({ titulo: `Excluir ${c.nome}?`, confirmar: 'Excluir', perigo: true }))) return
    try { await excluirConfig('consultorio', c.id); recarregar() } catch (e: any) { notificar(e.message, 'erro') }
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <DoorOpen size={16} color={T.text.tertiary} />
      <Input value={nome} onChange={e => setNome(e.target.value)} onBlur={() => nome.trim() && nome !== c.nome && salvar('PATCH', { tipo: 'consultorio', id: c.id, nome }, 'Consultório renomeado')}
        style={{ maxWidth: 300 }} aria-label="Nome do consultório" />
      <IconButton icon={Trash2} tone="danger" size={32} title="Excluir consultório" onClick={excluir} />
    </div>
  )
}
