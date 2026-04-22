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

  useEffect(() => {
    carregar()
  }, [])

  const carregar = async () => {
    try {
      // Detecta contexto de usuário
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

      // 1. Cadastrar médicos — conta médicos ativos com cargo 'medico' na clínica
      const { count: numMedicos } = await supabase
        .from('medicos')
        .select('*', { count: 'exact', head: true })
        .eq('clinica_id', clinicaId)
        .eq('cargo', 'medico')
        .eq('ativo', true)

      // 2. Primeiro médico da clínica pra checar WhatsApp e Sofia
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

      // 3. Dados da clínica
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
          desc: numMedicos ? `${numMedicos} médico${numMedicos !== 1 ? 's' : ''} cadastrado${numMedicos !== 1 ? 's' : ''}` : 'Adicione os médicos que atendem na sua clínica',
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

  if (carregando) return null
  if (passos.length === 0) return null

  const completos = passos.filter(p => p.completo).length
  const total = passos.length
  const tudoPronto = completos === total
  const progressoPct = (completos / total) * 100

  return (
    <div style={{
      background: 'white',
      borderRadius: 16,
      padding: 20,
      marginBottom: 20,
      border: tudoPronto ? `1px solid ${ACCENT_LIGHT}` : '1px solid #f3f4f6',
    }}>
      {/* Header com progresso */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 2px' }}>
            {tudoPronto ? '✓ Tudo configurado!' : 'Comece por aqui'}
          </p>
          <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>
            {tudoPronto ? 'Sua clínica está 100% pronta pra operar' : `${completos} de ${total} passos concluídos`}
          </p>
        </div>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: tudoPronto ? ACCENT_LIGHT : '#f3f4f6',
          color: tudoPronto ? ACCENT : '#9ca3af',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700,
        }}>
          {tudoPronto ? '✓' : `${completos}/${total}`}
        </div>
      </div>

      {/* Barra de progresso */}
      <div style={{
        height: 3, background: '#f3f4f6', borderRadius: 2,
        overflow: 'hidden', marginBottom: 16,
      }}>
        <div style={{
          width: progressoPct + '%', height: '100%',
          background: ACCENT,
          borderRadius: 2,
          transition: 'width 0.4s ease',
        }}/>
      </div>

      {/* Lista de passos */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {passos.map(p => (
          <div
            key={p.key}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', borderRadius: 10,
              background: p.completo ? ACCENT_LIGHT : '#F9FAFB',
            }}
          >
            {/* Check ou círculo */}
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              background: p.completo ? ACCENT : 'white',
              border: p.completo ? 'none' : '1.5px solid #d1d5db',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {p.completo && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </div>

            {/* Texto */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: p.completo ? ACCENT : '#111827', margin: '0 0 2px' }}>
                {p.label}
              </p>
              <p style={{ fontSize: 11, color: p.completo ? ACCENT : '#6b7280', margin: 0 }}>
                {p.desc}
              </p>
            </div>

            {/* Botão */}
            <button
              onClick={() => router.push(p.href)}
              style={{
                padding: '6px 14px', borderRadius: 8,
                background: p.completo ? 'white' : ACCENT,
                color: p.completo ? ACCENT : 'white',
                border: p.completo ? `1px solid ${ACCENT}` : 'none',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              {p.ctaLabel}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
