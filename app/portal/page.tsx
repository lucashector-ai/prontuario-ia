import { tokens } from '@/lib/design-tokens'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { FadeIn } from '@/components/motion/FadeIn'

export default function PortalHomePage() {
  return (
    <FadeIn>
      <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <header>
          <Badge variant="brand" size="sm">Sprint 1 — em construção</Badge>
          <h1 style={{ margin: '12px 0 8px', fontSize: 34, fontWeight: 700, letterSpacing: -0.6, color: tokens.text.primary }}>
            Olá, paciente.
          </h1>
          <p style={{ margin: 0, fontSize: 16, color: tokens.text.secondary, lineHeight: 1.5 }}>
            Esta é a fundação do Portal do Paciente premium. As páginas reais vêm no Sprint 2.
          </p>
        </header>

        <Card variant="elevated">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: tokens.text.tertiary }}>PRÓXIMA CONSULTA</span>
            <span style={{ fontSize: 22, fontWeight: 600, color: tokens.text.primary }}>Em breve</span>
            <span style={{ fontSize: 13, color: tokens.text.secondary }}>Integração com agenda no Sprint 2.</span>
          </div>
        </Card>
      </div>
    </FadeIn>
  )
}
