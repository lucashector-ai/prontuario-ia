import type { Metadata } from 'next'
import './globals.css'
import { ToastProvider } from '@/components/Toast'
import { AppShell } from '@/components/AppShell'

export const metadata: Metadata = {
  title: 'MedIA — Prontuário Inteligente',
  description: 'Plataforma de documentação clínica com inteligência artificial',
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
