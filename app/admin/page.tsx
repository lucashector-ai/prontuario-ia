'use client'
import { log } from '@/lib/logger'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { EspecialidadeSelect } from '@/components/EspecialidadeSelect'
import { CamposPessoaisMedico } from '@/components/CamposPessoaisMedico'
import { tokens } from '@/lib/design-tokens'
import {
  UserRound, Headset, Users, CalendarCheck, UserPlus, Ellipsis, Pencil, Power, RotateCcw, Trash2,
  Check, Copy, Info, TriangleAlert,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  KpiCard, Tabs, EmptyState, Button, Card, Avatar, Badge, Field, Input, Select, Modal, ModalAcoes,
  SegmentedControl, IconButton, Icon, Overline, PageHeader,
} from '@/components/ui'

const T = tokens
const TONS = ['purple', 'pink', 'blue', 'green'] as const
const FORM_VAZIO = { nome: '', email: '', crm: '', especialidade: '', cpf: '', data_nascimento: '', cor: tokens.brand.primary as string, comissao_tipo: 'sem' as 'sem' | 'percentual' | 'fixo_consulta' | 'fixo_mensal', comissao_valor: '', comissao_base: 'receita' as 'receita' | 'lucro' }

const PALETA_CORES = [
  tokens.brand.primary, tokens.status.infoStrong, tokens.status.successHover, tokens.status.warningAlt, tokens.external.instagramPink,
  tokens.status.infoCyan, tokens.external.purpleViolet, tokens.status.dangerCrimson, tokens.accent.limeStrong, tokens.status.infoTeal,
]

export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <Admin />
    </Suspense>
  )
}

