import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Formulário — Clinical 360',
}

export default function FormsPublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
