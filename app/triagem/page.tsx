'use client'
/**
 * Triagem — a tela da enfermagem: chama da fila da triagem (TV), registra queixa e
 * sinais vitais, vê a sugestão de cor (com o motivo) e manda para a fila do médico,
 * que passa a ordenar pela gravidade. ?demo=1 roda com dados de exemplo.
 */
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Activity, AlertTriangle, BellRing, HeartPulse, Megaphone, Send, Settings2, UserX, Users } from 'lucide-react'
import { tokens as T } from '@/lib/design-tokens'
import { usePageHeader } from '@/components/shell/header-context'
import { Button, Card, EmptyState, Field, Input, Select, Textarea } from '@/components/ui'
import { notificar } from '@/components/ui/dialogos'
import { useFila } from '@/lib/atendimento/useFila'
import { abrirFicha, avisarFila, carregarConfig, carregarFicha, chamarTriagem, ehDemo, mudar, registrarTriagem, type Config, type Ficha } from '@/lib/atendimento/cliente'
import { RISCOS, imc, minutosDesde, ordenarFila, sugerirRisco, type Atendimento, type Risco } from '@/lib/atendimento/comum'
import { SeloPrioridade, SenhaChip, esperaTexto, idade } from '@/components/atendimento/partes'

const CHAVE_SALA = 'c360-triagem-sala'
const CHAVE_ATUAL = 'c360-triagem-atual'

