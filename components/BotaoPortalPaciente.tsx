'use client'
/** "Portal do paciente": gera (ou renova) o link pessoal do paciente e oferece copiar ou mandar pelo WhatsApp. */
import { useState } from 'react'
import { Copy, ExternalLink, MessageCircle, Smartphone } from 'lucide-react'
import { tokens as T } from '@/lib/design-tokens'
import { Button, Modal } from '@/components/ui'
import { notificar } from '@/components/ui/dialogos'

export function BotaoPortalPaciente({ paciente, demo }: { paciente: { id: string; nome?: string | null; telefone?: string | null }; demo?: boolean }) {
  const [link, setLink] = useState<string | null>(null)
  const [gerando, setGerando] = useState(false)

  async function abrir() {
    if (demo) { setLink('https://clinical360.vercel.app/p/exemplo-de-link-do-portal'); return }
    setGerando(true)
    try {
      const r = await fetch('/api/portal/link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paciente_id: paciente.id }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.erro)
      setLink(j.url)
    } catch (e: any) { notificar(e.message || 'Não foi possível gerar o link.', 'erro') }
    finally { setGerando(false) }
  }

  const primeiro = String(paciente.nome || '').split(' ')[0]
  const texto = link ? `Olá${primeiro ? `, ${primeiro}` : ''}! Este é o seu portal: confirme sua consulta, avise quando chegar e prepare sua pré-consulta por aqui: ${link}` : ''
  const tel = String(paciente.telefone || '').replace(/\D/g, '')
  const whats = tel ? `https://wa.me/${tel.length <= 11 ? '55' + tel : tel}?text=${encodeURIComponent(texto)}` : `https://wa.me/?text=${encodeURIComponent(texto)}`

  return (
    <>
      <Button variant="secondary" icon={Smartphone} onClick={abrir} disabled={gerando}>{gerando ? 'Gerando…' : 'Portal do paciente'}</Button>
      {link && (
        <Modal titulo="Portal do paciente" onClose={() => setLink(null)} largura={480}
          rodape={<><Button variant="secondary" icon={Copy} onClick={() => { navigator.clipboard?.writeText(link); notificar('Link copiado') }}>Copiar link</Button>
            <Button icon={MessageCircle} onClick={() => window.open(whats, '_blank')}>Enviar no WhatsApp</Button></>}>
          <p style={{ fontSize: 13.5, color: T.text.secondary, margin: '0 0 12px', lineHeight: 1.5 }}>
            Pelo link, {primeiro || 'o paciente'} confirma a consulta, pede para remarcar, avisa que chegou e preenche os formulários da pré-consulta. Sem instalar nada. O link vale 30 dias e é renovado a cada envio.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 12, border: `1px solid ${T.border.default}`, background: T.bg.hover }}>
            <span className="mono" style={{ flex: 1, minWidth: 0, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: T.text.primary }}>{link}</span>
            <Button size="sm" variant="ghost" icon={ExternalLink} onClick={() => window.open(link, '_blank')}>Abrir</Button>
          </div>
        </Modal>
      )}
    </>
  )
}
