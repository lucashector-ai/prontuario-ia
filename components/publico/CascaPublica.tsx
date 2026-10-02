'use client'
/**
 * Casca das páginas que o PACIENTE vê (fora do app): fundo cinza da plataforma,
 * logo da clínica (ou a marca Clinical 360) no topo e rodapé discreto.
 * O conteúdo vai em cards brancos raio 20 — use `cartaoPublico`.
 */
import { Lock } from 'lucide-react'
import { tokens } from '@/lib/design-tokens'
import { Icon } from '@/components/ui'
import { Marca } from '@/components/Marca'

const T = tokens

export const cartaoPublico: React.CSSProperties = {
  background: T.bg.card,
  border: `1px solid ${T.border.default}`,
  borderRadius: T.radius['3xl'],
}

export function CascaPublica({ clinica, largura = 880, rodape = true, children }: {
  clinica?: { nome: string; logo_url: string | null } | null
  largura?: number
  rodape?: boolean
  children: React.ReactNode
}) {
  return (
    <div style={{ minHeight: '100dvh', background: T.bg.page, padding: '20px 16px 40px', boxSizing: 'border-box' }}>
      <style dangerouslySetInnerHTML={{ __html: '@keyframes c360-pub-spin { to { transform: rotate(360deg) } }' }} />
      <header style={{ maxWidth: largura, margin: '0 auto 18px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 32 }}>
        {clinica?.logo_url ? (
          <img src={clinica.logo_url} alt={clinica.nome} style={{ height: 32, width: 'auto', maxWidth: 180, objectFit: 'contain', display: 'block' }} />
        ) : clinica ? (
          <span style={{ fontSize: 15, fontWeight: 700, color: T.text.primary, letterSpacing: '-.01em' }}>{clinica.nome}</span>
        ) : (
          <Marca altura={24} />
        )}
      </header>
      {children}
      {rodape && (
        <footer style={{ marginTop: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, fontSize: 12, color: T.text.tertiary }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon icon={Lock} size={12} /> Seus dados são protegidos
          </span>
          {clinica && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              Powered by <Marca altura={14} style={{ opacity: 0.8 }} />
            </span>
          )}
        </footer>
      )}
    </div>
  )
}

export function Spinner({ tamanho = 20 }: { tamanho?: number }) {
  return (
    <span style={{
      display: 'inline-block', width: tamanho, height: tamanho, borderRadius: '50%', flexShrink: 0, boxSizing: 'border-box',
      border: `${tamanho >= 24 ? 2.5 : 2}px solid ${T.brand.primaryLight}`, borderTopColor: T.brand.primary,
      animation: 'c360-pub-spin .8s linear infinite',
    }} />
  )
}
