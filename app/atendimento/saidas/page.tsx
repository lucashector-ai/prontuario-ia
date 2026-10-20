'use client'
/** Saídas e retornos: o que o médico pediu na saída (retorno, exames, recados) e atalhos para os retornos. */
import Link from 'next/link'
import { CalendarHeart, CalendarCheck, DoorOpen } from 'lucide-react'
import { tokens as T } from '@/lib/design-tokens'
import { usePageHeader } from '@/components/shell/header-context'
import { Card, EmptyState } from '@/components/ui'
import { useFila } from '@/lib/atendimento/useFila'
import { avisarFila } from '@/lib/atendimento/cliente'
import { SaindoDoConsultorio } from '@/components/atendimento/blocos'

export default function SaidasPage() {
  usePageHeader('Central de atendimento', 'Saídas do consultório e retornos para agendar')
  const { fila, carregando, recarregar } = useFila(null)
  const saidas = fila?.saidas || []
  return (
    <div className="c360-pagina" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {carregando && !fila ? <span className="c360-skel" style={{ height: 140, borderRadius: 16 }} />
        : saidas.length ? <SaindoDoConsultorio saidas={saidas} onMudou={() => { avisarFila(); recarregar() }} />
        : <Card><EmptyState icon={DoorOpen} titulo="Nenhuma saída para resolver" descricao="Quando o médico finalizar uma consulta pedindo retorno, exames ou um recado, aparece aqui na hora (e com aviso no canto da tela)." /></Card>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
        {[
          { href: '/retornos', icon: CalendarHeart, t: 'Retornos e reativação', d: 'Pacientes com retorno vencendo ou que sumiram: agendar ou mandar mensagem.' },
          { href: '/configuracoes/agenda-publica', icon: CalendarCheck, t: 'Pedidos da agenda online', d: 'Pedidos de horário feitos pelo paciente na sua página de agendamento.' },
        ].map(x => (
          <Link key={x.href} href={x.href} style={{ textDecoration: 'none' }}>
            <Card hover style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ width: 36, height: 36, borderRadius: 11, display: 'grid', placeItems: 'center', background: T.brand.primaryLight, color: T.brand.primary, flexShrink: 0 }}><x.icon size={18} /></span>
              <span><span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: T.text.primary }}>{x.t}</span><span style={{ display: 'block', fontSize: 12.5, color: T.text.secondary, marginTop: 2 }}>{x.d}</span></span>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
