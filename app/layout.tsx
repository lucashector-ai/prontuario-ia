import type { Metadata } from 'next'
import './globals.css'
import DeepgramDebug from '@/components/DeepgramDebug'

export const metadata: Metadata = {
  title: 'MedIA — Prontuário Inteligente',
  description: 'Plataforma de documentação clínica com inteligência artificial',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <DeepgramDebug />
      </body>
    </html>
  )
}
