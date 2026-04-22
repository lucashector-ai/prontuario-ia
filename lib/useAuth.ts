'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export type TipoUsuario = 'clinica' | 'medico' | 'recepcionista'

export interface UsuarioAuth {
  id: string
  nome: string
  email: string
  clinica_id: string
  cargo?: string
  tipo: TipoUsuario
  raw: any // objeto original do localStorage, útil pra páginas específicas
}

interface UseAuthOptions {
  permitir?: TipoUsuario[]
  redirectSeNaoPermitido?: string
}

export function useAuth(options: UseAuthOptions = {}) {
  const router = useRouter()
  const [usuario, setUsuario] = useState<UsuarioAuth | null>(null)
  const [carregando, setCarregando] = useState(true)

  const permitir = options.permitir || ['clinica', 'medico', 'recepcionista']

  useEffect(() => {
    try {
      // 1. Tenta clinica_admin primeiro
      const ca = localStorage.getItem('clinica_admin')
      if (ca) {
        const admin = JSON.parse(ca)
        if (!permitir.includes('clinica')) {
          router.replace(options.redirectSeNaoPermitido || '/admin')
          return
        }
        setUsuario({
          id: admin.id,
          nome: admin.nome,
          email: admin.email,
          clinica_id: admin.clinica_id,
          cargo: 'admin',
          tipo: 'clinica',
          raw: admin,
        })
        setCarregando(false)
        return
      }

      // 2. Tenta médico/recepcionista
      const m = localStorage.getItem('medico')
      if (!m) {
        router.replace('/login')
        return
      }
      const med = JSON.parse(m)

      const tipo: TipoUsuario = med.cargo === 'recepcionista' ? 'recepcionista' : 'medico'
      if (!permitir.includes(tipo)) {
        router.replace(options.redirectSeNaoPermitido || '/dashboard')
        return
      }

      setUsuario({
        id: med.id,
        nome: med.nome,
        email: med.email,
        clinica_id: med.clinica_id,
        cargo: med.cargo,
        tipo,
        raw: med,
      })
      setCarregando(false)
    } catch (e) {
      console.error('Erro em useAuth:', e)
      router.replace('/login')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { usuario, carregando }
}
