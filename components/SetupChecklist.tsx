'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const ACCENT = '#6043C1'
const ACCENT_LIGHT = '#ede9fb'

type Passo = {
  key: string
  label: string
  desc: string
  completo: boolean
  href: string
  ctaLabel: string
}

export function SetupChecklist() {
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

      const { count: numMedicos } = await supabase
        .from('medicos')
        .select('*', { count: 'exact', head: true })
        .eq('clinica_id', clinicaId)
        .eq('cargo', 'medico')
        .eq('ativo', true)

      const { data: primeiroMedico } = await supabase
        .from('medicos')
        .select('id')
        .eq('clinica_id', clinicaId)
        .eq('ativo', true)
        .order('criado_em', { ascending: true })
        .limit(1)
        .maybeSingle()

      let whatsappConectado = false
      let sofiaConfigurada = false

      if (primeiroMedico) {
        const { data: config } = await supabase
          .from('whatsapp_config')
          .select('access_token, sofia_instrucoes')
          .eq('medico_id', primeiroMedico.id)
          .maybeSingle()
        whatsappConectado = !!(config && config.access_token)
        sofiaConfigurada = !!(config && config.sofia_instrucoes && config.sofia_instrucoes.length > 10)
      }

      const { data: clinica } = await supabase
        .from('clinicas')
        .select('nome, telefone, logo_url, email')
        .eq('id', clinicaId)
        .single()

      const clinicaConfigurada = !!(clinica && clinica.telefone && (clinica.logo_url || clinica.email))

      const lista: Passo[] = [
        {
          key: 'medicos',
          label: 'Cadastre seus médicos',
          desc: numMedicos ? (numMedicos + ' médico' + (numMedicos !== 1 ? 's' : '') + ' cadastrado' + (numMedicos !== 1 ? 's' : '')) : 'Adicione os médicos que atendem na sua clínica',
          completo: (numMedicos || 0) > 0,
          href: '/admin',
          ctaLabel: (numMedicos || 0) > 0 ? 'Gerenciar' : 'Cadastrar',
        },
        {
          key: 'whatsapp',
          label: 'Conecte o WhatsApp',
          desc: whatsappConectado ? 'Integração ativa' : 'Configure o WhatsApp Business pra atender pelo chat',
          completo: whatsappConectado,
          href: '/whatsapp-app',
          ctaLabel: whatsappConectado ? 'Ver conversas' : 'Conectar',
        },
        {
          key: 'clinica',
          label: 'Dados da clínica',
          desc: clinicaConfigurada ? 'Informações completas' : 'Preencha telefone, logo e outros dados',
          completo: clinicaConfigurada,
          href: '/minha-clinica',
          ctaLabel: clinicaConfigurada ? 'Editar' : 'Configurar',
        },
        {
          key: 'sofia',
          label: 'Configure a Sofia (IA)',
          desc: sofiaConfigurada ? 'Assistente pronta' : 'Ensine a Sofia a atender como sua clínica',
          completo: sofiaConfigurada,
          href: '/configuracoes/sofia',
          ctaLabel: sofiaConfigurada ? 'Ajustar' : 'Configurar',
        },
      ]

      setPassos(lista)
    } catch (e) {
      console.error('Erro ao carregar setup:', e)
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

  return (
    <>
      {/* FAB no canto inferior direito */}
      <button
        onClick={() => setAberto(true)}
        style={{
          position: 'fixed' as const,
          bottom: 24, right: 24, zIndex: 90,
          display: 'flex', alignItems: 'center', gap: 10,
          padding: tudoPronto ? '12px 16px' : '12px 18px 12px 14px',
          borderRadius: 999, border: 'none',
          background: tudoPronto ? '#10b981' : ACCENT, color: 'white',
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
            Configurar plataforma
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
              borderBottom: '1px solid #f3f4f6',
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
                  {tudoPronto ? 'Configuração completa' : 'Comece por aqui'}
                </h2>
                <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
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
                  border: 'none', background: '#F5F5F5', color: '#6b7280',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#e5e7eb'}
                onMouseLeave={e => e.currentTarget.style.background = '#F5F5F5'}
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
                height: 6, background: '#f3f4f6', borderRadius: 3,
                overflow: 'hidden' as const,
              }}>
                <div style={{
                  width: progressoPct + '%', height: '100%',
                  background: tudoPronto ? '#10b981' : ACCENT,
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
                    background: p.completo ? ACCENT_LIGHT : '#F9FAFB',
                    border: p.completo ? '1px solid #d4c9f7' : '1px solid #f3f4f6',
                  }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: p.completo ? ACCENT : 'white',
                    border: p.completo ? 'none' : '1.5px solid #d1d5db',
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
                      color: p.completo ? ACCENT : '#111827',
                      margin: '0 0 4px',
                    }}>
                      {p.label}
                    </p>
                    <p style={{
                      fontSize: 12,
                      color: p.completo ? ACCENT : '#6b7280',
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

            <style>{
              '@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } } ' +
              '@keyframes slideIn { from { transform: translateX(100%) } to { transform: translateX(0) } }'
            }</style>
          </div>
        </>
      )}
    </>
  )
}
