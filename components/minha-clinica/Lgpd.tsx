'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { LucideIcon } from 'lucide-react'
import { Eye, Upload, Pencil, Trash2, ShieldCheck, Lock, Download, Check, TriangleAlert } from 'lucide-react'
import { tokens } from '@/lib/design-tokens'
import { Badge, Button, Card, Field, Icon, IconTile, Input } from '@/components/ui'

const T = tokens

export function Lgpd() {
  const router = useRouter()
  const [medico, setMedico] = useState<any>(null)
  const [exportando, setExportando] = useState(false)
  const [deletando, setDeletando] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState('')
  const [msg, setMsg] = useState<{tipo:'ok'|'erro', texto:string}|null>(null)

  useEffect(() => {
    const ca_ = localStorage.getItem('clinica_admin')
    const m = ca_ || localStorage.getItem('medico')
    if (!m) { router.push('/login'); return }
    setMedico(JSON.parse(m))
  }, [router])

  const mostrarMsg = (tipo: 'ok'|'erro', texto: string) => {
    setMsg({ tipo, texto })
    setTimeout(() => setMsg(null), 3500)
  }

  const exportarDados = async () => {
    setExportando(true)
    try {
      const [{ data: pacientes }, { data: consultas }, { data: agendamentos }] = await Promise.all([
        supabase.from('pacientes').select('*').eq('medico_id', medico.id),
        supabase.from('consultas').select('*').eq('medico_id', medico.id),
        supabase.from('agendamentos').select('*').eq('medico_id', medico.id),
      ])

      const exportData = {
        exportado_em: new Date().toISOString(),
        medico: { id: medico.id, nome: medico.nome, email: medico.email },
        resumo: {
          total_pacientes: pacientes?.length || 0,
          total_consultas: consultas?.length || 0,
          total_agendamentos: agendamentos?.length || 0,
        },
        pacientes: pacientes || [],
        consultas: (consultas || []).map((c: any) => ({
          id: c.id,
          data: c.criado_em,
          paciente_id: c.paciente_id,
          diagnostico: c.diagnostico_principal,
          cids: c.cids,
        })),
        agendamentos: agendamentos || [],
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `media-dados-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      mostrarMsg('ok', 'Dados exportados com sucesso!')
    } catch (e: any) {
      mostrarMsg('erro', e.message)
    }
    setExportando(false)
  }

  const deletarConta = async () => {
    if (confirmDelete !== medico?.email) {
      mostrarMsg('erro', 'Email não confere')
      return
    }
    setDeletando(true)
    try {
      await supabase.from('consultas').delete().eq('medico_id', medico.id)
      await supabase.from('agendamentos').delete().eq('medico_id', medico.id)
      await supabase.from('pacientes').delete().eq('medico_id', medico.id)
      await supabase.from('medicos').delete().eq('id', medico.id)
      localStorage.clear()
      router.push('/cadastro')
    } catch (e: any) {
      mostrarMsg('erro', e.message)
      setDeletando(false)
    }
  }

  if (!medico) return null

  const direitos: Array<{ titulo: string; desc: string; icon: LucideIcon; cor: string }> = [
    { titulo: 'Acesso', desc: 'Veja todos os dados armazenados sobre você', icon: Eye, cor: T.data.purple },
    { titulo: 'Portabilidade', desc: 'Exporte em formato legível (JSON)', icon: Upload, cor: T.data.blue },
    { titulo: 'Correção', desc: 'Ajuste dados incorretos no seu perfil', icon: Pencil, cor: T.data.green },
    { titulo: 'Eliminação', desc: 'Delete sua conta permanentemente', icon: Trash2, cor: T.data.pink },
  ]

  const consentimentos = [
    { label: 'Armazenamento de prontuários médicos', desc: 'Essencial para o funcionamento da plataforma', obrig: true },
    { label: 'Transcrição de consultas com IA', desc: 'Áudios processados pela Deepgram e Anthropic', obrig: true },
    { label: 'Envio de mensagens pelo WhatsApp', desc: 'Integração com Meta WhatsApp Business API', obrig: false },
    { label: 'Análise de métricas e relatórios', desc: 'Dados agregados para o dashboard', obrig: false },
  ]

  const confere = confirmDelete === medico?.email

  const cabecalho = (icon: LucideIcon, titulo: string, sub: string, cor: string = T.brand.primary, corTitulo: string = T.text.primary) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
      <IconTile icon={icon} color={cor} size={34} radius={10} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-.01em', color: corTitulo }}>{titulo}</h3>
        <p style={{ margin: '2px 0 0', fontSize: 12.5, color: T.text.quaternary }}>{sub}</p>
      </div>
    </div>
  )

  return (
    <div>
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

      <div className="mc-lgpd-grid">
        {/* Coluna esquerda */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <Card>
            {cabecalho(ShieldCheck, 'Seus direitos (LGPD)', 'O que a lei te garante')}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              {direitos.map(d => (
                <div key={d.titulo} style={{ display: 'flex', gap: 10, padding: '12px', border: `1px solid ${T.border.default}`, borderRadius: 12 }}>
                  <span style={{ color: d.cor, display: 'inline-grid', paddingTop: 1 }}><Icon icon={d.icon} size={16} /></span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: T.text.primary, margin: '0 0 2px' }}>{d.titulo}</p>
                    <p style={{ fontSize: 12, color: T.text.quaternary, margin: 0, lineHeight: 1.4 }}>{d.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            {cabecalho(Lock, 'Consentimentos ativos', 'O que você autorizou ao se cadastrar')}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {consentimentos.map((item, i) => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderTop: i ? `1px solid ${T.border.muted}` : 'none' }}>
                  <span style={{ width: 18, height: 18, borderRadius: 6, background: T.brand.primary, color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 1 }}>
                    <Check size={11} strokeWidth={3} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: T.text.primary, margin: '0 0 2px' }}>{item.label}</p>
                    <p style={{ fontSize: 12, color: T.text.quaternary, margin: 0, lineHeight: 1.4 }}>{item.desc}</p>
                  </div>
                  {item.obrig && <Badge tone="neutral">Obrigatório</Badge>}
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Coluna direita */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <Card>
            {cabecalho(Download, 'Exportar meus dados', 'Baixe tudo em formato JSON', T.data.blue)}
            <p style={{ fontSize: 13, color: T.text.secondary, margin: '0 0 16px', lineHeight: 1.55 }}>
              O arquivo inclui todos os seus pacientes, consultas e agendamentos. Ideal para migrar de plataforma ou fazer backup pessoal.
            </p>
            <Button icon={Download} onClick={exportarDados} disabled={exportando}>
              {exportando ? 'Exportando…' : 'Exportar tudo em JSON'}
            </Button>
          </Card>

          <Card style={{ borderColor: T.status.dangerLight }}>
            {cabecalho(Trash2, 'Zona de perigo', 'Ação irreversível', T.status.danger, T.status.danger)}
            <div style={{ display: 'flex', gap: 10, background: T.status.dangerBg, borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
              <span style={{ color: T.status.danger, display: 'inline-grid', paddingTop: 1 }}><Icon icon={TriangleAlert} size={15} /></span>
              <p style={{ fontSize: 12.5, color: T.status.dangerDark, margin: 0, lineHeight: 1.5 }}>
                Ao deletar sua conta, <strong>todos os dados</strong> serão apagados permanentemente: pacientes, consultas, agendamentos e configurações. Não há como recuperar.
              </p>
            </div>

            <Field label={`Digite ${medico.email} para confirmar`}>
              <Input
                value={confirmDelete}
                onChange={e => setConfirmDelete(e.target.value)}
                placeholder="seu@email.com"
              />
            </Field>

            <div style={{ marginTop: 12 }}>
              <Button
                variant={confere ? 'dangerSolid' : 'danger'}
                icon={Trash2}
                onClick={deletarConta}
                disabled={deletando || !confere}
              >
                {deletando ? 'Deletando…' : 'Deletar minha conta permanentemente'}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .mc-lgpd-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; align-items: start; }
        @media (max-width: 900px) { .mc-lgpd-grid { grid-template-columns: minmax(0, 1fr); } }
      ` }} />
    </div>
  )
}
