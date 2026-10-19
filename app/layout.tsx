import type { Metadata } from 'next'
import { Manrope, JetBrains_Mono, Inter } from 'next/font/google'
import './globals.css'
import { ToastProvider } from '@/components/Toast'
import { AppShell } from '@/components/AppShell'
import { ArredondarIcones } from '@/components/shell/ArredondarIcones'

const sans = Manrope({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-sans', display: 'swap' })
// Inter só na landing (antes vinha do Google Fonts por <link>; agora é servida pelo próprio site)
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-inter', display: 'swap', preload: false })
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['500'], variable: '--font-mono', display: 'swap' })

export const metadata: Metadata = {
  title: 'Clinical 360 — Gestão Inteligente da Clínica',
  description: 'Plataforma completa de gestão clínica com inteligência artificial — agenda, prontuário, financeiro e teleconsulta em um só lugar.',
  icons: { icon: '/logo-simbolo.svg' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${sans.variable} ${mono.variable} ${inter.variable}`}>
      <body>
        <ToastProvider>
          <AppShell>{children}</AppShell>
          <ArredondarIcones />
        </ToastProvider>
      </body>
    </html>
  )
}
