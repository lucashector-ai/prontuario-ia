'use client'
/** /atendimento abre direto no posto da pessoa (ou no padrão do perfil). */
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { postoInicial } from '@/lib/atendimento/posto'

export default function AtendimentoInicio() {
  const router = useRouter()
  useEffect(() => {
    const demo = new URLSearchParams(window.location.search).get('demo') === '1' ? '?demo=1' : ''
    router.replace(`/atendimento/${postoInicial()}${demo}`)
  }, [router])
  return null
}
