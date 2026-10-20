'use client'
/**
 * Abas no topo de telas que são parte de uma mesma área (ex.: Indicadores = atendimento do dia +
 * relatórios; Pacientes = cadastro + consultas). Cada aba é uma rota; só aparece na rota exata
 * de uma das abas (fichas e detalhes abaixo delas ficam sem a barra) e some se sobrar uma aba só.
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { tokens as T } from '@/lib/design-tokens'
import { ehApoio } from '@/lib/cargos'
import { ehDemo } from '@/lib/demo'

export type Aba = { href: string; label: string; so?: 'gestor' | 'clinico' }

export function AbasSecao({ abas }: { abas: Aba[] }) {
  const pathname = usePathname()
  const [perfil, setPerfil] = useState<{ gestor: boolean; apoio: boolean } | null>(null)
  const [demo, setDemo] = useState('')
  useEffect(() => {
    try {
      const ca = localStorage.getItem('clinica_admin')
      const m = JSON.parse(localStorage.getItem('medico') || 'null')
      setPerfil({ gestor: !!ca || m?.cargo === 'admin', apoio: ehApoio(m?.cargo) })
      setDemo(ehDemo() ? '?demo=1' : '')
    } catch { setPerfil({ gestor: false, apoio: false }) }
  }, [])
  if (!perfil || !abas.some(a => a.href === pathname)) return null
  const visiveis = abas.filter(a => !(a.so === 'gestor' && !perfil.gestor) && !(a.so === 'clinico' && perfil.apoio))
  if (visiveis.length < 2) return null
  return (
    <nav aria-label="Seções" style={{ display: 'flex', gap: 2, padding: '0 14px', borderBottom: `1px solid ${T.border.default}`, overflowX: 'auto', scrollbarWidth: 'none' }}>
      {visiveis.map(a => {
        const ativa = a.href === pathname
        return (
          <Link key={a.href} href={a.href + demo} aria-current={ativa ? 'page' : undefined} style={{
            padding: '12px 12px 10px', fontSize: 13.5, fontWeight: ativa ? 700 : 600, whiteSpace: 'nowrap', textDecoration: 'none',
            color: ativa ? T.brand.primary : T.text.secondary, borderBottom: `2px solid ${ativa ? T.brand.primary : 'transparent'}`, marginBottom: -1,
          }}>{a.label}</Link>
        )
      })}
    </nav>
  )
}
