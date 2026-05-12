import { SubNav } from './_components/SubNav'

export default function FinanceiroPremiumLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '24px clamp(16px, 4vw, 40px)', maxWidth: 1280, margin: '0 auto' }}>
      <SubNav />
      {children}
    </div>
  )
}
