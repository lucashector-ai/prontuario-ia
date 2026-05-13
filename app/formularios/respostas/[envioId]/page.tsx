'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { tokens } from '@/lib/design-tokens'
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

  if (loading) {
    return (
      <div style={{ padding: 64, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 28, height: 28, border: '2.5px solid ' + tokens.brand.primaryLight, borderTopColor: tokens.brand.primary, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{'@keyframes spin { to { transform: rotate(360deg) } }'}</style>
      </div>
    )
  }

  if (erro || !dados) {
    return (
      <div style={{ padding: 32, maxWidth: 640, margin: '64px auto', textAlign: 'center' }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: tokens.text.primary, marginBottom: 8 }}>
          {erro || 'Não encontrado'}
        </h2>
        <button
          type="button"
          onClick={() => router.push('/formularios')}
          style={{
            marginTop: 16, padding: '10px 18px', background: tokens.brand.primary,
            color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Voltar
        </button>
      </div>
    )
  }

  const { envio, template, resposta } = dados
  const preenchido = !!resposta

  return (
    <div style={{ padding: '32px 32px 64px' }}>
      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        {/* Breadcrumb */}
        <button
          type="button"
          onClick={() => router.push('/formularios')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none',
            color: tokens.text.secondary, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', padding: 0, marginBottom: 16,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          Formulários
        </button>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: tokens.brand.primary, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>
            Resposta de formulário
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: tokens.text.primary, letterSpacing: '-0.02em', margin: '0 0 12px' }}>
            {envio.nome_paciente}
          </h1>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: tokens.text.secondary }}>
            <span><strong style={{ color: tokens.text.primary }}>Formulário:</strong> {template.nome}</span>
            {envio.telefone && <span><strong style={{ color: tokens.text.primary }}>Tel:</strong> {envio.telefone}</span>}
            {envio.email && <span><strong style={{ color: tokens.text.primary }}>Email:</strong> {envio.email}</span>}
            {resposta && <span><strong style={{ color: tokens.text.primary }}>Preenchido em:</strong> {formatarData(resposta.preenchido_em)}</span>}
          </div>
        </div>

        {!preenchido ? (
          <div style={{
            background: '#fff', borderRadius: 16, padding: 48, textAlign: 'center',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}>
            <div style={{
              width: 56, height: 56, margin: '0 auto 16px',
              background: '#FEF3C7', color: '#D97706',
              borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: tokens.text.primary, margin: '0 0 8px' }}>
              Paciente ainda não respondeu
            </h2>
            <p style={{ fontSize: 14, color: tokens.text.secondary, margin: 0 }}>
              Enviado em {formatarData(envio.enviado_em)}.
            </p>
          </div>
        ) : (
          <>
            {/* Resumo IA */}
            <div style={{
              background: 'linear-gradient(135deg, ' + tokens.brand.primary + ' 0%, ' + (tokens.brand.primaryDark || tokens.brand.primary) + ' 100%)',
              color: '#fff',
              borderRadius: 16,
              padding: 24,
              marginBottom: 24,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: 'rgba(255,255,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.95 }}>
                  Resumo gerado por IA
                </div>
              </div>
              {resposta?.resumo_ia ? (
                <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {resposta.resumo_ia}
                </div>
              ) : resumoGerando ? (
                <div style={{ fontSize: 14, opacity: 0.85, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Gerando resumo... pode levar uns segundos.
                </div>
              ) : (
                <div style={{ fontSize: 14, opacity: 0.85 }}>
                  Resumo ainda não disponível. Pode estar sendo gerado em segundo plano.
                </div>
              )}
            </div>

            {/* Respostas detalhadas */}
            <div style={{
              background: '#fff', borderRadius: 16,
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              overflow: 'hidden',
            }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid ' + tokens.border.subtle }}>
                <h2 style={{ fontSize: 17, fontWeight: 600, color: tokens.text.primary, margin: 0 }}>
                  Respostas completas
                </h2>
                <p style={{ fontSize: 13, color: tokens.text.secondary, margin: '4px 0 0' }}>
                  {template.campos.length} perguntas respondidas
                </p>
              </div>
              <div>
                {template.campos.map((campo, idx) => {
                  const val = resposta?.respostas[campo.id]
                  const ultima = idx === template.campos.length - 1
                  return (
                    <div key={campo.id} style={{
                      padding: '16px 24px',
                      borderBottom: ultima ? 'none' : '1px solid ' + tokens.border.subtle,
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: tokens.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                        Pergunta {idx + 1}
                      </div>
                      <div style={{ fontSize: 14, color: tokens.text.secondary, marginBottom: 8 }}>
                        {campo.label}
                      </div>
                      <div style={{ fontSize: 15, color: tokens.text.primary, fontWeight: 500 }}>
                        {formatarValor(val)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
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
