'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { tokens } from '@/lib/design-tokens'

export default function HomePage() {
  const router = useRouter()
  const [verificado, setVerificado] = useState(false)
  const [periodo, setPeriodo] = useState<'mensal' | 'anual'>('anual')

  useEffect(() => {
    try {
      const rawAdmin = localStorage.getItem('clinica_admin')
      if (rawAdmin) {
        const admin = JSON.parse(rawAdmin)
        if (!admin.onboarding_concluido) router.replace('/onboarding')
        else router.replace('/dashboard')
        return
      }
      const rawMedico = localStorage.getItem('medico')
      if (rawMedico) {
        const medico = JSON.parse(rawMedico)
        if (!medico.onboarding_concluido) router.replace('/onboarding')
        else router.replace('/dashboard')
        return
      }
      setVerificado(true)
    } catch {
      setVerificado(true)
    }
  }, [router])

  if (!verificado) {
    return (
      <div style={{ minHeight: '100vh', background: tokens.bg.hover, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: `2px solid ${tokens.brand.primary}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{"@keyframes spin { to { transform: rotate(360deg) } }"}</style>
      </div>
    )
  }

  return <Landing periodo={periodo} setPeriodo={setPeriodo} router={router} />
}

function Landing({ periodo, setPeriodo, router }: any) {
  const titulo = { fontWeight: 500 as const, letterSpacing: '-0.03em' as const, lineHeight: 1.05 }
  return (
    <div style={{ minHeight: '100vh', background: 'white', color: tokens.neutral[900] }}>
      <style>{`
        .lp-nav-links { display: flex; gap: 22px; }
        .lp-hero-h1 { font-size: 60px; }
        .lp-hero-sub { font-size: 18px; }
        .lp-section-h2 { font-size: 38px; }
        .lp-cta-final-h2 { font-size: 44px; }
        .lp-grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px; }
        .lp-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .lp-grid-features { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }
        .lp-footer-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 32px; }
        .lp-section { padding: 80px 24px; }
        .lp-hero { padding: 80px 24px 60px; }
        .lp-banner-text { display: inline; }
        .lp-logo-cloud { gap: 32px; }
        .lp-pricing-toggle { font-size: 13px; }

        @media (max-width: 768px) {
          .lp-hamburger { display: block !important; }
          .lp-nav-entrar { display: none !important; }
          .lp-nav-actions button[style*="background: rgb(10, 10, 10)"]:not(.lp-hamburger) { display: none !important; }
          .lp-nav-links { display: none; }
          .lp-hero-h1 { font-size: 36px !important; line-height: 1.1; }
          .lp-hero-sub { font-size: 15px; }
          .lp-section-h2 { font-size: 26px !important; line-height: 1.15; }
          .lp-cta-final-h2 { font-size: 28px !important; line-height: 1.15; }
          .lp-grid-2 { grid-template-columns: 1fr !important; }
          .lp-grid-3 { grid-template-columns: 1fr !important; }
          .lp-grid-features { grid-template-columns: 1fr !important; }
          .lp-footer-grid { grid-template-columns: 1fr 1fr !important; gap: 24px !important; }
          .lp-section { padding: 56px 20px !important; }
          .lp-hero { padding: 48px 20px 40px !important; }
          .lp-logo-cloud { gap: 20px !important; row-gap: 12px !important; }
          .lp-banner-text { display: block; font-size: 12px; line-height: 1.4; }
          .lp-pricing-cta-row { flex-direction: column; }
          .lp-plano-destaque { transform: none !important; }
        }

        @media (max-width: 480px) {
          .lp-hero-h1 { font-size: 32px !important; }
          .lp-section-h2 { font-size: 24px !important; }
        }
      `}</style>
      {/* BANNER URGENCIA */}
      <div style={{ background: tokens.neutral[900], color: 'white', padding: '10px 24px', textAlign: 'center' as const, fontSize: 13 }}>
        <span className="lp-banner-text">🎉 Primeiras 50 clínicas: 30% OFF no primeiro ano. </span><a href="#planos" style={{ color: tokens.accent.violet, fontWeight: 600, textDecoration: 'underline' }}>Garantir minha vaga →</a>
      </div>

      {/* NAV */}
      <NavBar router={router}/>

      {/* HERO */}
      <section className="lp-hero" style={{ textAlign: 'center' as const }}>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: tokens.brand.primaryLight, borderRadius: 20, marginBottom: 24, fontSize: 12, fontWeight: 600, color: tokens.brand.primary }}>
            <span style={{ width: 5, height: 5, background: tokens.brand.primary, borderRadius: '50%' }}/>
            AI-First · Plataforma médica que pensa por você
          </div>
          <h1 className="lp-hero-h1" style={{ ...titulo, margin: '0 0 22px' }}>
            Prontuário com IA<br/>
            <span style={{ color: tokens.brand.primary }}>que devolve seu tempo.</span>
          </h1>
          <p className="lp-hero-sub" style={{ color: tokens.text.muted, lineHeight: 1.55, margin: '0 0 36px', maxWidth: 600, marginLeft: 'auto', marginRight: 'auto' }}>
            Grava a consulta, gera prontuário SOAP, prescreve via Memed e atende paciente no WhatsApp — tudo automático. Você só atende.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' as const }}>
            <button onClick={() => router.push('/cadastro')} style={{ padding: '14px 26px', borderRadius: 10, background: tokens.neutral[900], color: 'white', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Assinar agora →
            </button>
            <button onClick={() => document.getElementById('planos')?.scrollIntoView({ behavior: 'smooth' })} style={{ padding: '14px 26px', borderRadius: 10, background: 'white', color: tokens.neutral[900], border: `1px solid ${tokens.neutral[200]}`, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Ver planos
            </button>
          </div>
          <p style={{ fontSize: 12, color: tokens.text.tertiary, margin: '18px 0 0' }}>
            Trial de 7 dias no plano Solo · Sem fidelidade · Cancele quando quiser
          </p>
        </div>

        {/* Mockup */}
        <div style={{ maxWidth: 1100, margin: '60px auto 0', padding: '0 24px' }}>
          <div style={{ background: `linear-gradient(135deg, ${tokens.brand.primary} 0%, ${tokens.appointment.exame.dot} 100%)`, borderRadius: 20, padding: 8, boxShadow: '0 30px 80px -20px rgba(96,67,193,0.4)' }}>
            <div style={{ background: tokens.bg.hover, borderRadius: 14, padding: '80px 30px', textAlign: 'center' as const, fontSize: 13, color: tokens.text.secondary }}>
              [Screenshot da plataforma — em produção será imagem real da nova-consulta]
            </div>
          </div>
        </div>
      </section>

      {/* ANTES vs COM Clinical 360 */}
      <section className="lp-section" style={{ background: tokens.bg.page }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center' as const, marginBottom: 48 }}>
            <p style={selo}>Por que Clinical 360</p>
            <h2 className="lp-section-h2" style={{ ...titulo, margin: '0 0 12px' }}>Antes você atendia papelada.<br/>Agora você atende pacientes.</h2>
          </div>
          <div className="lp-grid-2">
            <div style={{ background: 'white', borderRadius: 16, padding: 32, border: `1px solid ${tokens.neutral[150]}` }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: tokens.status.danger, textTransform: 'uppercase' as const, letterSpacing: '0.08em' as const, margin: '0 0 16px' }}>Antes</p>
              <ul style={{ listStyle: 'none' as const, padding: 0, margin: 0 }}>
                <ItemLista negativo texto="20-30 minutos digitando prontuário após cada consulta"/>
                <ItemLista negativo texto="Receita em papel ou sistema separado"/>
                <ItemLista negativo texto="Paciente liga no telefone pra confirmar consulta"/>
                <ItemLista negativo texto="Sem visão das métricas da clínica"/>
                <ItemLista negativo texto="Múltiplas plataformas pra agenda, prontuário e teleconsulta"/>
              </ul>
            </div>
            <div style={{ background: tokens.neutral[900], borderRadius: 16, padding: 32, color: 'white' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: tokens.accent.violet, textTransform: 'uppercase' as const, letterSpacing: '0.08em' as const, margin: '0 0 16px' }}>Com Clinical 360</p>
              <ul style={{ listStyle: 'none' as const, padding: 0, margin: 0 }}>
                <ItemLista positivo dark texto="Prontuário SOAP gerado pela IA em 30 segundos"/>
                <ItemLista positivo dark texto="Receita digital Memed com validade legal ICP-Brasil"/>
                <ItemLista positivo dark texto="Sofia (IA no WhatsApp) confirma e remarca sozinha"/>
                <ItemLista positivo dark texto="Dashboard com no-show rate e pacientes em risco"/>
                <ItemLista positivo dark texto="Tudo em um lugar — agenda, prontuário, teleconsulta, IA"/>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="lp-section" style={{ }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center' as const, marginBottom: 48 }}>
            <p style={selo}>Recursos</p>
            <h2 className="lp-section-h2" style={{ ...titulo, margin: '0 0 12px' }}>Tudo que sua clínica precisa.<br/>E IA em cada canto.</h2>
            <p style={{ fontSize: 15, color: tokens.text.muted, maxWidth: 540, margin: '0 auto' }}>
              Os concorrentes vendem IA como módulo extra. No Clinical 360, IA é o ponto de partida.
            </p>
          </div>

          <div className="lp-grid-features">
            <FeatureCard
              icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={tokens.brand.primary} strokeWidth="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/></svg>}
              titulo="IA na consulta"
              descricao="Grava a conversa médico-paciente e gera prontuário SOAP automático com CIDs sugeridos. Você revisa em 30 segundos."
            />
            <FeatureCard
              logo="/memed-logo.svg"
              titulo="Prescrição via Memed"
              descricao="Receita com validade legal ICP-Brasil. Envio direto pra farmácia. Integração nativa com a maior plataforma de prescrição do Brasil."
            />
            <FeatureCard
              icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={tokens.brand.primary} strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>}
              titulo="Sofia no WhatsApp"
              descricao="IA que atende seus pacientes 24/7. Marca consultas, tira dúvidas, confirma horários, lembra exames. Reduz no-show em até 40%."
            />
            <FeatureCard
              icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={tokens.brand.primary} strokeWidth="2"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>}
              titulo="Análise de exames com IA"
              descricao="IA lê o exame, destaca alterações relevantes e sugere conduta clínica. Tempo de análise: 2 minutos por exame."
            />
            <FeatureCard
              icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={tokens.brand.primary} strokeWidth="2"><path d="M3 3v18h18"/><path d="M7 12l4-4 4 4 5-5"/></svg>}
              titulo="Dashboard inteligente"
              descricao="No-show rate, pacientes em risco, CIDs frequentes, comparativo entre médicos. Métricas que importam pra gestão."
            />
            <FeatureCard
              icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={tokens.brand.primary} strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
              titulo="Agenda + teleconsulta nativa"
              descricao="Calendário visual com drag-and-drop. Vídeo nativo no seu domínio próprio. Sem instalar nada. Lembretes automáticos."
            />
          </div>
        </div>
      </section>

      {/* DIFERENCIAIS */}
      <section className="lp-section" style={{ background: tokens.bg.page }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center' as const, marginBottom: 48 }}>
            <p style={selo}>Diferenciais</p>
            <h2 className="lp-section-h2" style={{ ...titulo, margin: '0 0 12px' }}>O que só o Clinical 360 tem.</h2>
          </div>

          <div className="lp-grid-2">
            <Diferencial
              icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={tokens.brand.primary} strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>}
              titulo="Teleconsulta com seu domínio"
              descricao="Sala de vídeo personalizada com sua marca. Logo da clínica, cores, URL própria (consulta.suaclinica.com.br). Diferente do Google Meet genérico."
              destaque="Único no mercado"
            />
            <Diferencial
              icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={tokens.brand.primary} strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>}
              titulo="Modo Perfeita (copiloto)"
              descricao="IA acompanha a consulta em tempo real e sugere perguntas, alerta sobre alergias do paciente e indica possíveis diagnósticos enquanto você atende."
            />
            <Diferencial
              icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={tokens.brand.primary} strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
              titulo="Memed nativo (não plugin)"
              descricao="Prescrição digital integrada na nova consulta. Médico não sai da plataforma, paciente recebe a receita por SMS, validade ICP-Brasil garantida."
            />
            <Diferencial
              icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={tokens.brand.primary} strokeWidth="2"><path d="M9 11H1l8-8 8 8h-8v8H1z" transform="rotate(180 9 11)"/></svg>}
              titulo="LGPD-first desde o dia 1"
              descricao="Dados de saúde tratados como categoria especial. DPO designado, consentimento expresso, criptografia em repouso, backup PITR. Sem letras miúdas."
            />
          </div>
        </div>
      </section>

      {/* PARA QUEM */}
      <section id="paraquem" className="lp-section" style={{ }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center' as const, marginBottom: 48 }}>
            <p style={selo}>Para quem</p>
            <h2 className="lp-section-h2" style={{ ...titulo, margin: '0 0 12px' }}>Funciona pra todo tamanho de clínica.</h2>
          </div>

          <div className="lp-grid-3">
            <ParaQuem icon="👨‍⚕️" titulo="Médico solo" descricao="Consultório próprio, atende sozinho ou com 1 secretária. Quer parar de gastar 20min escrevendo prontuário."/>
            <ParaQuem icon="🏥" titulo="Clínica média" descricao="2 a 10 médicos, recepção, gestão profissional. Precisa de visão consolidada e produtividade da equipe."/>
            <ParaQuem icon="🏨" titulo="Rede / Grande clínica" descricao="Múltiplas unidades, dezenas de médicos, gestão centralizada. Precisa API, multi-clínica, suporte dedicado."/>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="planos" className="lp-section" style={{ background: tokens.bg.page }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center' as const, marginBottom: 36 }}>
            <p style={selo}>Planos</p>
            <h2 className="lp-section-h2" style={{ ...titulo, margin: '0 0 12px' }}>Escolha o plano da sua operação.</h2>
            <p style={{ fontSize: 15, color: tokens.text.muted }}>Sem fidelidade. Cancele quando quiser.</p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
            <div style={{ display: 'flex', background: 'white', borderRadius: 10, padding: 4, border: `1px solid ${tokens.neutral[200]}` }}>
              <button onClick={() => setPeriodo('mensal')} style={togglePeriodo(periodo === 'mensal')}>Mensal</button>
              <button onClick={() => setPeriodo('anual')} style={{ ...togglePeriodo(periodo === 'anual'), display: 'flex', alignItems: 'center', gap: 6 }}>
                Anual <span style={{ fontSize: 10, background: tokens.accent.emerald, color: 'white', padding: '2px 6px', borderRadius: 10, fontWeight: 700 }}>-20%</span>
              </button>
            </div>
          </div>

          <div className="lp-grid-3">
            <Plano nome="Solo" descricao="Para médicos autônomos" precoMensal={297} precoAnual={237} periodo={periodo} cta="Assinar" onCta={() => router.push('/cadastro')} features={[
              '1 médico',
              'IA na consulta ilimitada',
              'Prescrição Memed',
              'Agenda + teleconsulta',
              '200 mensagens WhatsApp/mês',
              'Suporte por e-mail',
              'Trial de 7 dias',
            ]}/>
            <Plano destaque nome="Clínica" badge="Mais vendido" descricao="Para clínicas 2 a 10 médicos" precoMensal={597} precoAnual={477} periodo={periodo} cta="Assinar" onCta={() => router.push('/cadastro')} features={[
              'Até 10 usuários',
              '1.000 consultas IA/mês',
              'Sofia no WhatsApp',
              '1.000 mensagens WhatsApp/mês',
              'Comparativo entre médicos',
              'Multi-perfil (médico, recepção)',
              'Suporte WhatsApp comercial',
            ]}/>
            <Plano nome="Pro" descricao="Para clínicas grandes e redes" precoMensal={1197} precoAnual={957} periodo={periodo} cta="Assinar" onCta={() => router.push('/cadastro')} features={[
              'Usuários ilimitados',
              'Consultas IA ilimitadas',
              'Análise de exames com IA',
              'Multi-clínica',
              '5.000 mensagens WhatsApp/mês',
              'API + integrações',
              'Suporte prioritário + onboarding',
            ]}/>
          </div>

          <p style={{ textAlign: 'center' as const, fontSize: 12, color: tokens.text.tertiary, marginTop: 28 }}>
            Mensagens WhatsApp adicionais: R$ 0,15 (Solo) · R$ 0,12 (Clínica) · R$ 0,10 (Pro). Repassamos custo da Meta sem margem.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="lp-section" style={{ }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ textAlign: 'center' as const, marginBottom: 36 }}>
            <p style={selo}>FAQ</p>
            <h2 className="lp-section-h2" style={{ ...titulo, margin: 0 }}>Perguntas frequentes</h2>
          </div>

          <FAQItem pergunta="O Clinical 360 está em conformidade com a LGPD?" resposta="Sim. Tratamos dados de saúde como categoria especial conforme exige a LGPD. Temos DPO designado, política de privacidade, consentimento expresso do paciente e backup com PITR no Supabase."/>
          <FAQItem pergunta="Como funciona a gravação da consulta?" resposta="O paciente é informado antes e dá consentimento. A gravação fica criptografada, é processada pela IA para gerar SOAP, e você decide se quer manter ou apagar o áudio."/>
          <FAQItem pergunta="A IA pode errar no prontuário?" resposta="Pode. Por isso TODO prontuário gerado é apenas um rascunho — você revisa, edita e assina. A IA acerta ~90% dos casos, ganhando 70% do seu tempo. Os 10% você ajusta em segundos."/>
          <FAQItem pergunta="Preciso instalar algo?" resposta="Não. Clinical 360 roda no navegador. Funciona em qualquer computador, tablet ou celular. A teleconsulta também é nativa, sem precisar Google Meet ou Zoom."/>
          <FAQItem pergunta="Posso migrar de outro sistema?" resposta="Sim. Importamos pacientes via CSV. Para clínicas com sistemas grandes (iClinic, Doctoralia), nossa equipe ajuda na migração — incluído no plano Pro, opcional nos demais."/>
          <FAQItem pergunta="Quanto custa um médico extra?" resposta="No plano Clínica, até 10 usuários inclusos (médicos + recepção). Acima disso, recomendamos o Pro com usuários ilimitados."/>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="lp-section" style={{ background: `linear-gradient(135deg, ${tokens.brand.primary} 0%, ${tokens.appointment.exame.dot} 100%)`, color: 'white', textAlign: 'center' as const }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <h2 className="lp-cta-final-h2" style={{ ...titulo, fontWeight: 600, margin: '0 0 16px', color: 'white' }}>Pare de perder tempo com prontuário.</h2>
          <p style={{ fontSize: 17, opacity: 0.9, margin: '0 0 32px', lineHeight: 1.5 }}>
            Comece grátis hoje. Sem cartão de crédito.
          </p>
          <button onClick={() => router.push('/cadastro')} style={{ padding: '14px 32px', borderRadius: 10, background: 'white', color: tokens.brand.primary, border: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
            Assinar agora →
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: '40px 24px', background: tokens.neutral[900], color: tokens.neutral[400], fontSize: 13 }}>
        <div className="lp-footer-grid" style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <img src="/logo-clinical-360.svg" alt="Clinical 360" style={{ height: 26, width: 'auto', objectFit: 'contain' as const, filter: 'brightness(0) invert(1)' }}/>
            </div>
            <p style={{ margin: 0, lineHeight: 1.6 }}>Prontuário com IA para clínicas modernas. Feito no Brasil, com 💜.</p>
          </div>
          <div>
            <p style={footerTitle}>Produto</p>
            <a href="#features" style={footerLink}>Recursos</a>
            <a href="#planos" style={footerLink}>Planos</a>
            <a href="#faq" style={footerLink}>FAQ</a>
          </div>
          <div>
            <p style={footerTitle}>Empresa</p>
            <a href="/sobre" style={footerLink}>Sobre</a>
            <a href="/contato" style={footerLink}>Contato</a>
            <a href="/blog" style={footerLink}>Blog</a>
          </div>
          <div>
            <p style={footerTitle}>Legal</p>
            <a href="/privacidade" style={footerLink}>Privacidade</a>
            <a href="/termos" style={footerLink}>Termos de uso</a>
          </div>
        </div>
        <div style={{ maxWidth: 1100, margin: '32px auto 0', paddingTop: 24, borderTop: `1px solid ${tokens.neutral[800]}`, fontSize: 12 }}>
          © 2026 Clinical 360. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  )
}

const navLink = { fontSize: 13, color: tokens.text.muted, textDecoration: 'none', fontWeight: 500 } as const
const selo = { fontSize: 13, fontWeight: 600 as const, color: tokens.brand.primary, textTransform: 'uppercase' as const, letterSpacing: '0.08em' as const, margin: '0 0 10px' }
const togglePeriodo = (ativo: boolean) => ({ padding: '8px 18px', borderRadius: 7, border: 'none', background: ativo ? tokens.neutral[900] : 'transparent', color: ativo ? 'white' : tokens.text.muted, fontSize: 13, fontWeight: 600 as const, cursor: 'pointer' })
const footerTitle = { fontSize: 11, color: 'white', fontWeight: 700 as const, textTransform: 'uppercase' as const, letterSpacing: '0.08em' as const, margin: '0 0 12px' }
const footerLink = { display: 'block', color: tokens.neutral[400], textDecoration: 'none', marginBottom: 8 }


function NavBar({ router }: { router: any }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)' as const, borderBottom: `1px solid ${tokens.neutral[150]}` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <img src="/logo-clinical-360.svg" alt="Clinical 360" style={{ height: 30, width: 'auto', objectFit: 'contain' as const }}/>
            </div>
            <div className="lp-nav-links">
              <a href="#features" style={navLink}>Recursos</a>
              <a href="#paraquem" style={navLink}>Para quem</a>
              <a href="#planos" style={navLink}>Planos</a>
              <a href="#faq" style={navLink}>FAQ</a>
            </div>
          </div>
          <div className="lp-nav-actions" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={() => router.push('/login')} className="lp-nav-entrar" style={{ fontSize: 13, color: tokens.text.muted, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>Entrar</button>
            <button onClick={() => router.push('/cadastro')} style={{ fontSize: 13, color: 'white', background: tokens.neutral[900], border: 'none', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Assinar</button>
            <button className="lp-hamburger" onClick={() => setOpen(true)} aria-label="Abrir menu" style={{ display: 'none', background: 'none', border: 'none', padding: 6, cursor: 'pointer' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={tokens.neutral[900]} strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
          </div>
        </div>
      </nav>

      {open && (
        <div style={{ position: 'fixed' as const, inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.4)' }} onClick={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute' as const, top: 0, right: 0, bottom: 0, width: 280, background: 'white', padding: '20px 24px', display: 'flex', flexDirection: 'column' as const, gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>Menu</span>
              <button onClick={() => setOpen(false)} aria-label="Fechar" style={{ background: 'none', border: 'none', padding: 6, cursor: 'pointer' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={tokens.neutral[900]} strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <a href="#features" onClick={() => setOpen(false)} style={mobileLink}>Recursos</a>
            <a href="#paraquem" onClick={() => setOpen(false)} style={mobileLink}>Para quem</a>
            <a href="#planos" onClick={() => setOpen(false)} style={mobileLink}>Planos</a>
            <a href="#faq" onClick={() => setOpen(false)} style={mobileLink}>FAQ</a>
            <div style={{ height: 1, background: tokens.neutral[150], margin: '12px 0' }}/>
            <button onClick={() => { setOpen(false); router.push('/login') }} style={{ ...mobileLink, background: 'none', border: 'none', textAlign: 'left' as const, cursor: 'pointer', width: '100%' }}>Entrar</button>
            <button onClick={() => { setOpen(false); router.push('/cadastro') }} style={{ marginTop: 12, padding: '12px', borderRadius: 10, background: tokens.neutral[900], color: 'white', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Assinar</button>
          </div>
        </div>
      )}
    </>
  )
}

const mobileLink = { display: 'block', padding: '12px 0', fontSize: 15, color: tokens.neutral[900], fontWeight: 500 as const, textDecoration: 'none' }

function FeatureCard({ icon, logo, titulo, descricao }: any) {
  return (
    <div style={{ background: 'white', borderRadius: 14, padding: 24, transition: 'all 0.2s' as const, border: `1px solid ${tokens.neutral[150]}` }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: tokens.brand.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
        {logo ? <img src={logo} alt="" style={{ height: 18 }}/> : icon}
      </div>
      <p style={{ fontSize: 16, fontWeight: 600, color: tokens.neutral[900], margin: '0 0 8px' }}>{titulo}</p>
      <p style={{ fontSize: 13, color: tokens.text.muted, margin: 0, lineHeight: 1.6 }}>{descricao}</p>
    </div>
  )
}

function Diferencial({ icon, titulo, descricao, destaque }: any) {
  return (
    <div style={{ background: 'white', borderRadius: 14, padding: 28, border: `1px solid ${tokens.neutral[150]}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: tokens.brand.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
        {destaque && <span style={{ fontSize: 10, fontWeight: 700, color: tokens.brand.primary, background: tokens.brand.primaryLight, padding: '4px 9px', borderRadius: 12, textTransform: 'uppercase' as const, letterSpacing: '0.06em' as const }}>{destaque}</span>}
      </div>
      <p style={{ fontSize: 17, fontWeight: 600, color: tokens.neutral[900], margin: '0 0 8px' }}>{titulo}</p>
      <p style={{ fontSize: 13, color: tokens.text.muted, margin: 0, lineHeight: 1.6 }}>{descricao}</p>
    </div>
  )
}

function ParaQuem({ icon, titulo, descricao }: any) {
  return (
    <div style={{ background: 'white', borderRadius: 14, padding: 28, textAlign: 'center' as const, border: `1px solid ${tokens.neutral[150]}` }}>
      <div style={{ fontSize: 36, marginBottom: 14 }}>{icon}</div>
      <p style={{ fontSize: 17, fontWeight: 600, color: tokens.neutral[900], margin: '0 0 8px' }}>{titulo}</p>
      <p style={{ fontSize: 13, color: tokens.text.muted, margin: 0, lineHeight: 1.6 }}>{descricao}</p>
    </div>
  )
}

function ItemLista({ texto, negativo, positivo, dark }: any) {
  return (
    <li style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', fontSize: 14, color: dark ? 'rgba(255,255,255,0.85)' : tokens.neutral[700], lineHeight: 1.5 }}>
      {negativo && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={tokens.status.danger} strokeWidth="2.5" style={{ flexShrink: 0, marginTop: 2 }}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
      {positivo && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={tokens.accent.emerald} strokeWidth="2.5" style={{ flexShrink: 0, marginTop: 2 }}><polyline points="20 6 9 17 4 12"/></svg>}
      {texto}
    </li>
  )
}

function Plano({ nome, descricao, precoMensal, precoAnual, periodo, cta, onCta, features, destaque, badge }: any) {
  const preco = periodo === 'mensal' ? precoMensal : precoAnual
  return (
    <div className={destaque ? 'lp-plano-destaque' : ''} style={{ background: 'white', borderRadius: 16, padding: 28, position: 'relative' as const, transform: destaque ? 'scale(1.02)' as const : 'none', boxShadow: destaque ? '0 8px 30px rgba(96,67,193,0.15)' : 'none', border: destaque ? `2px solid ${tokens.brand.primary}` : `1px solid ${tokens.neutral[200]}` }}>
      {badge && (
        <div style={{ position: 'absolute' as const, top: -10, left: '50%', transform: 'translateX(-50%)', background: tokens.brand.primary, color: 'white', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{badge}</div>
      )}
      <p style={{ fontSize: 13, fontWeight: 700, color: tokens.brand.primary, margin: '0 0 4px', textTransform: 'uppercase' as const, letterSpacing: '0.06em' as const }}>{nome}</p>
      <p style={{ fontSize: 13, color: tokens.text.muted, margin: '0 0 20px', lineHeight: 1.5 }}>{descricao}</p>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 16, color: tokens.text.muted }}>R$</span>
        <span style={{ fontSize: 42, fontWeight: 700, color: tokens.neutral[900], letterSpacing: '-0.02em' as const }}>{preco}</span>
        <span style={{ fontSize: 14, color: tokens.text.tertiary }}>/mês</span>
      </div>
      {periodo === 'anual' && (
        <p style={{ fontSize: 11, color: tokens.accent.emerald, margin: '-12px 0 16px', fontWeight: 600 }}>cobrado anualmente · economia de R$ {(precoMensal - precoAnual) * 12}/ano</p>
      )}
      <button onClick={onCta} style={{ width: '100%', padding: '12px', borderRadius: 10, background: destaque ? tokens.neutral[900] : 'white', color: destaque ? 'white' : tokens.neutral[900], border: destaque ? 'none' : `1px solid ${tokens.neutral[200]}`, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 24 }}>{cta}</button>
      <ul style={{ listStyle: 'none' as const, padding: 0, margin: 0 }}>
        {features.map((f: string, i: number) => (
          <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: tokens.neutral[700], marginBottom: 10, lineHeight: 1.5 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={tokens.accent.emerald} strokeWidth="2.5" style={{ flexShrink: 0, marginTop: 2 }}><polyline points="20 6 9 17 4 12"/></svg>
            {f}
          </li>
        ))}
      </ul>
    </div>
  )
}

function FAQItem({ pergunta, resposta }: { pergunta: string; resposta: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderBottom: `1px solid ${tokens.neutral[150]}` }}>
      <button onClick={() => setOpen(!open)} style={{ width: '100%', padding: '18px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' as const }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: tokens.neutral[900] }}>{pergunta}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={tokens.text.muted} strokeWidth="2" style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' as const : 'none', transition: 'transform 0.2s' as const }}><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <p style={{ fontSize: 14, color: tokens.text.muted, margin: '0 0 18px', lineHeight: 1.6 }}>{resposta}</p>
      )}
    </div>
  )
}
