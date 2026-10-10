'use client'
/**
 * Totem de autoatendimento (tablet ou tela de toque na entrada), aberto pelo link do
 * totem da sala de espera. Sem login.
 *   Tenho consulta → CPF → "é você?" → prioridade → senha
 *   Não tenho horário → prioridade → senha de balcão (a recepção chama)
 * Volta sozinho ao início quando fica parado. ?imprimir=1 imprime a senha
 * automaticamente (Chrome em modo quiosque com impressora térmica).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, CalendarCheck, Delete, HelpCircle, Ticket, UserRound } from 'lucide-react'
import { totemBuscar, totemCheckin, totemDados, totemSenha, type AgendamentoTotem } from '@/lib/atendimento/cliente'
import type { Prioridade } from '@/lib/atendimento/comum'

const COR = '#5B3FD0'
const FUNDO = 'linear-gradient(160deg, #F6F3FF 0%, #FFFFFF 55%)'
type Tela = 'inicio' | 'cpf' | 'escolher' | 'prioridade' | 'senha' | 'erro'
type Fluxo = 'consulta' | 'balcao'

const OPCOES_PRIORIDADE: { valor: Prioridade; titulo: string; detalhe: string }[] = [
  { valor: 'normal', titulo: 'Atendimento normal', detalhe: '' },
  { valor: 'prioritario', titulo: 'Prioritário', detalhe: '60 anos ou mais, gestante, lactante, pessoa com deficiência, autismo, criança de colo, mobilidade reduzida' },
  { valor: 'prioritario_80', titulo: '80 anos ou mais', detalhe: 'Prioridade especial' },
]

export default function TotemPage({ params }: { params: { token: string } }) {
  const [info, setInfo] = useState<{ setor: string; clinica: string | null; logo_url: string | null } | null>(null)
  const [indisponivel, setIndisponivel] = useState(false)
  const [tela, setTela] = useState<Tela>('inicio')
  const [fluxo, setFluxo] = useState<Fluxo>('consulta')
  const [cpf, setCpf] = useState('')
  const [ags, setAgs] = useState<AgendamentoTotem[]>([])
  const [escolhido, setEscolhido] = useState<AgendamentoTotem | null>(null)
  const [resultado, setResultado] = useState<{ senha: string; titulo: string; detalhe: string; prioritario: boolean } | null>(null)
  const [msg, setMsg] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const ultimoToque = useRef(Date.now())

  useEffect(() => { totemDados(params.token).then(setInfo).catch(() => setIndisponivel(true)) }, [params.token])

  const reiniciar = useCallback(() => {
    setTela('inicio'); setCpf(''); setAgs([]); setEscolhido(null); setResultado(null); setMsg(''); setOcupado(false)
  }, [])

  // Volta ao início: 15s na tela da senha, 60s parado em qualquer outra
  useEffect(() => {
    const toque = () => { ultimoToque.current = Date.now() }
    window.addEventListener('pointerdown', toque)
    const t = setInterval(() => {
      const parado = Date.now() - ultimoToque.current
      if ((tela === 'senha' && parado > 15000) || (tela !== 'inicio' && parado > 60000)) reiniciar()
    }, 1000)
    return () => { window.removeEventListener('pointerdown', toque); clearInterval(t) }
  }, [tela, reiniciar])

  const buscar = async () => {
    setOcupado(true); setMsg('')
    try {
      const r = await totemBuscar(params.token, cpf)
      const pendentes = r.agendamentos
      if (!pendentes.length) { setMsg('Não encontramos consulta para hoje com este CPF.'); setTela('erro') }
      else if (pendentes.length === 1 && pendentes[0].senha) mostrarSenha(pendentes[0].senha, 'Sua chegada já estava confirmada', `${pendentes[0].hora}${pendentes[0].medico ? ` · ${pendentes[0].medico}` : ''}`, false)
      else { setAgs(pendentes); setTela('escolher') }
    } catch (e: any) { setMsg(e.message || 'Não foi possível agora.'); setTela('erro') }
    finally { setOcupado(false) }
  }

  const confirmar = async (prioridade: Prioridade) => {
    setOcupado(true)
    try {
      if (fluxo === 'consulta' && escolhido) {
        const r = await totemCheckin(params.token, cpf, escolhido.id, prioridade)
        mostrarSenha(r.senha, r.ja_existia ? 'Sua chegada já estava confirmada' : `Chegada confirmada${r.nome ? `, ${r.nome.split(' ')[0]}` : ''}!`, `${escolhido.hora}${r.medico ? ` · ${r.medico}` : ''}`, r.prioridade !== 'normal')
      } else {
        const r = await totemSenha(params.token, prioridade, cpf ? 'sem_cpf' : 'sem_horario')
        mostrarSenha(r.senha, 'Aguarde ser chamado na recepção', r.na_frente ? `${r.na_frente} ${r.na_frente === 1 ? 'pessoa' : 'pessoas'} na sua frente` : 'Você é o próximo', prioridade !== 'normal')
      }
    } catch (e: any) { setMsg(e.message || 'Não foi possível agora.'); setTela('erro') }
    finally { setOcupado(false) }
  }

  const mostrarSenha = (senha: string, titulo: string, detalhe: string, prioritario: boolean) => {
    setResultado({ senha, titulo, detalhe, prioritario }); setTela('senha'); ultimoToque.current = Date.now()
    if (new URLSearchParams(window.location.search).get('imprimir') === '1') setTimeout(() => window.print(), 300)
  }

  if (indisponivel) return <Moldura><div style={{ margin: 'auto', textAlign: 'center', fontSize: 28, fontWeight: 700, padding: 24 }}>Totem indisponível.<div style={{ fontSize: 20, fontWeight: 500, marginTop: 10, opacity: .7 }}>Procure a recepção.</div></div></Moldura>

  return (
    <Moldura>
      <style dangerouslySetInnerHTML={{ __html: `
        .t-btn { border: none; cursor: pointer; font-family: inherit; transition: transform .08s, box-shadow .15s; -webkit-tap-highlight-color: transparent; user-select: none }
        .t-btn:active { transform: scale(.97) }
        @media print { body * { visibility: hidden } .t-ticket, .t-ticket * { visibility: visible } .t-ticket { position: fixed; inset: 0; display: block !important; text-align: center; font-family: system-ui; color: #000 } }
      ` }} />
      <header style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '3vh 4vw 0' }}>
        {info?.logo_url ? <img src={info.logo_url} alt="" style={{ height: 56, maxWidth: 200, objectFit: 'contain' }} /> : <span style={{ width: 52, height: 52, borderRadius: 16, background: COR, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 24, fontWeight: 800 }}>{(info?.clinica || 'C')[0]}</span>}
        <div><div style={{ fontSize: 24, fontWeight: 800 }}>{info?.clinica || ' '}</div><div style={{ fontSize: 16, opacity: .6 }}>{info?.setor || ' '}</div></div>
        <span style={{ flex: 1 }} />
        {tela !== 'inicio' && tela !== 'senha' && <button className="t-btn" onClick={reiniciar} style={{ ...btnSec, padding: '14px 22px' }}><ArrowLeft size={22} /> Início</button>}
      </header>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2vh 5vw 4vh', gap: 24 }}>
        {tela === 'inicio' && (
          <>
            <div style={{ fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 800, textAlign: 'center', letterSpacing: '-.02em' }}>Bem-vindo! 👋</div>
            <div style={{ fontSize: 'clamp(18px, 2.4vw, 26px)', opacity: .65, textAlign: 'center', marginTop: -10 }}>Toque numa opção para fazer seu check-in</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, width: '100%', maxWidth: 920 }}>
              <BotaoGrande icon={CalendarCheck} titulo="Tenho consulta marcada" detalhe="Confirme sua chegada com o CPF" principal onClick={() => { setFluxo('consulta'); setTela('cpf') }} />
              <BotaoGrande icon={Ticket} titulo="Não tenho horário" detalhe="Pegue uma senha para a recepção" onClick={() => { setFluxo('balcao'); setTela('prioridade') }} />
            </div>
          </>
        )}

        {tela === 'cpf' && (
          <>
            <div style={{ fontSize: 'clamp(26px, 3.6vw, 40px)', fontWeight: 800, textAlign: 'center' }}>Digite seu CPF</div>
            <div style={{ fontSize: 'clamp(34px, 5vw, 56px)', fontWeight: 800, letterSpacing: '.06em', fontVariantNumeric: 'tabular-nums', minHeight: 70, color: COR }}>
              {formatarCpf(cpf) || <span style={{ opacity: .25 }}>000.000.000-00</span>}
            </div>
            <Teclado valor={cpf} onChange={setCpf} max={11} />
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button className="t-btn" onClick={() => { setFluxo('balcao'); setTela('prioridade') }} style={{ ...btnSec, padding: '18px 26px' }}><HelpCircle size={22} /> Não sei meu CPF</button>
              <button className="t-btn" disabled={cpf.length !== 11 || ocupado} onClick={buscar} style={{ ...btnPri, opacity: cpf.length === 11 && !ocupado ? 1 : .4 }}>{ocupado ? 'Buscando…' : 'Continuar'}</button>
            </div>
          </>
        )}

        {tela === 'escolher' && (
          <>
            <div style={{ fontSize: 'clamp(26px, 3.6vw, 40px)', fontWeight: 800, textAlign: 'center' }}>{ags.length === 1 ? 'É você?' : 'Qual é a sua consulta?'}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', maxWidth: 640 }}>
              {ags.map(a => (
                <button key={a.id} className="t-btn" onClick={() => { if (a.senha) mostrarSenha(a.senha, 'Sua chegada já estava confirmada', `${a.hora}${a.medico ? ` · ${a.medico}` : ''}`, false); else { setEscolhido(a); setTela('prioridade') } }}
                  style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '24px 26px', borderRadius: 24, background: '#fff', border: '2px solid #E6E2F5', textAlign: 'left', boxShadow: '0 10px 30px -18px rgba(60,40,140,.4)' }}>
                  <span style={{ width: 64, height: 64, borderRadius: 20, background: '#EFEAFE', color: COR, display: 'grid', placeItems: 'center' }}><UserRound size={32} /></span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontSize: 28, fontWeight: 800, color: '#1d1b26' }}>{a.paciente}</span>
                    <span style={{ display: 'block', fontSize: 20, opacity: .65, color: '#1d1b26', marginTop: 4 }}>Hoje às {a.hora}{a.medico ? ` · ${a.medico}` : ''}</span>
                  </span>
                  <span style={{ fontSize: 22, fontWeight: 800, color: COR }}>Sou eu ›</span>
                </button>
              ))}
            </div>
            <button className="t-btn" onClick={() => { setMsg('Não é você? Procure a recepção, por favor.'); setTela('erro') }} style={{ ...btnSec, padding: '16px 24px' }}>Não sou eu</button>
          </>
        )}

        {tela === 'prioridade' && (
          <>
            <div style={{ fontSize: 'clamp(26px, 3.6vw, 40px)', fontWeight: 800, textAlign: 'center' }}>Você tem atendimento prioritário?</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%', maxWidth: 720 }}>
              {OPCOES_PRIORIDADE.map(o => (
                <button key={o.valor} className="t-btn" disabled={ocupado} onClick={() => confirmar(o.valor)} style={{
                  padding: '22px 26px', borderRadius: 22, textAlign: 'left', background: o.valor === 'normal' ? COR : '#fff', color: o.valor === 'normal' ? '#fff' : '#1d1b26',
                  border: o.valor === 'normal' ? 'none' : '2px solid #E6E2F5', opacity: ocupado ? .6 : 1,
                }}>
                  <span style={{ display: 'block', fontSize: 26, fontWeight: 800 }}>{o.titulo}</span>
                  {o.detalhe && <span style={{ display: 'block', fontSize: 17, opacity: .7, marginTop: 4 }}>{o.detalhe}</span>}
                </button>
              ))}
            </div>
          </>
        )}

        {tela === 'senha' && resultado && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'clamp(24px, 3.2vw, 36px)', fontWeight: 800 }}>{resultado.titulo}</div>
            <div style={{ fontSize: 22, opacity: .6, marginTop: 6 }}>{resultado.detalhe}</div>
            <div style={{ margin: '26px auto 0', padding: '26px 60px', borderRadius: 32, background: '#fff', border: `3px solid ${COR}`, display: 'inline-block', boxShadow: '0 20px 50px -24px rgba(60,40,140,.5)' }}>
              <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '.2em', opacity: .55 }}>SUA SENHA</div>
              <div style={{ fontSize: 'clamp(80px, 12vw, 140px)', fontWeight: 900, color: COR, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums' }}>{resultado.senha}</div>
              {resultado.prioritario && <div style={{ fontSize: 20, fontWeight: 800, color: '#B54708' }}>ATENDIMENTO PRIORITÁRIO</div>}
            </div>
            <div style={{ fontSize: 22, marginTop: 26, opacity: .75 }}>Aguarde ser chamado no painel. 🙂</div>
            <button className="t-btn" onClick={reiniciar} style={{ ...btnPri, marginTop: 26 }}>Pronto</button>
            {/* Comprovante para a impressora */}
            <div className="t-ticket" style={{ display: 'none' }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{info?.clinica}</div>
              <div style={{ fontSize: 12 }}>SENHA</div>
              <div style={{ fontSize: 56, fontWeight: 800 }}>{resultado.senha}</div>
              {resultado.prioritario && <div style={{ fontSize: 12, fontWeight: 700 }}>ATENDIMENTO PRIORITÁRIO</div>}
              <div style={{ fontSize: 12 }}>{resultado.detalhe}</div>
              <div style={{ fontSize: 11 }}>{new Date().toLocaleString('pt-BR')}</div>
            </div>
          </div>
        )}

        {tela === 'erro' && (
          <div style={{ textAlign: 'center', maxWidth: 680 }}>
            <div style={{ fontSize: 'clamp(26px, 3.6vw, 40px)', fontWeight: 800 }}>{msg || 'Não foi possível agora.'}</div>
            <div style={{ fontSize: 22, opacity: .65, marginTop: 12 }}>Pegue uma senha e a recepção te ajuda.</div>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 28, flexWrap: 'wrap' }}>
              <button className="t-btn" onClick={() => { setFluxo('balcao'); setTela('prioridade') }} style={btnPri}><Ticket size={24} /> Pegar senha</button>
              <button className="t-btn" onClick={reiniciar} style={{ ...btnSec, padding: '20px 28px' }}>Voltar ao início</button>
            </div>
          </div>
        )}
      </main>
      <footer style={{ textAlign: 'center', padding: '0 0 2vh', fontSize: 14, opacity: .4 }}>Seus dados ficam protegidos (LGPD) · Clinical 360</footer>
    </Moldura>
  )
}

