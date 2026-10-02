'use client'

/**
 * Card "Antes da consulta" — resumo objetivo do paciente gerado pela IA
 * a partir de /api/resumo-pre-consulta.
 *
 *   <ResumoPreConsulta pacienteId={p.id} medicoId={medico.id} />
 *   <ResumoPreConsulta pacienteId="x" medicoId="y" demo />   // dados de exemplo, sem rede
 */
import React, { useCallback, useEffect, useState } from 'react'
import { Sparkles, RefreshCw, TriangleAlert, MessageCircleQuestion, Circle, CircleAlert } from 'lucide-react'
import { tokens } from '@/lib/design-tokens'
import { Icon, Overline, Badge } from '@/components/ui'
import type { RespostaResumoPreConsulta } from '@/app/api/resumo-pre-consulta/tipos'

const T = tokens

type Props = {
  pacienteId: string | null | undefined
  medicoId: string | null | undefined
  /** Mostra dados de exemplo (não chama a API) */
  demo?: boolean
  style?: React.CSSProperties
}

const DEMO: RespostaResumoPreConsulta = {
  fonte: 'ia',
  gerado_em: new Date().toISOString(),
  paciente: { nome: 'Maria Aparecida Souza', idade: 58, sexo: 'F', convenio: 'Unimed' },
  resumo: {
    destaque: 'Retorno de hipertensão com PA ainda acima da meta e queixa nova de tosse seca desde o ajuste do enalapril.',
    pontos: [
      'Há 32 dias: enalapril aumentado para 20 mg 12/12h (PA 152/94).',
      'Pré-consulta: relata tosse seca há 3 semanas, pior à noite.',
      'Hemograma e perfil lipídico solicitados — resultado ainda não anexado.',
      'Retorno de 30 dias pendente desde a última consulta.',
      'WhatsApp (ontem): perguntou se pode tomar o remédio em jejum.',
    ],
    alertas: [
      'Alergia: dipirona',
      'Tosse seca pode ser efeito adverso do IECA (enalapril).',
      'Diabetes tipo 2 associado — atenção à função renal com IECA.',
    ],
    perguntas_sugeridas: [
      'A tosse começou depois do aumento do enalapril?',
      'Tem medido a pressão em casa? Quais valores?',
      'Trouxe o resultado do perfil lipídico?',
    ],
  },
}