export default function TriagemPage() {
  const router = useRouter()
  usePageHeader('Triagem', 'Sinais vitais e classificação de risco antes do médico')
  const { fila, carregando, erro, recarregar } = useFila()
  const [config, setConfig] = useState<Config | null>(null)
  const [salaId, setSalaId] = useState('')
  const [atualId, setAtualId] = useState<string | null>(null)
  const [chamando, setChamando] = useState(false)
  const [agora, setAgora] = useState(() => Date.now())
  const demo = ehDemo()

  useEffect(() => {
    carregarConfig().then(c => {
      setConfig(c)
      let s = ''
      try { s = localStorage.getItem(CHAVE_SALA) || '' } catch {}
      setSalaId(c.consultorios.some(x => x.id === s && x.ativo) ? s : '')
    }).catch(() => setConfig({ setores: [], consultorios: [] }))
    try { setAtualId(sessionStorage.getItem(CHAVE_ATUAL)) } catch {}
    const t = setInterval(() => setAgora(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])

  const escolherSala = (id: string) => { setSalaId(id); try { localStorage.setItem(CHAVE_SALA, id) } catch {} }
  const definirAtual = (id: string | null) => { setAtualId(id); try { id ? sessionStorage.setItem(CHAVE_ATUAL, id) : sessionStorage.removeItem(CHAVE_ATUAL) } catch {} }

  const todos = fila?.atendimentos || []
  const espera = useMemo(() => ordenarFila(todos.filter(a => a.status === 'aguardando_triagem')), [todos])
  const emTriagem = todos.filter(a => a.status === 'em_triagem')
  const atual = emTriagem.find(a => a.id === atualId) || null
  const outros = emTriagem.filter(a => a.id !== atualId)
  const triadosHoje = todos.filter(a => a.risco).length
  const sala = config?.consultorios.find(c => c.id === salaId)
  const triagemLigada = !!config?.setores.some(s => s.usa_triagem)

  const chamar = async (atendimentoId?: string, rechamar = false) => {
    if (!salaId) { notificar('Escolha a sala de triagem primeiro', 'erro'); return }
    setChamando(true)
    try {
      const r = await chamarTriagem({ consultorio_id: salaId, atendimento_id: atendimentoId, rechamar })
      if (r.fila_vazia || !r.atendimento) notificar('Ninguém aguardando triagem', 'info')
      else { definirAtual(r.atendimento.id); notificar(`Chamando ${r.atendimento.senha} para a triagem`) }
      avisarFila(); recarregar()
    } catch (e: any) { notificar(e.message, 'erro') } finally { setChamando(false) }
  }

  if (erro?.faltaMigration) return <div className="c360-pagina"><Card><EmptyState icon={Settings2} titulo="Falta ativar o módulo de atendimento" descricao="Rode as migrations 0018 e 0020 no Supabase." /></Card></div>

  return (
    <div className="c360-pagina" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {config && !triagemLigada && !demo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: T.status.infoBg, color: T.status.infoStrong, fontSize: 13 }}>
          <HeartPulse size={18} />
          <span style={{ flex: 1 }}>A triagem está desligada: hoje o check-in manda o paciente direto para o médico. Ligue na sala de espera em Minha clínica → Recepção e painel.</span>
          <Button size="sm" variant="secondary" onClick={() => router.push('/minha-clinica?aba=atendimento')}>Ligar triagem</Button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {config && config.consultorios.length > 0 && (
          <Select value={salaId} onChange={e => escolherSala(e.target.value)} style={{ width: 'auto', minWidth: 200 }} aria-label="Sala de triagem">
            <option value="">Escolha a sala de triagem</option>
            {config.consultorios.filter(c => c.ativo).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </Select>
        )}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 13, color: T.text.secondary }}><b style={{ color: T.text.primary }}>{espera.length}</b> aguardando · <b style={{ color: T.text.primary }}>{triadosHoje}</b> triados hoje</span>
        <Button icon={Megaphone} onClick={() => chamar()} disabled={chamando || !espera.length || !!atual || !salaId}>
          {chamando ? 'Chamando…' : espera.length ? `Chamar próximo · ${espera[0].senha}` : 'Fila vazia'}
        </Button>
      </div>

      <div className="c360-triagem-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 300px) minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
        <style dangerouslySetInnerHTML={{ __html: '@media (max-width: 1023px) { .c360-triagem-grid { grid-template-columns: minmax(0, 1fr) !important; } .c360-triagem-fila { order: 2 } }' }} />

        <div className="c360-triagem-fila" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card padding={0}>
            <div style={cab}><Users size={15} /> Aguardando triagem · {espera.length}</div>
            {carregando && !fila ? <div style={{ padding: 14 }}><span className="c360-skel" style={{ display: 'block', height: 14, borderRadius: 6 }} /></div>
              : espera.length === 0 ? <div style={vazio}>Ninguém aguardando.</div>
              : espera.map((a, i) => (
                <div key={a.id} style={{ ...linha, borderTop: i === 0 ? 'none' : linha.borderTop }}>
                  <SenhaChip senha={a.senha} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 650, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.paciente?.nome?.split(' ').slice(0, 2).join(' ')}</div>
                    <div style={{ fontSize: 11.5, color: T.text.secondary, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>espera {esperaTexto(minutosDesde(a.chegada_em, agora))} <SeloPrioridade prioridade={a.prioridade} /></div>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => chamar(a.id)} disabled={chamando || !!atual || !salaId}>Chamar</Button>
                </div>
              ))}
          </Card>
          {outros.length > 0 && (
            <Card padding={0}>
              <div style={cab}><Activity size={15} /> Em triagem em outras salas</div>
              {outros.map(a => (
                <div key={a.id} style={linha}>
                  <SenhaChip senha={a.senha} /><span style={{ flex: 1, fontSize: 12.5 }}>{a.paciente?.nome?.split(' ')[0]}</span>
                  <Button size="sm" variant="ghost" onClick={() => definirAtual(a.id)}>Assumir</Button>
                </div>
              ))}
            </Card>
          )}
        </div>

        <div style={{ minWidth: 0 }}>
          {atual ? (
            <FormTriagem key={atual.id} at={atual} chamando={chamando}
              onRechamar={() => chamar(atual.id, true)}
              onAusente={async () => { try { await mudar(atual.id, 'ausente'); definirAtual(null); avisarFila(); recarregar() } catch (e: any) { notificar(e.message, 'erro') } }}
              onPronto={() => { definirAtual(null); avisarFila(); recarregar() }} />
          ) : (
            <Card>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '28px 10px', gap: 12 }}>
                <span style={{ width: 56, height: 56, borderRadius: 18, display: 'grid', placeItems: 'center', background: T.brand.primarySubtle, color: T.brand.primary }}><HeartPulse size={26} /></span>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{salaId ? `${sala?.nome} livre` : 'Escolha a sala de triagem'}</div>
                <div style={{ fontSize: 13.5, color: T.text.secondary, maxWidth: 420 }}>
                  {!salaId ? 'A TV chama o paciente para esta sala.' : espera.length ? `${espera.length} aguardando. O próximo é ${espera[0].paciente?.nome?.split(' ')[0] || espera[0].senha}.` : 'Quando a recepção confirmar a chegada, o paciente aparece aqui.'}
                </div>
                {salaId && <Button size="lg" icon={Megaphone} onClick={() => chamar()} disabled={chamando || !espera.length}>{espera.length ? `Chamar próximo · ${espera[0].senha}` : 'Fila vazia'}</Button>}
              </div>
            </Card>
          )}
        </div>
      </div>
      {erro && !erro.faltaMigration && <div style={{ fontSize: 13, color: T.status.danger }}>{erro.msg}</div>}
    </div>
  )
}

