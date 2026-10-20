'use client'
/**
 * Blocos da Central de atendimento usados em mais de uma aba (Recepção, Agora, Saídas).
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarPlus, Check, DoorOpen, MessageCircle, Stethoscope } from 'lucide-react'
import { tokens as T } from '@/lib/design-tokens'
import { Badge, Button, Card } from '@/components/ui'
import { confirmar, notificar } from '@/components/ui/dialogos'
import { abrirFicha, ehDemo, resolverSaida, whatsappRetorno, type Config, type Fila, type Saida } from '@/lib/atendimento/cliente'
import { minutosDesde } from '@/lib/atendimento/comum'
import { SenhaChip, esperaTexto, horaCurta } from '@/components/atendimento/partes'

export const linha: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: `1px solid ${T.border.muted}` }
export const cabecalho: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', padding: '14px 16px', borderBottom: `1px solid ${T.border.muted}` }
export const tituloCard: React.CSSProperties = { fontSize: 15, fontWeight: 700, letterSpacing: '-.01em' }


/** Faixa "Médicos agora": quem está atendendo, chamando ou livre, e o tamanho da fila de cada um. */
export function MedicosAgora({ fila, config, agora }: { fila: Fila; config: Config | null; agora: number }) {
  return (
    <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 2 }}>
      {fila.medicos.map(m => {
        const meus = fila.atendimentos.filter(a => a.medico_id === m.id)
        const atual = meus.find(a => a.status === 'em_atendimento') || meus.find(a => a.status === 'chamado')
        const naFila = meus.filter(a => a.status === 'aguardando').length
        const sala = config?.consultorios.find(c => c.id === (atual?.consultorio_id || m.consultorio_id))?.nome
        const estado = atual?.status === 'em_atendimento' ? { t: `Atendendo · ${atual.paciente?.nome?.split(' ')[0] || atual.senha}`, cor: T.status.info, bg: T.status.infoBg }
          : atual ? { t: `Chamando ${atual.senha}`, cor: T.brand.primary, bg: T.brand.primarySubtle }
          : { t: 'Livre', cor: T.status.success, bg: T.status.successBg }
        return (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 14, background: '#fff', border: `1px solid ${T.border.default}`, minWidth: 230, flexShrink: 0 }}>
            <span style={{ width: 34, height: 34, borderRadius: 11, display: 'grid', placeItems: 'center', background: estado.bg, color: estado.cor, flexShrink: 0 }}><Stethoscope size={17} /></span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 650, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.nome}</div>
              <div style={{ fontSize: 12, color: estado.cor, fontWeight: 600, whiteSpace: 'nowrap' }}>
                {estado.t}{atual?.status === 'em_atendimento' && atual.inicio_em ? ` · ${esperaTexto(minutosDesde(atual.inicio_em, agora))}` : ''}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 750 }}>{naFila}</div>
              <div style={{ fontSize: 10.5, color: T.text.tertiary }}>{sala || 'na fila'}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}


const ROTULO_ITEM: Record<string, string> = {
  retorno: 'Agendar retorno', exames: 'Entregar pedido de exames', receita: 'Entregar receita', atestado: 'Entregar atestado',
  procedimento: 'Agendar procedimento', encaminhamento: 'Entregar encaminhamento',
}

