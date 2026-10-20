import { AbasSecao } from '@/components/shell/AbasSecao'

// Pacientes: cadastro e as consultas (histórico de prontuários) na mesma área
export default function Layout({ children }: { children: React.ReactNode }) {
  return <><AbasSecao abas={[{ href: '/pacientes', label: 'Pacientes' }, { href: '/historico', label: 'Consultas e prontuários', so: 'clinico' }]} />{children}</>
}
