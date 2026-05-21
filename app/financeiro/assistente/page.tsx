'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/useAuth'
import { tokens } from '@/lib/design-tokens'
import { obterDashboard } from '@/lib/financeiro/dashboard'
import { obterMargens } from '@/lib/financeiro/margem'

const brl = (v: number) => 'R$ ' + (Number(v) || 0).toFixed(2).replace('.', ',')

type Msg = { role: 'user' | 'assistant'; content: string }

const SUGESTOES = [
  'Como está a saúde financeira da clínica?',
  'Quais procedimentos têm a menor margem?',
  'Qual a previsão de caixa para as próximas semanas?',
  'Onde posso reduzir custos?',
]

export default function AssistenteFinanceiroPage() {
  const router = useRouter()
  const { usuario } = useAuth()
  const clinicaId = usuario?.clinica_id || null

  const [contexto, setContexto] = useState('')
  const [mensagens, setMensagens] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [enviando, setEnviando] = useState(false)
  const fimRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!clinicaId) return
    Promise.all([obterDashboard(clinicaId), obterMargens(clinicaId)]).then(([dash, marg]) => {
      const d = dash.data
      const m = marg.data || []
      if (!d) return
      setContexto(`
Faturamento do mês: ${brl(d.faturamentoMes)} (mês anterior: ${brl(d.faturamentoMesAnterior)})
Recebido no mês: ${brl(d.recebidoMes)}
Lucro do mês: ${brl(d.lucroMes)} (mês anterior: ${brl(d.lucroMesAnterior)})
A receber em aberto: ${brl(d.aReceber)} | Inadimplência: ${brl(d.inadimplencia)}
A pagar em aberto: ${brl(d.aPagar)} | Despesas vencidas: ${brl(d.painelPagar.emAtraso)}
Ticket médio: ${brl(d.ticketMedio)} | Comandas fechadas no mês: ${d.comandasFechadasMes}
Receita por categoria: ${d.categorias.map((c) => `${c.tipo}=${brl(c.valor)}`).join(', ') || 'sem dados'}
Projeção 45 dias: entradas previstas ${brl(d.projecao.entradasPrevistas)}, saídas previstas ${brl(d.projecao.saidasPrevistas)}
Margem por procedimento: ${m.length ? m.map((p) => `${p.nome} (preço ${brl(p.valor)}, custo ${brl(p.custoTotal)}, margem ${p.margemPct.toFixed(0)}%)`).join('; ') : 'sem custos cadastrados'}
`.trim())
    })
  }, [clinicaId])

  useEffect(() => { fimRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [mensagens, enviando])

  async function enviar(texto: string) {
    const pergunta = texto.trim()
    if (!pergunta || enviando) return
    const novas: Msg[] = [...mensagens, { role: 'user', content: pergunta }]
    setMensagens(novas)
    setInput('')
    setEnviando(true)
    try {
      const r = await fetch('/api/financeiro/assistente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pergunta, historico: mensagens, contexto }),
      })
      const d = await r.json()
      setMensagens([...novas, {
        role: 'assistant',
        content: d.resposta || d.error || 'Não consegui responder agora.',
      }])
    } catch {
      setMensagens([...novas, { role: 'assistant', content: 'Erro de conexão. Tente novamente.' }])
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: tokens.text.primary, margin: 0 }}>Assistente financeiro</h1>
      <p style={{ fontSize: 13, color: tokens.text.secondary, margin: '4px 0 16px' }}>
        Pergunte sobre receita, custos, margem e previsão de caixa da clínica.
      </p>

      <div style={{
        flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
        background: tokens.bg.card, border: `1px solid ${tokens.border.subtle}`, borderRadius: 16, overflow: 'hidden',
      }}>
        {/* Mensagens */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, minHeight: 0 }}>
          {mensagens.length === 0 ? (
            <div style={{ maxWidth: 520 }}>
              <p style={{ fontSize: 13, color: tokens.text.secondary, margin: '0 0 12px' }}>
                Comece com uma pergunta:
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {SUGESTOES.map((s) => (
                  <button key={s} onClick={() => enviar(s)} style={{
                    padding: '8px 13px', borderRadius: 100, fontSize: 12.5, cursor: 'pointer',
                    border: `1px solid ${tokens.border.default}`, background: tokens.bg.card, color: tokens.text.strong,
                  }}>{s}</button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {mensagens.map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '78%', padding: '10px 14px', borderRadius: 14, fontSize: 13.5, lineHeight: 1.55,
                    whiteSpace: 'pre-wrap',
                    background: m.role === 'user' ? tokens.brand.primary : tokens.bg.cardSubtle,
                    color: m.role === 'user' ? '#fff' : tokens.text.primary,
                  }}>{m.content}</div>
                </div>
              ))}
              {enviando && (
                <div style={{ fontSize: 12.5, color: tokens.text.tertiary }}>Analisando...</div>
              )}
            </div>
          )}
          <div ref={fimRef} />
        </div>

        {/* Input */}
        <div style={{ borderTop: `1px solid ${tokens.border.subtle}`, padding: 14, display: 'flex', gap: 10 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') enviar(input) }}
            placeholder="Pergunte algo sobre o financeiro..."
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 10, border: `1px solid ${tokens.border.default}`,
              fontSize: 13, outline: 'none', background: tokens.bg.card, color: tokens.text.primary,
            }}
          />
          <button onClick={() => enviar(input)} disabled={enviando || !input.trim()} style={{
            padding: '10px 20px', borderRadius: 10, border: 'none',
            background: tokens.brand.primary, color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: enviando || !input.trim() ? 'not-allowed' : 'pointer', opacity: enviando || !input.trim() ? 0.6 : 1,
          }}>Enviar</button>
        </div>
      </div>

      <button onClick={() => router.push('/financeiro')} style={{
        marginTop: 12, padding: '6px 11px', borderRadius: 8, border: 'none', alignSelf: 'flex-start',
        background: 'transparent', color: tokens.brand.primary, fontSize: 12, fontWeight: 600, cursor: 'pointer',
      }}>← Voltar ao financeiro</button>
    </div>
  )
}
