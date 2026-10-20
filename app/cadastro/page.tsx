'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import { Eye, EyeOff, ArrowLeft, ArrowRight, Check, Stethoscope, Building2, Network, Mic, ConciergeBell, MessageCircle, CalendarCheck, ShieldCheck, CircleAlert } from 'lucide-react'
import { SenhaStrength, senhaEhForte } from '@/components/SenhaStrength'
import { tokens } from '@/lib/design-tokens'
import { Marca } from '@/components/Marca'
import { Input, Button, Field, IconTile } from '@/components/ui'
import { guardarToken } from '@/lib/sessao'
import { CHAVE_PERFIL_CADASTRO } from '@/lib/onboarding'

const T = tokens
type Perfil = 'autonomo' | 'clinica' | 'rede'


const INCLUSO: { icon: LucideIcon; titulo: string; texto: string }[] = [
  { icon: Mic, titulo: 'Prontuário escrito pela IA', texto: 'Grave a consulta e receba o SOAP pronto, com CIDs.' },
  { icon: CalendarCheck, titulo: 'Agenda que se confirma sozinha', texto: 'Lembretes e confirmações pelo WhatsApp.' },
  { icon: ConciergeBell, titulo: 'Recepção, fila e TV', texto: 'Check-in, senhas, triagem e chamada no painel.' },
  { icon: MessageCircle, titulo: 'Sofia no WhatsApp', texto: 'Atende, agenda e tira dúvidas 24 horas.' },
]

function mascararTelefone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

