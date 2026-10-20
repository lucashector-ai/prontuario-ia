'use client'
/** /atendimento abre direto no posto da pessoa (ou no padrão do perfil). */
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { postoInicial } from '@/lib/atendimento/posto'
import { comDemo } from '@/lib/demo'

export default function AtendimentoInicio() {
  const router = useRouter()
  useEffect(() => {
    // Mantém os parâmetros (?demo=1, ?tour=1…) ao abrir o posto
    router.replace(comDemo(`/atendimento/${postoInicial()}${window.location.search}`))
  }, [router])
  return null
}
