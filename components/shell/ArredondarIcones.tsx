'use client'
import { useEffect } from 'react'

/**
 * Deixa todos os ícones Lucide do app mais arredondados (regra do protótipo do design):
 * cantos dos <rect> = 32% do menor lado, no máximo 6 (em unidades do viewBox 24×24).
 * Roda uma vez no carregamento e observa o DOM para ícones que aparecem depois.
 */
function arredondar(raiz: ParentNode) {
  raiz.querySelectorAll<SVGRectElement>('svg.lucide rect:not([data-arr])').forEach(r => {
    const w = parseFloat(r.getAttribute('width') || '0')
    const h = parseFloat(r.getAttribute('height') || '0')
    const atual = parseFloat(r.getAttribute('rx') || '0')
    const rx = Math.min(Math.max(atual, Math.min(w, h) * 0.32), 6)
    r.setAttribute('rx', String(+rx.toFixed(2)))
    r.removeAttribute('ry')
    r.setAttribute('data-arr', '1')
  })
}

export function ArredondarIcones() {
  useEffect(() => {
    arredondar(document)
    let pendente = false
    const obs = new MutationObserver(() => {
      if (pendente) return
      pendente = true
      requestAnimationFrame(() => { pendente = false; arredondar(document) })
    })
    obs.observe(document.body, { childList: true, subtree: true })
    return () => obs.disconnect()
  }, [])
  return null
}
