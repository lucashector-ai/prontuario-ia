'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { tokens } from '@/lib/design-tokens'

const ITENS = [
  { href: '/estoque',                label: 'Produtos' },
  { href: '/estoque/lotes',          label: 'Lotes' },
  { href: '/estoque/fornecedores',   label: 'Fornecedores' },
  { href: '/estoque/procedimentos',  label: 'Procedimentos' },
]

export function SubNav() {
  const pathname = usePathname()
  return (
    <nav
      aria-label="Seções do estoque"
      style={{
        display: 'flex', gap: 4,
        borderBottom: `1px solid ${tokens.border.subtle}`,
        marginBottom: 24, overflowX: 'auto',
      }}
    >
      {ITENS.map((it) => {
        const active =
          pathname === it.href ||
          (it.href !== '/estoque' && pathname?.startsWith(it.href + '/'))
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
            }}
          >
            {it.label}
            <span
              aria-hidden
              style={{
                position: 'absolute', left: 8, right: 8, bottom: -1,
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
