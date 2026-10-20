'use client'
import { usePageHeader } from '@/components/shell/header-context'
import { TabelaPlanos } from '@/components/planos/TabelaPlanos'

export default function PlanosPage() {
  usePageHeader('Planos', 'Escolha o plano da sua clínica')
  return <div className="c360-pagina"><TabelaPlanos /></div>
}
