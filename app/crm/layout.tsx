import { SubNav } from './_components/SubNav'

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '24px clamp(16px, 4vw, 40px)', maxWidth: 1400, margin: '0 auto' }}>
      <SubNav />
      {children}
    </div>
  )
}
