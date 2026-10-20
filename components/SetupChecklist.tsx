'use client'
import { log } from '@/lib/logger'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { tokens } from '@/lib/design-tokens'

const ACCENT = tokens.brand.primary
const ACCENT_LIGHT = tokens.brand.primaryLighter

type Passo = {
  key: string
  label: string
  desc: string
  completo: boolean
  href: string
  ctaLabel: string
}

export function SetupChecklist({ variante = 'fab' }: { variante?: 'fab' | 'sidebar' } = {}) {
  const router = useRouter()
  const [passos, setPassos] = useState<Passo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [aberto, setAberto] = useState(false)

  useEffect(() => {
    carregar()
  }, [])

  const carregar = async () => {
    try {
      const ca = localStorage.getItem('clinica_admin')
      const m = localStorage.getItem('medico')
      let clinicaId: string | null = null

      if (ca) {
        const admin = JSON.parse(ca)
        clinicaId = admin.clinica_id
      } else if (m) {
        const med = JSON.parse(m)
        clinicaId = med.clinica_id
      }

      if (!clinicaId) {
        setCarregando(false)
        return
      }

      // Perfil da conta: autônomo/Grátis (uso individual) ou clínica com equipe
      const perfil = (() => { try { return localStorage.getItem('c360-perfil-cadastro') } catch { return null } })()
      const conta = await supabase.from('clinicas').select('nome, telefone, logo_url, email, plano, tipo').eq('id', clinicaId).single()
      const clinica: any = conta.data
      const individual = perfil === 'autonomo' || clinica?.tipo === 'autonomo' || clinica?.plano === 'gratis'

      const { data: meds } = await supabase.from('medicos').select('id, cargo').eq('clinica_id', clinicaId).eq('ativo', true)
      const idsMedicos = (meds || []).filter((x: any) => !['recepcionista', 'enfermagem'].includes(x.cargo)).map((x: any) => x.id)
      const equipe = (meds || []).length
      const nada = ['00000000-0000-0000-0000-000000000000']
      const conta0 = (r: { count: number | null; error: any }) => (r.error ? 0 : r.count || 0)

      const [wppNovo, wppAntigo, pacientes, setores, consultas] = await Promise.all([
        supabase.from('canais_conectados').select('id', { count: 'exact', head: true }).eq('canal', 'whatsapp').eq('status', 'ativo').in('medico_id', idsMedicos.length ? idsMedicos : nada),
        supabase.from('whatsapp_config').select('access_token, sofia_instrucoes').in('medico_id', idsMedicos.length ? idsMedicos : nada).limit(1).maybeSingle(),
        supabase.from('pacientes').select('id', { count: 'exact', head: true }).eq('clinica_id', clinicaId),
        supabase.from('setores').select('id', { count: 'exact', head: true }).eq('clinica_id', clinicaId),
        supabase.from('consultas').select('id', { count: 'exact', head: true }).in('medico_id', idsMedicos.length ? idsMedicos : nada),
      ])
      const cfg: any = wppAntigo.data
      const whatsappConectado = conta0(wppNovo as any) > 0 || !!cfg?.access_token
      const sofiaConfigurada = !!(cfg?.sofia_instrucoes && cfg.sofia_instrucoes.length > 10)
      const clinicaConfigurada = !!(clinica && clinica.telefone && (clinica.logo_url || clinica.email))
      const temPacientes = conta0(pacientes as any) > 0

      const P = {
        clinica: { key: 'clinica', label: individual ? 'Dados do consultório' : 'Dados da clínica', desc: clinicaConfigurada ? 'Informações completas' : 'Telefone, logo e endereço aparecem para o paciente', completo: clinicaConfigurada, href: '/minha-clinica', ctaLabel: clinicaConfigurada ? 'Editar' : 'Completar' },
        equipe: { key: 'equipe', label: 'Convide a equipe', desc: equipe > 1 ? `${equipe} pessoas com acesso` : 'Médicos, recepção e enfermagem, cada um com seu acesso', completo: equipe > 1, href: '/admin?add=medico', ctaLabel: equipe > 1 ? 'Gerenciar' : 'Convidar' },
        salas: { key: 'salas', label: 'Salas de espera e TV', desc: conta0(setores as any) > 0 ? 'Recepção e painel prontos' : 'Cadastre a sala, os consultórios e abra o painel na TV', completo: conta0(setores as any) > 0, href: '/minha-clinica?aba=atendimento', ctaLabel: conta0(setores as any) > 0 ? 'Ver' : 'Configurar' },
        whatsapp: { key: 'whatsapp', label: 'Conecte o WhatsApp', desc: whatsappConectado ? 'Conversas chegando no Chat' : 'Atenda e confirme consultas pelo Chat', completo: whatsappConectado, href: whatsappConectado ? '/chat' : '/minha-clinica?aba=canais', ctaLabel: whatsappConectado ? 'Ver conversas' : 'Conectar' },
        sofia: { key: 'sofia', label: 'Ensine a Sofia', desc: sofiaConfigurada ? 'Sofia pronta para atender' : 'Horários, valores e o jeito de falar da clínica', completo: sofiaConfigurada, href: '/minha-clinica?aba=sofia', ctaLabel: sofiaConfigurada ? 'Ajustar' : 'Configurar' },
        importar: { key: 'importar', label: 'Traga seus pacientes', desc: temPacientes ? 'Pacientes cadastrados' : 'Importe a planilha do sistema antigo', completo: temPacientes, href: '/pacientes', ctaLabel: temPacientes ? 'Ver' : 'Importar' },
        consulta: { key: 'consulta', label: 'Faça a 1ª consulta com IA', desc: conta0(consultas as any) > 0 ? 'Prontuário pela IA funcionando' : 'Grave e receba o prontuário pronto', completo: conta0(consultas as any) > 0, href: '/nova-consulta', ctaLabel: 'Começar' },
      }
      const lista: Passo[] = individual
        ? [P.clinica, P.importar, P.consulta, P.whatsapp]
        : [P.clinica, P.equipe, P.salas, P.whatsapp, P.sofia, P.importar]

      setPassos(lista)
    } catch (e) {
      log.error('Erro ao carregar setup:', e)
    } finally {
      setCarregando(false)
    }
  }

  if (carregando || passos.length === 0) return null

  const completos = passos.filter(p => p.completo).length
  const total = passos.length
  const pendentes = total - completos
  const tudoPronto = completos === total
  const progressoPct = (completos / total) * 100

  // Card no menu lateral (design v2): progresso + próximo passo + "Continuar"
  if (variante === 'sidebar') {
    if (tudoPronto) return null
    const proximo = passos.find(p => !p.completo)!
    return (
      <div style={{ padding: 14, borderRadius: 14, background: '#fff', border: `1px solid ${tokens.border.default}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: tokens.text.primary }}>Primeiros passos</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: ACCENT }}>{completos} de {total}</span>
        </div>
        <div style={{ height: 6, borderRadius: 99, background: tokens.brand.primaryLight, overflow: 'hidden' }}>
          <div style={{ width: `${progressoPct}%`, height: '100%', background: ACCENT, borderRadius: 99, transition: 'width .4s' }} />
        </div>
        <div style={{ fontSize: 12, color: tokens.text.quaternary, lineHeight: 1.4 }}>Próximo: {proximo.label.charAt(0).toLowerCase() + proximo.label.slice(1)}</div>
        <button
          onClick={() => router.push(proximo.href)}
          style={{ display: 'flex', alignItems: 'center', gap: 4, border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: ACCENT, fontFamily: 'inherit' }}
        >
          Continuar
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </button>
      </div>
    )
  }

  return (
    <>
      {/* FAB no canto inferior direito */}
      <style dangerouslySetInnerHTML={{ __html: `
        .setup-fab {
          bottom: 24px;
        }
        @media (max-width: 768px) {
          .setup-fab {
            bottom: calc(80px + env(safe-area-inset-bottom, 0px)) !important;
            right: 16px !important;
          }
        }
      ` }} />
      <button
        onClick={() => setAberto(true)}
        className="setup-fab"
        style={{
          position: 'fixed' as const,
          right: 24, zIndex: 90,
          display: 'flex', alignItems: 'center', gap: 10,
          padding: tudoPronto ? '12px 16px' : '12px 18px 12px 14px',
          borderRadius: 999, border: 'none',
          background: tudoPronto ? tokens.accent.emerald : ACCENT, color: 'white',
          fontSize: 13, fontWeight: 700, cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          transition: 'transform 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'none'}
        title={tudoPronto ? 'Tudo configurado' : (pendentes + ' passo' + (pendentes !== 1 ? 's' : '') + ' pendente' + (pendentes !== 1 ? 's' : ''))}
      >
        {tudoPronto ? (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Tudo configurado
          </>
        ) : (
          <>
            <span style={{
              width: 24, height: 24, borderRadius: '50%',
              background: 'rgba(255,255,255,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700,
            }}>
              {pendentes}
            </span>
            Primeiros passos
          </>
        )}
      </button>

      {/* Drawer */}
      {aberto && (
        <>
          {/* Overlay */}
          <div
            onClick={() => setAberto(false)}
            style={{
              position: 'fixed' as const, inset: 0,
              background: 'rgba(0,0,0,0.3)', zIndex: 100,
              animation: 'fadeIn 0.2s ease',
            }}
          />

          {/* Drawer panel */}
          <div style={{
            position: 'fixed' as const,
            top: 0, right: 0, bottom: 0, width: 440,
            background: 'white', zIndex: 101,
            boxShadow: '-12px 0 30px rgba(0,0,0,0.12)',
            display: 'flex', flexDirection: 'column' as const,
            animation: 'slideIn 0.25s ease',
          }}>
            {/* Header drawer */}
            <div style={{
              padding: '20px 24px',
              borderBottom: `1px solid ${tokens.bg.hoverStrong}`,
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: tokens.text.primary, margin: '0 0 4px' }}>
                  {tudoPronto ? 'Tudo pronto' : 'Primeiros passos'}
                </h2>
                <p style={{ fontSize: 12, color: tokens.text.secondary, margin: 0 }}>
                  {tudoPronto
                    ? 'Sua clínica está 100% pronta pra operar'
                    : (completos + ' de ' + total + ' passos concluídos')
                  }
                </p>
              </div>
              <button
                onClick={() => setAberto(false)}
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  border: 'none', background: tokens.bg.hover, color: tokens.text.secondary,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                onMouseEnter={e => e.currentTarget.style.background = tokens.border.default}
                onMouseLeave={e => e.currentTarget.style.background = tokens.bg.hover}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Barra de progresso */}
            <div style={{ padding: '16px 24px 0' }}>
              <div style={{
                height: 6, background: tokens.bg.hoverStrong, borderRadius: 3,
                overflow: 'hidden' as const,
              }}>
                <div style={{
                  width: progressoPct + '%', height: '100%',
                  background: tudoPronto ? tokens.accent.emerald : ACCENT,
                  borderRadius: 3,
                  transition: 'width 0.4s ease',
                }}/>
              </div>
            </div>

            {/* Lista */}
            <div style={{ flex: 1, overflow: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {passos.map(p => (
                <div
                  key={p.key}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 14,
                    padding: 16, borderRadius: 12,
                    background: p.completo ? ACCENT_LIGHT : tokens.bg.muted,
                    border: p.completo ? `1px solid ${tokens.brand.primaryAccentSoft}` : `1px solid ${tokens.bg.hoverStrong}`,
                  }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: p.completo ? ACCENT : 'white',
                    border: p.completo ? 'none' : `1.5px solid ${tokens.border.strong}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {p.completo && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 14, fontWeight: 700,
                      color: p.completo ? ACCENT : tokens.text.primary,
                      margin: '0 0 4px',
                    }}>
                      {p.label}
                    </p>
                    <p style={{
                      fontSize: 12,
                      color: p.completo ? ACCENT : tokens.text.secondary,
                      margin: '0 0 12px', lineHeight: 1.5,
                    }}>
                      {p.desc}
                    </p>
                    <button
                      onClick={() => { setAberto(false); router.push(p.href) }}
                      style={{
                        padding: '7px 14px', borderRadius: 8,
                        background: p.completo ? 'white' : ACCENT,
                        color: p.completo ? ACCENT : 'white',
                        border: p.completo ? '1px solid ' + ACCENT : 'none',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      {p.ctaLabel}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <style dangerouslySetInnerHTML={{ __html: '@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } } ' +
              '@keyframes slideIn { from { transform: translateX(100%) } to { transform: translateX(0) } }' }} />
          </div>
        </>
      )}
    </>
  )
}
