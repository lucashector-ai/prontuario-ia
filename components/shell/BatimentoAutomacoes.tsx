'use client'
import { useEffect } from 'react'

const INTERVALO = 15 * 60_000

/**
 * Mantém as automações (confirmações, retornos) rodando a cada 15 min enquanto
 * o sistema estiver aberto — complementa o cron diário da Vercel (plano Hobby).
 * O servidor tem trava própria, então várias abas abertas não duplicam envios.
 * Silencioso: nunca mostra erro ao usuário.
 */
export function BatimentoAutomacoes() {
  useEffect(() => {
    const demo = new URLSearchParams(window.location.search).get('demo') === '1'
    const logado = !!(localStorage.getItem('clinica_admin') || localStorage.getItem('medico'))
    if (demo || !logado) return

    const bater = () => {
      if (!navigator.onLine) return
      fetch('/api/automacoes/tick', { method: 'POST', keepalive: true }).catch(() => {})
    }
    const primeiro = setTimeout(bater, 20_000) // deixa a página carregar antes
    const t = setInterval(bater, INTERVALO)
    return () => { clearTimeout(primeiro); clearInterval(t) }
  }, [])
  return null
}
