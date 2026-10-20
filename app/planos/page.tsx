'use client'
import { usePageHeader } from '@/components/shell/header-context'
import { TabelaPlanos } from '@/components/planos/TabelaPlanos'
import { CartaoSaldo } from '@/components/planos/SaldoCreditos'

export default function PlanosPage() {
  usePageHeader('Planos e créditos', 'Seu saldo de créditos de IA e os planos da clínica')
  return <div className="c360-pagina" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}><CartaoSaldo /><TabelaPlanos /></div>
}
