'use client'
/**
 * Unidades da conta (rede): números de cada unidade lado a lado, entrar em outra unidade
 * e cadastrar unidade nova. Cada unidade tem agenda, equipe, fila e TV próprias.
 */
import { useEffect, useState } from 'react'
import { Building2, Check, LogIn, Plus } from 'lucide-react'
import { tokens as T } from '@/lib/design-tokens'
import { Button, Card, EmptyState, Field, Input, Modal, ModalAcoes } from '@/components/ui'
import { notificar } from '@/components/ui/dialogos'
import { trocarDeUnidade } from '@/lib/unidades-cliente'
import { avisoDemo, ehDemo } from '@/lib/demo'

// Demonstração: rede fictícia com duas unidades
const UNIDADES_DEMO: { organizacao: any; unidades: U[] } = {
  organizacao: { nome: 'Rede Bem Viver' },
  unidades: [
    { id: 'demo', nome: 'Clínica Bem Viver', apelido: 'Centro', atual: true, equipe: 5, medicos: 3, pacientes: 1284, hoje: { agendados: 23, atendidos: 11 }, mes: { consultas: 412 } },
    { id: 'demo-un-2', nome: 'Clínica Bem Viver — Zona Sul', apelido: 'Zona Sul', atual: false, equipe: 4, medicos: 2, pacientes: 638, hoje: { agendados: 14, atendidos: 6 }, mes: { consultas: 231 } },
  ],
}

type U = { id: string; nome: string; apelido: string | null; atual: boolean; equipe: number; medicos: number; pacientes: number | null; hoje: { agendados: number | null; atendidos: number | null }; mes: { consultas: number | null } }

export function Unidades() {
  const [dados, setDados] = useState<{ organizacao: any; unidades: U[] } | null>(null)
  const [erro, setErro] = useState('')
  const [nova, setNova] = useState(false)
  const [form, setForm] = useState({ nome: '', apelido: '', telefone: '', endereco: '' })
  const [salvando, setSalvando] = useState(false)

  const carregar = () => ehDemo() ? Promise.resolve(setDados(UNIDADES_DEMO)) : fetch('/api/unidades').then(async r => { const j = await r.json(); if (!r.ok) setErro(j.error || 'Não foi possível carregar'); else setDados(j) }).catch(() => setErro('Sem conexão'))
  useEffect(() => { carregar() }, [])

  async function criar() {
    if (!form.nome.trim()) return notificar('Dê um nome para a unidade', 'erro')
    if (ehDemo()) { setNova(false); avisoDemo(); return }
    setSalvando(true)
    try {
      const r = await fetch('/api/unidades', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const j = await r.json(); if (!r.ok) throw new Error(j.error)
      notificar(`Unidade ${j.unidade.nome} criada. Entre nela para cadastrar a equipe, as salas e a agenda.`)
      setNova(false); setForm({ nome: '', apelido: '', telefone: '', endereco: '' }); carregar()
    } catch (e: any) { notificar(e.message || 'Não foi possível criar', 'erro') } finally { setSalvando(false) }
  }

  if (erro) return <Card><EmptyState icon={Building2} titulo="Unidades" descricao={erro} /></Card>
  const n = (v: number | null | undefined) => v == null ? '—' : v

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: T.text.primary }}>{dados?.organizacao?.nome || 'Sua conta'}</h3>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: T.text.secondary }}>Cada unidade tem agenda, equipe, fila e TV próprias. Quem trabalha em mais de uma troca de unidade pelo menu da conta, no topo.</p>
          </div>
          <Button icon={Plus} onClick={() => setNova(true)}>Nova unidade</Button>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {!dados ? [0, 1].map(i => <span key={i} className="c360-skel" style={{ height: 170, borderRadius: 16 }} />) : dados.unidades.map(u => (
          <Card key={u.id} style={{ display: 'flex', flexDirection: 'column', gap: 12, border: u.atual ? `1px solid ${T.brand.primaryAccent}` : undefined }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ width: 36, height: 36, borderRadius: 11, display: 'grid', placeItems: 'center', background: T.brand.primaryLight, color: T.brand.primary, flexShrink: 0 }}><Building2 size={18} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: T.text.primary }}>{u.apelido || u.nome}</div>
                <div style={{ fontSize: 12.5, color: T.text.tertiary }}>{u.apelido ? u.nome + ' · ' : ''}{u.medicos} médico{u.medicos === 1 ? '' : 's'} · {u.equipe} pessoa{u.equipe === 1 ? '' : 's'}</div>
              </div>
              {u.atual && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, color: T.brand.primary }}><Check size={13} /> Você está aqui</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[{ l: 'Agendados hoje', v: n(u.hoje.agendados) }, { l: 'Atendidos hoje', v: n(u.hoje.atendidos) }, { l: 'Consultas no mês', v: n(u.mes.consultas) }].map(x => (
                <div key={x.l}><div style={{ fontSize: 19, fontWeight: 750, fontVariantNumeric: 'tabular-nums' }}>{x.v}</div><div style={{ fontSize: 11.5, color: T.text.tertiary }}>{x.l}</div></div>
              ))}
            </div>
            {!u.atual && <Button variant="secondary" icon={LogIn} onClick={() => ehDemo() ? avisoDemo('Demonstração: a troca de unidade não está disponível.') : trocarDeUnidade(u.id).catch(e => notificar(e.message, 'erro'))}>Entrar nesta unidade</Button>}
          </Card>
        ))}
      </div>

      {nova && (
        <Modal titulo="Nova unidade" onClose={() => setNova(false)} largura={480}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Nome que o paciente vê"><Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex.: Clínica São Lucas — Centro" /></Field>
            <Field label="Apelido interno" hint="Opcional. Aparece no seletor de unidade."><Input value={form.apelido} onChange={e => setForm(f => ({ ...f, apelido: e.target.value }))} placeholder="Ex.: Centro" /></Field>
            <Field label="Telefone"><Input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} /></Field>
            <Field label="Endereço"><Input value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} /></Field>
          </div>
          <ModalAcoes>
            <Button variant="secondary" onClick={() => setNova(false)}>Voltar</Button>
            <Button onClick={criar} disabled={salvando}>{salvando ? 'Criando…' : 'Criar unidade'}</Button>
          </ModalAcoes>
        </Modal>
      )}
    </div>
  )
}