const cab: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', fontSize: 13.5, fontWeight: 700, borderBottom: `1px solid ${T.border.muted}` }
const linha: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderTop: `1px solid ${T.border.muted}` }
const vazio: React.CSSProperties = { padding: 14, fontSize: 13, color: T.text.tertiary }

type Campos = Record<'pa_sistolica' | 'pa_diastolica' | 'fc' | 'fr' | 'temperatura' | 'spo2' | 'glicemia' | 'peso' | 'altura', string>
const VAZIO: Campos = { pa_sistolica: '', pa_diastolica: '', fc: '', fr: '', temperatura: '', spo2: '', glicemia: '', peso: '', altura: '' }

function FormTriagem({ at, chamando, onRechamar, onAusente, onPronto }: { at: Atendimento; chamando: boolean; onRechamar: () => void; onAusente: () => void; onPronto: () => void }) {
  const [ficha, setFicha] = useState<Ficha | null>(null)
  const [v, setV] = useState<Campos>(VAZIO)
  const [dor, setDor] = useState<number | null>(null)
  const [queixa, setQueixa] = useState('')
  const [obs, setObs] = useState('')
  const [risco, setRisco] = useState<Risco | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => { if (at.paciente_id) carregarFicha(at.paciente_id, at.agendamento_id).then(setFicha).catch(() => {}) }, [at.paciente_id, at.agendamento_id])

  const num = (x: string) => (x.trim() === '' ? null : Number(x.replace(',', '.')))
  const sugestao = useMemo(() => sugerirRisco({
    pa_sistolica: num(v.pa_sistolica), pa_diastolica: num(v.pa_diastolica), fc: num(v.fc), fr: num(v.fr),
    temperatura: num(v.temperatura), spo2: num(v.spo2), glicemia: num(v.glicemia), dor,
  }), [v, dor])
  const escolhido = risco || sugestao.risco
  const indiceImc = imc(num(v.peso), num(v.altura))
  const anos = idade(at.paciente?.data_nascimento)
  const set = (k: keyof Campos) => (e: React.ChangeEvent<HTMLInputElement>) => setV(o => ({ ...o, [k]: e.target.value.replace(/[^\d.,]/g, '').slice(0, 5) }))

  const salvar = async () => {
    setSalvando(true)
    try {
      const dados: Record<string, any> = { risco: escolhido, queixa: queixa.trim() || null, observacoes: obs.trim() || null, dor }
      for (const k of Object.keys(v) as (keyof Campos)[]) dados[k] = num(v[k])
      await registrarTriagem(at.id, dados)
      notificar(`Triagem salva · ${at.paciente?.nome?.split(' ')[0] || at.senha} foi para a fila do médico`)
      onPronto()
    } catch (e: any) { notificar(e.message, 'erro'); setSalvando(false) }
  }

  const corSug = RISCOS.find(r => r.valor === sugestao.risco)!
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card padding={0}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '16px 20px' }}>
          <span className="mono" style={{ fontSize: 28, fontWeight: 800, color: T.brand.primary }}>{at.senha}</span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <button onClick={() => abrirFicha(at.paciente_id)} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 18, fontWeight: 700, color: T.text.primary }}>{at.paciente?.nome}</button>
            <div style={{ fontSize: 13, color: T.text.secondary, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {[anos !== null ? `${anos} anos` : null, at.medico?.nome, ficha?.agendamento?.motivo].filter(Boolean).join(' · ')}<SeloPrioridade prioridade={at.prioridade} />
            </div>
            {ficha?.paciente.alergias && <div style={{ marginTop: 6, fontSize: 12.5, fontWeight: 650, color: T.status.danger, display: 'flex', gap: 6, alignItems: 'center' }}><AlertTriangle size={14} /> Alergia: {ficha.paciente.alergias}</div>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost" icon={UserX} onClick={onAusente} style={{ color: T.status.danger }}>Não compareceu</Button>
            <Button variant="secondary" icon={BellRing} onClick={onRechamar} disabled={chamando}>Chamar de novo</Button>
          </div>
        </div>
      </Card>

      <Card titulo="Queixa e sinais vitais">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Queixa principal"><Textarea value={queixa} onChange={e => setQueixa(e.target.value)} rows={2} placeholder="Ex.: dor no peito há 2 horas, piora ao esforço" autoFocus /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
            <Field label="Pressão (mmHg)">
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Input value={v.pa_sistolica} onChange={set('pa_sistolica')} placeholder="120" inputMode="numeric" style={{ textAlign: 'center' }} />
                <span style={{ color: T.text.tertiary }}>x</span>
                <Input value={v.pa_diastolica} onChange={set('pa_diastolica')} placeholder="80" inputMode="numeric" style={{ textAlign: 'center' }} />
              </div>
            </Field>
            <Field label="Freq. cardíaca (bpm)"><Input value={v.fc} onChange={set('fc')} placeholder="78" inputMode="numeric" /></Field>
            <Field label="Freq. respiratória"><Input value={v.fr} onChange={set('fr')} placeholder="16" inputMode="numeric" /></Field>
            <Field label="Temperatura (°C)"><Input value={v.temperatura} onChange={set('temperatura')} placeholder="36,5" inputMode="decimal" /></Field>
            <Field label="Saturação (%)"><Input value={v.spo2} onChange={set('spo2')} placeholder="98" inputMode="numeric" /></Field>
            <Field label="Glicemia (mg/dL)"><Input value={v.glicemia} onChange={set('glicemia')} placeholder="opcional" inputMode="numeric" /></Field>
            <Field label="Peso (kg)"><Input value={v.peso} onChange={set('peso')} placeholder="70" inputMode="decimal" /></Field>
            <Field label={`Altura (cm)${indiceImc ? ` · IMC ${indiceImc}` : ''}`}><Input value={v.altura} onChange={set('altura')} placeholder="170" inputMode="numeric" /></Field>
          </div>
          <Field label="Dor (0 a 10)">
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {Array.from({ length: 11 }, (_, n) => (
                <button key={n} onClick={() => setDor(dor === n ? null : n)} style={{
                  width: 34, height: 34, borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
                  border: `1px solid ${dor === n ? 'transparent' : T.border.default}`,
                  background: dor === n ? (n >= 8 ? '#F27A1A' : n >= 5 ? '#E3B008' : T.brand.primary) : '#fff', color: dor === n ? '#fff' : T.text.secondary,
                }}>{n}</button>
              ))}
            </div>
          </Field>
        </div>
      </Card>

      <Card titulo="Classificação de risco">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 12, marginBottom: 12, background: `color-mix(in srgb, ${corSug.cor} 10%, #fff)` }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: corSug.cor, marginTop: 4, flexShrink: 0 }} />
          <div style={{ fontSize: 13 }}>
            <b>Sugestão: {corSug.label}</b> ({corSug.prazo})
            <div style={{ color: T.text.secondary, marginTop: 2 }}>{sugestao.motivos.length ? sugestao.motivos.join(' · ') : 'Sinais vitais dentro do esperado. Suba a cor se a queixa pedir.'}</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
          {RISCOS.map(r => {
            const ativo = escolhido === r.valor
            return (
              <button key={r.valor} onClick={() => setRisco(r.valor)} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3, padding: '10px 12px', borderRadius: 12, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                border: `2px solid ${ativo ? r.cor : T.border.default}`, background: ativo ? `color-mix(in srgb, ${r.cor} 12%, #fff)` : '#fff',
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 700, color: T.text.primary }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: r.cor }} />{r.label}</span>
                <span style={{ fontSize: 11.5, color: T.text.secondary }}>{r.descricao} · {r.prazo}</span>
              </button>
            )
          })}
        </div>
        <Field label="Observações (opcional)" style={{ marginTop: 14 }}><Textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} placeholder="Ex.: veio acompanhado da filha; trouxe exames" /></Field>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
          <Button size="lg" icon={Send} onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : `Enviar para o médico · ${RISCOS.find(r => r.valor === escolhido)!.label}`}</Button>
        </div>
      </Card>
    </div>
  )
}