/** Quem acabou de sair do consultório com algo para a recepção resolver (retorno, exames, recados). */
export function SaindoDoConsultorio({ saidas, onMudou }: { saidas: Saida[]; onMudou: () => void }) {
  const router = useRouter()
  const [destaque, setDestaque] = useState<string | null>(null)
  const [enviando, setEnviando] = useState<string | null>(null)
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('saida')
    if (!id) return
    setDestaque(id)
    setTimeout(() => document.getElementById('saida-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200)
  }, [])

  const agendar = (s: Saida) => {
    const q = new URLSearchParams({ novo: '1', paciente_id: s.paciente_id || '', medico_id: s.medico_id || '', tipo: 'retorno', ...(s.retorno?.data_prevista ? { data: s.retorno.data_prevista } : {}),
      motivo: s.retorno?.motivo ? `Retorno — ${s.retorno.motivo}` : 'Retorno', ...(ehDemo() ? { demo: '1' } : {}) })
    router.push('/agenda?' + q)
  }
  const whatsapp = async (s: Saida) => {
    setEnviando(s.id)
    try { await whatsappRetorno(s.id); notificar('Mensagem enviada. A Sofia continua a conversa e oferece horários.') }
    catch (e: any) { notificar(e.message, 'erro') } finally { setEnviando(null) }
  }
  const concluir = async (s: Saida) => {
    const retornoPendente = (s.saida_itens || []).includes('retorno') && !(s.retorno?.status === 'agendado' || s.retorno?.agendamento_id)
    if (retornoPendente && !(await confirmar({ titulo: 'Concluir sem agendar o retorno?', mensagem: `O médico pediu retorno para ${s.paciente?.nome?.split(' ')[0] || 'o paciente'}. Ele continua na lista de Retornos para você agendar depois.`, confirmar: 'Concluir mesmo assim' }))) return
    try { await resolverSaida(s.id); notificar('Saída concluída'); onMudou() } catch (e: any) { notificar(e.message, 'erro') }
  }

  return (
    <Card padding={0} style={{ border: `1px solid ${T.data.orange}`, overflow: 'hidden' }}>
      <div style={{ ...cabecalho, background: 'color-mix(in srgb, ' + T.data.orange + ' 10%, #fff)' }}>
        <span style={{ ...tituloCard, display: 'inline-flex', alignItems: 'center', gap: 8 }}><DoorOpen size={17} color={T.data.orange} /> Saindo do consultório · {saidas.length}</span>
        <span style={{ fontSize: 12.5, color: T.text.secondary }}>Pedidos do médico — resolva antes de o paciente ir embora</span>
      </div>
      {saidas.map((s, i) => {
        const agendado = s.retorno?.status === 'agendado' || !!s.retorno?.agendamento_id
        return (
          <div key={s.id} id={'saida-' + s.id} style={{ ...linha, borderTop: i === 0 ? 'none' : linha.borderTop, alignItems: 'flex-start', flexWrap: 'wrap', background: destaque === s.id ? T.brand.primarySubtle : undefined }}>
            <SenhaChip senha={s.senha} />
            <div style={{ flex: '1 1 260px', minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 650 }}><NomePaciente id={s.paciente_id} nome={s.paciente?.nome} /> <span style={{ fontSize: 12, color: T.text.tertiary, fontWeight: 500 }}>· {s.medico?.nome} · saiu {horaCurta(s.fim_em)}</span></div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                {(s.saida_itens || []).map(it => (
                  <Badge key={it} tone={it === 'retorno' && agendado ? 'success' : 'warning'} icon={it === 'retorno' && agendado ? Check : undefined}>
                    {it === 'retorno' && s.retorno ? `${agendado ? 'Retorno agendado' : 'Retorno por volta de'} ${agendado ? '' : new Date(s.retorno.data_prevista + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`.trim() : (ROTULO_ITEM[it] || it)}
                  </Badge>
                ))}
              </div>
              {s.retorno?.motivo && <div style={{ fontSize: 12.5, color: T.text.secondary, marginTop: 6 }}>Motivo do retorno: {s.retorno.motivo}</div>}
              {s.saida_obs && <div style={{ fontSize: 12.5, color: T.text.primary, marginTop: 6, padding: '6px 10px', borderRadius: 8, background: T.bg.page }}>“{s.saida_obs}”</div>}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {(s.saida_itens || []).includes('retorno') && !agendado && <Button size="sm" icon={CalendarPlus} onClick={() => agendar(s)}>Agendar retorno</Button>}
              {s.paciente?.telefone && (s.saida_itens || []).includes('retorno') && !agendado && (
                <Button size="sm" variant="secondary" icon={MessageCircle} onClick={() => whatsapp(s)} disabled={enviando === s.id}>{enviando === s.id ? 'Enviando…' : 'Enviar pelo WhatsApp'}</Button>
              )}
              <Button size="sm" variant={agendado ? 'primary' : 'secondary'} icon={Check} onClick={() => concluir(s)}>Concluir saída</Button>
            </div>
          </div>
        )
      })}
    </Card>
  )
}

/** Nome clicável: abre a ficha do paciente por cima da tela. */
export function NomePaciente({ id, nome }: { id?: string | null; nome?: string | null }) {
  if (!id) return <>{nome || 'Paciente'}</>
  return (
    <button onClick={() => abrirFicha(id)} title="Ver ficha e histórico" style={{
      border: 'none', background: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit', textAlign: 'left',
      textDecoration: 'underline', textDecorationColor: T.border.strong, textUnderlineOffset: 3,
    }}>{nome || 'Paciente'}</button>
  )
}

/** Senhas do balcão: quem pegou senha no totem sem horário (ou sem CPF). A recepção chama na TV e atende. */
