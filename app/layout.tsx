import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Prontuário IA',
  description: 'Prontuário médico gerado por voz com inteligência artificial',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