export default function CadastroPage() {
  const router = useRouter()
  const [etapa, setEtapa] = useState<1 | 2 | 3>(1)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [emailEmUso, setEmailEmUso] = useState(false)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [form, setForm] = useState({ nome: '', email: '', telefone: '', nome_clinica: '', senha: '', senha_confirma: '' })
  const [showSenha, setShowSenha] = useState(false)
  const [aceite, setAceite] = useState(false)

  const set = (k: keyof typeof form, v: string) => { setForm(p => ({ ...p, [k]: v })); setErro(null); setEmailEmUso(false) }

  const escolherPerfil = (p: Perfil) => { setPerfil(p); setErro(null); setEtapa(2) }

  const avancarDados = () => {
    setErro(null)
    if (form.nome.trim().split(/\s+/).length < 2) return setErro('Escreva seu nome e sobrenome.')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) return setErro('Confira o email — ele vai ser seu login.')
    const tel = form.telefone.replace(/\D/g, '')
    if (tel && tel.length < 10) return setErro('Telefone incompleto. Use DDD + número.')
    if (!form.nome_clinica.trim()) return setErro(perfil === 'autonomo' ? 'Dê um nome ao seu consultório.' : 'Preencha o nome da clínica.')
    setEtapa(3)
  }

  const cadastrar = async () => {
    setErro(null)
    if (!senhaEhForte(form.senha)) return setErro('A senha ainda não atende aos critérios abaixo.')
    if (form.senha !== form.senha_confirma) return setErro('As senhas não são iguais.')
    if (!aceite) return setErro('Para continuar, aceite os termos de uso e a política de privacidade.')

    setSalvando(true)
    try {
      // Autônomo: a pessoa é médica E administradora (registro em medicos, cargo admin) —
      // assim Consultório, Agenda, Retornos e Nova consulta já funcionam com ela.
      // Clínica com equipe: conta de administrador; os médicos vêm depois pelo convite.
      const autonomo = perfil === 'autonomo'
      const res = await fetch(autonomo ? '/api/cadastro-autonomo' : '/api/cadastro-clinica', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(autonomo ? {
          nome: form.nome.trim(), email: form.email, senha: form.senha, telefone: form.telefone, empresa_nome: form.nome_clinica.trim(),
        } : {
          tipo_conta: perfil === 'rede' ? 'rede' : 'clinica',
          clinica: { nome: form.nome_clinica.trim(), email: form.email, telefone: form.telefone },
          admin: { nome: form.nome.trim(), email: form.email, senha: form.senha },
          medicos: [],
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (/já (cadastrado|está em uso)/i.test(data.error || '')) { setEmailEmUso(true); setEtapa(2); throw new Error('Este email já tem uma conta no Clinical 360.') }
        throw new Error(data.error || 'Não foi possível criar a conta agora.')
      }

      // Entra direto (o token de verificação acabou de ser criado)
      const verifyRes = await fetch('/api/verificar-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: data.token_verificacao, tipo: autonomo ? 'medico' : 'admin' }),
      })
      const verifyData = await verifyRes.json()

      if (verifyData.ok) guardarToken(verifyData.token)
      if (verifyData.ok && verifyData.tipo_conta === 'clinica') {
        localStorage.setItem('clinica_admin', JSON.stringify(verifyData.admin))
        localStorage.setItem('clinica', JSON.stringify(verifyData.clinica))
        localStorage.removeItem('medico')
        try { if (perfil) localStorage.setItem(CHAVE_PERFIL_CADASTRO, perfil === 'rede' ? 'clinica' : perfil); localStorage.setItem('c360-tipo-conta', perfil === 'rede' ? 'rede' : '') } catch {}
        router.push('/onboarding')
      } else if (verifyData.ok && verifyData.tipo_conta === 'medico') {
        localStorage.setItem('medico', JSON.stringify(verifyData.medico))
        if (verifyData.clinica) localStorage.setItem('clinica', JSON.stringify(verifyData.clinica))
        localStorage.removeItem('clinica_admin')
        try { localStorage.setItem(CHAVE_PERFIL_CADASTRO, 'autonomo') } catch {}
        router.push('/onboarding')
      } else {
        router.push('/login')
      }
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  const campo: React.CSSProperties = { minHeight: 44, fontSize: 14 }
  const titulo: React.CSSProperties = { fontSize: 26, fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1.15, color: T.text.primary, margin: '0 0 8px' }
  const sub: React.CSSProperties = { fontSize: 14.5, color: T.text.secondary, lineHeight: 1.55, margin: '0 0 26px' }
  const ETAPAS = ['Como você atende', 'Seus dados', 'Acesso']

  return (
    <div style={{ minHeight: '100dvh', background: T.bg.card, display: 'flex' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .cad-lado { display: flex; }
        @media (max-width: 900px) { .cad-lado { display: none !important; } .cad-form { padding: 24px 16px !important; } }
        .cad-entra { animation: cad-entra .35s ease; }
        @keyframes cad-entra { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
      ` }} />

      {/* Lado: o que vem na conta */}
      <aside className="cad-lado" style={{
        width: '40%', maxWidth: 560, flexDirection: 'column', justifyContent: 'space-between', padding: 48, color: '#fff', position: 'relative', overflow: 'hidden',
        background: `linear-gradient(160deg, ${T.brand.primary} 0%, ${T.brand.primaryDark} 100%)`,
      }}>
        <div style={{ position: 'absolute', top: -200, right: -200, width: 500, height: 500, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', filter: 'blur(40px)' }} />
        <div style={{ position: 'relative' }}><Marca altura={28} style={{ filter: 'brightness(0) invert(1)' }} /></div>
        <div style={{ position: 'relative' }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', opacity: .8, margin: '0 0 14px' }}>Sua conta inclui</p>
          <h2 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1.12, margin: '0 0 28px' }}>Do agendamento ao retorno, tudo num lugar só.</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {INCLUSO.map(i => (
              <div key={i.titulo} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <span style={{ width: 36, height: 36, borderRadius: 11, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,.14)' }}><i.icon size={17} /></span>
                <span>
                  <span style={{ display: 'block', fontSize: 14.5, fontWeight: 650 }}>{i.titulo}</span>
                  <span style={{ display: 'block', fontSize: 13, opacity: .78, marginTop: 2 }}>{i.texto}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, opacity: .8 }}>
          <ShieldCheck size={15} /> Dados protegidos conforme a LGPD
        </div>
      </aside>

      {/* Formulário */}
      <main className="cad-form" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '36px 56px', boxSizing: 'border-box', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, minHeight: 36 }}>
          {etapa > 1 ? (
            <button onClick={() => { setErro(null); setEtapa((etapa - 1) as 1 | 2) }} style={{ background: 'none', border: 'none', color: T.text.secondary, fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'inherit' }}>
              <ArrowLeft size={15} strokeWidth={1.6} /> Voltar
            </button>
          ) : <span />}
          <span style={{ fontSize: 13, color: T.text.tertiary }}>Já tem conta? <a href="/login" style={{ color: T.brand.primary, fontWeight: 600, textDecoration: 'none' }}>Entrar</a></span>
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 0' }}>
          <div style={{ width: '100%', maxWidth: 460 }}>
            {/* Etapas */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 30 }}>
              {ETAPAS.map((nome, i) => {
                const n = i + 1, feito = etapa > n, atual = etapa === n
                return (
                  <div key={nome} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: i < ETAPAS.length - 1 ? 1 : '0 0 auto', minWidth: 0 }}>
                    <span style={{
                      width: 24, height: 24, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700,
                      background: feito || atual ? T.brand.primary : T.bg.page, color: feito || atual ? '#fff' : T.text.tertiary,
                      border: feito || atual ? 'none' : `1px solid ${T.border.default}`,
                    }}>{feito ? <Check size={13} strokeWidth={2.4} /> : n}</span>
                    <span style={{ fontSize: 12.5, fontWeight: atual ? 650 : 500, color: atual ? T.text.primary : T.text.tertiary, whiteSpace: 'nowrap' }}>{nome}</span>
                    {i < ETAPAS.length - 1 && <span style={{ flex: 1, height: 1.5, minWidth: 12, background: feito ? T.brand.primary : T.border.default }} />}
                  </div>
                )
              })}
            </div>

            {erro && (
              <div style={{ padding: '10px 12px', borderRadius: 12, background: T.status.dangerBg, color: T.status.danger, fontSize: 13, fontWeight: 500, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                <CircleAlert size={15} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{erro}</span>
                {emailEmUso && <a href="/login" style={{ color: T.status.danger, fontWeight: 700 }}>Entrar</a>}
              </div>
            )}

            {etapa === 1 && (
              <div className="cad-entra">
                <h1 style={titulo}>Crie sua conta</h1>
                <p style={sub}>Primeiro, conte como você atende. Isso ajusta o sistema para o seu dia a dia — dá para mudar depois.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {([
                    { key: 'autonomo', titulo: 'Atendo sozinho(a)', sub: 'Médico ou profissional autônomo, com ou sem secretária', icone: Stethoscope },
                    { key: 'clinica', titulo: 'Tenho uma clínica com equipe', sub: 'Vários médicos, recepção, triagem e gestão', icone: Building2 },
                    { key: 'rede', titulo: 'Tenho várias unidades', sub: 'Grupo ou rede: cada unidade com equipe e agenda, e uma visão de todas', icone: Network },
                  ] as const).map(op => {
                    const sel = perfil === op.key
                    return (
                      <button key={op.key} type="button" onClick={() => escolherPerfil(op.key)} style={{
                        textAlign: 'left', padding: '16px 18px', borderRadius: 16, cursor: 'pointer', fontFamily: 'inherit',
                        border: `1px solid ${sel ? T.brand.primary : T.border.default}`, background: sel ? T.brand.primarySoftBg : '#fff',
                        display: 'flex', alignItems: 'center', gap: 14, transition: 'border-color .15s, background .15s',
                      }}
                        onMouseEnter={e => { if (!sel) e.currentTarget.style.borderColor = T.brand.primaryAccent }}
                        onMouseLeave={e => { if (!sel) e.currentTarget.style.borderColor = T.border.default }}>
                        <IconTile icon={op.icone} size={42} active={sel} />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'block', fontSize: 15, fontWeight: 650, color: T.text.primary }}>{op.titulo}</span>
                          <span style={{ display: 'block', fontSize: 13, color: T.text.quaternary, marginTop: 2 }}>{op.sub}</span>
                        </span>
                        <ArrowRight size={17} color={T.text.tertiary} />
                      </button>
                    )
                  })}
                </div>
                <p style={{ fontSize: 12.5, color: T.text.tertiary, margin: '22px 0 0', lineHeight: 1.5 }}>
                  Faz parte de uma clínica que já usa o Clinical 360? Peça ao administrador para cadastrar você. Ele recebe uma senha provisória para te passar, e no primeiro acesso você cria a sua.
                </p>
              </div>
            )}

            {etapa === 2 && (
              <div className="cad-entra">
                <h1 style={titulo}>{perfil === 'autonomo' ? 'Sobre você e o consultório' : 'Sobre você e a clínica'}</h1>
                <p style={sub}>Você será o administrador da conta. O email vira o seu login.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <Field label="Seu nome completo">
                    <Input value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Ex.: Ana Paula Souza" style={campo} autoFocus autoComplete="name" />
                  </Field>
                  <Field label="Email">
                    <Input type="email" value={form.email} onChange={e => set('email', e.target.value.toLowerCase().trim())} placeholder="voce@email.com" style={{ ...campo, borderColor: emailEmUso ? T.status.dangerLightAlt : undefined }} autoComplete="email" />
                  </Field>
                  <Field label="WhatsApp ou telefone" hint="Opcional — usado só para suporte e avisos da conta.">
                    <Input inputMode="tel" value={form.telefone} onChange={e => set('telefone', mascararTelefone(e.target.value))} placeholder="(11) 99999-9999" style={campo} autoComplete="tel" />
                  </Field>
                  <Field label={perfil === 'autonomo' ? 'Nome do consultório' : perfil === 'rede' ? 'Nome da primeira unidade' : 'Nome da clínica'} hint="Aparece para o paciente: WhatsApp, TV da recepção e documentos.">
                    <Input value={form.nome_clinica} onChange={e => set('nome_clinica', e.target.value)} placeholder={perfil === 'autonomo' ? 'Ex.: Consultório Dra. Ana Souza' : 'Ex.: Clínica São Lucas'} style={campo} onKeyDown={e => { if (e.key === 'Enter') avancarDados() }} />
                  </Field>
                </div>
                <Button size="lg" block onClick={avancarDados} iconRight={ArrowRight} style={{ marginTop: 24 }}>Continuar</Button>
              </div>
            )}

            {etapa === 3 && (
              <div className="cad-entra">
                <h1 style={titulo}>Crie sua senha</h1>
                <p style={sub}>Entrando como <strong style={{ color: T.text.primary }}>{form.email}</strong>.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <Field label="Senha">
                    <div style={{ position: 'relative' }}>
                      <Input type={showSenha ? 'text' : 'password'} value={form.senha} onChange={e => set('senha', e.target.value)} placeholder="Crie uma senha forte" style={{ ...campo, paddingRight: 42 }} autoFocus autoComplete="new-password" />
                      <button type="button" onClick={() => setShowSenha(s => !s)} aria-label={showSenha ? 'Ocultar senha' : 'Mostrar senha'} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: T.text.tertiary, padding: 0, display: 'flex' }}>
                        {showSenha ? <EyeOff size={16} strokeWidth={1.6} /> : <Eye size={16} strokeWidth={1.6} />}
                      </button>
                    </div>
                    <SenhaStrength senha={form.senha} />
                  </Field>
                  <Field label="Repita a senha">
                    <Input type={showSenha ? 'text' : 'password'} value={form.senha_confirma} onChange={e => set('senha_confirma', e.target.value)} placeholder="Digite de novo" autoComplete="new-password"
                      style={{ ...campo, borderColor: form.senha_confirma && form.senha !== form.senha_confirma ? T.status.dangerLightAlt : undefined }}
                      onKeyDown={e => { if (e.key === 'Enter') cadastrar() }} />
                    {form.senha_confirma && form.senha !== form.senha_confirma && <p style={{ fontSize: 12, color: T.status.danger, margin: '5px 0 0' }}>As senhas não são iguais</p>}
                  </Field>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: T.text.secondary, lineHeight: 1.5, cursor: 'pointer' }}>
                    <input type="checkbox" checked={aceite} onChange={e => { setAceite(e.target.checked); setErro(null) }} style={{ width: 17, height: 17, marginTop: 2, accentColor: T.brand.primary, flexShrink: 0 }} />
                    <span>Li e aceito os <a href="/termos" target="_blank" style={{ color: T.brand.primary, fontWeight: 600 }}>termos de uso</a> e a <a href="/privacidade" target="_blank" style={{ color: T.brand.primary, fontWeight: 600 }}>política de privacidade</a>.</span>
                  </label>
                </div>
                <Button size="lg" block onClick={cadastrar} disabled={salvando} style={{ marginTop: 24 }}>
                  {salvando ? 'Criando sua conta…' : 'Criar conta e começar'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
