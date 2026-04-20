'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const PERGUNTAS = [
  { id: 'nome_clinica', pergunta: 'Qual é o nome da sua clínica ou consultório?', placeholder: 'Ex: Clínica São Lucas' },
  { id: 'especialidades', pergunta: 'Quais são as especialidades atendidas?', placeholder: 'Ex: Clínica Geral, Pediatria, Cardiologia' },
  { id: 'horarios', pergunta: 'Quais são os horários de funcionamento?', placeholder: 'Ex: Segunda a sexta das 8h às 18h, sábado das 8h às 12h' },
  { id: 'convenios', pergunta: 'Aceita convênios? Quais?', placeholder: 'Ex: Unimed, Bradesco Saúde, Particular' },
  { id: 'endereco', pergunta: 'Qual é o endereço da clínica?', placeholder: 'Ex: Rua das Flores, 123 - Centro, São Paulo/SP' },
  { id: 'duracao_consulta', pergunta: 'Qual é a duração média de uma consulta?', placeholder: 'Ex: 30 minutos para consultas de retorno, 1 hora para primeira consulta' },
  { id: 'regras_especiais', pergunta: 'Alguma regra especial que a Sofia deve saber? (opcional)', placeholder: 'Ex: Não agendamos consultas no dia, mínimo 24h de antecedência' },
  { id: 'tom', pergunta: 'Como você quer que a Sofia se comunique?', placeholder: 'Ex: Formal e profissional / Amigável e descontraída / Empática e acolhedora' },
]

