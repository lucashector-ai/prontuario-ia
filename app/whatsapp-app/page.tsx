import { redirect } from 'next/navigation'

// O WhatsApp antigo foi desativado — conversas de WhatsApp, Instagram e Messenger ficam no Chat.
export default function Page() {
  redirect('/chat')
}
