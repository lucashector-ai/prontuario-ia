import type { Metadata } from 'next'
import './globals.css'
import { ToastProvider } from '@/components/Toast'
import { AppShell } from '@/components/AppShell'

export const metadata: Metadata = {
  title: 'Clinical 360 — Gestão Inteligente da Clínica',
  description: 'Plataforma completa de gestão clínica com inteligência artificial — agenda, prontuário, financeiro e teleconsulta em um só lugar.',
  icons: { icon: '/favicon.svg' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <ToastProvider>
          <AppShell>{children}</AppShell>
        </ToastProvider>
      </body>
    </html>
  )
}
