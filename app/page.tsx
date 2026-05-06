'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()
  const [verificado, setVerificado] = useState(false)
  const [periodo, setPeriodo] = useState<'mensal' | 'anual'>('mensal')

  useEffect(() => {
    try {
      const rawAdmin = localStorage.getItem('clinica_admin')
      if (rawAdmin) {
        const admin = JSON.parse(rawAdmin)
        if (!admin.onboarding_concluido) router.replace('/onboarding')
        else router.replace('/admin')
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
      <div style={{ minHeight: '100vh', background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '2px solid #6043C1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{"@keyframes spin { to { transform: rotate(360deg) } }"}</style>
      </div>
    )
  }

  return <Landing periodo={periodo} setPeriodo={setPeriodo} router={router} />
}

function Landing({ periodo, setPeriodo, router }: any) {
  return (
    <div style={{ minHeight: '100vh', background: 'white', color: '#0a0a0a' }}>
      {/* NAV */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)' as const, borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, background: '#6043C1', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              </div>
              <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em' as const }}>MedIA</span>
            </div>
            <div style={{ display: 'flex', gap: 22 }}>
              <a href="#features" style={{ fontSize: 13, color: '#525252', textDecoration: 'none', fontWeight: 500 }}>Recursos</a>
              <a href="#planos" style={{ fontSize: 13, color: '#525252', textDecoration: 'none', fontWeight: 500 }}>Planos</a>
              <a href="#como" style={{ fontSize: 13, color: '#525252', textDecoration: 'none', fontWeight: 500 }}>Como funciona</a>
              <a href="#faq" style={{ fontSize: 13, color: '#525252', textDecoration: 'none', fontWeight: 500 }}>FAQ</a>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={() => router.push('/login')} style={{ fontSize: 13, color: '#525252', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>Entrar</button>
            <button onClick={() => router.push('/cadastro')} style={{ fontSize: 13, color: 'white', background: '#0a0a0a', border: 'none', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Testar grátis</button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ padding: '80px 24px 60px', textAlign: 'center' as const }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: '#f0ebff', borderRadius: 20, marginBottom: 24, fontSize: 12, fontWeight: 600, color: '#6043C1' }}>
            <span style={{ width: 5, height: 5, background: '#6043C1', borderRadius: '50%' }}/>
            Novo: Sofia, sua secretária com IA no WhatsApp
          </div>
          <h1 style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.03em' as const, margin: '0 0 22px' }}>
            Prontuário com IA<br/>
            <span style={{ color: '#6043C1' }}>que devolve seu tempo.</span>
          </h1>
          <p style={{ fontSize: 18, color: '#525252', lineHeight: 1.55, margin: '0 0 36px', maxWidth: 600, marginLeft: 'auto', marginRight: 'auto' }}>
            Grava a consulta, gera prontuário SOAP, prescreve via Memed e atende paciente no WhatsApp — tudo automático. Você só atende.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' as const }}>
            <button onClick={() => router.push('/cadastro')} style={{ padding: '14px 26px', borderRadius: 10, background: '#0a0a0a', color: 'white', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Testar grátis 7 dias →
            </button>
            <button onClick={() => document.getElementById('planos')?.scrollIntoView({ behavior: 'smooth' })} style={{ padding: '14px 26px', borderRadius: 10, background: 'white', color: '#0a0a0a', border: '1px solid #e5e5e5', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Ver planos
            </button>
          </div>
          <p style={{ fontSize: 12, color: '#9ca3af', margin: '18px 0 0' }}>
            Sem cartão de crédito · Cancele quando quiser
          </p>
        </div>

        {/* Mockup */}
        <div style={{ maxWidth: 1100, margin: '60px auto 0', padding: '0 24px' }}>
          <div style={{ background: 'linear-gradient(135deg, #6043C1 0%, #8b5cf6 100%)', borderRadius: 20, padding: 8, boxShadow: '0 30px 80px -20px rgba(96,67,193,0.4)' }}>
            <div style={{ background: '#F5F5F5', borderRadius: 14, padding: '40px 30px', textAlign: 'center' as const, fontSize: 13, color: '#6b7280' }}>
              [Screenshot da plataforma — em produção será imagem real da nova-consulta]
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ padding: '80px 24px', background: '#fafafa' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center' as const, marginBottom: 48 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#6043C1', textTransform: 'uppercase' as const, letterSpacing: '0.08em' as const, margin: '0 0 10px' }}>Recursos</p>
            <h2 style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.02em' as const, margin: '0 0 12px' }}>Tudo que sua clínica precisa.<br/>E IA em cada canto.</h2>
            <p style={{ fontSize: 15, color: '#525252', maxWidth: 540, margin: '0 auto' }}>
              Os concorrentes vendem IA como módulo extra. No MedIA, IA é o ponto de partida.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
            <FeatureCard icon="🎙️" titulo="IA na consulta" descricao="Grava a conversa médico-paciente e gera prontuário SOAP automático com CIDs sugeridos. Você revisa em 30 segundos."/>
            <FeatureCard icon="💊" titulo="Prescrição Memed" descricao="Receita com validade legal ICP-Brasil. Envio direto pra farmácia. Integrado nativamente."/>
            <FeatureCard icon="💬" titulo="Sofia no WhatsApp" descricao="IA que atende seus pacientes 24/7. Marca consultas, tira dúvidas, lembra exames. Reduz no-show em 40%."/>
            <FeatureCard icon="🔬" titulo="Análise de exames" descricao="IA lê o exame, destaca alterações relevantes e sugere conduta. Tempo de análise: 2 minutos."/>
            <FeatureCard icon="📊" titulo="Dashboard inteligente" descricao="No-show rate, pacientes em risco, CIDs frequentes, comparativo entre médicos. Métricas que importam."/>
            <FeatureCard icon="📅" titulo="Agenda + teleconsulta" descricao="Calendário visual com drag-and-drop. Vídeo nativo, sem instalar nada. Lembretes automáticos."/>
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section id="como" style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center' as const, marginBottom: 48 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#6043C1', textTransform: 'uppercase' as const, letterSpacing: '0.08em' as const, margin: '0 0 10px' }}>Como funciona</p>
            <h2 style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.02em' as const, margin: 0 }}>3 passos. Zero burocracia.</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <Passo numero="1" titulo="Cadastra sua clínica" descricao="Conta criada em 2 minutos. Adiciona médicos, pacientes (ou importa CSV)."/>
            <Passo numero="2" titulo="Atende como sempre" descricao="Inicia gravação no início da consulta. Conversa naturalmente com seu paciente."/>
            <Passo numero="3" titulo="IA gera tudo" descricao="Prontuário SOAP, CIDs, receita, resumo pro paciente. Você revisa e assina."/>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="planos" style={{ padding: '80px 24px', background: '#fafafa' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center' as const, marginBottom: 36 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#6043C1', textTransform: 'uppercase' as const, letterSpacing: '0.08em' as const, margin: '0 0 10px' }}>Planos</p>
            <h2 style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.02em' as const, margin: '0 0 12px' }}>Escolha o plano da sua operação.</h2>
            <p style={{ fontSize: 15, color: '#525252' }}>Sem fidelidade. Cancele quando quiser.</p>
          </div>

          {/* Toggle mensal/anual */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
            <div style={{ display: 'flex', background: 'white', borderRadius: 10, padding: 4, border: '1px solid #e5e5e5' }}>
              <button onClick={() => setPeriodo('mensal')} style={{ padding: '8px 18px', borderRadius: 7, border: 'none', background: periodo === 'mensal' ? '#0a0a0a' : 'transparent', color: periodo === 'mensal' ? 'white' : '#525252', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Mensal</button>
              <button onClick={() => setPeriodo('anual')} style={{ padding: '8px 18px', borderRadius: 7, border: 'none', background: periodo === 'anual' ? '#0a0a0a' : 'transparent', color: periodo === 'anual' ? 'white' : '#525252', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                Anual <span style={{ fontSize: 10, background: '#10b981', color: 'white', padding: '2px 6px', borderRadius: 10, fontWeight: 700 }}>-17%</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <Plano nome="Solo" descricao="Para médicos autônomos" precoMensal={297} precoAnual={247} periodo={periodo} cta="Testar grátis 7 dias" onCta={() => router.push('/cadastro')} features={[
              '1 médico',
              'IA na consulta ilimitada',
              'Prescrição Memed',
              'Agenda + teleconsulta',
              '200 mensagens WhatsApp/mês',
              'Suporte por e-mail',
            ]}/>
            <Plano destaque nome="Clínica" badge="Mais vendido" descricao="Para clínicas 2 a 10 médicos" precoMensal={597} precoAnual={497} periodo={periodo} cta="Agendar demo" onCta={() => router.push('/cadastro')} features={[
              'Até 10 usuários',
              '1.000 consultas IA/mês',
              'Sofia no WhatsApp',
              '1.000 mensagens WhatsApp/mês',
              'Comparativo entre médicos',
              'Multi-perfil (médico, recepção)',
              'Suporte WhatsApp comercial',
            ]}/>
            <Plano nome="Pro" descricao="Para clínicas grandes e redes" precoMensal={1197} precoAnual={997} periodo={periodo} cta="Agendar demo" onCta={() => router.push('/cadastro')} features={[
              'Usuários ilimitados',
              'Consultas IA ilimitadas',
              'Análise de exames com IA',
              'Multi-clínica',
              '5.000 mensagens WhatsApp/mês',
              'API + integrações',
              'Suporte prioritário + onboarding',
            ]}/>
          </div>

          <p style={{ textAlign: 'center' as const, fontSize: 12, color: '#9ca3af', marginTop: 28 }}>
            Mensagens WhatsApp adicionais: R$ 0,15 (Solo) · R$ 0,12 (Clínica) · R$ 0,10 (Pro). Repassamos custo da Meta sem margem.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ textAlign: 'center' as const, marginBottom: 36 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#6043C1', textTransform: 'uppercase' as const, letterSpacing: '0.08em' as const, margin: '0 0 10px' }}>FAQ</p>
            <h2 style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.02em' as const, margin: 0 }}>Perguntas frequentes</h2>
          </div>

          <FAQItem pergunta="O MedIA está em conformidade com a LGPD?" resposta="Sim. Tratamos dados de saúde como categoria especial conforme exige a LGPD. Temos DPO designado, política de privacidade, consentimento expresso do paciente e backup com PITR no Supabase."/>
          <FAQItem pergunta="Como funciona a gravação da consulta?" resposta="O paciente é informado antes e dá consentimento. A gravação fica criptografada, é processada pela IA para gerar SOAP, e você decide se quer manter ou apagar o áudio."/>
          <FAQItem pergunta="A IA pode errar no prontuário?" resposta="Pode. Por isso TODO prontuário gerado é apenas um rascunho — você revisa, edita e assina. A IA acerta ~90% dos casos, ganhando 70% do seu tempo. Os 10% você ajusta em segundos."/>
          <FAQItem pergunta="Preciso instalar algo?" resposta="Não. MedIA roda no navegador. Funciona em qualquer computador, tablet ou celular. A teleconsulta também é nativa, sem precisar Google Meet ou Zoom."/>
          <FAQItem pergunta="Posso migrar de outro sistema?" resposta="Sim. Importamos pacientes via CSV. Para clínicas com sistemas grandes (iClinic, Doctoralia), nossa equipe ajuda na migração — incluído no plano Pro, opcional nos demais."/>
          <FAQItem pergunta="Quanto custa um médico extra?" resposta="No plano Clínica, até 10 usuários inclusos (médicos + recepção). Acima disso, recomendamos o Pro com usuários ilimitados."/>
        </div>
      </section>

      {/* CTA FINAL */}
      <section style={{ padding: '80px 24px', background: 'linear-gradient(135deg, #6043C1 0%, #8b5cf6 100%)', color: 'white', textAlign: 'center' as const }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <h2 style={{ fontSize: 42, fontWeight: 700, letterSpacing: '-0.02em' as const, margin: '0 0 16px', lineHeight: 1.1 }}>Pare de perder tempo com prontuário.</h2>
          <p style={{ fontSize: 17, opacity: 0.9, margin: '0 0 32px', lineHeight: 1.5 }}>
            Comece grátis hoje. Sem cartão de crédito.
          </p>
          <button onClick={() => router.push('/cadastro')} style={{ padding: '14px 32px', borderRadius: 10, background: 'white', color: '#6043C1', border: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
            Começar agora →
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: '40px 24px', background: '#0a0a0a', color: '#a3a3a3', fontSize: 13 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 32 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 24, height: 24, background: '#6043C1', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              </div>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>MedIA</span>
            </div>
            <p style={{ margin: 0, lineHeight: 1.6 }}>Prontuário com IA para clínicas modernas. Feito no Brasil, com 💜.</p>
          </div>
          <div>
            <p style={{ fontSize: 11, color: 'white', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em' as const, margin: '0 0 12px' }}>Produto</p>
            <a href="#features" style={{ display: 'block', color: '#a3a3a3', textDecoration: 'none', marginBottom: 8 }}>Recursos</a>
            <a href="#planos" style={{ display: 'block', color: '#a3a3a3', textDecoration: 'none', marginBottom: 8 }}>Planos</a>
            <a href="#faq" style={{ display: 'block', color: '#a3a3a3', textDecoration: 'none', marginBottom: 8 }}>FAQ</a>
          </div>
          <div>
            <p style={{ fontSize: 11, color: 'white', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em' as const, margin: '0 0 12px' }}>Empresa</p>
            <a href="/sobre" style={{ display: 'block', color: '#a3a3a3', textDecoration: 'none', marginBottom: 8 }}>Sobre</a>
            <a href="/contato" style={{ display: 'block', color: '#a3a3a3', textDecoration: 'none', marginBottom: 8 }}>Contato</a>
            <a href="/blog" style={{ display: 'block', color: '#a3a3a3', textDecoration: 'none', marginBottom: 8 }}>Blog</a>
          </div>
          <div>
            <p style={{ fontSize: 11, color: 'white', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em' as const, margin: '0 0 12px' }}>Legal</p>
            <a href="/privacidade" style={{ display: 'block', color: '#a3a3a3', textDecoration: 'none', marginBottom: 8 }}>Privacidade</a>
            <a href="/termos" style={{ display: 'block', color: '#a3a3a3', textDecoration: 'none', marginBottom: 8 }}>Termos de uso</a>
            <a href="/lgpd" style={{ display: 'block', color: '#a3a3a3', textDecoration: 'none', marginBottom: 8 }}>LGPD</a>
          </div>
        </div>
        <div style={{ maxWidth: 1100, margin: '32px auto 0', paddingTop: 24, borderTop: '1px solid #262626', fontSize: 12 }}>
          © 2026 MedIA. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, titulo, descricao }: any) {
  return (
    <div style={{ background: 'white', borderRadius: 14, padding: 24, transition: 'all 0.2s' as const }}>
      <div style={{ fontSize: 28, marginBottom: 14 }}>{icon}</div>
      <p style={{ fontSize: 16, fontWeight: 700, color: '#0a0a0a', margin: '0 0 8px' }}>{titulo}</p>
      <p style={{ fontSize: 13, color: '#525252', margin: 0, lineHeight: 1.6 }}>{descricao}</p>
    </div>
  )
}

function Passo({ numero, titulo, descricao }: any) {
  return (
    <div style={{ textAlign: 'center' as const }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: '#f0ebff', color: '#6043C1', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>{numero}</div>
      <p style={{ fontSize: 17, fontWeight: 700, color: '#0a0a0a', margin: '0 0 8px' }}>{titulo}</p>
      <p style={{ fontSize: 13, color: '#525252', margin: 0, lineHeight: 1.6 }}>{descricao}</p>
    </div>
  )
}

function Plano({ nome, descricao, precoMensal, precoAnual, periodo, cta, onCta, features, destaque, badge }: any) {
  const preco = periodo === 'mensal' ? precoMensal : precoAnual
  return (
    <div style={{ background: 'white', borderRadius: 16, padding: 28, position: 'relative' as const, transform: destaque ? 'scale(1.02)' as const : 'none', boxShadow: destaque ? '0 8px 30px rgba(96,67,193,0.15)' : 'none', border: destaque ? '2px solid #6043C1' : '1px solid #e5e5e5' }}>
      {badge && (
        <div style={{ position: 'absolute' as const, top: -10, left: '50%', transform: 'translateX(-50%)', background: '#6043C1', color: 'white', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{badge}</div>
      )}
      <p style={{ fontSize: 13, fontWeight: 700, color: '#6043C1', margin: '0 0 4px', textTransform: 'uppercase' as const, letterSpacing: '0.06em' as const }}>{nome}</p>
      <p style={{ fontSize: 13, color: '#525252', margin: '0 0 20px', lineHeight: 1.5 }}>{descricao}</p>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 16, color: '#525252' }}>R$</span>
        <span style={{ fontSize: 42, fontWeight: 700, color: '#0a0a0a', letterSpacing: '-0.02em' as const }}>{preco}</span>
        <span style={{ fontSize: 14, color: '#9ca3af' }}>/mês</span>
      </div>
      {periodo === 'anual' && (
        <p style={{ fontSize: 11, color: '#10b981', margin: '-12px 0 16px', fontWeight: 600 }}>cobrado anualmente · economia de R$ {(precoMensal - precoAnual) * 12}</p>
      )}
      <button onClick={onCta} style={{ width: '100%', padding: '12px', borderRadius: 10, background: destaque ? '#0a0a0a' : 'white', color: destaque ? 'white' : '#0a0a0a', border: destaque ? 'none' : '1px solid #e5e5e5', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 24 }}>{cta}</button>
      <ul style={{ listStyle: 'none' as const, padding: 0, margin: 0 }}>
        {features.map((f: string, i: number) => (
          <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#404040', marginBottom: 10, lineHeight: 1.5 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" style={{ flexShrink: 0, marginTop: 2 }}><polyline points="20 6 9 17 4 12"/></svg>
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
    <div style={{ borderBottom: '1px solid #f0f0f0' }}>
      <button onClick={() => setOpen(!open)} style={{ width: '100%', padding: '18px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' as const }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: '#0a0a0a' }}>{pergunta}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#525252" strokeWidth="2" style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' as const : 'none', transition: 'transform 0.2s' as const }}><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <p style={{ fontSize: 14, color: '#525252', margin: '0 0 18px', lineHeight: 1.6 }}>{resposta}</p>
      )}
    </div>
  )
}
