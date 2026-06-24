'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

/* ============================================================================
   Landing pública do Clinical 360 — recriada a partir do handoff de design
   (Claude Design). Página de marketing autossuficiente: usa a paleta própria
   do design (#8972FF), não os tokens da plataforma, pra manter fidelidade.
   Os CTAs estão ligados às rotas reais (/login, /cadastro) e respeitam sessão.
   ========================================================================== */

// ── Paleta do design ────────────────────────────────────────────────────────
const PURPLE = 'rgb(137,114,255)'
const PURPLE_HOVER = 'rgb(118,96,232)'
const ACCENT = 'rgb(89,69,188)'
const INK = 'rgb(50,54,63)'
const MUTED = 'rgb(107,112,123)'
const FAINT = 'rgb(243,244,250)'
const LAV = 'rgb(238,234,254)'
const LAV_BORDER = 'rgb(179,167,236)'
const LAV_TEXT = 'rgb(111,93,197)'

const PLANS = [
  {
    name: 'SOLO', desc: 'Para médicos autônomos', monthly: '297', annualPerMonth: '237', annualTotal: '2.844', highlight: false, badge: '',
    features: ['IA na consulta ilimitada', 'Prescrição Memed', 'Agenda + teleconsulta', '200 mensagens WhatsApp/mês', 'Suporte por e-mail', 'Trial de 7 dias'],
  },
  {
    name: 'CLÍNICA', desc: 'Para clínicas de 2 a 10 médicos', monthly: '597', annualPerMonth: '477', annualTotal: '5.724', highlight: true, badge: 'MAIS VENDIDO',
    features: ['Até 10 usuários', '1.000 consultas IA/mês', 'Sofia no WhatsApp', '1.000 mensagens WhatsApp/mês', 'Comparativo entre médicos', 'Multi-perfil (médico, recepção)', 'Suporte WhatsApp comercial'],
  },
  {
    name: 'PRO', desc: 'Para clínicas grandes e redes', monthly: '1.197', annualPerMonth: '957', annualTotal: '11.484', highlight: false, badge: '',
    features: ['Usuários ilimitados', 'Consultas IA ilimitadas', 'Análise de exames com IA', 'Multi-clínica', '5.000 mensagens WhatsApp/mês', 'API + integrações', 'Suporte prioritário + onboarding'],
  },
]

const FAQS = [
  { q: 'O Clinical 360 está em conformidade com a LGPD?', a: 'Sim. Tratamos dados de saúde como categoria especial conforme exige a LGPD. Temos DPO designado, política de privacidade, consentimento expresso do paciente e backup com PITR no Supabase.' },
  { q: 'A IA pode errar no prontuário?', a: 'A IA gera um rascunho do prontuário SOAP — você revisa e aprova antes de salvar. Nada é registrado sem a sua confirmação. O médico mantém total controle e responsabilidade clínica.' },
  { q: 'Preciso instalar algo?', a: 'Não. O Clinical 360 roda 100% no navegador. Acesse de qualquer computador, tablet ou celular — sem instalação e sem atualização manual.' },
  { q: 'Posso migrar de outro sistema?', a: 'Sim. Nossa equipe importa seus pacientes, prontuários e agenda do seu sistema atual sem custo. A migração leva em média 48 horas.' },
  { q: 'Como funciona o trial gratuito?', a: 'São 7 dias com acesso completo, sem cartão de crédito. Ao final, você escolhe um plano ou cancela — seus dados ficam guardados por 30 dias.' },
  { q: 'Quanto custa um médico extra?', a: 'No plano Clínica, cada médico adicional custa R$ 97/mês. No plano PRO, os usuários são ilimitados.' },
]

export default function HomePage() {
  const router = useRouter()
  const [logado, setLogado] = useState(false)
  const [destinoLogado, setDestinoLogado] = useState<'/dashboard' | '/onboarding'>('/dashboard')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const rawAdmin = localStorage.getItem('clinica_admin')
      if (rawAdmin) {
        const admin = JSON.parse(rawAdmin)
        setLogado(true)
        setDestinoLogado(admin.onboarding_concluido ? '/dashboard' : '/onboarding')
        return
      }
      const rawMedico = localStorage.getItem('medico')
      if (rawMedico) {
        const medico = JSON.parse(rawMedico)
        setLogado(true)
        setDestinoLogado(medico.onboarding_concluido ? '/dashboard' : '/onboarding')
      }
    } catch {
      // sem sessão, mostra landing pública
    }
  }, [])

  return <Landing router={router} logado={logado && mounted} destinoLogado={destinoLogado} />
}

