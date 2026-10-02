import { redirect } from 'next/navigation'

// Lista antiga de contatos do WhatsApp — agora as conversas ficam no Chat.
export default function Page() {
  redirect('/chat')
}
