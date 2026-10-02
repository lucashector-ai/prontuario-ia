'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, CalendarCheck, Clock, FileText, FileX, Mail, Phone, Sparkles } from 'lucide-react'
import { tokens } from '@/lib/design-tokens'
import { Button, Card, EmptyState, Icon, IconTile } from '@/components/ui'
import { usePageHeader } from '@/components/shell/header-context'

const T = tokens
import { supabase } from '@/lib/supabase'
import type { Campo } from '@/lib/formularios/types'

type DadosResposta = {
  envio: {
    id: string
    nome_paciente: string
    telefone: string | null
    email: string | null
    enviado_em: string
    preenchido_em: string | null
    paciente_id: string | null
    medico_id: string | null
  }
  template: {
    id: string
    nome: string
    descricao: string | null
    campos: Campo[]
  }
  resposta: {
    id: string
    respostas: Record<string, any>
    resumo_ia: string | null
    preenchido_em: string
  } | null
}

export default function VerRespostaPage() {
  const router = useRouter()
  const params = useParams()
  const envioId = params.envioId as string

  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [dados, setDados] = useState<DadosResposta | null>(null)
  const [resumoGerando, setResumoGerando] = useState(false)

  useEffect(() => {
    async function carregar() {
      try {
        const rawMedico = localStorage.getItem('medico')
        const rawAdmin = localStorage.getItem('clinica_admin')
        if (!rawMedico && !rawAdmin) {
          router.replace('/login')
          return
        }

        const { data: envio, error: errEnvio } = await supabase
          .from('formularios_envios')
          .select(`
            id, nome_paciente, telefone, email, enviado_em, preenchido_em,
            paciente_id, medico_id, status, resposta_id, template_id
          `)
          .eq('id', envioId)
          .single()

        if (errEnvio || !envio) {
          setErro('Envio não encontrado')
          return
        }

        const { data: template } = await supabase
          .from('formularios_templates')
          .select('id, nome, descricao, campos')
          .eq('id', envio.template_id)
          .single()

        let resposta = null
        if (envio.resposta_id) {
          const { data: r } = await supabase
            .from('formularios_respostas')
            .select('id, respostas, resumo_ia, preenchido_em')
            .eq('id', envio.resposta_id)
            .single()
          resposta = r

          // Se ainda não tem resumo IA, aguarda 2s e tenta de novo (resumo é gerado em background)
          if (r && !r.resumo_ia) {
            setResumoGerando(true)
            setTimeout(async () => {
              const { data: r2 } = await supabase
                .from('formularios_respostas')
                .select('id, respostas, resumo_ia, preenchido_em')
                .eq('id', envio.resposta_id)
                .single()
              if (r2?.resumo_ia) {
                setDados(prev => prev ? { ...prev, resposta: r2 as any } : null)
              }
              setResumoGerando(false)
            }, 3000)
          }
        }

        setDados({
          envio: envio as any,
          template: template as any,
          resposta: resposta as any,
        })
      } catch (e: any) {
        setErro(e.message || 'Erro ao carregar')
      } finally {
        setLoading(false)
      }
    }
    carregar()
  }, [envioId, router])

  usePageHeader(
    dados ? dados.envio.nome_paciente : 'Resposta de formulário',
    dados ? 'Resposta de formulário · ' + (dados.template?.nome || '') : undefined,
  )

  if (loading) {
    return (
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 880 }}>
        <div className="c360-skel" style={{ height: 20, width: 140, borderRadius: 8 }} />
        <div className="c360-skel" style={{ height: 120, borderRadius: 16 }} />
        <div className="c360-skel" style={{ height: 280, borderRadius: 16 }} />
      </div>
    )
  }

  if (erro || !dados) {
    return (
      <div style={{ padding: 20 }}>
        <EmptyState
          icon={FileX}
          titulo={erro || 'Não encontrado'}
          acao={<Button icon={ArrowLeft} variant="secondary" onClick={() => router.push('/formularios')}>Voltar</Button>}
        />
      </div>
    )
  }

  const { envio, template, resposta } = dados
  const preenchido = !!resposta

  const meta: Array<[typeof FileText, string]> = [[FileText, template.nome]]
  if (envio.telefone) meta.push([Phone, envio.telefone])
  if (envio.email) meta.push([Mail, envio.email])
  if (resposta) meta.push([CalendarCheck, 'Preenchido em ' + formatarData(resposta.preenchido_em)])

  return (
    <div style={{ padding: 20 }}>
      <div style={{ maxWidth: 880, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Voltar + metadados */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Button variant="secondary" size="sm" icon={ArrowLeft} onClick={() => router.push('/formularios')}>Formulários</Button>
          <span style={{ flex: 1 }} />
          {meta.map(([I, txt], i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: T.text.secondary }}>
              <Icon icon={I} size={14} color={T.text.tertiary} />{txt}
            </span>
          ))}
        </div>

        {!preenchido ? (
          <Card padding={0}>
            <EmptyState
              icon={Clock}
              titulo="Paciente ainda não respondeu"
              descricao={'Enviado em ' + formatarData(envio.enviado_em) + '.'}
            />
          </Card>
        ) : (
          <>
            {/* Resumo IA */}
            <div style={{
              background: T.brand.primarySoftBg, border: `1px solid ${T.brand.primaryAccentLight}`,
              borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <IconTile icon={Sparkles} size={30} radius={9} />
                <span style={{ fontSize: 14, fontWeight: 700, color: T.text.primary }}>Resumo gerado por IA</span>
              </div>
              {resposta?.resumo_ia ? (
                <div style={{ fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: T.text.strong }}>
                  {resposta.resumo_ia}
                </div>
              ) : resumoGerando ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ fontSize: 13, color: T.text.quaternary }}>Gerando resumo... pode levar uns segundos.</span>
                  <div className="c360-skel" style={{ height: 12, width: '90%', borderRadius: 6 }} />
                  <div className="c360-skel" style={{ height: 12, width: '70%', borderRadius: 6 }} />
                </div>
              ) : (
                <div style={{ fontSize: 13, color: T.text.quaternary }}>
                  Resumo ainda não disponível. Pode estar sendo gerado em segundo plano.
                </div>
              )}
            </div>

            {/* Respostas detalhadas */}
            <Card padding={0} style={{ overflow: 'hidden' }}>
              <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <h3 style={{ margin: 0, flex: 1, fontSize: 15, fontWeight: 700, letterSpacing: '-.01em', color: T.text.primary }}>
                  Respostas completas
                </h3>
                <span style={{ fontSize: 12.5, color: T.text.quaternary }}>{template.campos.length} perguntas</span>
              </div>
              <div>
                {template.campos.map((campo, idx) => {
                  const val = resposta?.respostas[campo.id]
                  return (
                    <div key={campo.id} style={{ padding: '14px 18px', borderTop: '1px solid ' + T.border.muted, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontSize: 12.5, color: T.text.secondary }}>
                        <span className="mono" style={{ color: T.text.tertiary, marginRight: 6 }}>{String(idx + 1).padStart(2, '0')}</span>
                        {campo.label}
                      </span>
                      <span style={{ fontSize: 14, color: T.text.primary, fontWeight: 600, whiteSpace: 'pre-wrap' }}>
                        {formatarValor(val)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}

function formatarValor(v: any): string {
  if (v === undefined || v === null || v === '') {
    return '—'
  }
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não'
  if (Array.isArray(v)) return v.join(', ')
  return String(v)
}

function formatarData(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}
