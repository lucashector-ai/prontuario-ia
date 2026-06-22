'use client'
import { log } from '@/lib/logger'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export type MedicoSession = {
  id: string
  nome: string
  email?: string
  crm?: string
  especialidade?: string
  clinica_id?: string
  slug_publico?: string
  agenda_publica_ativa?: boolean
  agenda_publica_config?: any
}

export type AuthEstado = {
  tipo: 'medico' | 'admin' | null
  adminClinicaId?: string  // se for admin, qual clínica ele administra
  medicoAtivo: MedicoSession | null
  medicosDisponiveis: MedicoSession[]  // só preenche se for admin
  loading: boolean
}

/**
 * Hook unificado que aceita médico OU admin de clínica.
 * Se for admin, busca todos os médicos da clínica pra ele escolher qual configurar.
 */
export function useMedicoLogado() {
  const router = useRouter()
  const [estado, setEstado] = useState<AuthEstado>({
    tipo: null,
    medicoAtivo: null,
    medicosDisponiveis: [],
    loading: true,
  })

  useEffect(() => {
    async function carregar() {
      try {
        const rawMedico = localStorage.getItem('medico')
        const rawAdmin = localStorage.getItem('clinica_admin')

        // Caso 1: médico logado
        if (rawMedico) {
          const med = JSON.parse(rawMedico)
          // Recarrega do banco pra pegar slug_publico/agenda_publica_config atualizados
          const { data: medFresco } = await supabase
            .from('medicos')
            .select('id, nome, email, crm, especialidade, clinica_id, slug_publico, agenda_publica_ativa, agenda_publica_config')
            .eq('id', med.id)
            .single()

          const medicoCompleto = medFresco || med
          setEstado({
            tipo: 'medico',
            medicoAtivo: medicoCompleto,
            medicosDisponiveis: [medicoCompleto],
            loading: false,
          })
          return
        }

        // Caso 2: admin de clínica logado
        if (rawAdmin) {
          const admin = JSON.parse(rawAdmin)
          if (!admin.clinica_id) {
            router.replace('/login')
            return
          }

          // Busca todos os médicos dessa clínica
          const { data: medicos } = await supabase
            .from('medicos')
            .select('id, nome, email, crm, especialidade, clinica_id, slug_publico, agenda_publica_ativa, agenda_publica_config')
            .eq('clinica_id', admin.clinica_id)
            .eq('ativo', true)
            .order('nome')

          const lista = medicos || []
          setEstado({
            tipo: 'admin',
            adminClinicaId: admin.clinica_id,
            medicoAtivo: lista[0] || null,
            medicosDisponiveis: lista,
            loading: false,
          })
          return
        }

        // Nenhum dos dois: redireciona pro login
        router.replace('/login')
      } catch (e) {
        log.error('useMedicoLogado:', e)
        router.replace('/login')
      }
    }
    carregar()
  }, [router])

  function trocarMedicoAtivo(medicoId: string) {
    const novo = estado.medicosDisponiveis.find(m => m.id === medicoId)
    if (novo) setEstado(prev => ({ ...prev, medicoAtivo: novo }))
  }

  function atualizarMedicoAtivo(updates: Partial<MedicoSession>) {
    setEstado(prev => {
      if (!prev.medicoAtivo) return prev
      const atualizado = { ...prev.medicoAtivo, ...updates }
      return {
        ...prev,
        medicoAtivo: atualizado,
        medicosDisponiveis: prev.medicosDisponiveis.map(m => 
          m.id === atualizado.id ? atualizado : m
        ),
      }
    })

    // Se for o próprio médico logado, atualiza localStorage tbm
    if (estado.tipo === 'medico') {
      const raw = localStorage.getItem('medico')
      if (raw) {
        const med = JSON.parse(raw)
        localStorage.setItem('medico', JSON.stringify({ ...med, ...updates }))
      }
    }
  }

  return { 
    ...estado, 
    trocarMedicoAtivo,
    atualizarMedicoAtivo,
    // Aliases para compatibilidade com código antigo
    medico: estado.medicoAtivo,
    setMedico: atualizarMedicoAtivo,
  }
}
