'use client'
/** TV e totem: abrir e copiar os links de cada sala de espera, e os recados que estão na TV. */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Copy, ExternalLink, Megaphone, MonitorPlay, Settings2, Tablet, Trash2 } from 'lucide-react'
import { tokens as T } from '@/lib/design-tokens'
import { usePageHeader } from '@/components/shell/header-context'
import { Button, Card, EmptyState, Input, Select } from '@/components/ui'
import { notificar } from '@/components/ui/dialogos'
import { useFila } from '@/lib/atendimento/useFila'
import { avisarFila, carregarConfig, publicarRecado, retirarAviso, type Config } from '@/lib/atendimento/cliente'
import { cabecalho, tituloCard } from '@/components/atendimento/blocos'

export default function TelasPage() {
  usePageHeader('Central de atendimento', 'TV da sala de espera, totem e recados')
  const [config, setConfig] = useState<Config | null>(null)
  const [erro, setErro] = useState(false)
  const { fila, recarregar } = useFila(null)
  const [texto, setTexto] = useState('')
  const [horas, setHoras] = useState('4')
  useEffect(() => { carregarConfig().then(setConfig).catch(() => setErro(true)) }, [])

  const copiar = async (url: string) => {
    try { await navigator.clipboard.writeText(url); notificar('Link copiado') } catch { notificar(url, 'info') }
  }
  const origem = typeof window !== 'undefined' ? window.location.origin : ''
  const setores = (config?.setores || []).filter(s => s.ativo)

  return (
    <div className="c360-pagina" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {erro ? <Card><EmptyState icon={MonitorPlay} titulo="O módulo de atendimento ainda não está ativo" descricao="Fale com o suporte do Clinical 360 para liberar." /></Card> : (
        <Card padding={0} style={{ overflow: 'hidden' }}>
          <div style={cabecalho}>
            <span style={tituloCard}>Telas das salas de espera</span>
            <Link href="/minha-clinica?aba=atendimento" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: T.brand.primary, textDecoration: 'none' }}><Settings2 size={14} /> Salas, voz e totem</Link>
          </div>
          {!config ? <div style={{ padding: 16 }}><span className="c360-skel" style={{ display: 'block', height: 48, borderRadius: 10 }} /></div>
            : setores.length === 0 ? <div style={{ padding: 16, fontSize: 13, color: T.text.tertiary }}>Nenhuma sala de espera cadastrada ainda.</div>
            : setores.map((s, i) => (
              <div key={s.id} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', padding: '12px 16px', borderTop: i ? `1px solid ${T.border.muted}` : 'none' }}>
                <span style={{ flex: '1 1 200px', fontSize: 14, fontWeight: 650 }}>{s.nome}</span>
                <Button size="sm" variant="secondary" icon={MonitorPlay} onClick={() => window.open(`/painel/${s.painel_token}`, '_blank')}>Abrir TV</Button>
                <Button size="sm" variant="ghost" icon={Copy} onClick={() => copiar(`${origem}/painel/${s.painel_token}`)}>Link da TV</Button>
                {s.totem_ativo && s.totem_token && <>
                  <Button size="sm" variant="secondary" icon={Tablet} onClick={() => window.open(`/totem/${s.totem_token}`, '_blank')}>Abrir totem</Button>
                  <Button size="sm" variant="ghost" icon={Copy} onClick={() => copiar(`${origem}/totem/${s.totem_token}`)}>Link do totem</Button>
                </>}
              </div>
            ))}
        </Card>
      )}

      <Card padding={0} style={{ overflow: 'hidden' }}>
        <div style={cabecalho}><span style={{ ...tituloCard, display: 'inline-flex', alignItems: 'center', gap: 8 }}><Megaphone size={16} color={T.brand.primary} /> Recados na TV</span></div>
        <form onSubmit={async e => {
          e.preventDefault(); if (!texto.trim()) return
          try { await publicarRecado(texto.trim(), Number(horas)); setTexto(''); avisarFila(); recarregar(); notificar('Recado publicado na TV') } catch (er: any) { notificar(er.message, 'erro') }
        }} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '12px 16px' }}>
          <Input value={texto} onChange={e => setTexto(e.target.value)} placeholder="Ex.: Hoje o estacionamento está fechado. Use a entrada lateral." style={{ flex: '1 1 280px' }} maxLength={160} />
          <Select value={horas} onChange={e => setHoras(e.target.value)} style={{ width: 150 }}>
            <option value="1">Por 1 hora</option><option value="4">Por 4 horas</option><option value="12">Até o fim do dia</option>
          </Select>
          <Button type="submit" disabled={!texto.trim()}>Publicar</Button>
        </form>
        {(fila?.avisos || []).map(a => (
          <div key={a.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 16px', borderTop: `1px solid ${T.border.muted}` }}>
            <span style={{ flex: 1, fontSize: 13.5 }}>{a.texto}</span>
            <span style={{ fontSize: 12, color: T.text.tertiary, whiteSpace: 'nowrap' }}>até {new Date(a.expira_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
            <Button size="sm" variant="ghost" icon={Trash2} onClick={async () => { await retirarAviso(a.id).catch(() => {}); avisarFila(); recarregar() }}>Retirar</Button>
          </div>
        ))}
      </Card>
      <p style={{ margin: 0, fontSize: 12.5, color: T.text.tertiary, display: 'flex', alignItems: 'center', gap: 6 }}><ExternalLink size={13} /> Abra o link da TV no navegador da televisão e deixe em tela cheia.</p>
    </div>
  )
}
