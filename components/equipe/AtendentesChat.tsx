'use client'
/**
 * Atendentes do chat: pessoas que só respondem as conversas (WhatsApp, Instagram, Messenger),
 * sem acesso a agenda nem prontuário. Cada atendente fica ligado à caixa de um médico.
 * Entram por /login-atendente.
 */
import { useEffect, useState } from 'react'
import { Headset, Trash2, UserPlus } from 'lucide-react'
import { tokens as T } from '@/lib/design-tokens'
import { Button, EmptyState, Field, Input, Modal, ModalAcoes, Select } from '@/components/ui'
import { notificar } from '@/components/ui/dialogos'
import { SenhaStrength, senhaEhForte } from '@/components/SenhaStrength'

type Atendente = { id: string; nome: string; email: string; cargo: string; ativo: boolean; medico_id?: string }

export function AtendentesChat({ medicos }: { medicos: { id: string; nome: string }[] }) {
  const [lista, setLista] = useState<(Atendente & { caixa: string })[] | null>(null)
  const [novo, setNovo] = useState(false)
  const [form, setForm] = useState({ nome: '', email: '', senha: '', medico_id: '' })
  const [salvando, setSalvando] = useState(false)

  async function carregar() {
    const todas = await Promise.all(medicos.map(async m => {
      const r = await fetch('/api/atendentes?medico_id=' + m.id).then(r => r.json()).catch(() => ({ atendentes: [] }))
      return (r.atendentes || []).map((a: Atendente) => ({ ...a, medico_id: m.id, caixa: m.nome }))
    }))
    setLista(todas.flat().filter((a: Atendente) => a.ativo !== false))
  }
  useEffect(() => { if (medicos.length) carregar(); else setLista([]) }, [medicos.map(m => m.id).join()]) // eslint-disable-line react-hooks/exhaustive-deps

  async function criar() {
    if (!form.nome.trim() || !form.email.trim() || !form.medico_id) return notificar('Preencha nome, email e a caixa de mensagens', 'erro')
    if (!senhaEhForte(form.senha)) return notificar('A senha precisa de 8+ caracteres, com maiúscula, minúscula e número', 'erro')
    setSalvando(true)
    try {
      const r = await fetch('/api/atendentes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, email: form.email.trim().toLowerCase() }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error)
      notificar(`${form.nome} já pode entrar em /login-atendente com esse email e senha`)
      setNovo(false); setForm({ nome: '', email: '', senha: '', medico_id: '' }); carregar()
    } catch (e: any) { notificar(e.message || 'Não foi possível cadastrar', 'erro') } finally { setSalvando(false) }
  }

  async function desativar(a: Atendente) {
    await fetch('/api/atendentes?id=' + a.id, { method: 'DELETE' }).catch(() => {})
    notificar(`${a.nome} não tem mais acesso ao chat`); carregar()
  }

  return (
    <div style={{ borderTop: `1px solid ${T.border.muted}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', flexWrap: 'wrap' }}>
        <span style={{ flex: 1, fontSize: 12.5, color: T.text.secondary, minWidth: 220 }}>Só respondem as mensagens do Chat. Não veem agenda nem prontuário. Entram pela página “Entrar como atendente”.</span>
        <Button size="sm" icon={UserPlus} onClick={() => setNovo(true)} disabled={!medicos.length}>Adicionar atendente</Button>
      </div>
      {lista === null ? <div style={{ padding: '0 18px 18px' }}><span className="c360-skel" style={{ display: 'block', height: 44, borderRadius: 10 }} /></div>
        : lista.length === 0 ? <EmptyState icon={Headset} titulo="Nenhum atendente do chat" descricao="Útil quando alguém só cuida do WhatsApp e das redes, sem mexer na agenda." />
        : lista.map(a => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', borderTop: `1px solid ${T.border.muted}` }}>
            <span style={{ width: 34, height: 34, borderRadius: 10, background: T.brand.primaryLight, color: T.brand.primary, display: 'grid', placeItems: 'center' }}><Headset size={16} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 650 }}>{a.nome}</div>
              <div style={{ fontSize: 12.5, color: T.text.tertiary }}>{a.email} · caixa de {a.caixa}</div>
            </div>
            <Button size="sm" variant="ghost" icon={Trash2} onClick={() => desativar(a)}>Tirar acesso</Button>
          </div>
        ))}
      {novo && (
        <Modal titulo="Adicionar atendente do chat" onClose={() => setNovo(false)} largura={460}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Nome"><Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex.: Paula Lima" /></Field>
            <Field label="Email (login)"><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></Field>
            <Field label="Caixa de mensagens" hint="As conversas de qual número/médico essa pessoa atende.">
              <Select value={form.medico_id} onChange={e => setForm(f => ({ ...f, medico_id: e.target.value }))}>
                <option value="">Escolha…</option>
                {medicos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </Select>
            </Field>
            <Field label="Senha inicial"><Input type="text" value={form.senha} onChange={e => setForm(f => ({ ...f, senha: e.target.value }))} autoComplete="new-password" /><SenhaStrength senha={form.senha} /></Field>
          </div>
          <ModalAcoes>
            <Button variant="secondary" onClick={() => setNovo(false)}>Voltar</Button>
            <Button onClick={criar} disabled={salvando}>{salvando ? 'Salvando…' : 'Cadastrar'}</Button>
          </ModalAcoes>
        </Modal>
      )}
    </div>
  )
}
