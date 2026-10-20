import { AbasSecao } from '@/components/shell/AbasSecao'

// Indicadores: atendimento do dia (gestor) e relatórios na mesma área
export default function Layout({ children }: { children: React.ReactNode }) {
  return <><AbasSecao abas={[{ href: '/gestao', label: 'Atendimento do dia', so: 'gestor' }, { href: '/relatorios', label: 'Relatórios' }]} />{children}</>
}