export default function ConfigurarChat() {
  const router = useRouter()
  const [medico, setMedico] = useState<any>(null)
  const [passo, setPasso] = useState<'intro'|'perguntas'|'gerando'|'revisao'|'pronto'>('intro')
  const [respostas, setRespostas] = useState<Record<string, string>>({})
  const [perguntaAtual, setPerguntaAtual] = useState(0)
  const [inputAtual, setInputAtual] = useState('')
  const [promptGerado, setPromptGerado] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [msgs, setMsgs] = useState<{role:'sofia'|'clinica', texto:string}[]>([])
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const m = localStorage.getItem('medico')
    if (!m) { router.push('/login'); return }
    setMedico(JSON.parse(m))
  }, [router])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs])

  const iniciar = () => {
    setPasso('perguntas')
    setMsgs([{ role: 'sofia', texto: `Olá! Vou te ajudar a configurar a Sofia IA para a sua clínica. Vou fazer algumas perguntas rápidas e no final gero automaticamente as instruções dela. Pode começar?\n\n${PERGUNTAS[0].pergunta}` }])
  }

  const responder = () => {
    if (!inputAtual.trim()) return
    const novasRespostas = { ...respostas, [PERGUNTAS[perguntaAtual].id]: inputAtual.trim() }
    setRespostas(novasRespostas)
    setMsgs(prev => [...prev, { role: 'clinica', texto: inputAtual.trim() }])
    setInputAtual('')

    const proxima = perguntaAtual + 1
    if (proxima < PERGUNTAS.length) {
      setPerguntaAtual(proxima)
      setTimeout(() => {
        setMsgs(prev => [...prev, { role: 'sofia', texto: PERGUNTAS[proxima].pergunta }])
      }, 500)
    } else {
      // Todas respondidas — gera o prompt
      setTimeout(() => {
        setMsgs(prev => [...prev, { role: 'sofia', texto: 'Perfeito! Estou gerando as instruções da Sofia com base nas suas respostas...' }])
        setPasso('gerando')
        gerarPrompt(novasRespostas)
      }, 500)
    }
  }

  const pular = () => {
    const proxima = perguntaAtual + 1
    if (proxima < PERGUNTAS.length) {
      setPerguntaAtual(proxima)
      setMsgs(prev => [...prev,
        { role: 'clinica', texto: '(pulado)' },
        { role: 'sofia', texto: PERGUNTAS[proxima].pergunta }
      ])
    } else {
      setPasso('gerando')
      gerarPrompt(respostas)
    }
    setInputAtual('')
  }

  const gerarPrompt = async (r: Record<string, string>) => {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          messages: [{
            role: 'user',
            content: `Crie um prompt de sistema para uma IA assistente de clínica médica chamada Sofia, baseado nas seguintes informações:

Nome da clínica: ${r.nome_clinica || 'Não informado'}
Especialidades: ${r.especialidades || 'Clínica Geral'}
Horários: ${r.horarios || 'Segunda a sexta das 8h às 18h'}
Convênios: ${r.convenios || 'Não informado'}
Endereço: ${r.endereco || 'Não informado'}
Duração consulta: ${r.duracao_consulta || '30 minutos'}
Regras especiais: ${r.regras_especiais || 'Nenhuma'}
Tom de comunicação: ${r.tom || 'Amigável e profissional'}

O prompt deve:
1. Definir a personalidade da Sofia conforme o tom escolhido
2. Incluir as informações da clínica para responder dúvidas
3. Ter regras claras sobre agendamento (sempre usar horários do sistema, nunca inventar)
4. Incluir regra de botões: [BOTOES: opcao1|opcao2|opcao3]
5. Incluir regra de transferência: [HUMANO] quando pedido
6. Incluir regra de agendamento: [AGENDAR:{"data":"YYYY-MM-DDTHH:mm:00","motivo":"motivo"}]
7. Ser escrito em português, sem markdown, direto ao ponto
8. Máximo 500 palavras

Retorne APENAS o prompt, sem explicações.`
          }]
        })
      })
      const data = await res.json()
      const prompt = data.content?.[0]?.text || ''
      setPromptGerado(prompt)
      setPasso('revisao')
      setMsgs(prev => [...prev, { role: 'sofia', texto: 'Pronto! Gerei as instruções da Sofia. Você pode revisar e editar antes de salvar.' }])
    } catch (e) {
      setPromptGerado(`Voce e Sofia, assistente virtual da ${r.nome_clinica || 'clinica'}. Seja ${r.tom || 'amigavel e profissional'}. Responda SEMPRE em portugues.

INFORMACOES DA CLINICA:
- Especialidades: ${r.especialidades || 'Clinica Geral'}
- Horarios: ${r.horarios || 'Segunda a sexta 8h-18h'}
- Convenios: ${r.convenios || 'Consulte a recepcao'}
- Endereco: ${r.endereco || 'Consulte a recepcao'}

REGRAS:
- Use [BOTOES: opcao1|opcao2|opcao3] sempre que houver opcoes
- Para agendar: mostre horarios disponiveis do sistema, use [AGENDAR:{"data":"YYYY-MM-DDTHH:mm:00","motivo":"consulta"}]
- Para transferir: use [HUMANO]
- NUNCA invente horarios - use apenas os do sistema
- ${r.regras_especiais || 'Seja sempre cordial e profissional'}`)
      setPasso('revisao')
    }
  }

  const salvar = async () => {
    if (!medico || !promptGerado) return
    setSalvando(true)
    await supabase.from('whatsapp_config')
      .update({ sofia_instrucoes: promptGerado, sofia_ativo: true })
      .eq('medico_id', medico.id)
    setSalvando(false)
    setPasso('pronto')
  }

  const s = { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }

  return (
    <div style={{ ...s, minHeight: '100vh', background: '#f0f2f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      
      {passo === 'intro' && (
        <div style={{ background: 'white', borderRadius: 20, padding: 40, maxWidth: 480, width: '100%', textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, background: '#d9fdd3', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <span style={{ fontSize: 32 }}>🤖</span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>Configurar a Sofia IA</h1>
          <p style={{ fontSize: 15, color: '#6b7280', margin: '0 0 32px', lineHeight: 1.6 }}>
            Em menos de 3 minutos, vou configurar a assistente virtual da sua clínica. 
            Ela vai atender seus pacientes automaticamente pelo Chat.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
            {['✅ Responde dúvidas dos pacientes', '📅 Agenda consultas automaticamente', '🔄 Transfere para humano quando necessário', '⭐ Tom de comunicação personalizado'].map(t => (
              <div key={t} style={{ background: '#f9fafb', borderRadius: 10, padding: '10px 16px', fontSize: 14, color: '#374151', textAlign: 'left' }}>{t}</div>
            ))}
          </div>
          <button onClick={iniciar} style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: '#00a884', color: 'white', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>
            Começar configuração →
          </button>
          <button onClick={() => router.back()} style={{ marginTop: 12, background: 'none', border: 'none', color: '#6b7280', fontSize: 13, cursor: 'pointer' }}>Voltar</button>
        </div>
      )}

      {(passo === 'perguntas' || passo === 'gerando') && (
        <div style={{ background: 'white', borderRadius: 20, maxWidth: 580, width: '100%', display: 'flex', flexDirection: 'column', height: '80vh' }}>
          {/* Header */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f2f5', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, background: '#d9fdd3', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🤖</div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 }}>Sofia — Configuração</p>
              <p style={{ fontSize: 12, color: '#00a884', margin: 0 }}>Pergunta {Math.min(perguntaAtual + 1, PERGUNTAS.length)} de {PERGUNTAS.length}</p>
            </div>
            <div style={{ marginLeft: 'auto', flex: 0.4, height: 4, background: '#f0f2f5', borderRadius: 4 }}>
              <div style={{ width: `${((perguntaAtual) / PERGUNTAS.length) * 100}%`, height: '100%', background: '#00a884', borderRadius: 4, transition: 'width 0.3s' }}/>
            </div>
          </div>

          {/* Chat */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {msgs.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'sofia' ? 'flex-start' : 'flex-end' }}>
                <div style={{
                  maxWidth: '80%', padding: '10px 14px', borderRadius: m.role === 'sofia' ? '0 12px 12px 12px' : '12px 12px 0 12px',
                  background: m.role === 'sofia' ? '#f0f2f5' : '#d9fdd3',
                  fontSize: 14, color: '#111827', lineHeight: 1.5, whiteSpace: 'pre-wrap'
                }}>{m.texto}</div>
              </div>
            ))}
            {passo === 'gerando' && (
              <div style={{ display: 'flex', gap: 6, padding: '8px 14px', background: '#f0f2f5', borderRadius: '0 12px 12px 12px', width: 'fit-content' }}>
                {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#aebac1', animation: `pulse 1.2s ${i*0.2}s infinite` }}/>)}
              </div>
            )}
            <div ref={endRef}/>
          </div>

          {/* Input */}
          {passo === 'perguntas' && (
            <div style={{ padding: '12px 20px', borderTop: '1px solid #f0f2f5' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <textarea
                  value={inputAtual}
                  onChange={e => setInputAtual(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); responder() } }}
                  placeholder={PERGUNTAS[perguntaAtual]?.placeholder}
                  rows={2}
                  style={{ flex: 1, padding: '10px 14px', borderRadius: 12, border: '1px solid #d1d7db', outline: 'none', resize: 'none', fontSize: 14, fontFamily: 'inherit', color: '#111827' }}
                />
                <button onClick={responder} disabled={!inputAtual.trim()} style={{ padding: '10px 16px', borderRadius: 12, border: 'none', background: inputAtual.trim() ? '#00a884' : '#e5e7eb', color: inputAtual.trim() ? 'white' : '#9ca3af', cursor: inputAtual.trim() ? 'pointer' : 'default', fontWeight: 600, fontSize: 14 }}>
                  Enviar
                </button>
              </div>
              {PERGUNTAS[perguntaAtual]?.id === 'regras_especiais' && (
                <button onClick={pular} style={{ marginTop: 8, background: 'none', border: 'none', color: '#6b7280', fontSize: 12, cursor: 'pointer' }}>Pular esta pergunta</button>
              )}
            </div>
          )}
        </div>
      )}

      {passo === 'revisao' && (
        <div style={{ background: 'white', borderRadius: 20, maxWidth: 640, width: '100%', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #f0f2f5', background: '#f9fafb' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>✅ Instruções geradas!</h2>
            <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Revise e edite se quiser antes de salvar</p>
          </div>
          <div style={{ padding: 24 }}>
            <textarea
              value={promptGerado}
              onChange={e => setPromptGerado(e.target.value)}
              rows={14}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #d1d7db', outline: 'none', resize: 'vertical', fontSize: 13, fontFamily: 'monospace', color: '#374151', lineHeight: 1.6 }}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={salvar} disabled={salvando} style={{ flex: 1, padding: 14, borderRadius: 12, border: 'none', background: '#00a884', color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
                {salvando ? 'Salvando...' : '✅ Salvar e ativar Sofia'}
              </button>
              <button onClick={() => { setPasso('perguntas'); setPerguntaAtual(0); setMsgs([{ role: 'sofia', texto: PERGUNTAS[0].pergunta }]) }} style={{ padding: '14px 20px', borderRadius: 12, border: '1px solid #d1d7db', background: 'white', color: '#374151', fontSize: 14, cursor: 'pointer' }}>
                Refazer
              </button>
            </div>
          </div>
        </div>
      )}

      {passo === 'pronto' && (
        <div style={{ background: 'white', borderRadius: 20, padding: 40, maxWidth: 440, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>Sofia configurada!</h1>
          <p style={{ fontSize: 15, color: '#6b7280', margin: '0 0 32px', lineHeight: 1.6 }}>
            Sua assistente já está pronta para atender os pacientes com as informações da sua clínica.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={() => router.push('/whatsapp-app')} style={{ padding: 14, borderRadius: 12, border: 'none', background: '#00a884', color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
              Abrir Chat →
            </button>
            <button onClick={() => router.push('/dashboard')} style={{ padding: 14, borderRadius: 12, border: '1px solid #d1d7db', background: 'white', color: '#374151', fontSize: 15, cursor: 'pointer' }}>
              Ir para o Dashboard
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:0.4;transform:scale(0.8)} 50%{opacity:1;transform:scale(1)} }`}</style>
    </div>
  )
}