export function ResumoPreConsulta({ pacienteId, medicoId, demo, style }: Props) {
  const [dados, setDados] = useState<RespostaResumoPreConsulta | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState(false)

  const carregar = useCallback(async (forcar = false) => {
    if (demo) {
      setCarregando(true); setErro(false)
      setTimeout(() => { setDados({ ...DEMO, gerado_em: new Date().toISOString() }); setCarregando(false) }, forcar ? 700 : 400)
      return
    }
    if (!pacienteId) return
    setCarregando(true); setErro(false)
    try {
      const r = await fetch('/api/resumo-pre-consulta', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paciente_id: pacienteId, medico_id: medicoId, forcar }),
      })
      const j = await r.json()
      if (!r.ok || !j?.resumo) throw new Error(j?.error || 'falha')
      setDados(j)
    } catch {
      setErro(true)
    } finally {
      setCarregando(false)
    }
  }, [pacienteId, medicoId, demo])

  useEffect(() => { setDados(null); carregar(false) }, [carregar])

  if (!pacienteId && !demo) return null

  const r = dados?.resumo
  const hora = dados?.gerado_em ? new Date(dados.gerado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''

  return (
    <div style={{
      background: T.bg.card, border: `1px solid ${T.border.default}`, borderRadius: 16,
      padding: 18, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0, ...style,
    }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: 'grid', placeItems: 'center',
          background: T.brand.primarySubtle, color: T.brand.primary, border: `1px solid ${T.brand.primaryAccentLight}`,
        }}><Icon icon={Sparkles} size={15} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, letterSpacing: '-.01em', color: T.text.primary }}>Antes da consulta</h3>
          <span style={{ fontSize: 11.5, color: T.text.quaternary }}>
            {carregando ? 'Lendo o histórico…' : dados?.fonte === 'dados' ? 'Resumo dos dados (IA indisponível)' : dados?.fonte === 'primeira' ? 'Sem histórico' : hora ? 'Resumo da IA · ' + hora : 'Resumo da IA'}
          </span>
        </div>
        <button type="button" onClick={() => carregar(true)} disabled={carregando} title="Atualizar resumo"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 10px', borderRadius: 9,
            border: `1px solid ${T.border.default}`, background: '#fff', color: T.text.muted, fontSize: 12, fontWeight: 600,
            fontFamily: 'inherit', cursor: carregando ? 'default' : 'pointer', opacity: carregando ? 0.6 : 1, flexShrink: 0,
          }}>
          <RefreshCw size={13} strokeWidth={1.6} style={{ animation: carregando ? 'spin .8s linear infinite' : 'none' }} />
          Atualizar
        </button>
      </div>

      {/* Carregando */}
      {carregando && !r && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="c360-skel" style={{ height: 14, width: '92%', borderRadius: 6 }} />
          <div className="c360-skel" style={{ height: 14, width: '70%', borderRadius: 6 }} />
          <div style={{ height: 4 }} />
          {[80, 64, 72].map((w, i) => <div key={i} className="c360-skel" style={{ height: 11, width: w + '%', borderRadius: 5 }} />)}
          <div className="c360-skel" style={{ height: 38, width: '100%', borderRadius: 10, marginTop: 4 }} />
        </div>
      )}

      {/* Erro (discreto) */}
      {erro && !carregando && !r && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: T.text.secondary }}>
          <Icon icon={CircleAlert} size={14} color={T.text.tertiary} />
          <span style={{ flex: 1 }}>Não deu para montar o resumo agora.</span>
          <button type="button" onClick={() => carregar(true)}
            style={{ border: 'none', background: 'none', padding: 0, color: T.brand.primary, fontWeight: 600, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>
            Tentar de novo
          </button>
        </div>
      )}

      {r && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, opacity: carregando ? 0.55 : 1, transition: 'opacity .2s' }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, lineHeight: 1.5, color: T.text.primary, letterSpacing: '-.005em' }}>
            {r.destaque}
          </p>

          {r.alertas.length > 0 && (
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px', borderRadius: 12,
              background: T.status.dangerBg, border: `1px solid ${T.status.dangerLight}`,
            }}>
              {r.alertas.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, lineHeight: 1.45, color: T.status.dangerText }}>
                  <TriangleAlert size={13} strokeWidth={1.8} style={{ flexShrink: 0, marginTop: 2, color: T.status.danger }} />
                  <span>{a}</span>
                </div>
              ))}
            </div>
          )}

          {r.pontos.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Overline>Pontos principais</Overline>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
                {r.pontos.map((p, i) => (
                  <li key={i} style={{ display: 'flex', gap: 9, fontSize: 13, lineHeight: 1.5, color: T.text.strong }}>
                    <Circle size={6} fill={T.brand.primary} strokeWidth={0} style={{ flexShrink: 0, marginTop: 7 }} />
                    <span style={{ minWidth: 0 }}>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {r.perguntas_sugeridas.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Overline>Perguntas sugeridas</Overline>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {r.perguntas_sugeridas.map((q, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 10px', borderRadius: 10,
                    background: T.brand.primarySoftBg, border: `1px solid ${T.brand.primaryAccentLight}`,
                    fontSize: 12.5, lineHeight: 1.45, color: T.text.strong,
                  }}>
                    <MessageCircleQuestion size={14} strokeWidth={1.6} style={{ flexShrink: 0, marginTop: 1, color: T.brand.primary }} />
                    <span>{q}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {demo && <div><Badge tone="accent">Dados de exemplo</Badge></div>}
        </div>
      )}
    </div>
  )
}

export default ResumoPreConsulta
