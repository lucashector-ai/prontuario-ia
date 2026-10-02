'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ImageIcon, Users, UserRound, CalendarDays, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { tokens } from '@/lib/design-tokens'
import { Avatar, Button, Card, Field, Icon, IconTile, Input, Textarea, Badge } from '@/components/ui'

const T = tokens

function formatarTelefone(v: string) {
  const nums = v.replace(/\D/g, '').slice(0, 11)
  if (nums.length <= 2) return nums
  if (nums.length <= 6) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`
  if (nums.length <= 10) return `(${nums.slice(0, 2)}) ${nums.slice(2, 6)}-${nums.slice(6)}`
  return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7)}`
}

type CampoKey = 'nome' | 'telefone' | 'endereco' | 'site' | 'horarios' | 'descricao'
const CHAVES: CampoKey[] = ['nome', 'telefone', 'endereco', 'site', 'horarios', 'descricao']
const TONS = ['purple', 'pink', 'blue', 'green'] as const

export function VisaoGeral() {
  const router = useRouter()
  const [medico, setMedico] = useState<any>(null)
  const [ehAdmin, setEhAdmin] = useState(false)
  const [clinica, setClinica] = useState<any>(null)
  const [form, setForm] = useState<Record<CampoKey, string>>({
    nome: '', endereco: '', telefone: '', site: '', horarios: '', descricao: '',
  })
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro', texto: string } | null>(null)
  const [uploadandoLogo, setUploadandoLogo] = useState(false)
  const [stats, setStats] = useState({ medicos: 0, pacientes: 0 })
  const [profissionais, setProfissionais] = useState<any[]>([])
  const logoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const ca_ = localStorage.getItem('clinica_admin')
    const m = ca_ || localStorage.getItem('medico')
    if (!m) { router.push('/login'); return }
    const med = JSON.parse(m); setMedico(med)
    setEhAdmin(!!ca_ || med.cargo === 'admin')
    carregar(med.clinica_id || med.id)
  }, [router])

  const carregar = async (clinicaId: string) => {
    const { data } = await supabase.from('clinicas').select('*').eq('id', clinicaId).single()
    if (data) {
      setClinica(data)
      setForm({
        nome: data.nome || '',
        endereco: data.endereco || '',
        telefone: data.telefone || '',
        site: data.site || '',
        horarios: data.horarios || '',
        descricao: data.descricao || '',
      })
      const [{ count: nMedicos }, { count: nPacientes }, { data: pros }] = await Promise.all([
        supabase.from('medicos').select('*', { count: 'exact', head: true }).eq('clinica_id', clinicaId).eq('cargo', 'medico').eq('ativo', true),
        supabase.from('pacientes').select('*', { count: 'exact', head: true }).eq('clinica_id', clinicaId).then(r => r.error ? { count: 0 } : r),
        supabase.from('medicos').select('id, nome, especialidade, crm, foto_url, cargo').eq('clinica_id', clinicaId).eq('ativo', true).neq('cargo', 'recepcionista').order('criado_em'),
      ])
      setStats({ medicos: nMedicos || 0, pacientes: nPacientes || 0 })
      setProfissionais(pros || [])
    }
  }

  // Campos alterados em relação ao que está salvo
  const alterados = CHAVES.filter(k => (clinica?.[k] || '') !== form[k])

  const salvarTudo = async () => {
    if (!clinica || alterados.length === 0) return
    setSalvando(true); setMsg(null)
    const update: any = {}
    alterados.forEach(k => { update[k] = form[k] })
    const { error } = await supabase.from('clinicas').update(update).eq('id', clinica.id)
    if (error) {
      setMsg({ tipo: 'erro', texto: error.message })
    } else {
      setMsg({ tipo: 'ok', texto: 'Alterações salvas' })
      setClinica({ ...clinica, ...update })
      setTimeout(() => setMsg(null), 2500)
    }
    setSalvando(false)
  }

  const descartar = () => {
    if (!clinica) return
    setForm({
      nome: clinica.nome || '', endereco: clinica.endereco || '', telefone: clinica.telefone || '',
      site: clinica.site || '', horarios: clinica.horarios || '', descricao: clinica.descricao || '',
    })
  }

  const uploadLogo = async (file: File) => {
    setUploadandoLogo(true)
    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64 = e.target?.result as string
      await supabase.from('clinicas').update({ logo_url: base64 }).eq('id', clinica.id)
      setClinica((p: any) => ({ ...p, logo_url: base64 }))
      setUploadandoLogo(false)
    }
    reader.readAsDataURL(file)
  }

  const set = (key: CampoKey, valor: string) => {
    setForm(p => ({ ...p, [key]: key === 'telefone' ? formatarTelefone(valor) : valor }))
  }

  if (!medico) return null

  const iniciais = clinica?.nome?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() || ''
  const fmtData = clinica?.criado_em ? new Date(clinica.criado_em).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }) : ''
  const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Toast */}
      {msg && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 200,
          padding: '11px 16px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8,
          background: '#fff', border: `1px solid ${T.border.default}`, boxShadow: T.shadow.lg,
          color: msg.tipo === 'ok' ? T.status.success : T.status.danger, fontSize: 13, fontWeight: 600,
        }}>
          {msg.tipo === 'ok' && <Icon icon={Check} size={15} />}
          {msg.texto}
        </div>
      )}

      {/* Barra de ações */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ flex: 1, minWidth: 200, fontSize: 12.5, color: T.text.quaternary }}>
          As alterações valem para toda a equipe e aparecem nos prontuários e atendimentos.
        </span>
        {alterados.length > 0 && (
          <Button variant="secondary" onClick={descartar} disabled={salvando}>Descartar</Button>
        )}
        <Button icon={Check} onClick={salvarTudo} disabled={salvando || alterados.length === 0}>
          {salvando ? 'Salvando…' : 'Salvar alterações'}
        </Button>
      </div>

      <div className="mc-visao-grid">
        {/* Coluna principal */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <Card padding={18} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', width: 60, height: 60, flexShrink: 0 }}>
                {clinica?.logo_url ? (
                  <img src={clinica.logo_url} alt="" style={{ width: 60, height: 60, borderRadius: 16, objectFit: 'cover', border: `1px solid ${T.border.default}` }} />
                ) : (
                  <span style={{ width: 60, height: 60, borderRadius: 16, background: T.night[800], color: '#fff', display: 'grid', placeItems: 'center', fontSize: 18, fontWeight: 700 }}>
                    {iniciais || 'C'}
                  </span>
                )}
                {uploadandoLogo && (
                  <span style={{ position: 'absolute', inset: 0, borderRadius: 16, background: 'rgba(255,255,255,.8)', display: 'grid', placeItems: 'center', color: T.brand.primary }}>
                    <Loader2 size={20} strokeWidth={1.6} style={{ animation: 'spin .8s linear infinite' }} />
                  </span>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 140, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: T.text.primary }}>{clinica?.nome || 'Sua clínica'}</span>
                <span style={{ fontSize: 12.5, color: T.text.quaternary }}>
                  Plano Starter{fmtData ? ` · desde ${fmtData.replace('.', '')}` : ''}
                </span>
              </div>
              <Button variant="secondary" icon={ImageIcon} onClick={() => logoRef.current?.click()} disabled={uploadandoLogo || !clinica}>
                Alterar logo
              </Button>
              <input ref={logoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
            </div>

            <div style={grid2}>
              <Field label="Nome fantasia">
                <Input value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Ex.: Clínica São Lucas" />
              </Field>
              <Field label="Telefone">
                <Input value={form.telefone} onChange={e => set('telefone', e.target.value)} placeholder="(11) 99999-9999" maxLength={15} />
              </Field>
              <Field label="Site">
                <Input value={form.site} onChange={e => set('site', e.target.value)} placeholder="www.suaclinica.com.br" />
              </Field>
            </div>
            <Field label="Endereço">
              <Input value={form.endereco} onChange={e => set('endereco', e.target.value)} placeholder="Rua das Flores, 123 - Centro, São Paulo/SP" />
            </Field>
          </Card>

          <Card titulo="Horário de funcionamento">
            <Field label="Dias e horários" hint="Aparece para a equipe e nas mensagens aos pacientes.">
              <Input value={form.horarios} onChange={e => set('horarios', e.target.value)} placeholder="Seg-Sex 8h-18h, Sáb 8h-12h" />
            </Field>
          </Card>

          <Card titulo="Sobre a clínica e especialidades">
            <Textarea
              rows={4}
              value={form.descricao}
              onChange={e => set('descricao', e.target.value)}
              placeholder="Clínica especializada em cardiologia e medicina geral..."
            />
          </Card>
        </div>

        {/* Coluna lateral */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <Card titulo="Visão geral">
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {[
                { icon: UserRound, cor: T.data.purple, label: 'Médicos ativos', valor: String(stats.medicos) },
                { icon: Users, cor: T.data.blue, label: 'Pacientes cadastrados', valor: String(stats.pacientes) },
                ...(fmtData ? [{ icon: CalendarDays, cor: T.data.green, label: 'Cadastrada em', valor: fmtData.replace('.', '') }] : []),
              ].map((l, i) => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: i ? `1px solid ${T.border.muted}` : 'none' }}>
                  <IconTile icon={l.icon} color={l.cor} size={32} radius={10} />
                  <span style={{ flex: 1, fontSize: 13, color: T.text.secondary }}>{l.label}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: T.text.primary, fontVariantNumeric: 'tabular-nums' }}>{l.valor}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card
            titulo="Profissionais"
            acao={ehAdmin ? (
              <button onClick={() => router.push('/admin')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, color: T.brand.primary }}>
                Gerenciar equipe
              </button>
            ) : undefined}
          >
            {profissionais.length === 0 ? (
              <span style={{ fontSize: 12.5, color: T.text.quaternary }}>Nenhum profissional ativo.</span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {profissionais.map((p, i) => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar nome={(p.nome || '').replace(/^Dra?\.\s*/, '')} src={p.foto_url} size={34} tom={TONS[i % TONS.length]} />
                    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: T.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nome}</span>
                      <span style={{ fontSize: 12, color: T.text.quaternary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {[p.especialidade, p.crm ? `CRM ${p.crm}` : ''].filter(Boolean).join(' · ') || 'Sem especialidade'}
                      </span>
                    </span>
                    {p.cargo === 'admin' && <Badge tone="accent">Admin</Badge>}
                  </div>
                ))}
              </div>
            )}
          </Card>

        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        .mc-visao-grid { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 16px; align-items: start; }
        @media (max-width: 900px) { .mc-visao-grid { grid-template-columns: minmax(0, 1fr); } }
      `}</style>
    </div>
  )
}