const btnPri: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 10, padding: '22px 44px', borderRadius: 20, background: COR, color: '#fff', fontSize: 26, fontWeight: 800 }
const btnSec: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 10, borderRadius: 18, background: '#fff', color: '#1d1b26', fontSize: 20, fontWeight: 700, border: '2px solid #E6E2F5' }

const formatarCpf = (d: string) => d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')

function Moldura({ children }: { children: React.ReactNode }) {
  return <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: FUNDO, color: '#1d1b26', fontFamily: 'var(--font-sans), system-ui, sans-serif', overflow: 'auto' }}>{children}</div>
}

function BotaoGrande({ icon: I, titulo, detalhe, principal, onClick }: { icon: any; titulo: string; detalhe: string; principal?: boolean; onClick: () => void }) {
  return (
    <button className="t-btn" onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 14, padding: '34px 32px', borderRadius: 28, textAlign: 'left', minHeight: 230,
      background: principal ? COR : '#fff', color: principal ? '#fff' : '#1d1b26', border: principal ? 'none' : '2px solid #E6E2F5',
      boxShadow: principal ? '0 24px 50px -24px rgba(91,63,208,.7)' : '0 10px 30px -18px rgba(60,40,140,.4)',
    }}>
      <span style={{ width: 72, height: 72, borderRadius: 22, display: 'grid', placeItems: 'center', background: principal ? 'rgba(255,255,255,.18)' : '#EFEAFE', color: principal ? '#fff' : COR }}><I size={38} /></span>
      <span style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.15 }}>{titulo}</span>
      <span style={{ fontSize: 20, opacity: .75 }}>{detalhe}</span>
    </button>
  )
}

function Teclado({ valor, onChange, max }: { valor: string; onChange: (v: string) => void; max: number }) {
  const tecla = (k: string) => {
    if (k === 'apagar') onChange(valor.slice(0, -1))
    else if (k === 'limpar') onChange('')
    else if (valor.length < max) onChange(valor + k)
  }
  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'limpar', '0', 'apagar']
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(90px, 130px))', gap: 14 }}>
      {teclas.map(k => (
        <button key={k} className="t-btn" onClick={() => tecla(k)} aria-label={k === 'apagar' ? 'Apagar' : k === 'limpar' ? 'Limpar' : k} style={{
          height: 'clamp(70px, 9vh, 96px)', borderRadius: 20, background: k.length > 1 ? '#F1EEFB' : '#fff', border: '2px solid #E6E2F5',
          fontSize: k.length > 1 ? 18 : 36, fontWeight: 800, color: '#1d1b26', display: 'grid', placeItems: 'center',
        }}>{k === 'apagar' ? <Delete size={30} /> : k === 'limpar' ? 'Limpar' : k}</button>
      ))}
    </div>
  )
}
