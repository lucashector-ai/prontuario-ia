import AgendaPublica from '@/components/agenda-publica/AgendaPublica'
import { notFound } from 'next/navigation'

type Props = {
  params: { slugs: string[] }
}

export default function PaginaAgenda({ params }: Props) {
  const slugs = params.slugs || []

  if (slugs.length === 1) {
    // /agenda/medico-solo
    return <AgendaPublica medicoSlug={slugs[0]} />
  }

  if (slugs.length === 2) {
    // /agenda/clinica/medico
    return <AgendaPublica clinicaSlug={slugs[0]} medicoSlug={slugs[1]} />
  }

  // 3+ segmentos não existe — 404
  notFound()
}

export const dynamic = 'force-dynamic'
