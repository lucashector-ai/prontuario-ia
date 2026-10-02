'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { EspecialidadeSelect } from '@/components/EspecialidadeSelect'
import { Camera, KeyRound, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react'
import { tokens } from '@/lib/design-tokens'
import { Input, Textarea, Button, Card, Field, Avatar, Badge, Icon, IconTile } from '@/components/ui'
import { usePageHeader } from '@/components/shell/header-context'

const T = tokens

export default function PerfilPage() {
  const router = useRouter()
  const [medico, setMedico] = useState<any>(null)
  const [form, setForm] = useState({ nome: '', especialidade: '', crm: '', telefone: '', clinica: '', bio: '' })
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<{tipo: 'ok'|'erro', texto: string} | null>(null)
  const [senhaForm, setSenhaForm] = useState({ atual: '', nova: '', confirma: '' })
  const [salvandoSenha, setSalvandoSenha] = useState(false)
  const [uploadandoFoto, setUploadandoFoto] = useState(false)
  const fotoInputRef = useRef<HTMLInputElement>(null)
  const [senhaAberta, setSenhaAberta] = useState(false)
  usePageHeader('Meu perfil', 'Seus dados e preferências')

  useEffect(() => {
    const ca = localStorage.getItem('clinica_admin')
    const m = localStorage.getItem('medico')
    if (!ca && !m) { router.push('/login'); return }
    const med = ca ? JSON.parse(ca) : JSON.parse(m!)
    setMedico(med)
    setForm({
      nome: med.nome || '',
      especialidade: med.especialidade || '',
      crm: med.crm || '',
      telefone: med.telefone || '',
      clinica: med.clinica || '',
      bio: med.bio || '',
    })
  }, [router])

  const mostrarMsg = (tipo: 'ok'|'erro', texto: string) => {
    setMsg({ tipo, texto })
    setTimeout(() => setMsg(null), 3500)
  }

  const uploadFoto = async (file: File) => {
    if (!file || !medico) return
    setUploadandoFoto(true)
    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64 = e.target?.result as string
      await supabase.from('medicos').update({ foto_url: base64 }).eq('id', medico.id)
      const novoMedico = { ...medico, foto_url: base64 }
      localStorage.setItem('medico', JSON.stringify(novoMedico))
      setMedico(novoMedico)
      setUploadandoFoto(false)
      mostrarMsg('ok', 'Foto atualizada')
    }
    reader.readAsDataURL(file)
  }

  async function salvarPerfil() {
    setSalvando(true)
    try {
      const { error } = await supabase.from('medicos').update({
        nome: form.nome,
        especialidade: form.especialidade,
        crm: form.crm,
        telefone: form.telefone,
        clinica: form.clinica,
        bio: form.bio,
      }).eq('id', medico.id)
      if (error) throw error
      const novoMedico = { ...medico, ...form }
      localStorage.setItem('medico', JSON.stringify(novoMedico))
      setMedico(novoMedico)
      mostrarMsg('ok', 'Perfil atualizado')
    } catch (e: any) {
      mostrarMsg('erro', e.message || 'Erro ao salvar')
    }
    setSalvando(false)
  }

  async function salvarSenha() {
    if (!senhaForm.nova || senhaForm.nova.length < 6) return mostrarMsg('erro', 'Senha deve ter ao menos 6 caracteres')
    if (senhaForm.nova !== senhaForm.confirma) return mostrarMsg('erro', 'Senhas não coincidem')
    setSalvandoSenha(true)
    try {
      const res = await fetch('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medico_id: medico.id, senha_atual: senhaForm.atual, senha_nova: senhaForm.nova })
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)
      mostrarMsg('ok', 'Senha alterada com sucesso')
      setSenhaForm({ atual: '', nova: '', confirma: '' })
      setSenhaAberta(false)
    } catch (e: any) {
      mostrarMsg('erro', e.message || 'Erro ao alterar senha')
    }
    setSalvandoSenha(false)
  }

  if (!medico) return null

  const ehAdmin = !!localStorage.getItem('clinica_admin')

  return (
    <div style={{ padding: 20 }}>
      <style>{`
        .c360-perfil-grid { display: grid; grid-template-columns: 280px minmax(0, 1fr); gap: 20px; align-items: start; }
        @media (max-width: 900px) { .c360-perfil-grid { grid-template-columns: minmax(0, 1fr); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Toast de mensagem */}
      {msg && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 300,
          padding: '12px 16px', borderRadius: T.radius.xl, background: '#fff',
          boxShadow: T.shadow.lg, border: `1px solid ${T.border.default}`,
          display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 600,
          color: msg.tipo === 'ok' ? T.status.success : T.status.danger,
        }}>
          <Icon icon={msg.tipo === 'ok' ? CheckCircle2 : AlertCircle} size={16} />
          <span style={{ color: T.text.primary }}>{msg.texto}</span>
        </div>
      )}

      <div className="c360-perfil-grid">
        {/* COLUNA ESQUERDA — identidade */}
        <Card padding="24px 18px" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
          <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => fotoInputRef.current?.click()} title="Alterar foto">
            <Avatar nome={medico.nome} src={medico.foto_url} size={88} />
            {uploadandoFoto && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.8)', borderRadius: '50%', display: 'grid', placeItems: 'center' }}>
                <div style={{ width: 22, height: 22, border: `2.5px solid ${T.brand.primary}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              </div>
            )}
          </div>
          <input ref={fotoInputRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => e.target.files?.[0] && uploadFoto(e.target.files[0])} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, maxWidth: '100%' }}>
            <span style={{ fontSize: 17, fontWeight: 700, color: T.text.primary }}>{medico.nome || 'Sem nome'}</span>
            <span style={{ fontSize: 12.5, color: T.text.quaternary }}>
              {[medico.especialidade, medico.crm ? 'CRM ' + medico.crm : null].filter(Boolean).join(' · ') || medico.email}
            </span>
            {medico.email && (medico.especialidade || medico.crm) && (
              <span style={{ fontSize: 12, color: T.text.tertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{medico.email}</span>
            )}
          </div>
          <Badge tone="accent">{ehAdmin ? 'Administrador' : 'Médico'}</Badge>
          <Button variant="secondary" icon={Camera} disabled={uploadandoFoto} onClick={() => fotoInputRef.current?.click()} style={{ marginTop: 4 }}>
            {uploadandoFoto ? 'Enviando...' : 'Alterar foto'}
          </Button>
        </Card>

        {/* COLUNA DIREITA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <Card
            titulo="Dados profissionais"
            acao={
              <Button onClick={salvarPerfil} disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </Button>
            }
          >
            <p style={{ fontSize: 12.5, color: T.text.quaternary, margin: '-6px 0 16px' }}>
              Seus dados aparecem nos prontuários e para seus pacientes.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <Field label="Nome completo">
                <Input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                  placeholder="Dr. João Silva" />
              </Field>
              <Field label="Especialidade">
                <EspecialidadeSelect value={form.especialidade} onChange={v => setForm(p => ({ ...p, especialidade: v }))} />
              </Field>
              <Field label="CRM">
                <Input value={form.crm} onChange={e => setForm(p => ({ ...p, crm: e.target.value }))}
                  placeholder="Ex.: 12345-SP" />
              </Field>
              <Field label="Telefone">
                <Input value={form.telefone} onChange={e => setForm(p => ({ ...p, telefone: e.target.value }))}
                  placeholder="(11) 99999-9999" />
              </Field>
              <Field label="Nome da clínica" style={{ gridColumn: '1 / -1' }}>
                <Input value={form.clinica} onChange={e => setForm(p => ({ ...p, clinica: e.target.value }))}
                  placeholder="Ex.: Clínica São Paulo" />
              </Field>
              <Field label="Bio / apresentação" style={{ gridColumn: '1 / -1' }}>
                <Textarea value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))}
                  placeholder="Breve descrição sobre você, sua abordagem clínica e experiência..."
                  rows={4} />
              </Field>
            </div>
          </Card>

          <Card titulo="Segurança">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', paddingTop: 2 }}>
              <IconTile icon={KeyRound} size={34} radius={10} />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: T.text.primary }}>Senha</span>
                <span style={{ fontSize: 12.5, color: T.text.quaternary }}>Atualize sua senha periodicamente.</span>
              </div>
              <Button variant="secondary" onClick={() => setSenhaAberta(v => !v)}>
                {senhaAberta ? 'Cancelar' : 'Alterar'}
              </Button>
            </div>

            {senhaAberta && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.border.muted}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                  <Field label="Senha atual">
                    <Input type="password" value={senhaForm.atual}
                      onChange={e => setSenhaForm(p => ({ ...p, atual: e.target.value }))}
                      placeholder="••••••••" />
                  </Field>
                  <Field label="Nova senha">
                    <Input type="password" value={senhaForm.nova}
                      onChange={e => setSenhaForm(p => ({ ...p, nova: e.target.value }))}
                      placeholder="Mínimo 6 caracteres" />
                  </Field>
                  <Field label="Confirmar nova senha">
                    <Input type="password" value={senhaForm.confirma}
                      onChange={e => setSenhaForm(p => ({ ...p, confirma: e.target.value }))}
                      placeholder="••••••••" />
                  </Field>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button onClick={salvarSenha} disabled={salvandoSenha}>
                    {salvandoSenha ? 'Alterando...' : 'Alterar senha'}
                  </Button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.border.muted}` }}>
              <IconTile icon={ShieldCheck} size={34} radius={10} color={T.status.success} />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: T.text.primary }}>Privacidade e dados (LGPD)</span>
                <span style={{ fontSize: 12.5, color: T.text.quaternary }}>Exporte seus dados ou solicite a exclusão da conta.</span>
              </div>
              <Button variant="secondary" onClick={() => router.push('/lgpd')}>Abrir</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