function Admin() {
  const router = useRouter()
  const { toast } = useToast()
  const [medico, setMedico] = useState<any>(null)
  const [medicos, setMedicos] = useState<any[]>([])
  const [stats, setStats] = useState<Record<string, any>>({})
  const [kpis, setKpis] = useState({ totalPacientes: 0, consultasMes: 0, consultasTotal: 0 })
  const [carregando, setCarregando] = useState(true)

  const [aba, setAba] = useState<'medicos' | 'recepcionistas'>('medicos')
  const [modalNovoTipo, setModalNovoTipo] = useState<'medico' | 'recepcionista' | null>(null)
  const [modalEditar, setModalEditar] = useState<any>(null)
  const [modalExcluir, setModalExcluir] = useState<any>(null)
  const [senhaGerada, setSenhaGerada] = useState<{ pessoa: any; senha: string; tipo: 'medico' | 'recepcionista' } | null>(null)
  const [senhaCopiada, setSenhaCopiada] = useState(false)

  const [form, setForm] = useState({ nome: '', email: '', crm: '', especialidade: '', cpf: '', data_nascimento: '', cor: tokens.brand.primary as string, comissao_tipo: 'sem' as 'sem' | 'percentual' | 'fixo_consulta' | 'fixo_mensal', comissao_valor: '', comissao_base: 'receita' as 'receita' | 'lucro' })
  const [formEditar, setFormEditar] = useState({ nome: '', email: '', crm: '', especialidade: '', cpf: '', data_nascimento: '', cargo: 'medico', comissao_tipo: 'sem' as 'sem' | 'percentual' | 'fixo_consulta' | 'fixo_mensal', comissao_valor: '', comissao_base: 'receita' as 'receita' | 'lucro' })
  const [salvando, setSalvando] = useState(false)
  const [menuAberto, setMenuAberto] = useState<string | null>(null)

  useEffect(() => {
    const ca = localStorage.getItem('clinica_admin')
    if (ca) {
      const admin = JSON.parse(ca)
      setMedico({ ...admin, cargo: 'admin' })
      carregarDados(admin.clinica_id)
      return
    }
    const m = localStorage.getItem('medico')
    if (!m) { router.push('/login'); return }
    const med = JSON.parse(m)
    if (med.cargo !== 'admin') { router.push('/dashboard'); return }
    setMedico(med)
    carregarDados(med.clinica_id)
  }, [router])

  // Abre já na aba/modal certos quando vem do onboarding (?add= / ?tab=)
  const searchParams = useSearchParams()
  useEffect(() => {
    const add = searchParams.get('add')
    const tab = searchParams.get('tab')
    if (add === 'medico') { setAba('medicos'); setModalNovoTipo('medico') }
    else if (add === 'recepcionista') { setAba('recepcionistas'); setModalNovoTipo('recepcionista') }
    else if (tab === 'recepcionistas') setAba('recepcionistas')
    else if (tab === 'medicos') setAba('medicos')
  }, [searchParams])

  const carregarDados = async (clinicaId: string) => {
    setCarregando(true)
    try {
      const { data: meds } = await supabase
        .from('medicos')
        .select('id, nome, email, crm, especialidade, ativo, criado_em, cargo, foto_url, clinica_id')
        .eq('clinica_id', clinicaId)
        .order('criado_em')

      const lista = meds || []
      setMedicos(lista)

      const statsMap: Record<string, any> = {}
      let totalConsultas = 0
      let totalConsultasMes = 0
      let totalPacientes = 0
      const inicioMes = new Date()
      inicioMes.setDate(1)
      inicioMes.setHours(0, 0, 0, 0)

      await Promise.all(lista.filter(m => m.cargo !== 'recepcionista').map(async (m: any) => {
        try {
          const [{ count: consultas }, { count: consultasMes }, { count: pacientes }] = await Promise.all([
            supabase.from('consultas').select('*', { count: 'exact', head: true }).eq('medico_id', m.id),
            supabase.from('consultas').select('*', { count: 'exact', head: true }).eq('medico_id', m.id).gte('criado_em', inicioMes.toISOString()),
            supabase.from('pacientes').select('*', { count: 'exact', head: true }).eq('medico_id', m.id),
          ])
          statsMap[m.id] = {
            consultas: consultas || 0,
            consultasMes: consultasMes || 0,
            pacientes: pacientes || 0,
          }
          totalConsultas += consultas || 0
          totalConsultasMes += consultasMes || 0
          totalPacientes += pacientes || 0
        } catch (e) {
          statsMap[m.id] = { consultas: 0, consultasMes: 0, pacientes: 0 }
        }
      }))

      setStats(statsMap)
      setKpis({ totalPacientes, consultasMes: totalConsultasMes, consultasTotal: totalConsultas })
    } catch (e) {
      log.error('Erro:', e)
    } finally {
      setCarregando(false)
    }
  }

  const handleCriar = async () => {
    if (!form.nome || !form.email) { toast('Preencha nome e email', 'error'); return }
    if (modalNovoTipo === 'medico') {
      const cpfDigits = form.cpf.replace(/\D/g, '')
      if (cpfDigits.length !== 11) { toast('CPF é obrigatório (11 dígitos)', 'error'); return }
      if (!form.data_nascimento) { toast('Data de nascimento é obrigatória', 'error'); return }
    }
    setSalvando(true)
    try {
      const payload: any = {
        nome: form.nome,
        email: form.email,
        clinica_id: medico.clinica_id,
        cargo: modalNovoTipo,
      }
      if (modalNovoTipo === 'medico') {
        payload.crm = form.crm
        payload.especialidade = form.especialidade
        payload.cpf = form.cpf.replace(/\D/g, '')
        payload.data_nascimento = form.data_nascimento
        payload.cor = form.cor
        payload.comissao_tipo = form.comissao_tipo || 'sem'
        payload.comissao_valor = form.comissao_valor ? parseFloat(form.comissao_valor.replace(',', '.')) : null
        payload.comissao_base = form.comissao_base || 'receita'
      }

      const res = await fetch('/api/medicos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.medico && data.senha_provisoria_gerada) {
        const tipoSalvo = modalNovoTipo!
        setModalNovoTipo(null)
        setForm({ ...FORM_VAZIO })
        setSenhaGerada({ pessoa: data.medico, senha: data.senha_provisoria_gerada, tipo: tipoSalvo })
        await carregarDados(medico.clinica_id)
      } else throw new Error(data.error || 'Erro ao criar')
    } catch (e: any) { toast(e.message, 'error') }
    finally { setSalvando(false) }
  }

  const handleEditar = async () => {
    if (!modalEditar) return
    setSalvando(true)
    try {
      const res = await fetch(`/api/medicos/${modalEditar.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
        ...formEditar,
        cpf: formEditar.cpf ? formEditar.cpf.replace(/\D/g, '') : null,
        comissao_valor: formEditar.comissao_valor ? parseFloat(formEditar.comissao_valor.replace(',', '.')) : null,
        data_nascimento: formEditar.data_nascimento || null,
      }),
      })
      const data = await res.json()
      if (data.medico) {
        setMedicos(prev => prev.map(m => m.id === modalEditar.id ? { ...m, ...formEditar } : m))
        setModalEditar(null)
        toast('Atualizado!')
      } else throw new Error(data.error)
    } catch (e: any) { toast(e.message, 'error') }
    finally { setSalvando(false) }
  }

  const handleExcluir = async () => {
    if (!modalExcluir) return
    setSalvando(true)
    try {
      const res = await fetch(`/api/medicos/${modalExcluir.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.ok) {
        setMedicos(prev => prev.filter(m => m.id !== modalExcluir.id))
        setModalExcluir(null)
        toast('Removido')
      } else throw new Error(data.error)
    } catch (e: any) { toast(e.message, 'error') }
    finally { setSalvando(false) }
  }

  const toggleAtivo = async (id: string, ativo: boolean) => {
    await supabase.from('medicos').update({ ativo: !ativo }).eq('id', id)
    setMedicos(prev => prev.map(m => m.id === id ? { ...m, ativo: !ativo } : m))
    toast(ativo ? 'Desativado' : 'Reativado', ativo ? 'error' : 'success')
  }

  const abrirEditar = (m: any) => {
    setFormEditar({
      nome: m.nome || '', email: m.email || '',
      crm: m.crm || '', especialidade: m.especialidade || '',
      cpf: m.cpf || '',
      data_nascimento: m.data_nascimento || '',
      cargo: m.cargo || 'medico',
      comissao_tipo: m.comissao_tipo || 'sem',
      comissao_valor: m.comissao_valor ? String(m.comissao_valor).replace('.', ',') : '',
      comissao_base: m.comissao_base || 'receita',
    })
    setModalEditar(m)
  }

  const copiarSenha = () => {
    if (!senhaGerada) return
    navigator.clipboard.writeText(senhaGerada.senha)
    setSenhaCopiada(true)
    setTimeout(() => setSenhaCopiada(false), 2000)
  }

  const copiarCredenciais = () => {
    if (!senhaGerada) return
    const label = senhaGerada.tipo === 'recepcionista' ? 'Recepcionista' : 'Médico'
    const texto = `Acesso Clinical 360 — ${label} ${senhaGerada.pessoa.nome}\nEmail: ${senhaGerada.pessoa.email}\nSenha provisória: ${senhaGerada.senha}\n\nNo primeiro login você vai precisar trocar a senha.`
    navigator.clipboard.writeText(texto)
    setSenhaCopiada(true)
    setTimeout(() => setSenhaCopiada(false), 2000)
  }

  if (!medico) return null

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })

  const listaMedicos = medicos.filter(m => m.cargo !== 'recepcionista')
  const listaRecepcionistas = medicos.filter(m => m.cargo === 'recepcionista')

  const listaAtual = aba === 'medicos' ? listaMedicos : listaRecepcionistas
  const labelAba = aba === 'medicos' ? 'médico' : 'recepcionista'
  const labelPlural = aba === 'medicos' ? 'médicos' : 'recepcionistas'

  const abrirNovo = (tipo: 'medico' | 'recepcionista') => {
    setModalNovoTipo(tipo)
    setForm({ ...FORM_VAZIO })
  }

  const ROLE: Record<string, { label: string; tone: 'accent' | 'info' | 'warning' }> = {
    admin: { label: 'Admin', tone: 'accent' },
    medico: { label: 'Médico', tone: 'info' },
    recepcionista: { label: 'Recepção', tone: 'warning' },
  }

  return (
    <main style={{ height: '100%', overflow: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        titulo="Painel admin"
        descricao={`${listaMedicos.length} médico${listaMedicos.length !== 1 ? 's' : ''} · ${listaRecepcionistas.length} recepcionista${listaRecepcionistas.length !== 1 ? 's' : ''}`}
      />

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
        <KpiCard label="Médicos ativos" valor={listaMedicos.filter(m => m.ativo).length} icon={UserRound} cor={T.data.purple} carregando={carregando} />
        <KpiCard label="Recepcionistas" valor={listaRecepcionistas.filter(m => m.ativo).length} icon={Headset} cor={T.data.blue} carregando={carregando} />
        <KpiCard label="Pacientes cadastrados" valor={kpis.totalPacientes} icon={Users} cor={T.data.green} carregando={carregando} />
        <KpiCard label="Consultas este mês" valor={kpis.consultasMes} icon={CalendarCheck} cor={T.data.orange} carregando={carregando} />
      </div>

      <div className="adm-grid">
        {/* Equipe */}
        <Card padding={0} style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 18px 4px', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, flex: 1, fontSize: 15, fontWeight: 700, letterSpacing: '-.01em', color: T.text.primary }}>Equipe</h3>
            <Button icon={UserPlus} onClick={() => abrirNovo(aba === 'medicos' ? 'medico' : 'recepcionista')}>Adicionar membro</Button>
          </div>
          <Tabs
            style={{ padding: '0 10px', marginBottom: 0, borderBottom: 'none' }}
            ativa={aba}
            onChange={(id) => setAba(id as 'medicos' | 'recepcionistas')}
            tabs={[
              { id: 'medicos', label: `Médicos (${listaMedicos.length})` },
              { id: 'recepcionistas', label: `Recepcionistas (${listaRecepcionistas.length})` },
            ]}
          />

          {carregando ? (
            <div style={{ padding: '8px 18px 18px', display: 'flex', flexDirection: 'column', gap: 10, borderTop: `1px solid ${T.border.muted}` }}>
              {[0, 1, 2].map(i => <div key={i} className="c360-skel" style={{ height: 44, borderRadius: 10 }} />)}
            </div>
          ) : listaAtual.length === 0 ? (
            <div style={{ borderTop: `1px solid ${T.border.muted}` }}>
              <EmptyState
                icon={UserPlus}
                titulo={`Nenhum ${labelAba} cadastrado ainda`}
                descricao={aba === 'medicos'
                  ? 'Adicione os médicos da clínica — cada um recebe um acesso próprio com agenda e prontuários.'
                  : 'Adicione recepcionistas para cuidar da agenda e do atendimento no WhatsApp.'}
                acao={
                  <Button variant="secondary" icon={UserPlus} onClick={() => abrirNovo(aba === 'medicos' ? 'medico' : 'recepcionista')}>
                    Adicionar {labelAba}
                  </Button>
                }
              />
            </div>
          ) : (
            <div>
              {listaAtual.map((m, i) => {
                const isRecep = m.cargo === 'recepcionista'
                const role = ROLE[m.cargo] || ROLE.medico
                const proprio = m.id === medico.id
                const meta = isRecep ? m.email : [m.especialidade || 'Sem especialidade', m.crm ? 'CRM ' + m.crm : '', m.email].filter(Boolean).join(' · ')
                const acoes: Array<{ icon: LucideIcon; label: string; danger?: boolean; onClick: () => void }> = [
                  { icon: Pencil, label: 'Editar', onClick: () => abrirEditar(m) },
                  ...(!proprio ? [
                    { icon: m.ativo ? Power : RotateCcw, label: m.ativo ? 'Desativar' : 'Reativar', onClick: () => toggleAtivo(m.id, m.ativo) },
                    { icon: Trash2, label: 'Excluir', danger: true, onClick: () => setModalExcluir(m) },
                  ] : []),
                ]
                return (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderTop: `1px solid ${T.border.muted}`, flexWrap: 'wrap', opacity: m.ativo ? 1 : 0.65 }}>
                    <Avatar nome={(m.nome || '').replace(/^Dra?\.\s*/, '')} src={m.foto_url} size={36} tom={TONS[i % TONS.length]} />
                    <span style={{ flex: 1, minWidth: 160, display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: T.text.primary }}>
                        {m.nome}{proprio && <span style={{ fontWeight: 500, color: T.text.quaternary }}> (você)</span>}
                      </span>
                      <span style={{ fontSize: 12, color: T.text.quaternary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta}</span>
                    </span>
                    <Badge tone={role.tone}>{role.label}</Badge>
                    <span style={{ width: 70, fontSize: 12, fontWeight: 600, color: m.ativo ? T.status.success : T.text.tertiary }}>{m.ativo ? 'Ativo' : 'Inativo'}</span>
                    <div style={{ position: 'relative' }}>
                      <IconButton icon={Ellipsis} size={32} aria-label="Ações" active={menuAberto === m.id}
                        onClick={() => setMenuAberto(menuAberto === m.id ? null : m.id)} />
                      {menuAberto === m.id && (
                        <>
                          <div onClick={() => setMenuAberto(null)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                          <div style={{
                            position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: 200, zIndex: 50,
                            background: '#fff', border: `1px solid ${T.border.default}`, borderRadius: 14, boxShadow: T.shadow.lg, padding: 6,
                          }}>
                            {acoes.map(a => (
                              <MenuItem key={a.label} icon={a.icon} danger={a.danger} onClick={() => { setMenuAberto(null); a.onClick() }}>{a.label}</MenuItem>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* Desempenho por médico (dados reais de consultas/pacientes) */}
        <Card titulo="Desempenho dos médicos" style={{ minWidth: 0 }}>
          {carregando ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[0, 1].map(i => <div key={i} className="c360-skel" style={{ height: 56, borderRadius: 10 }} />)}
            </div>
          ) : listaMedicos.length === 0 ? (
            <span style={{ fontSize: 12.5, color: T.text.quaternary }}>Os números aparecem aqui assim que houver médicos cadastrados.</span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {listaMedicos.map((m, i) => {
                const s = stats[m.id] || { consultas: 0, consultasMes: 0, pacientes: 0 }
                return (
                  <div key={m.id} style={{ padding: '10px 0', borderTop: i ? `1px solid ${T.border.muted}` : 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.cor || T.brand.primary, flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: T.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.nome}</span>
                      {m.criado_em && <span style={{ fontSize: 11.5, color: T.text.tertiary }}>desde {fmt(m.criado_em)}</span>}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      {[
                        { l: 'Pacientes', v: s.pacientes },
                        { l: 'Consultas', v: s.consultas },
                        { l: 'Este mês', v: s.consultasMes, destaque: true },
                      ].map(x => (
                        <div key={x.l} style={{ background: T.bg.page, borderRadius: 10, padding: '8px 10px' }}>
                          <Overline style={{ fontSize: 10 }}>{x.l}</Overline>
                          <div style={{ marginTop: 3, fontSize: 16, fontWeight: 700, color: x.destaque ? T.brand.primary : T.text.primary, fontVariantNumeric: 'tabular-nums' }}>{x.v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Modal Adicionar membro (médico ou recepcionista) */}
      {modalNovoTipo && (
        <Modal titulo="Adicionar membro" onClose={() => setModalNovoTipo(null)} largura={500}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Função">
              <SegmentedControl
                value={modalNovoTipo}
                onChange={(v) => setModalNovoTipo(v)}
                options={[{ value: 'medico', label: 'Médico' }, { value: 'recepcionista', label: 'Recepção' }]}
              />
              <span style={{ fontSize: 12.5, color: T.text.quaternary, lineHeight: 1.45 }}>
                {modalNovoTipo === 'medico'
                  ? 'Agenda própria, prontuários, prescrições e exames.'
                  : 'Agenda, cadastro de pacientes e WhatsApp.'}
              </span>
            </Field>
            <Field label="Nome completo *">
              <Input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                placeholder={modalNovoTipo === 'medico' ? 'Dr. João Silva' : 'Maria Santos'} />
            </Field>
            <Field label="E-mail *">
              <Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="nome@clinica.com" />
            </Field>
            {modalNovoTipo === 'medico' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <Field label="CRM">
                  <Input value={form.crm} onChange={e => setForm(p => ({ ...p, crm: e.target.value }))} placeholder="CRM/SP 123456" />
                </Field>
                <Field label="Especialidade">
                  <EspecialidadeSelect value={form.especialidade} onChange={v => setForm(p => ({ ...p, especialidade: v }))} />
                </Field>
              </div>
            )}
            {modalNovoTipo === 'medico' && (
              <CamposPessoaisMedico
                cpf={form.cpf}
                data_nascimento={form.data_nascimento}
                onChange={(campo, valor) => setForm(p => ({ ...p, [campo]: valor }))}
              />
            )}
            {modalNovoTipo === 'medico' && (
              <Field label="Cor na agenda" hint="Essa cor aparece nos agendamentos do médico na agenda.">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {PALETA_CORES.map(cor => {
                    const selecionada = form.cor === cor
                    return (
                      <button
                        key={cor}
                        type="button"
                        onClick={() => setForm(p => ({ ...p, cor }))}
                        title={cor}
                        aria-label={`Cor ${cor}`}
                        style={{
                          width: 30, height: 30, borderRadius: '50%', flexShrink: 0, padding: 0,
                          background: cor, cursor: 'pointer', border: 'none', color: '#fff',
                          boxShadow: selecionada ? `0 0 0 2px #fff, 0 0 0 4px ${cor}` : 'none',
                          transition: 'box-shadow .15s', display: 'grid', placeItems: 'center',
                        }}
                      >
                        {selecionada && <Check size={15} strokeWidth={3} />}
                      </button>
                    )
                  })}
                </div>
              </Field>
            )}
            <Aviso icon={Info}>
              Uma senha provisória será gerada. No primeiro login, {modalNovoTipo === 'medico' ? 'o médico' : 'a pessoa'} precisa criar uma senha própria.
            </Aviso>
          </div>
          {modalNovoTipo === 'medico' && <CamposComissao form={form} setForm={setForm} />}
          <ModalAcoes>
            <Button variant="secondary" onClick={() => setModalNovoTipo(null)}>Cancelar</Button>
            <Button onClick={handleCriar} disabled={salvando}>
              {salvando ? 'Criando…' : 'Criar ' + (modalNovoTipo === 'medico' ? 'médico' : 'recepcionista')}
            </Button>
          </ModalAcoes>
        </Modal>
      )}

      {/* Modal Editar */}
      {modalEditar && (
        <Modal titulo={`Editar ${modalEditar.cargo === 'recepcionista' ? 'recepcionista' : 'médico'}`} onClose={() => setModalEditar(null)} largura={480}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Nome completo">
              <Input value={formEditar.nome} onChange={e => setFormEditar(p => ({ ...p, nome: e.target.value }))} />
            </Field>
            <Field label="E-mail">
              <Input value={formEditar.email} onChange={e => setFormEditar(p => ({ ...p, email: e.target.value }))} />
            </Field>
            {modalEditar.cargo !== 'recepcionista' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <Field label="CRM">
                  <Input value={formEditar.crm} onChange={e => setFormEditar(p => ({ ...p, crm: e.target.value }))} />
                </Field>
                <Field label="Especialidade">
                  <EspecialidadeSelect value={formEditar.especialidade} onChange={v => setFormEditar(p => ({ ...p, especialidade: v }))} />
                </Field>
              </div>
            )}
            <Field label="Cargo">
              <Select value={formEditar.cargo} onChange={e => setFormEditar(p => ({ ...p, cargo: e.target.value }))}>
                <option value="medico">Médico</option>
                <option value="recepcionista">Recepcionista</option>
                <option value="admin">Admin</option>
              </Select>
            </Field>
            {modalEditar?.cargo === 'medico' && (
              <CamposPessoaisMedico
                cpf={formEditar.cpf}
                data_nascimento={formEditar.data_nascimento}
                onChange={(campo, valor) => setFormEditar(p => ({ ...p, [campo]: valor }))}
              />
            )}
          </div>
          {modalEditar?.cargo === 'medico' && <CamposComissao form={formEditar} setForm={setFormEditar} />}
          <ModalAcoes>
            <Button variant="secondary" onClick={() => setModalEditar(null)}>Cancelar</Button>
            <Button onClick={handleEditar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Button>
          </ModalAcoes>
        </Modal>
      )}

      {/* Modal Excluir */}
      {modalExcluir && (
        <Modal titulo={`Excluir ${modalExcluir.nome}?`} onClose={() => setModalExcluir(null)} largura={420}>
          <p style={{ fontSize: 13.5, color: T.text.secondary, margin: 0, lineHeight: 1.55 }}>
            Você está prestes a excluir <strong style={{ color: T.text.primary }}>{modalExcluir.nome}</strong> permanentemente. Essa ação não pode ser desfeita.
          </p>
          <ModalAcoes>
            <Button variant="secondary" onClick={() => setModalExcluir(null)}>Cancelar</Button>
            <Button variant="dangerSolid" icon={Trash2} onClick={handleExcluir} disabled={salvando}>
              {salvando ? 'Excluindo…' : 'Excluir'}
            </Button>
          </ModalAcoes>
        </Modal>
      )}

      {/* Modal de senha gerada — só fecha pelo botão "Pronto" */}
      {senhaGerada && (
        <Modal onClose={() => {}} largura={480}>
          <span style={{ width: 48, height: 48, borderRadius: 15, background: T.status.successBg, color: T.status.success, display: 'grid', placeItems: 'center', marginBottom: 14 }}>
            <Icon icon={Check} size={22} />
          </span>
          <h2 style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-.01em', color: T.text.primary, margin: '0 0 6px' }}>
            {senhaGerada.tipo === 'medico' ? 'Médico' : 'Recepcionista'} cadastrado
          </h2>
          <p style={{ fontSize: 13, color: T.text.secondary, margin: '0 0 18px', lineHeight: 1.55 }}>
            Envie essas credenciais para <strong style={{ color: T.text.primary }}>{senhaGerada.pessoa.nome}</strong>. No primeiro login, {senhaGerada.tipo === 'medico' ? 'ele' : 'ela'} vai precisar criar uma senha própria.
          </p>

          <div style={{ border: `1px solid ${T.border.default}`, borderRadius: 14, padding: 14, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <Overline>E-mail</Overline>
              <p style={{ fontSize: 13.5, fontWeight: 600, color: T.text.primary, margin: '4px 0 0', wordBreak: 'break-all' }}>{senhaGerada.pessoa.email}</p>
            </div>
            <div>
              <Overline>Senha provisória</Overline>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, background: T.bg.page, borderRadius: 10, padding: '6px 6px 6px 12px' }}>
                <code className="mono" style={{ flex: 1, fontSize: 14, fontWeight: 600, color: T.brand.primary, wordBreak: 'break-all' }}>{senhaGerada.senha}</code>
                <Button size="sm" variant={senhaCopiada ? 'secondary' : 'primary'} icon={senhaCopiada ? Check : Copy} onClick={copiarSenha}>
                  {senhaCopiada ? 'Copiado' : 'Copiar'}
                </Button>
              </div>
            </div>
          </div>

          <Aviso icon={TriangleAlert} tom="warning">
            Esta senha <strong>só aparece agora</strong>. Anote ou copie antes de fechar.
          </Aviso>

          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            <Button variant="secondary" block icon={Copy} onClick={copiarCredenciais}>Copiar tudo</Button>
            <Button block onClick={() => { setSenhaGerada(null); setSenhaCopiada(false); toast('Cadastrado com sucesso!') }}>Pronto</Button>
          </div>
        </Modal>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .adm-grid { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr); gap: 16px; align-items: start; }
        @media (max-width: 960px) { .adm-grid { grid-template-columns: minmax(0, 1fr); } }
      ` }} />
    </main>
  )
}

function MenuItem({ icon, danger, onClick, children }: { icon: LucideIcon; danger?: boolean; onClick: () => void; children: React.ReactNode }) {
  const [h, setH] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 9,
        border: 'none', background: h ? T.bg.hover : 'transparent', cursor: 'pointer', fontFamily: 'inherit',
        fontSize: 13, textAlign: 'left', color: danger ? T.status.danger : T.text.strong,
      }}
    >
      <Icon icon={icon} size={15} />
      {children}
    </button>
  )
}

function Aviso({ icon, tom = 'info', children }: { icon: LucideIcon; tom?: 'info' | 'warning'; children: React.ReactNode }) {
  const cor = tom === 'warning' ? T.status.warning : T.brand.primary
  const bg = tom === 'warning' ? T.status.warningBg : T.brand.primarySoftBg
  return (
    <div style={{ display: 'flex', gap: 10, padding: '11px 13px', borderRadius: 12, background: bg, fontSize: 12.5, lineHeight: 1.5, color: T.text.strong }}>
      <span style={{ color: cor, display: 'inline-grid', paddingTop: 1 }}><Icon icon={icon} size={15} /></span>
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
    </div>
  )
}

// ============================================
// COMPONENTE: Campos de Comissao (reutilizavel)
// ============================================

function CamposComissao({ form, setForm }: any) {
  const tipo = form.comissao_tipo || 'sem'
  const base = form.comissao_base || 'receita'
  return (
    <div style={{ marginTop: 16, padding: 14, borderRadius: 14, border: `1px solid ${T.border.default}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Overline>Comissão</Overline>

      <Field label="Tipo">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
          {[
            { v: 'sem', l: 'Sem comissão' },
            { v: 'percentual', l: 'Percentual %' },
            { v: 'fixo_consulta', l: 'R$ por consulta' },
            { v: 'fixo_mensal', l: 'R$ fixo/mês' },
          ].map(o => {
            const sel = tipo === o.v
            return (
              <button key={o.v} type="button" onClick={() => setForm((f: any) => ({ ...f, comissao_tipo: o.v }))} style={{
                height: 36, borderRadius: 10, fontFamily: 'inherit', cursor: 'pointer',
                border: `1px solid ${sel ? T.brand.primary : T.border.default}`,
                background: sel ? T.brand.primarySoftBg : '#fff',
                color: sel ? T.brand.primary : T.text.muted,
                fontSize: 12.5, fontWeight: 600, transition: 'all .15s',
              }}>{o.l}</button>
            )
          })}
        </div>
      </Field>

      {tipo !== 'sem' && (
        <>
          <Field label={tipo === 'percentual' ? 'Percentual (%)' : 'Valor (R$)'}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.text.tertiary, fontSize: 13 }}>{tipo === 'percentual' ? '%' : 'R$'}</span>
              <Input type="text" value={form.comissao_valor || ''} onChange={e => setForm((f: any) => ({ ...f, comissao_valor: e.target.value.replace(/[^0-9,]/g, '') }))} placeholder="0,00"
                style={{ paddingLeft: 36, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }} />
            </div>
          </Field>

          {tipo === 'percentual' && (
            <Field label="Base de cálculo">
              <SegmentedControl
                stretch
                value={base}
                onChange={(v) => setForm((f: any) => ({ ...f, comissao_base: v }))}
                options={[{ value: 'receita', label: 'Sobre receita' }, { value: 'lucro', label: 'Sobre lucro' }]}
              />
            </Field>
          )}
        </>
      )}
    </div>
  )
}
