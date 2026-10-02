import Link from 'next/link'
import { tokens } from '@/lib/design-tokens'

export default function NotFound() {
  return (
    <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 380 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16, margin: '0 auto 16px',
          background: tokens.brand.primaryLight, color: tokens.brand.primary,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3M8.5 11h5" />
          </svg>
        </div>
        <p style={{ fontSize: 12, fontWeight: 600, color: tokens.brand.primary, margin: '0 0 6px', letterSpacing: '0.04em' }}>ERRO 404</p>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: tokens.text.primary, margin: '0 0 8px' }}>Página não encontrada</h1>
        <p style={{ fontSize: 14, color: tokens.text.secondary, margin: '0 0 20px', lineHeight: 1.5 }}>
          O endereço pode estar errado ou a página foi movida.
        </p>
        <Link href="/dashboard" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 10,
          background: tokens.brand.primary, color: 'white', fontSize: 13, fontWeight: 600, textDecoration: 'none',
        }}>
          Voltar ao início
        </Link>
      </div>
    </div>
  )
}
