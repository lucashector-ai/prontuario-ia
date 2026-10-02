'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { tokens } from '@/lib/design-tokens'
import { usePageHeader } from '@/components/shell/header-context'
import type { LucideIcon } from 'lucide-react'
import { Check, Download, Eye, Lock, PenLine, ShieldCheck, Trash2, TriangleAlert, Upload } from 'lucide-react'
import { Button, Card, Field, IconTile, Input } from '@/components/ui'
import { notificar } from '@/components/ui/dialogos'

const T = tokens

export default function LGPD() {
  usePageHeader('Privacidade e LGPD', 'Gerencie seus dados conforme a Lei Geral de Proteção de Dados')
  const router = useRouter()
  const [medico, setMedico] = useState<any>(null)
  const [exportando, setExportando] = useState(false)
  const [deletando, setDeletando] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState('')

  useEffect(() => {
    const ca_ = localStorage.getItem('clinica_admin')
    const m = ca_ || localStorage.getItem('medico')
    if (!m) { router.push('/login'); return }
    setMedico(JSON.parse(m))
  }, [router])

  const mostrarMsg = (tipo: 'ok'|'erro', texto: string) => {
    notificar(texto, tipo)
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

  const direitos: { titulo: string; desc: string; icon: LucideIcon }[] = [
    { titulo: 'Acesso', desc: 'Veja todos os dados armazenados sobre você', icon: Eye },
    { titulo: 'Portabilidade', desc: 'Exporte em formato legível (JSON)', icon: Upload },
    { titulo: 'Correção', desc: 'Ajuste dados incorretos no seu perfil', icon: PenLine },
    { titulo: 'Eliminação', desc: 'Delete sua conta permanentemente', icon: Trash2 },
  ]

  const consentimentos = [
    { label: 'Armazenamento de prontuários médicos', desc: 'Essencial para o funcionamento da plataforma', obrig: true },
    { label: 'Transcrição de consultas com IA', desc: 'Áudios processados pela Deepgram e Anthropic', obrig: true },
    { label: 'Envio de mensagens pelo WhatsApp', desc: 'Integração com Meta WhatsApp Business API', obrig: false },
    { label: 'Análise de métricas e relatórios', desc: 'Dados agregados para o dashboard', obrig: false },
  ]

  const emailConfere = confirmDelete === medico?.email

  return (
    <div style={{ padding: 20 }}>
      <style>{`
        .lgpd-grid { display: grid; grid-template-columns: 1fr; gap: 16px; align-items: start; }
        @media (min-width: 960px) { .lgpd-grid { grid-template-columns: 360px minmax(0, 1fr); } }
      `}</style>

      <div className="lgpd-grid">
        {/* COLUNA ESQUERDA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Seus direitos */}
          <Card padding={20}>
            <CabecalhoCard icon={ShieldCheck} titulo="Seus direitos (LGPD)" sub="O que a lei te garante" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {direitos.map(d => (
                <div key={d.titulo} style={itemLista}>
                  <IconTile icon={d.icon} size={30} radius={9} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: T.text.primary, margin: '0 0 2px' }}>{d.titulo}</p>
                    <p style={{ fontSize: 12, color: T.text.secondary, margin: 0, lineHeight: 1.4 }}>{d.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Consentimentos */}
          <Card padding={20}>
            <CabecalhoCard icon={Lock} titulo="Consentimentos ativos" sub="O que você autorizou ao se cadastrar" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {consentimentos.map(item => (
                <div key={item.label} style={itemLista}>
                  <span style={{ width: 18, height: 18, borderRadius: 5, background: T.brand.primary, color: T.text.inverse, display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 1 }}>
                    <Check size={11} strokeWidth={3} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 12.5, fontWeight: 600, color: T.text.primary, margin: '0 0 2px' }}>{item.label}</p>
                    <p style={{ fontSize: 12, color: T.text.secondary, margin: 0, lineHeight: 1.4 }}>
                      {item.desc}
                      {item.obrig && <span style={{ color: T.status.danger, fontWeight: 600 }}> · Obrigatório</span>}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* COLUNA DIREITA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>

          {/* Exportar */}
          <Card padding={20}>
            <CabecalhoCard icon={Upload} titulo="Exportar meus dados" sub="Baixe tudo em formato JSON" />
            <p style={{ fontSize: 13, color: T.text.secondary, margin: '0 0 16px', lineHeight: 1.6 }}>
              O arquivo inclui todos os seus pacientes, consultas e agendamentos. Ideal pra migrar de plataforma ou fazer backup pessoal.
            </p>
            <Button icon={Download} onClick={exportarDados} disabled={exportando}>
              {exportando ? 'Exportando…' : 'Exportar tudo em JSON'}
            </Button>
          </Card>

          {/* Zona de perigo */}
          <Card padding={20} style={{ borderColor: T.status.dangerLight }}>
            <CabecalhoCard icon={Trash2} cor={T.status.danger} titulo="Zona de perigo" sub="Ação irreversível" />

            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: T.status.dangerBg, borderRadius: T.radius.input, padding: '12px 14px', marginBottom: 16 }}>
              <TriangleAlert size={16} strokeWidth={1.6} color={T.status.danger} style={{ flexShrink: 0, marginTop: 1 }} />
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

            <Button
              variant="dangerSolid"
              icon={Trash2}
              onClick={deletarConta}
              disabled={deletando || !emailConfere}
              style={{ marginTop: 12 }}
            >
              {deletando ? 'Deletando…' : 'Deletar minha conta permanentemente'}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  )
}

const itemLista: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 12px',
  background: T.bg.cardSubtle, border: `1px solid ${T.border.muted}`, borderRadius: T.radius.input,
}

function CabecalhoCard({ icon, titulo, sub, cor = T.brand.primary }: { icon: LucideIcon; titulo: string; sub: string; cor?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
      <IconTile icon={icon} color={cor} size={36} radius={11} />
      <div style={{ minWidth: 0 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: cor === T.brand.primary ? T.text.primary : cor, margin: 0, letterSpacing: '-.01em' }}>{titulo}</h3>
        <p style={{ fontSize: 12.5, color: T.text.quaternary, margin: '2px 0 0' }}>{sub}</p>
      </div>
    </div>
  )
}
