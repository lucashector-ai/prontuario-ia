import type { Metadata } from 'next'
import { PortalShell } from './_components/PortalShell'

export const metadata: Metadata = {
  title: 'Portal do Paciente — Clinical 360',
  description: 'Acompanhe sua jornada de saúde: consultas, exames, prescrições, pagamentos e mensagens em um só lugar.',
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <PortalShell>{children}</PortalShell>
}