function Landing({ router, logado, destinoLogado }: { router: any; logado: boolean; destinoLogado: string }) {
  const [billing, setBilling] = useState<'mensal' | 'anual'>('anual')
  const [openFaq, setOpenFaq] = useState<number>(0)
  const [scrolled, setScrolled] = useState(false)
  const isAnual = billing === 'anual'

  // CTAs ligados à plataforma
  const irCadastro = () => router.push(logado ? destinoLogado : '/cadastro')
  const irLogin = () => router.push(logado ? destinoLogado : '/login')

  useEffect(() => {
    const onScroll = () => {
      const v = (window.scrollY || document.documentElement.scrollTop || 0) > 60
      setScrolled(prev => (prev !== v ? v : prev))
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const navStyle: React.CSSProperties = {
    position: 'sticky', top: 0, zIndex: 50, width: '100%', transition: 'background .25s, box-shadow .25s',
    ...(scrolled
      ? { background: 'rgba(255,255,255,0.82)', backdropFilter: 'saturate(180%) blur(14px)', WebkitBackdropFilter: 'saturate(180%) blur(14px)', boxShadow: '0 1px 0 rgba(20,20,40,0.06)' }
      : { background: 'transparent' }),
  }
  const navLink: React.CSSProperties = {
    textDecoration: 'none', fontWeight: 500, fontSize: 15, letterSpacing: '-0.02em', whiteSpace: 'nowrap',
    color: scrolled ? INK : 'rgba(255,255,255,0.92)',
  }
  const logoFilter = scrolled ? 'none' : 'brightness(0) invert(1)'

  const eyebrow: React.CSSProperties = {
    alignSelf: 'flex-start', display: 'inline-flex', padding: '5px 16px', borderRadius: 32,
    background: 'linear-gradient(90deg,rgba(89,69,188,0.06),rgba(137,114,255,0.06))',
    color: ACCENT, fontWeight: 600, fontSize: 13, letterSpacing: '0.2em',
  }
  const h2: React.CSSProperties = { margin: 0, fontWeight: 500, fontSize: 48, lineHeight: 1.1, letterSpacing: '-0.05em', color: INK }

  return (
    <div style={{ fontFamily: "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif", background: '#fff', color: INK, overflowX: 'hidden', WebkitFontSmoothing: 'antialiased' }}>
      {/* Fonte + animações + responsivo */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <style>{`
        html{scroll-behavior:smooth;}
        @keyframes c360pulse{0%,100%{opacity:1}50%{opacity:.25}}
        @keyframes c360float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
        @keyframes c360bob{0%,100%{translate:0 0}50%{translate:0 -12px}}
        @keyframes c360spin{to{transform:rotate(360deg)}}
        .c360-btn{transition:transform .2s, box-shadow .2s, background .2s;}
        .c360-btn--primary:hover{background:${PURPLE_HOVER};transform:translateY(-1px);box-shadow:0 8px 20px rgba(137,114,255,0.45);}
        .c360-btn--hero:hover{transform:translateY(-3px);box-shadow:0 20px 44px rgba(137,114,255,0.55);background:${PURPLE_HOVER};}
        .c360-btn--lg:hover{transform:translateY(-3px);box-shadow:0 18px 40px rgba(137,114,255,0.5);background:${PURPLE_HOVER};}
        .c360-btn--ghost:hover{background:rgba(255,255,255,0.14);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.8);}
        .c360-btn--white:hover{transform:translateY(-2px);box-shadow:0 14px 30px rgba(20,12,60,0.25);}
        .c360-btn--white-lg:hover{transform:translateY(-3px);box-shadow:0 18px 40px rgba(20,12,60,0.3);}
        .c360-navlink:hover{opacity:0.62;}
        .c360-entrar:hover{background:rgba(137,114,255,0.16);transform:translateY(-1px);}
        .c360-plan{transition:transform .25s ease, box-shadow .25s ease;}
        .c360-plan:hover{transform:translateY(-16px) !important;box-shadow:0 34px 70px rgba(99,85,170,0.22) !important;}
        .c360-arrow{transition:gap .2s;}
        .c360-arrow:hover{gap:14px;}
        .c360-footlink{transition:color .2s;}
        .c360-footlink:hover{color:${ACCENT};}
        .c360-sec{padding-left:112px !important;padding-right:112px !important;}
        @media (max-width:1024px){
          .c360-sec{padding-left:56px !important;padding-right:56px !important;}
          .c360-navlinks{display:none !important;}
          .c360-grid-4{grid-template-columns:repeat(2,1fr) !important;}
          .c360-faqwrap{flex-direction:column !important;gap:56px !important;}
          .c360-faqhead{width:auto !important;}
          .c360-hero-h1{font-size:54px !important;}
        }
        @media (max-width:760px){
          .c360-sec{padding-left:20px !important;padding-right:20px !important;}
          .c360-entrar{display:none !important;}
          .c360-grid-2{grid-template-columns:1fr !important;}
          .c360-grid-3{grid-template-columns:1fr !important;}
          .c360-grid-4{grid-template-columns:repeat(2,1fr) !important;}
          .c360-bento{grid-template-columns:1fr !important;}
          .c360-bento > *{grid-column:1 / -1 !important;grid-row:auto !important;}
          .c360-hero-h1{font-size:40px !important;}
          .c360-h2{font-size:30px !important;}
          .c360-numbers{padding:40px 24px !important;}
          .c360-mockbody{flex-direction:column !important;}
          .c360-ctx{width:auto !important;}
          .c360-suggest{position:static !important;width:auto !important;right:auto !important;bottom:auto !important;margin-top:16px !important;}
          .c360-orbit{transform:scale(0.62);transform-origin:top center;margin-bottom:-170px;}
          .c360-wordmark{font-size:96px !important;}
        }
      `}</style>

      {/* ============ NAV ============ */}
      <nav style={navStyle}>
        <div className="c360-sec" style={{ maxWidth: 1440, margin: '0 auto', paddingTop: 20, paddingBottom: 20, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 48 }}>
            <a href="#top" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
              <img src="/landing/logo-clinical.svg" alt="Clinical 360" style={{ height: 27, display: 'block', filter: logoFilter, transition: 'filter .25s' }} />
            </a>
            <div className="c360-navlinks" style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
              <a className="c360-navlink" href="#para-quem" style={navLink}>Para Quem</a>
              <a className="c360-navlink" href="#recursos" style={navLink}>Recursos</a>
              <a className="c360-navlink" href="#planos" style={navLink}>Planos</a>
              <a className="c360-navlink" href="#faq" style={navLink}>FAQ</a>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="c360-btn c360-entrar"
              onClick={irLogin}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', border: 'none',
                borderRadius: 12, padding: '9px 16px', fontWeight: 500, fontSize: 15, letterSpacing: '-0.02em', fontFamily: 'inherit',
                transition: 'background .2s, box-shadow .2s, transform .2s',
                ...(scrolled
                  ? { color: INK, background: 'transparent', boxShadow: 'inset 0 0 0 1px rgba(50,54,63,0.18)' }
                  : { color: '#fff', background: 'rgba(255,255,255,0.1)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.85)' }),
              }}
            >
              {logado ? 'Ir para a plataforma' : 'Entrar'}
            </button>
            <button className="c360-btn c360-btn--primary" onClick={irCadastro} style={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap', border: 'none', cursor: 'pointer', borderRadius: 12, padding: '9px 18px', fontWeight: 500, fontSize: 15, letterSpacing: '-0.02em', background: PURPLE, color: '#fff', fontFamily: 'inherit' }}>
              {logado ? 'Abrir dashboard' : 'Teste grátis'}
            </button>
          </div>
        </div>
      </nav>

      {/* ============ HERO ============ */}
      <header id="top" style={{ position: 'relative', marginTop: -72, paddingTop: 72, background: '#fff', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, height: 760, backgroundImage: "url('/landing/hero.jpg')", backgroundSize: 'cover', backgroundPosition: 'center 46%' }} />
        <div style={{ position: 'absolute', inset: 0, height: 760, background: 'linear-gradient(180deg,rgba(34,24,78,0.55) 0%,rgba(46,34,104,0.3) 55%,rgba(48,36,108,0.34) 100%)' }} />
        <div className="c360-sec" style={{ position: 'relative', maxWidth: 1440, margin: '0 auto', paddingTop: 96, paddingBottom: 130, boxSizing: 'border-box' }}>
          <div style={{ maxWidth: 780, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <span style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 32, background: 'rgba(255,255,255,0.12)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.18)', color: '#fff', fontSize: 15, letterSpacing: '-0.02em', backdropFilter: 'blur(4px)' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: PURPLE, boxShadow: '0 0 0 4px rgba(137,114,255,0.3)' }} />
              AI-First · Plataforma médica que pensa por você
            </span>
            <h1 className="c360-hero-h1" style={{ margin: 0, color: '#fff', fontWeight: 500, fontSize: 72, lineHeight: 1.05, letterSpacing: '-0.05em' }}>A IA para cuidar<br />da sua clínica.</h1>
            <p style={{ margin: 0, maxWidth: 500, color: 'rgba(255,255,255,0.88)', fontSize: 17, lineHeight: 1.6, letterSpacing: '-0.02em' }}>Prontuário SOAP gerado na consulta, prescrição Memed integrada, Sofia (nossa IA) respondendo o WhatsApp 24/7, exames interpretados em segundos e teleconsulta nativa. Tudo no Clinical 360.</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
              <button className="c360-btn c360-btn--hero" onClick={irCadastro} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', background: PURPLE, color: '#fff', borderRadius: 16, padding: '16px 36px', fontWeight: 500, fontSize: 16, letterSpacing: '-0.02em', boxShadow: '0 12px 30px rgba(137,114,255,0.4)', fontFamily: 'inherit' }}>{logado ? 'Ir para a plataforma' : 'Comece grátis'}</button>
              <a className="c360-btn c360-btn--ghost" href="#planos" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', color: '#fff', borderRadius: 16, padding: '16px 28px', fontWeight: 500, fontSize: 16, letterSpacing: '-0.02em', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.4)' }}>Ver planos</a>
            </div>
          </div>

          {/* APP MOCKUP */}
          <div style={{ position: 'relative', width: '100%', maxWidth: 1008, margin: '72px auto 0' }}>
            <div style={{ background: 'rgb(250,250,250)', borderRadius: 18, padding: 16, boxSizing: 'border-box', boxShadow: '0 40px 90px -28px rgba(45,28,95,0.32),0 14px 36px -18px rgba(45,28,95,0.16)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 6px 14px' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#e3e3e8' }} />
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#e3e3e8' }} />
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#e3e3e8' }} />
                </div>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                  <div style={{ background: '#fff', borderRadius: 100, padding: '5px 16px', fontSize: 11, color: 'rgb(120,118,141)', boxShadow: 'inset 0 0 0 1px #efeff4' }}>https://clinical360.app/</div>
                </div>
                <div style={{ width: 54 }} />
              </div>
              <div style={{ background: '#fff', borderRadius: 12, padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', boxShadow: 'inset 0 0 0 1px #f1f1f6' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgb(235,232,250)', boxShadow: 'inset 0 0 0 1px rgb(179,167,236)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: 'rgb(80,75,154)' }}>MA</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: 'rgb(80,75,154)', letterSpacing: '-0.02em' }}>Maria Aparecida Souza</span>
                    <span style={{ fontSize: 10, color: 'rgb(107,112,123)' }}>44 anos · Última consulta: 29 de abril de 2026</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: 'rgb(107,112,123)' }}>⇄ Trocar de paciente</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: LAV, boxShadow: `inset 0 0 0 1px ${LAV_BORDER}`, color: LAV_TEXT, borderRadius: 7, padding: '6px 10px', fontSize: 11, fontWeight: 500 }}>
                    <svg width="9" height="11" viewBox="0 0 9 11" fill="none"><path d="M5 0L0 6.5h3.5L4 11l5-6.5H5.5L5 0z" fill={LAV_TEXT} /></svg>
                    Modo perfeita ativo
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', boxShadow: 'inset 0 0 0 1px #ededf3', borderRadius: 7, padding: '6px 10px', fontSize: 11, color: 'rgb(107,112,123)' }}>Prescrever com <img src="/landing/memed.png" alt="Memed" style={{ height: 13, display: 'block' }} /></span>
                </div>
              </div>
              <div className="c360-mockbody" style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'stretch' }}>
                <div className="c360-ctx" style={{ width: 248, flex: 'none', background: '#fff', borderRadius: 14, padding: 12, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 10, boxShadow: 'inset 0 0 0 1px #f3f3f8' }}>
                  <span style={{ fontWeight: 700, fontSize: 9, letterSpacing: '0.2em', color: 'rgb(163,168,178)' }}>CONTEXTO DO PACIENTE</span>
                  <div style={{ borderRadius: 10, padding: 12, boxShadow: 'inset 0 0 0 1px #f4f4f9', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 9, letterSpacing: '0.2em', color: 'rgb(107,112,123)' }}>RESUMO IA</span>
                    <span style={{ fontSize: 11, lineHeight: 1.4, color: 'rgb(107,112,123)' }}>Hipertensão arterial sistêmica e Diabetes tipo 2, em uso de 3 medicações, última consulta há 12 dias.</span>
                  </div>
                  <div style={{ borderRadius: 10, padding: 12, boxShadow: 'inset 0 0 0 1px #f4f4f9', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 9, letterSpacing: '0.2em', color: 'rgb(107,112,123)' }}>ALERTAS</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgb(192,57,43)' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgb(227,48,51)' }} />Alergia: Penicilina</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgb(107,112,123)' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: LAV_BORDER }} />Hipertensão arterial sistêmica</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgb(107,112,123)' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: LAV_BORDER }} />Diabetes tipo 2</span>
                    </div>
                  </div>
                  <div style={{ borderRadius: 10, padding: 12, boxShadow: 'inset 0 0 0 1px #f4f4f9', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 9, letterSpacing: '0.2em', color: 'rgb(107,112,123)' }}>MEDICAÇÕES ATIVAS</span>
                    <span style={{ fontSize: 11, lineHeight: 1.55, color: 'rgb(107,112,123)' }}>Losartana 50mg 1x/dia (manhã)<br />AAS 100mg 1x/dia (manhã)<br />Metformina 500mg 2x/dia (refeições)</span>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ background: '#fff', borderRadius: 12, padding: '12px 14px', boxShadow: 'inset 0 0 0 1px #f3f3f8', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgb(227,48,51)', animation: 'c360pulse 1.6s ease-in-out infinite' }} />
                    <span style={{ fontWeight: 700, fontSize: 9, letterSpacing: '0.2em', color: 'rgb(227,48,51)' }}>GRAVANDO</span>
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgb(163,168,178)' }}>02:14</span>
                  </div>
                  <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: 'inset 0 0 0 1px #f3f3f8', display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
                    <div style={{ maxWidth: '78%', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', color: 'rgb(163,168,178)' }}>PACIENTE</span>
                      <div style={{ background: 'rgb(247,247,250)', borderRadius: '12px 12px 12px 2px', padding: '10px 12px', fontSize: 12, lineHeight: 1.5, color: 'rgb(82,86,95)' }}>Doutor, tô com uma dor de cabeça forte do lado direito há três dias. Sensível à luz, e ontem vomitei.</div>
                    </div>
                    <div style={{ maxWidth: '78%', alignSelf: 'flex-end', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                      <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', color: PURPLE }}>MÉDICO</span>
                      <div style={{ background: LAV, borderRadius: '12px 12px 2px 12px', padding: '10px 12px', fontSize: 12, lineHeight: 1.5, color: 'rgb(80,75,154)' }}>A pressão tá controlada? Tomou o Losartana certinho?</div>
                    </div>
                    <div style={{ maxWidth: '78%', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', color: 'rgb(163,168,178)' }}>PACIENTE</span>
                      <div style={{ background: 'rgb(247,247,250)', borderRadius: '12px 12px 12px 2px', padding: '10px 12px', fontSize: 12, lineHeight: 1.5, color: 'rgb(82,86,95)' }}>Tomei sim, todos os dias de manhã...</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="c360-suggest" style={{ position: 'absolute', right: 18, bottom: -46, width: 316, background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 30px 60px -16px rgba(45,28,95,0.28),0 8px 20px -8px rgba(45,28,95,0.12)', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12, animation: 'c360float 6s ease-in-out infinite' }}>
              <span style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, background: LAV, color: LAV_TEXT, borderRadius: 7, padding: '5px 10px', fontWeight: 700, fontSize: 9, letterSpacing: '0.16em' }}>
                <svg width="9" height="11" viewBox="0 0 9 11" fill="none"><path d="M5 0L0 6.5h3.5L4 11l5-6.5H5.5L5 0z" fill={LAV_TEXT} /></svg>
                SUGESTÃO IA
              </span>
              <span style={{ fontSize: 12, lineHeight: 1.55, color: LAV_TEXT }}>
                <strong style={{ fontWeight: 600 }}>Foco:</strong> cefaleia hemicraniana com fotofobia e emese — quadro sugestivo de enxaqueca.<br /><br />
                ⚠️ <strong style={{ fontWeight: 600 }}>Atenção:</strong> paciente é hipertensa. Aferir PA antes de medicar.<br />
                <span style={{ color: 'rgb(132,128,160)' }}>Evite: Dipirona e AINEs (alergia registrada).</span>
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ============ FEATURES ============ */}
      <section className="c360-sec" style={{ maxWidth: 1440, margin: '0 auto', paddingTop: 130, paddingBottom: 110, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', marginBottom: 56 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <span style={eyebrow}>POR QUE CLINICAL 360</span>
            <h2 className="c360-h2" style={h2}>Antes você atendia papelada.<br />Agora você atende pacientes.</h2>
          </div>
          <button className="c360-btn c360-btn--lg" onClick={irCadastro} style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', background: PURPLE, color: '#fff', borderRadius: 16, padding: '14px 32px', fontWeight: 500, fontSize: 16, letterSpacing: '-0.02em', fontFamily: 'inherit' }}>Comece agora mesmo</button>
        </div>
        <div className="c360-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 32 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ height: 400, borderRadius: 16, background: 'rgba(137,114,255,0.1)', overflow: 'hidden', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 22, boxSizing: 'border-box' }}>
              <div style={{ width: '100%', background: '#fff', borderRadius: 10, boxShadow: '0 20px 50px rgba(137,114,255,0.18)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', gap: 14, padding: '10px 12px', borderBottom: `1px solid ${FAINT}`, fontSize: 9 }}>
                  <span style={{ color: LAV_TEXT, fontWeight: 600, borderBottom: `1.5px solid ${LAV_TEXT}`, paddingBottom: 4 }}>Prontuário</span>
                  <span style={{ color: 'rgb(163,168,178)' }}>Resumo</span>
                  <span style={{ color: 'rgb(163,168,178)' }}>Documentos</span>
                </div>
                <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {[['S', 'Subjetivo', 'Cefaleia hemicraniana há 3 dias, fotofobia e emese.'], ['A', 'Avaliação', 'Quadro compatível com crise de enxaqueca.'], ['P', 'Plano', 'Aferir PA. Diário de dor e revisar medicação.']].map(([k, t, d]) => (
                    <div key={k} style={{ borderRadius: 6, boxShadow: `inset 0 0 0 1px ${FAINT}`, padding: 8, display: 'flex', gap: 7 }}>
                      <span style={{ width: 14, height: 14, borderRadius: 4, background: LAV, color: LAV_TEXT, fontWeight: 700, fontSize: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{k}</span>
                      <div><div style={{ fontSize: 8, fontWeight: 700, color: INK }}>{t}</div><div style={{ fontSize: 7, color: 'rgb(149,153,161)', marginTop: 2, lineHeight: 1.4 }}>{d}</div></div>
                    </div>
                  ))}
                  <div style={{ borderRadius: 6, boxShadow: `inset 0 0 0 1px ${FAINT}`, padding: 8 }}>
                    <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: '0.15em', color: 'rgb(107,112,123)', marginBottom: 6 }}>CIDS SUGERIDOS</div>
                    <div style={{ display: 'flex', gap: 6 }}><span style={{ background: LAV, boxShadow: `inset 0 0 0 1px ${LAV_BORDER}`, color: LAV_TEXT, borderRadius: 5, padding: '4px 7px', fontSize: 8 }}>G43.9 Enxaqueca</span><span style={{ background: LAV, boxShadow: `inset 0 0 0 1px ${LAV_BORDER}`, color: LAV_TEXT, borderRadius: 5, padding: '4px 7px', fontSize: 8 }}>I10 HAS</span></div>
                  </div>
                </div>
              </div>
              <img src="/landing/isotipo.svg" alt="" style={{ position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)', width: 24, height: 24, opacity: 0.9 }} />
            </div>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.45, color: MUTED, letterSpacing: '-0.02em' }}>Prontuário SOAP gerado pela IA em 30 segundos.</p>
          </div>
          {[
            { bg: "rgba(137,114,255,0.8) url('/landing/feature-memed.jpg') center/cover", txt: 'Receita digital Memed com validade legal ICP-Brasil.' },
            { bg: "rgba(137,114,255,0.4) url('/landing/feature-sofia.jpg') center/cover", txt: 'Sofia (IA no WhatsApp) confirma e remarca sozinha.' },
            { bg: "url('/landing/feature-all.jpg') center/cover", txt: 'Tudo em um lugar — agenda, prontuário, teleconsulta, IA.' },
          ].map((f, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ height: 400, borderRadius: 16, background: f.bg }} />
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.45, color: MUTED, letterSpacing: '-0.02em' }}>{f.txt}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ PARA QUEM ============ */}
      <section id="para-quem" style={{ position: 'relative', background: '#fff', overflow: 'hidden' }}>
        <img src="/landing/isotipo.svg" alt="" style={{ position: 'absolute', top: -80, right: -60, width: 360, opacity: 0.05, transform: 'rotate(18deg)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 120, left: -120, width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle,rgba(137,114,255,0.10),transparent 70%)', pointerEvents: 'none' }} />
        <div className="c360-sec" style={{ position: 'relative', maxWidth: 1440, margin: '0 auto', paddingTop: 130, paddingBottom: 130, boxSizing: 'border-box' }}>
          <div style={{ maxWidth: 720, margin: '0 auto 64px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <span style={{ ...eyebrow, alignSelf: 'center' }}>PARA QUEM</span>
            <h2 className="c360-h2" style={h2}>Feito para quem vive a clínica.</h2>
            <p style={{ margin: 0, fontSize: 17, lineHeight: 1.6, color: MUTED, letterSpacing: '-0.02em' }}>Do consultório solo à rede com dezenas de médicos — o Clinical 360 se adapta à sua operação.</p>
          </div>
          <div className="c360-bento" style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gridAutoRows: 'minmax(320px,auto)', gap: 20 }}>
            <div style={{ gridColumn: 'span 8', minHeight: 380, position: 'relative', overflow: 'hidden', borderRadius: 28, padding: 44, boxSizing: 'border-box', background: `linear-gradient(135deg,${PURPLE} 0%,rgb(88,71,174) 100%)`, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', color: '#fff' }}>
              <img src="/landing/isotipo.svg" alt="" style={{ position: 'absolute', top: -50, left: -40, width: 240, opacity: 0.18, filter: 'brightness(0) invert(1)', transform: 'rotate(-12deg)' }} />
              <div style={{ position: 'absolute', top: 28, right: 32, width: 236, background: '#fff', borderRadius: 16, padding: 14, boxSizing: 'border-box', boxShadow: '0 24px 50px rgba(30,18,80,0.35)', display: 'flex', flexDirection: 'column', gap: 10, transform: 'rotate(3deg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgb(37,211,102)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6.5l2.5 2.5L10 3.5" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg></span><span style={{ fontSize: 11, fontWeight: 600, color: INK }}>Sofia · WhatsApp</span></div>
                <div style={{ background: LAV, borderRadius: '10px 10px 10px 2px', padding: '8px 10px', fontSize: 11, lineHeight: 1.45, color: 'rgb(80,75,154)' }}>Olá, Maria! Confirmando sua consulta amanhã às 14h. Posso confirmar? 😊</div>
                <div style={{ alignSelf: 'flex-end', background: 'rgb(220,248,231)', borderRadius: '10px 10px 2px 10px', padding: '8px 10px', fontSize: 11, color: 'rgb(34,103,64)' }}>Confirmado! ✅</div>
              </div>
              <h3 style={{ margin: '0 0 12px', fontWeight: 600, fontSize: 26, letterSpacing: '-0.03em', maxWidth: 300, position: 'relative' }}>Médicos autônomos</h3>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: 'rgba(255,255,255,0.88)', maxWidth: 360, letterSpacing: '-0.02em' }}>Consultório próprio, sem secretária. A Sofia agenda, confirma e remarca pelo WhatsApp enquanto você atende.</p>
            </div>
            <div style={{ gridColumn: 'span 4', position: 'relative', overflow: 'hidden', borderRadius: 28, padding: 36, boxSizing: 'border-box', background: LAV, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['Cardio', 'Endócrino', 'Neuro', '+12'].map(t => <span key={t} style={{ background: '#fff', boxShadow: `inset 0 0 0 1px ${LAV_BORDER}`, color: LAV_TEXT, borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 500 }}>{t}</span>)}
              </div>
              <div>
                <h3 style={{ margin: '0 0 10px', fontWeight: 600, fontSize: 22, letterSpacing: '-0.03em', color: INK }}>Especialistas</h3>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: MUTED, letterSpacing: '-0.02em' }}>A IA conhece o contexto do paciente e sugere CIDs e condutas da sua área.</p>
              </div>
            </div>
            <div style={{ gridColumn: 'span 4', position: 'relative', overflow: 'hidden', borderRadius: 28, background: '#fff', boxShadow: '0 2px 5px rgba(0,0,0,0.04),0 14px 30px rgba(99,85,170,0.06)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: 150, background: "rgba(137,114,255,0.4) url('/landing/feature-sofia.jpg') center/cover" }} />
              <div style={{ padding: '28px 32px' }}>
                <h3 style={{ margin: '0 0 10px', fontWeight: 600, fontSize: 22, letterSpacing: '-0.03em', color: INK }}>Recepção e secretária</h3>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: MUTED, letterSpacing: '-0.02em' }}>Menos telefone, menos no-show. A IA responde pacientes 24/7 e organiza a fila de espera.</p>
              </div>
            </div>
            <div style={{ gridColumn: 'span 8', position: 'relative', overflow: 'hidden', borderRadius: 28, padding: 40, boxSizing: 'border-box', background: '#fff', boxShadow: '0 2px 5px rgba(0,0,0,0.04),0 14px 30px rgba(99,85,170,0.06)', display: 'flex', alignItems: 'center', gap: 40 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ margin: '0 0 12px', fontWeight: 600, fontSize: 24, letterSpacing: '-0.03em', color: INK }}>Clínicas e redes</h3>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: MUTED, letterSpacing: '-0.02em' }}>Vários médicos, uma operação. Compare a produtividade da equipe, padronize prontuários e centralize a agenda de todas as unidades.</p>
              </div>
              <div style={{ flex: 'none', width: 230, background: 'rgb(250,250,250)', borderRadius: 18, padding: 20, boxSizing: 'border-box', boxShadow: `inset 0 0 0 1px ${FAINT}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', color: 'rgb(163,168,178)', marginBottom: 16 }}>CONSULTAS / MÉDICO</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 110 }}>
                  {[['Dr. A', 62, LAV_BORDER], ['Dr. B', 92, PURPLE], ['Dr. C', 48, LAV_BORDER], ['Dr. D', 78, PURPLE]].map(([n, hh, c]) => (
                    <div key={n as string} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}><div style={{ width: '100%', height: hh as number, borderRadius: 6, background: c as string }} /><span style={{ fontSize: 9, color: 'rgb(149,153,161)' }}>{n}</span></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ RECURSOS ============ */}
      <section id="recursos" style={{ position: 'relative', background: 'rgb(250,250,250)', overflow: 'hidden' }}>
        <div className="c360-sec" style={{ position: 'relative', maxWidth: 1440, margin: '0 auto', paddingTop: 130, paddingBottom: 130, boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', marginBottom: 56 }}>
            <div style={{ maxWidth: 620, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <span style={eyebrow}>RECURSOS</span>
              <h2 className="c360-h2" style={h2}>Tudo que sua clínica precisa, em um só lugar.</h2>
            </div>
            <p style={{ maxWidth: 300, fontSize: 15, lineHeight: 1.6, color: MUTED, letterSpacing: '-0.02em' }}>Uma plataforma única no lugar de cinco ferramentas desconectadas.</p>
          </div>
          <div className="c360-bento" style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gridAutoRows: 'minmax(190px,auto)', gap: 20 }}>
            <div style={{ gridColumn: 'span 6', gridRow: 'span 2', position: 'relative', overflow: 'hidden', borderRadius: 28, padding: 40, boxSizing: 'border-box', background: 'linear-gradient(160deg,rgb(238,234,254) 0%,#fff 65%)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 28, boxShadow: `inset 0 0 0 1px ${FAINT}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: '#fff', boxShadow: '0 4px 12px rgba(99,85,170,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="22" height="22" viewBox="0 0 22 22"><rect x="4" y="2" width="14" height="18" rx="2" fill="none" stroke={LAV_TEXT} strokeWidth="1.6" /><line x1="7" y1="7" x2="15" y2="7" stroke={LAV_TEXT} strokeWidth="1.6" strokeLinecap="round" /><line x1="7" y1="11" x2="15" y2="11" stroke={LAV_TEXT} strokeWidth="1.6" strokeLinecap="round" /><line x1="7" y1="15" x2="12" y2="15" stroke={LAV_TEXT} strokeWidth="1.6" strokeLinecap="round" /></svg></div>
                <h3 style={{ margin: 0, fontWeight: 600, fontSize: 22, letterSpacing: '-0.03em', color: INK }}>Prontuário SOAP com IA</h3>
              </div>
              <div style={{ background: '#fff', borderRadius: 14, padding: 14, boxShadow: '0 18px 40px rgba(99,85,170,0.12)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 12, borderBottom: `1px solid ${FAINT}`, paddingBottom: 8, fontSize: 10 }}><span style={{ color: LAV_TEXT, fontWeight: 600, borderBottom: `1.5px solid ${LAV_TEXT}`, paddingBottom: 6 }}>Prontuário</span><span style={{ color: 'rgb(163,168,178)' }}>Resumo</span><span style={{ color: 'rgb(163,168,178)' }}>Documentos</span></div>
                {[['S', 'Subjetivo', 'Cefaleia hemicraniana há 3 dias, fotofobia e emese.'], ['A', 'Avaliação', 'Quadro compatível com crise de enxaqueca.']].map(([k, t, d]) => (
                  <div key={k} style={{ display: 'flex', gap: 8 }}><span style={{ width: 18, height: 18, borderRadius: 5, background: LAV, color: LAV_TEXT, fontWeight: 700, fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{k}</span><div><div style={{ fontSize: 10, fontWeight: 700, color: INK }}>{t}</div><div style={{ fontSize: 9, color: 'rgb(149,153,161)', marginTop: 2 }}>{d}</div></div></div>
                ))}
                <div style={{ display: 'flex', gap: 6, marginTop: 2 }}><span style={{ background: LAV, boxShadow: `inset 0 0 0 1px ${LAV_BORDER}`, color: LAV_TEXT, borderRadius: 6, padding: '4px 8px', fontSize: 9 }}>G43.9 Enxaqueca</span><span style={{ background: LAV, boxShadow: `inset 0 0 0 1px ${LAV_BORDER}`, color: LAV_TEXT, borderRadius: 6, padding: '4px 8px', fontSize: 9 }}>I10 HAS</span></div>
              </div>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: MUTED, letterSpacing: '-0.02em' }}>Grave a consulta e receba o prontuário estruturado (S.O.A.P.) em 30 segundos, com CIDs sugeridos e alertas de alergia.</p>
            </div>
            <div style={{ gridColumn: 'span 6', position: 'relative', overflow: 'hidden', borderRadius: 28, padding: 32, boxSizing: 'border-box', background: '#fff', boxShadow: `inset 0 0 0 1px ${FAINT}`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 20 }}>
              <div>
                <h3 style={{ margin: '0 0 10px', fontWeight: 600, fontSize: 20, letterSpacing: '-0.03em', color: INK }}>Sofia — IA no WhatsApp</h3>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: MUTED, letterSpacing: '-0.02em', maxWidth: 420 }}>Agenda, confirma e remarca consultas 24/7. Reduz no-show e libera a recepção.</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 340 }}>
                <div style={{ background: LAV, borderRadius: '10px 10px 10px 2px', padding: '8px 12px', fontSize: 11, lineHeight: 1.4, color: 'rgb(80,75,154)' }}>Olá! Confirmando sua consulta amanhã às 14h 😊</div>
                <div style={{ alignSelf: 'flex-end', background: 'rgb(220,248,231)', borderRadius: '10px 10px 2px 10px', padding: '8px 12px', fontSize: 11, color: 'rgb(34,103,64)', display: 'flex', alignItems: 'center', gap: 4 }}>Confirmado <svg width="11" height="11" viewBox="0 0 12 12"><path d="M2 6.5l2.5 2.5L10 3.5" fill="none" stroke="rgb(37,160,90)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
              </div>
            </div>
            <div style={{ gridColumn: 'span 3', borderRadius: 28, padding: 28, boxSizing: 'border-box', background: '#fff', boxShadow: `inset 0 0 0 1px ${FAINT}`, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: LAV, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="22" height="22" viewBox="0 0 22 22"><rect x="3" y="5" width="16" height="12" rx="3" fill="none" stroke={LAV_TEXT} strokeWidth="1.6" /><circle cx="8" cy="11" r="2" fill={LAV_TEXT} /><line x1="12" y1="11" x2="16" y2="11" stroke={LAV_TEXT} strokeWidth="1.6" strokeLinecap="round" /></svg></div>
              <h3 style={{ margin: 0, fontWeight: 600, fontSize: 17, letterSpacing: '-0.03em', color: INK }}>Prescrição Memed</h3>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: MUTED, letterSpacing: '-0.02em' }}>Receita digital com validade ICP-Brasil, enviada em um clique.</p>
            </div>
            <div style={{ gridColumn: 'span 3', borderRadius: 28, padding: 28, boxSizing: 'border-box', background: `linear-gradient(150deg,${PURPLE},rgb(88,71,174))`, color: '#fff', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="22" height="22" viewBox="0 0 22 22"><rect x="3" y="5" width="11" height="12" rx="2" fill="none" stroke="#fff" strokeWidth="1.6" /><path d="M14 9l5-3v10l-5-3z" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" /></svg></div>
              <h3 style={{ margin: 0, fontWeight: 600, fontSize: 17, letterSpacing: '-0.03em' }}>Teleconsulta nativa</h3>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: 'rgba(255,255,255,0.85)', letterSpacing: '-0.02em' }}>Vídeo integrado ao prontuário, sem link externo nem app.</p>
            </div>
            <div style={{ gridColumn: 'span 4', borderRadius: 28, padding: 30, boxSizing: 'border-box', background: '#fff', boxShadow: `inset 0 0 0 1px ${FAINT}`, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: LAV, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="22" height="22" viewBox="0 0 22 22"><circle cx="10" cy="10" r="6" fill="none" stroke={LAV_TEXT} strokeWidth="1.6" /><line x1="14.5" y1="14.5" x2="18" y2="18" stroke={LAV_TEXT} strokeWidth="1.6" strokeLinecap="round" /></svg></div>
              <h3 style={{ margin: 0, fontWeight: 600, fontSize: 18, letterSpacing: '-0.03em', color: INK }}>Análise de exames</h3>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: MUTED, letterSpacing: '-0.02em' }}>Faça upload de PDFs e imagens e receba interpretação e alertas em segundos.</p>
            </div>
            <div style={{ gridColumn: 'span 4', borderRadius: 28, padding: 30, boxSizing: 'border-box', background: '#fff', boxShadow: `inset 0 0 0 1px ${FAINT}`, display: 'flex', alignItems: 'center', gap: 22 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: LAV, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}><svg width="22" height="22" viewBox="0 0 22 22"><rect x="3" y="5" width="16" height="14" rx="2" fill="none" stroke={LAV_TEXT} strokeWidth="1.6" /><line x1="3" y1="9" x2="19" y2="9" stroke={LAV_TEXT} strokeWidth="1.6" /></svg></div>
                <h3 style={{ margin: '0 0 8px', fontWeight: 600, fontSize: 18, letterSpacing: '-0.03em', color: INK }}>Agenda inteligente</h3>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: MUTED, letterSpacing: '-0.02em' }}>Médicos, salas e teleconsultas em uma visão.</p>
              </div>
              <div style={{ flex: 'none', width: 96, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 5 }}>
                {[0, 1, 0, 0, 0, 0, 2, 0, 1, 0, 0, 2].map((v, i) => <span key={i} style={{ aspectRatio: '1', borderRadius: 4, background: v === 1 ? PURPLE : v === 2 ? LAV_BORDER : FAINT }} />)}
              </div>
            </div>
            <div style={{ gridColumn: 'span 4', borderRadius: 28, padding: 30, boxSizing: 'border-box', background: INK, color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 20 }}>
              <h3 style={{ margin: 0, fontWeight: 600, fontSize: 18, letterSpacing: '-0.03em' }}>E muito mais</h3>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: 'rgba(255,255,255,0.7)', letterSpacing: '-0.02em' }}>API, multi-clínica, comparativo entre médicos, relatórios e integrações.</p>
              <a className="c360-arrow" href="#planos" style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: '#fff', fontWeight: 500, fontSize: 14 }}>Ver planos
                <svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 8h9M8 3.5L12.5 8 8 12.5" fill="none" stroke={PURPLE} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ============ COMO FUNCIONA ============ */}
      <section style={{ position: 'relative', background: '#fff', overflow: 'hidden' }}>
        <img src="/landing/isotipo.svg" alt="" style={{ position: 'absolute', bottom: -60, left: -50, width: 300, opacity: 0.05, transform: 'rotate(-20deg)', pointerEvents: 'none' }} />
        <div className="c360-sec c360-grid-2" style={{ position: 'relative', maxWidth: 1440, margin: '0 auto', paddingTop: 130, paddingBottom: 130, boxSizing: 'border-box', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <span style={eyebrow}>COMO FUNCIONA</span>
            <h2 className="c360-h2" style={{ ...h2, fontSize: 42, lineHeight: 1.12, margin: '0 0 24px' }}>Da conversa ao prontuário em 3 passos.</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                ['1', 'Atenda normalmente', 'Converse com o paciente. O Clinical 360 grava e transcreve a consulta com segurança.', PURPLE, true],
                ['2', 'A IA estrutura', 'Em 30 segundos, a IA gera o prontuário SOAP, sugere CIDs e alerta sobre interações e alergias.', PURPLE, true],
                ['3', 'Você revisa e prescreve', 'Confira, ajuste se quiser e prescreva pela Memed. Tudo registrado e em conformidade.', ACCENT, false],
              ].map(([n, t, d, c, line]) => (
                <div key={n as string} style={{ display: 'flex', gap: 20 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none' }}>
                    <span style={{ width: 44, height: 44, borderRadius: '50%', background: c as string, color: '#fff', fontWeight: 600, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n}</span>
                    {line ? <span style={{ flex: 1, width: 2, background: 'linear-gradient(rgb(179,167,236),rgba(179,167,236,0.2))', margin: '6px 0' }} /> : null}
                  </div>
                  <div style={{ paddingBottom: line ? 28 : 0 }}><h3 style={{ margin: '0 0 8px', fontWeight: 600, fontSize: 19, letterSpacing: '-0.03em', color: INK }}>{t}</h3><p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: MUTED, letterSpacing: '-0.02em' }}>{d}</p></div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ position: 'relative', height: 440 }}>
            <div style={{ position: 'absolute', inset: 20, borderRadius: 32, background: 'radial-gradient(circle at 60% 40%,rgba(137,114,255,0.16),transparent 70%)' }} />
            <div style={{ position: 'absolute', top: 30, left: 20, width: 300, background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 24px 50px rgba(99,85,170,0.18)', transform: 'rotate(-4deg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: 'rgb(227,48,51)', animation: 'c360pulse 1.6s ease-in-out infinite' }} /><span style={{ fontWeight: 700, fontSize: 9, letterSpacing: '0.2em', color: 'rgb(227,48,51)' }}>GRAVANDO</span><span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgb(163,168,178)' }}>02:14</span></div>
              <div style={{ background: 'rgb(247,247,250)', borderRadius: '10px 10px 10px 2px', padding: '9px 11px', fontSize: 11, lineHeight: 1.45, color: 'rgb(82,86,95)', maxWidth: '80%', marginBottom: 8 }}>Doutor, dor de cabeça forte do lado direito há três dias...</div>
              <div style={{ background: LAV, borderRadius: '10px 10px 2px 10px', padding: '9px 11px', fontSize: 11, color: 'rgb(80,75,154)', maxWidth: '80%', marginLeft: 'auto' }}>A pressão está controlada?</div>
            </div>
            <div style={{ position: 'absolute', bottom: 20, right: 10, width: 300, background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 30px 60px rgba(99,85,170,0.22)', transform: 'rotate(3deg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}><svg width="14" height="16" viewBox="0 0 9 11"><path d="M5 0L0 6.5h3.5L4 11l5-6.5H5.5L5 0z" fill={LAV_TEXT} /></svg><span style={{ fontWeight: 700, fontSize: 9, letterSpacing: '0.16em', color: LAV_TEXT }}>PRONTUÁRIO GERADO</span></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8 }}><span style={{ width: 18, height: 18, borderRadius: 5, background: LAV, color: LAV_TEXT, fontWeight: 700, fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>S</span><div style={{ fontSize: 10, color: MUTED, lineHeight: 1.4 }}>Cefaleia hemicraniana, fotofobia e emese.</div></div>
                <div style={{ display: 'flex', gap: 8 }}><span style={{ width: 18, height: 18, borderRadius: 5, background: LAV, color: LAV_TEXT, fontWeight: 700, fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>A</span><div style={{ fontSize: 10, color: MUTED, lineHeight: 1.4 }}>Crise de enxaqueca. Investigar gatilhos.</div></div>
                <div style={{ display: 'flex', gap: 6 }}><span style={{ background: LAV, boxShadow: `inset 0 0 0 1px ${LAV_BORDER}`, color: LAV_TEXT, borderRadius: 6, padding: '4px 8px', fontSize: 9 }}>G43.9</span><span style={{ background: 'rgb(220,248,231)', color: 'rgb(34,103,64)', borderRadius: 6, padding: '4px 8px', fontSize: 9 }}>✓ Revisado</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ NÚMEROS ============ */}
      <section className="c360-sec" style={{ maxWidth: 1440, margin: '0 auto', paddingTop: 60, paddingBottom: 120, boxSizing: 'border-box' }}>
        <div className="c360-numbers" style={{ position: 'relative', overflow: 'hidden', background: `linear-gradient(120deg,${PURPLE} 0%,rgb(88,71,174) 100%)`, borderRadius: 32, padding: '72px 64px', boxSizing: 'border-box' }}>
          <img src="/landing/isotipo.svg" alt="" style={{ position: 'absolute', top: -70, right: -50, width: 340, opacity: 0.16, filter: 'brightness(0) invert(1)', transform: 'rotate(14deg)', pointerEvents: 'none' }} />
          <img src="/landing/isotipo.svg" alt="" style={{ position: 'absolute', bottom: -90, left: -40, width: 260, opacity: 0.10, filter: 'brightness(0) invert(1)', transform: 'rotate(-24deg)', pointerEvents: 'none' }} />
          <span style={{ position: 'relative', display: 'inline-flex', padding: '5px 16px', borderRadius: 32, background: 'rgba(255,255,255,0.14)', color: '#fff', fontWeight: 600, fontSize: 12, letterSpacing: '0.2em', marginBottom: 40 }}>RESULTADOS REAIS</span>
          <div className="c360-grid-4" style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 32 }}>
            {[['30s', 'para gerar um prontuário SOAP completo'], ['12h', 'economizadas por mês em papelada, por médico'], ['−38%', 'de faltas com a Sofia confirmando no WhatsApp'], ['100%', 'em conformidade com a LGPD']].map(([n, d]) => (
              <div key={n} style={{ display: 'flex', flexDirection: 'column', gap: 10, borderLeft: '1px solid rgba(255,255,255,0.18)', paddingLeft: 24 }}>
                <span style={{ fontWeight: 600, fontSize: 60, letterSpacing: '-0.05em', color: '#fff', lineHeight: 1 }}>{n}</span>
                <span style={{ fontSize: 15, lineHeight: 1.5, color: 'rgba(255,255,255,0.82)', letterSpacing: '-0.02em' }}>{d}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ DEPOIMENTOS ============ */}
      <section style={{ background: 'rgb(250,250,250)' }}>
        <div className="c360-sec" style={{ maxWidth: 1440, margin: '0 auto', paddingTop: 120, paddingBottom: 120, boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', marginBottom: 56 }}>
            <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <span style={eyebrow}>DEPOIMENTOS</span>
              <h2 className="c360-h2" style={h2}>Médicos que recuperaram o tempo deles.</h2>
            </div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: '#fff', boxShadow: '0 2px 5px rgba(0,0,0,0.04)', borderRadius: 100, padding: '10px 18px', fontSize: 14, color: INK, fontWeight: 500 }}><span style={{ fontWeight: 700, color: PURPLE }}>4.9/5</span> · +1.200 médicos</span>
          </div>
          <div className="c360-bento" style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 24, alignItems: 'start' }}>
            <div style={{ gridColumn: 'span 5', position: 'relative', overflow: 'hidden', borderRadius: 28, padding: 40, boxSizing: 'border-box', background: `linear-gradient(150deg,${PURPLE},rgb(88,71,174))`, color: '#fff', display: 'flex', flexDirection: 'column', gap: 32, minHeight: 340 }}>
              <img src="/landing/isotipo.svg" alt="" style={{ position: 'absolute', top: -40, right: -30, width: 180, opacity: 0.18, filter: 'brightness(0) invert(1)' }} />
              <p style={{ margin: 0, fontSize: 24, lineHeight: 1.5, letterSpacing: '-0.02em', fontWeight: 500 }}>&ldquo;Antes eu levava o prontuário pra casa. Hoje saio do consultório com tudo pronto.&rdquo;</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 'auto' }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: "rgba(255,255,255,0.25) url('/landing/hero.jpg') center/cover", flex: 'none', boxShadow: '0 0 0 2px rgba(255,255,255,0.4)' }} />
                <div><div style={{ fontWeight: 600, fontSize: 16 }}>Dra. Helena Martins</div><div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>Clínica Geral · São Paulo</div></div>
              </div>
            </div>
            <div style={{ gridColumn: 'span 7', display: 'flex', flexDirection: 'column', gap: 24 }}>
              {[
                ['"A IA me lembra das interações e alergias antes de prescrever. Mudou minha rotina por completo."', 'Dr. Rafael Souza', 'Cardiologista · Belo Horizonte', 0],
                ['"A Sofia reduziu minhas faltas pela metade. A recepção respira de novo."', 'Dra. Camila Nunes', 'Endocrinologista · Recife', 40],
              ].map(([q, n, r, ml]) => (
                <div key={n as string} style={{ background: '#fff', borderRadius: 24, padding: 32, boxShadow: '0 2px 5px rgba(0,0,0,0.03),0 12px 24px rgba(99,85,170,0.05)', display: 'flex', flexDirection: 'column', gap: 20, marginLeft: ml as number }}>
                  <p style={{ margin: 0, fontSize: 18, lineHeight: 1.6, color: INK, letterSpacing: '-0.02em' }}>{q}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'repeating-linear-gradient(45deg,#eceaf6,#eceaf6 6px,#e3def2 6px,#e3def2 12px)', flex: 'none' }} />
                    <div><div style={{ fontWeight: 600, fontSize: 15, color: INK }}>{n}</div><div style={{ fontSize: 13, color: MUTED }}>{r}</div></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ INTEGRAÇÕES ============ */}
      <section style={{ position: 'relative', background: '#fff', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 640, height: 640, borderRadius: '50%', background: 'radial-gradient(circle,rgba(137,114,255,0.10),transparent 68%)', pointerEvents: 'none' }} />
        <div className="c360-sec" style={{ position: 'relative', maxWidth: 1440, margin: '0 auto', paddingTop: 120, paddingBottom: 120, boxSizing: 'border-box' }}>
          <div style={{ maxWidth: 680, margin: '0 auto 32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <span style={{ ...eyebrow, alignSelf: 'center' }}>INTEGRAÇÕES</span>
            <h2 className="c360-h2" style={h2}>Conecta com o que você já usa.</h2>
          </div>
          <div className="c360-orbit" style={{ position: 'relative', width: '100%', maxWidth: 860, height: 480, margin: '0 auto' }}>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 300, height: 300, borderRadius: '50%', border: '1.5px dashed rgb(218,212,244)' }} />
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 500, height: 500, borderRadius: '50%', border: '1.5px dashed rgb(232,228,248)' }} />
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 120, height: 120, borderRadius: '50%', background: '#fff', boxShadow: '0 20px 50px rgba(99,85,170,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><img src="/landing/isotipo.svg" alt="Clinical 360" style={{ width: 52, height: 52, animation: 'c360spin 26s linear infinite' }} /></div>
            {[
              { pos: { top: 14, left: '50%', transform: 'translateX(-50%)' }, dot: PURPLE, label: 'Memed', anim: 'c360bob 6.5s ease-in-out infinite' },
              { pos: { top: 130, right: 30 }, dot: 'rgb(37,211,102)', label: 'WhatsApp', anim: 'c360bob 7.5s ease-in-out infinite', delay: '-2s' },
              { pos: { bottom: 130, right: 20 }, dot: PURPLE, label: 'Google Agenda', anim: 'c360bob 6s ease-in-out infinite', delay: '-3s' },
              { pos: { bottom: 14, left: '50%', transform: 'translateX(-50%)' }, dot: LAV_BORDER, label: 'ICP-Brasil', anim: 'c360bob 8s ease-in-out infinite', delay: '-1s' },
              { pos: { bottom: 130, left: 20 }, dot: LAV_BORDER, label: 'TISS / Convênios', anim: 'c360bob 6.8s ease-in-out infinite', delay: '-2.5s' },
              { pos: { top: 130, left: 30 }, dot: PURPLE, label: 'API REST', anim: 'c360bob 7.2s ease-in-out infinite', delay: '-1.5s' },
            ].map((it, i) => (
              <div key={i} style={{ position: 'absolute', ...(it.pos as any), background: '#fff', boxShadow: '0 8px 20px rgba(99,85,170,0.12)', borderRadius: 100, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 8, animation: it.anim, animationDelay: (it as any).delay }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: it.dot }} /><span style={{ fontFamily: 'ui-monospace,monospace', fontSize: 13, color: INK }}>{it.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ SEGURANÇA ============ */}
      <section style={{ position: 'relative', background: 'rgb(250,250,250)', overflow: 'hidden' }}>
        <div className="c360-sec c360-grid-2" style={{ position: 'relative', maxWidth: 1440, margin: '0 auto', paddingTop: 120, paddingBottom: 120, boxSizing: 'border-box', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 72, alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <span style={eyebrow}>SEGURANÇA</span>
            <h2 className="c360-h2" style={{ ...h2, fontSize: 42, lineHeight: 1.12 }}>Dados de saúde tratados com o cuidado que merecem.</h2>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: MUTED, letterSpacing: '-0.02em' }}>Privacidade por padrão, do consentimento do paciente ao backup. Você no comando de cada registro.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
              {[
                ['Conformidade LGPD.', 'DPO designado, consentimento expresso e dados como categoria especial.'],
                ['Criptografia ponta a ponta.', 'Dados protegidos em trânsito e repouso, com backup contínuo (PITR).'],
                ['A IA sugere, o médico aprova.', 'Nada é registrado no prontuário sem a sua confirmação.'],
              ].map(([t, d]) => (
                <div key={t} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <svg width="22" height="22" viewBox="0 0 22 22" style={{ flex: 'none', marginTop: 1 }}><circle cx="11" cy="11" r="11" fill="rgba(137,114,255,0.12)" /><path d="M6 11.4l3 3 7-7.5" fill="none" stroke={ACCENT} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <div><span style={{ fontWeight: 600, fontSize: 16, color: INK }}>{t}</span> <span style={{ fontSize: 16, color: MUTED, lineHeight: 1.6 }}>{d}</span></div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
              {['LGPD', 'ICP-Brasil', 'Criptografia AES-256'].map(t => <span key={t} style={{ background: '#fff', boxShadow: 'inset 0 0 0 1px rgb(226,228,239)', borderRadius: 100, padding: '8px 16px', fontSize: 13, fontWeight: 600, color: ACCENT }}>{t}</span>)}
            </div>
          </div>
          <div style={{ position: 'relative', height: 420 }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: 32, background: 'radial-gradient(circle at 50% 40%,rgba(137,114,255,0.14),transparent 70%)' }} />
            <div style={{ position: 'absolute', top: 40, left: 30, right: 60, background: '#fff', borderRadius: 18, padding: 22, boxShadow: '0 24px 50px rgba(99,85,170,0.16)', transform: 'rotate(-3deg)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', color: 'rgb(163,168,178)', marginBottom: 14 }}>CONTROLE DE ACESSO</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ width: 30, height: 30, borderRadius: '50%', background: LAV, color: 'rgb(80,75,154)', fontWeight: 700, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>MA</div><div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 600, color: INK }}>Dra. Maria Alves</div><div style={{ fontSize: 10, color: 'rgb(149,153,161)' }}>Médico · acesso total</div></div><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgb(37,211,102)' }} /></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ width: 30, height: 30, borderRadius: '50%', background: FAINT, color: MUTED, fontWeight: 700, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>RC</div><div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 600, color: INK }}>Recepção</div><div style={{ fontSize: 10, color: 'rgb(149,153,161)' }}>Agenda · sem prontuário</div></div><span style={{ width: 8, height: 8, borderRadius: '50%', background: LAV_BORDER }} /></div>
              </div>
            </div>
            <div style={{ position: 'absolute', bottom: 36, right: 20, width: 230, background: '#fff', borderRadius: 18, padding: 20, boxShadow: '0 30px 60px rgba(99,85,170,0.2)', transform: 'rotate(3deg)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(137,114,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="18" height="18" viewBox="0 0 22 22"><rect x="5" y="9" width="12" height="9" rx="2" fill="none" stroke={LAV_TEXT} strokeWidth="1.8" /><path d="M8 9V7a3 3 0 016 0v2" fill="none" stroke={LAV_TEXT} strokeWidth="1.8" /></svg></span><div style={{ fontSize: 12, fontWeight: 600, color: INK, lineHeight: 1.3 }}>Backup ativo<br /><span style={{ fontWeight: 500, color: 'rgb(149,153,161)', fontSize: 10 }}>há 2 minutos</span></div></div>
              <div style={{ height: 6, borderRadius: 100, background: FAINT, overflow: 'hidden' }}><div style={{ width: '100%', height: '100%', background: 'rgb(37,211,102)' }} /></div>
              <span style={{ fontSize: 10, color: 'rgb(34,103,64)', fontWeight: 600 }}>✓ Criptografado · ICP-Brasil</span>
            </div>
          </div>
        </div>
      </section>

      {/* ============ PLANOS ============ */}
      <section id="planos" style={{ background: 'rgb(250,250,250)' }}>
        <div className="c360-sec" style={{ maxWidth: 1440, margin: '0 auto', paddingTop: 130, paddingBottom: 130, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 48 }}>
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, maxWidth: 600 }}>
            <span style={{ ...eyebrow, alignSelf: 'center' }}>PLANOS</span>
            <h2 className="c360-h2" style={h2}>Escolha o plano<br />da sua operação.</h2>
            <p style={{ margin: 0, fontSize: 14, color: MUTED, letterSpacing: '-0.02em' }}>Sem fidelidade. Cancele quando quiser.</p>
          </div>
          <div style={{ display: 'flex', gap: 6, padding: 6, borderRadius: 16, background: 'rgb(244,244,248)', boxShadow: 'inset 0 0 0 1px rgb(232,232,238)' }}>
            {(['mensal', 'anual'] as const).map(b => {
              const on = billing === b
              return (
                <button key={b} onClick={() => setBilling(b)} style={{ border: 'none', cursor: 'pointer', borderRadius: 11, padding: b === 'anual' ? '10px 18px' : '10px 22px', fontFamily: 'inherit', fontWeight: 600, fontSize: 15, letterSpacing: '-0.02em', transition: 'all .2s ease', display: 'inline-flex', alignItems: 'center', gap: 8, ...(on ? { background: '#fff', color: 'rgb(40,42,52)', boxShadow: '0 1px 3px rgba(20,20,40,0.14)' } : { background: 'transparent', color: 'rgb(122,124,132)' }) }}>
                  {b === 'mensal' ? 'Mensal' : 'Anual'}
                  {b === 'anual' ? <span style={{ background: LAV, color: PURPLE, borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700 }}>20% OFF</span> : null}
                </button>
              )
            })}
          </div>
          <div className="c360-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 32, width: '100%', alignItems: 'stretch' }}>
            {PLANS.map(p => (
              <div key={p.name} className="c360-plan" style={{ background: '#fff', borderRadius: 16, padding: 32, display: 'flex', flexDirection: 'column', gap: 40, boxSizing: 'border-box', minWidth: 0, ...(p.highlight ? { boxShadow: `0 0 0 2px ${PURPLE}, 0 30px 70px rgba(99,85,170,0.20)`, transform: 'translateY(-10px)' } : { boxShadow: '0 2px 5px rgba(0,0,0,0.04), 0 9px 9px rgba(0,0,0,0.03)' }) }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 28 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, letterSpacing: '0.2em', color: ACCENT }}>{p.name}</span>
                    {p.badge ? <span style={{ background: PURPLE, color: '#fff', borderRadius: 8, padding: '5px 12px', fontWeight: 600, fontSize: 11, letterSpacing: '0.14em' }}>{p.badge}</span> : null}
                  </div>
                  <span style={{ fontSize: 14, color: MUTED, letterSpacing: '-0.02em' }}>{p.desc}</span>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                    <span style={{ fontWeight: 500, fontSize: 18, color: INK }}>R$</span>
                    <span style={{ fontWeight: 600, fontSize: 60, lineHeight: 0.9, letterSpacing: '-0.05em', color: INK }}>{isAnual ? p.annualPerMonth : p.monthly}</span>
                    <span style={{ fontSize: 16, color: MUTED, marginBottom: 6 }}>/mês</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: '-0.02em', color: isAnual ? 'rgb(29,137,116)' : 'rgb(149,153,161)' }}>{isAnual ? `R$ ${p.annualTotal} cobrados anualmente` : 'cobrado mensalmente'}</span>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {p.features.map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <svg width="18" height="18" viewBox="0 0 18 18" style={{ flex: 'none' }}><circle cx="9" cy="9" r="9" fill="rgba(137,114,255,0.12)" /><path d="M5 9.4l2.4 2.4L13 6.4" fill="none" stroke={ACCENT} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      <span style={{ fontSize: 15, color: 'rgb(82,86,95)', letterSpacing: '-0.02em' }}>{f}</span>
                    </div>
                  ))}
                </div>
                <button className="c360-btn c360-btn--primary" onClick={irCadastro} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', background: PURPLE, color: '#fff', borderRadius: 16, padding: 16, fontWeight: 500, fontSize: 16, letterSpacing: '-0.02em', marginTop: 8, fontFamily: 'inherit' }}>{logado ? 'Ir para a plataforma' : 'Comece grátis'}</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section id="faq" className="c360-sec c360-faqwrap" style={{ maxWidth: 1440, margin: '0 auto', paddingTop: 130, paddingBottom: 130, boxSizing: 'border-box', display: 'flex', gap: 120, alignItems: 'flex-start' }}>
        <div className="c360-faqhead" style={{ flex: 'none', width: 380, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <span style={eyebrow}>FAQ</span>
          <h2 className="c360-h2" style={h2}>Perguntas frequentes</h2>
          <p style={{ margin: '8px 0 0', fontSize: 16, lineHeight: 1.6, color: MUTED, letterSpacing: '-0.02em' }}>Não achou o que procurava? Fale com a gente em <span style={{ color: ACCENT }}>contato@clinical360.app</span>.</p>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {FAQS.map((f, i) => {
            const open = openFaq === i
            return (
              <div key={i} style={{ borderBottom: `1px solid ${FAINT}`, padding: '28px 0' }}>
                <button onClick={() => setOpenFaq(open ? -1 : i)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, textAlign: 'left', fontFamily: 'inherit' }}>
                  <span style={{ fontWeight: 600, fontSize: 17, color: INK, letterSpacing: '-0.02em' }}>{f.q}</span>
                  <svg width="22" height="22" viewBox="0 0 22 22" style={{ flex: 'none', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .45s cubic-bezier(.4,0,.2,1)' }}><path d="M6 9l5 5 5-5" fill="none" stroke={PURPLE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                <div style={{ overflow: 'hidden', maxHeight: open ? 320 : 0, opacity: open ? 1 : 0, marginTop: open ? 16 : 0, transition: 'max-height .55s cubic-bezier(.4,0,.2,1), opacity .45s ease, margin-top .55s cubic-bezier(.4,0,.2,1)' }}>
                  <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: 'rgb(132,135,143)', letterSpacing: '-0.02em', maxWidth: 560 }}>{f.a}</p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ============ CTA BAND ============ */}
      <section style={{ position: 'relative', overflow: 'hidden', background: 'rgb(88,71,174)' }}>
        <div style={{ background: `linear-gradient(90deg,${PURPLE} 0%,rgb(88,71,174) 100%)` }}>
          <div className="c360-sec" style={{ maxWidth: 1440, margin: '0 auto', paddingTop: 24, paddingBottom: 24, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}><img src="/landing/isotipo.svg" alt="" style={{ width: 28, height: 28, filter: 'brightness(0) invert(1)' }} /><span style={{ color: '#fff', fontSize: 16, letterSpacing: '-0.02em' }}>Pare de perder tempo com prontuário e comece hoje mesmo.</span></div>
            <button className="c360-btn c360-btn--white" onClick={irCadastro} style={{ border: 'none', cursor: 'pointer', background: '#fff', color: PURPLE, borderRadius: 16, padding: '13px 32px', fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em', fontFamily: 'inherit' }}>{logado ? 'Ir para a plataforma' : 'Comece grátis'}</button>
          </div>
        </div>
        <div style={{ position: 'relative', background: "rgb(88,71,174) url('/landing/cta.jpg') center/cover" }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,rgba(70,55,150,0.9) 0%,rgba(70,55,150,0.55) 60%,rgba(70,55,150,0.3) 100%)' }} />
          <div className="c360-sec" style={{ position: 'relative', maxWidth: 1440, margin: '0 auto', paddingTop: 96, paddingBottom: 96, boxSizing: 'border-box' }}>
            <div style={{ maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 24 }}>
              <h2 className="c360-h2" style={{ ...h2, color: '#fff' }}>Pare de perder tempo com prontuário.</h2>
              <p style={{ margin: 0, fontSize: 16, color: 'rgba(255,255,255,0.9)', letterSpacing: '-0.02em' }}>Comece grátis hoje. Sem cartão de crédito.</p>
              <button className="c360-btn c360-btn--white-lg" onClick={irCadastro} style={{ alignSelf: 'flex-start', border: 'none', cursor: 'pointer', background: '#fff', color: PURPLE, borderRadius: 16, padding: '16px 36px', fontWeight: 500, fontSize: 16, letterSpacing: '-0.02em', fontFamily: 'inherit' }}>{logado ? 'Ir para a plataforma' : 'Comece grátis'}</button>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer style={{ background: '#fff', overflow: 'hidden' }}>
        <div className="c360-sec" style={{ maxWidth: 1440, margin: '0 auto', paddingTop: 104, boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 48, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 48, maxWidth: 303 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <img src="/landing/logo-clinical.svg" alt="Clinical 360" style={{ height: 29, width: 'auto', alignSelf: 'flex-start' }} />
                <p style={{ margin: 0, fontSize: 16, color: MUTED, letterSpacing: '-0.02em' }}>Prontuário com IA para clínicas modernas.</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <span style={{ fontWeight: 600, fontSize: 13, letterSpacing: '0.2em', color: INK }}>CONTATO</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={{ fontSize: 14, color: 'rgb(194,196,202)' }}>E-mail para contato</span><span style={{ fontSize: 16, color: MUTED }}>contato@clinical360.app</span></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={{ fontSize: 14, color: 'rgb(194,196,202)' }}>WhatsApp</span><span style={{ fontSize: 16, color: MUTED }}>+55 11 91257 0058</span></div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 96, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <span style={{ fontWeight: 600, fontSize: 13, letterSpacing: '0.2em', color: INK }}>PRODUTO</span>
                <a className="c360-footlink" href="#recursos" style={{ textDecoration: 'none', fontSize: 16, color: MUTED }}>Recursos</a>
                <a className="c360-footlink" href="#planos" style={{ textDecoration: 'none', fontSize: 16, color: MUTED }}>Planos</a>
                <a className="c360-footlink" href="#faq" style={{ textDecoration: 'none', fontSize: 16, color: MUTED }}>FAQ</a>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <span style={{ fontWeight: 600, fontSize: 13, letterSpacing: '0.2em', color: INK }}>EMPRESA</span>
                <a className="c360-footlink" href="#top" style={{ textDecoration: 'none', fontSize: 16, color: MUTED }}>Sobre</a>
                <a className="c360-footlink" href="#faq" style={{ textDecoration: 'none', fontSize: 16, color: MUTED }}>Contato</a>
                <a className="c360-footlink" href="#top" style={{ textDecoration: 'none', fontSize: 16, color: MUTED }}>Blog</a>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <span style={{ fontWeight: 600, fontSize: 13, letterSpacing: '0.2em', color: INK }}>REDES SOCIAIS</span>
                <a className="c360-footlink" href="#top" style={{ textDecoration: 'none', fontSize: 16, color: MUTED }}>Instagram</a>
                <a className="c360-footlink" href="#top" style={{ textDecoration: 'none', fontSize: 16, color: MUTED }}>LinkedIn</a>
                <a className="c360-footlink" href="#top" style={{ textDecoration: 'none', fontSize: 16, color: MUTED }}>Twitter</a>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', marginTop: 64, paddingBottom: 40 }}>
            <span style={{ fontSize: 15, color: MUTED }}>© 2026 Clinical 360. Todos os direitos reservados.</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
              <a className="c360-footlink" href="/privacidade" style={{ textDecoration: 'none', fontSize: 15, color: MUTED }}>Privacidade</a>
              <a className="c360-footlink" href="/termos" style={{ textDecoration: 'none', fontSize: 15, color: MUTED }}>Termos de uso</a>
              <a className="c360-footlink" href="#top" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', fontSize: 15, color: MUTED }}><svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 11V3M3.5 6.5L7 3l3.5 3.5" fill="none" stroke={PURPLE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>Voltar ao topo</a>
            </div>
          </div>
          <div className="c360-wordmark" style={{ fontWeight: 700, fontSize: 240, lineHeight: 0.8, letterSpacing: '-0.05em', color: 'rgb(248,248,250)', whiteSpace: 'nowrap', userSelect: 'none', margin: '0 0 -40px -8px' }}>Clinical 360</div>
        </div>
      </footer>
    </div>
  )
}
