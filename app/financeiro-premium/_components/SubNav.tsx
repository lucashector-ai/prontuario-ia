'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { tokens } from '@/lib/design-tokens'

const ITENS = [
  { href: '/financeiro-premium',                 label: 'Visão geral' },
  { href: '/financeiro-premium/movimentacoes',   label: 'Movimentações' },
  { href: '/financeiro-premium/comissoes',       label: 'Comissões' },
  { href: '/financeiro-premium/pix',             label: 'Pix' },
  { href: '/financeiro-premium/recorrencia',     label: 'Recorrência' },
  { href: '/financeiro-premium/dre',             label: 'DRE' },
  { href: '/financeiro-premium/exportar',        label: 'Exportar' },
]

export function SubNav() {
  const pathname = usePathname()

  return (
    <nav
      style={{
        display: 'flex',
        gap: 4,
        borderBottom: `1px solid ${tokens.border.subtle}`,
        marginBottom: 24,
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
      aria-label="Seções do financeiro"
    >
      {ITENS.map((it) => {
        const active =
          pathname === it.href ||
          (it.href !== '/financeiro-premium' && pathname?.startsWith(it.href + '/'))
        return (
          <Link
            key={it.href}
            href={it.href}
            style={{
              position: 'relative',
              padding: '10px 14px',
              fontSize: 14,
              fontWeight: active ? 600 : 500,
              color: active ? tokens.text.primary : tokens.text.secondary,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              transition: 'color 120ms ease',
            }}
          >
            {it.label}
            <span
              aria-hidden
              style={{
                position: 'absolute',
                left: 8,
                right: 8,
                bottom: -1,
                height: 2,
                background: active ? tokens.brand.primary : 'transparent',
                borderRadius: 2,
              }}
            />
          </Link>
        )
      })}
    </nav>
  )
}
