'use client'
/**
 * Agora — a clínica neste momento, numa tela só:
 *   médicos agora · caminho do paciente (a chegar → balcão → triagem → espera → consulta → saída)
 *   · o que precisa de alguém · como está o dia.
 * Só mostra: nada aqui chama paciente (quem chama é o médico ou a triagem).
 * Clicar num paciente abre a ficha rápida.
 */
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlarmClock, CircleAlert, DoorOpen, MessageCircle, Ticket, TriangleAlert } from 'lucide-react'
import { tokens as T } from '@/lib/design-tokens'
import { usePageHeader } from '@/components/shell/header-context'
import { Card, EmptyState } from '@/components/ui'
import { useFila } from '@/lib/atendimento/useFila'
import { abrirFicha, carregarConfig, type Config } from '@/lib/atendimento/cliente'
import { minutosDesde, ordenarFila } from '@/lib/atendimento/comum'
import { SeloPrioridade, SeloRisco, SenhaChip, esperaTexto, horaCurta } from '@/components/atendimento/partes'
import { MedicosAgora, cabecalho, tituloCard } from '@/components/atendimento/blocos'
import { useChatNaoLidas } from '@/components/shell/useChatNaoLidas'

type Cartao = { id: string; pacienteId: string | null; titulo: string; linha: string; senha?: string; risco?: string | null; prioridade?: any; alerta?: boolean }

export default function AgoraPage() {
  usePageHeader('Central de atendimento', 'A clínica agora: quem chegou, quem espera e o que precisa de alguém')
  const { fila, carregando, erro } = useFila(null)
  const [config, setConfig] = useState<Config | null>(null)
  const [agora, setAgora] = useState(Date.now())
  const [demo, setDemo] = useState('')
  const mensagens = useChatNaoLidas()

  useEffect(() => {
    carregarConfig().then(setConfig).catch(() => {})
    setDemo(new URLSearchParams(window.location.search).get('demo') === '1' ? '?demo=1' : '')
    const t = setInterval(() => setAgora(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])

  const colunas = useMemo(() => {
    if (!fila) return []
    const at = fila.atendimentos
    const primeiro = (n?: string | null) => n?.split(' ').slice(0, 2).join(' ') || 'Paciente'
    const triagem = ordenarFila(at.filter(a => a.status === 'aguardando_triagem' || a.status === 'em_triagem'))
    const espera = ordenarFila(at.filter(a => a.status === 'aguardando' || a.status === 'chamado'))
    return [
      { id: 'chegar', titulo: 'A chegar', cor: T.text.tertiary, itens: [...fila.esperados].sort((a, b) => a.data_hora.localeCompare(b.data_hora)).map<Cartao>(e => {
        const atraso = Math.round((agora - new Date(e.data_hora).getTime()) / 60000)
        return { id: e.id, pacienteId: e.paciente?.id || null, titulo: primeiro(e.paciente?.nome), linha: `${horaCurta(e.data_hora)} · ${e.medico?.nome || ''}${atraso > 15 ? ` · ${esperaTexto(atraso)} de atraso` : ''}`, alerta: atraso > 15 }
      }) },
      { id: 'balcao', titulo: 'Balcão', cor: T.data.blue, itens: (fila.balcao || []).map<Cartao>(b => ({
        id: b.id, pacienteId: null, senha: b.senha, prioridade: b.prioridade, titulo: b.motivo || 'Sem agendamento',
        linha: `${b.status === 'chamado' ? `chamado${b.guiche ? ` · ${b.guiche}` : ''}` : `esperando ${esperaTexto(minutosDesde(b.criado_em, agora))}`}`,
        alerta: b.status === 'aguardando' && minutosDesde(b.criado_em, agora) > 10,
      })) },
      { id: 'triagem', titulo: 'Triagem', cor: T.data.orange, itens: triagem.map<Cartao>(a => ({
        id: a.id, pacienteId: a.paciente_id, senha: a.senha, risco: a.risco, prioridade: a.prioridade, titulo: primeiro(a.paciente?.nome),
        linha: `${a.status === 'em_triagem' ? 'em triagem' : `esperando ${esperaTexto(minutosDesde(a.chegada_em, agora))}`} · ${a.medico?.nome || ''}`,
      })) },
      { id: 'espera', titulo: 'Esperando médico', cor: T.brand.primary, itens: espera.map<Cartao>(a => ({
        id: a.id, pacienteId: a.paciente_id, senha: a.senha, risco: a.risco, prioridade: a.prioridade, titulo: primeiro(a.paciente?.nome),
        linha: `${a.status === 'chamado' ? `chamado${a.consultorio ? ` · ${a.consultorio.nome}` : ''}` : `${esperaTexto(minutosDesde(a.chegada_em, agora))}`} · ${a.medico?.nome || ''}`,
        alerta: a.risco === 'vermelho' || a.risco === 'laranja',
      })) },
      { id: 'consulta', titulo: 'Em consulta', cor: T.status.info, itens: at.filter(a => a.status === 'em_atendimento').map<Cartao>(a => ({
        id: a.id, pacienteId: a.paciente_id, senha: a.senha, titulo: primeiro(a.paciente?.nome),
        linha: `${a.medico?.nome || ''}${a.inicio_em ? ` · há ${esperaTexto(minutosDesde(a.inicio_em, agora))}` : ''}`,
      })) },
      { id: 'saida', titulo: 'Saída', cor: T.data.orange, itens: (fila.saidas || []).map<Cartao>(s => ({
        id: s.id, pacienteId: s.paciente_id, senha: s.senha, titulo: primeiro(s.paciente?.nome),
        linha: s.retorno ? `retorno por volta de ${new Date(s.retorno.data_prevista + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}` : (s.saida_itens || []).join(', ') || 'para a recepção',
        alerta: true,
      })) },
    ]
  }, [fila, agora])

  const precisa = useMemo(() => {
    if (!fila) return []
    const l: { icon: any; cor: string; texto: string; href: string }[] = []
    const urg = fila.atendimentos.filter(a => (a.risco === 'vermelho' || a.risco === 'laranja') && ['aguardando_triagem', 'em_triagem', 'aguardando', 'chamado'].includes(a.status))
    urg.forEach(a => l.push({ icon: TriangleAlert, cor: T.status.danger, texto: `Risco ${a.risco}: ${a.paciente?.nome?.split(' ')[0] || a.senha} esperando ${a.medico?.nome || 'médico'}`, href: '/atendimento/agora' }))
    const atrasados = fila.esperados.filter(e => agora - new Date(e.data_hora).getTime() > 15 * 60e3).length
    if (atrasados) l.push({ icon: AlarmClock, cor: T.status.warning, texto: `${atrasados} agendado${atrasados > 1 ? 's' : ''} com mais de 15 min de atraso: confirmar se vêm`, href: '/atendimento/recepcao' })
    const saidas = (fila.saidas || []).length
    if (saidas) l.push({ icon: DoorOpen, cor: T.data.orange, texto: `${saidas} saída${saidas > 1 ? 's' : ''} do consultório para resolver (retorno, exames, recados)`, href: '/atendimento/saidas' })
    const balcao = (fila.balcao || []).filter(b => b.status === 'aguardando' && minutosDesde(b.criado_em, agora) > 10).length
    if (balcao) l.push({ icon: Ticket, cor: T.status.warning, texto: `${balcao} senha${balcao > 1 ? 's' : ''} de balcão esperando há mais de 10 min`, href: '/atendimento/recepcao' })
    const semSala = fila.medicos.filter(m => !m.consultorio_id && fila.atendimentos.some(a => a.medico_id === m.id && a.status === 'aguardando'))
    semSala.forEach(m => l.push({ icon: CircleAlert, cor: T.status.warning, texto: `${m.nome} tem pacientes esperando e ainda não abriu o consultório`, href: '/atendimento/agora' }))
    if (mensagens) l.push({ icon: MessageCircle, cor: T.brand.primary, texto: `${mensagens} conversa${mensagens > 1 ? 's' : ''} com mensagem sem resposta`, href: '/chat' })
    return l
  }, [fila, agora, mensagens])

  const dia = useMemo(() => {
    if (!fila) return null
    const fin = fila.atendimentos.filter(a => a.status === 'finalizado')
    const esperas = fin.filter(a => a.inicio_em).map(a => (new Date(a.inicio_em!).getTime() - new Date(a.chegada_em).getTime()) / 60000)
    return {
      atendidos: fin.length,
      ausentes: fila.atendimentos.filter(a => a.status === 'ausente').length,
      espera: esperas.length ? Math.round(esperas.reduce((x, y) => x + y, 0) / esperas.length) : null,
    }
  }, [fila])

  if (erro?.faltaMigration) return <div className="c360-pagina"><Card><EmptyState icon={CircleAlert} titulo="O módulo de atendimento ainda não está ativo" descricao="Recepção, fila e painel da TV precisam ser liberados na sua conta. Fale com o suporte do Clinical 360 para liberar." /></Card></div>

  return (
    <div className="c360-pagina" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {fila && fila.medicos.length > 0 && <MedicosAgora fila={fila} config={config} agora={agora} />}

      <Card padding={0} style={{ overflow: 'hidden' }}>
        <div style={cabecalho}><span style={tituloCard}>Caminho do paciente</span><span style={{ fontSize: 12.5, color: T.text.tertiary }}>Clique num nome para abrir a ficha</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(170px, 1fr))', overflowX: 'auto' }}>
          {(carregando && !fila ? Array.from({ length: 6 }, (_, i) => ({ id: 'sk' + i, titulo: '', cor: T.border.default, itens: [] as Cartao[] })) : colunas).map((c, i) => (
            <div key={c.id} style={{ borderLeft: i ? `1px solid ${T.border.muted}` : 'none', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '10px 12px', fontSize: 11.5, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: c.cor, display: 'flex', justifyContent: 'space-between', borderBottom: `2px solid ${c.cor}` }}>
                <span>{c.titulo || ' '}</span>{c.titulo && <span style={{ fontVariantNumeric: 'tabular-nums' }}>{c.itens.length}</span>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 8, minHeight: 120, maxHeight: 420, overflowY: 'auto' }}>
                {!c.titulo && [0, 1].map(k => <span key={k} className="c360-skel" style={{ height: 52, borderRadius: 10 }} />)}
                {c.titulo && c.itens.length === 0 && <span style={{ fontSize: 12, color: T.text.tertiary, padding: '6px 4px' }}>Ninguém</span>}
                {c.itens.map(it => (
                  <button key={it.id} onClick={() => it.pacienteId && abrirFicha(it.pacienteId)} disabled={!it.pacienteId} style={{
                    textAlign: 'left', padding: '8px 10px', borderRadius: 10, fontFamily: 'inherit', cursor: it.pacienteId ? 'pointer' : 'default',
                    border: `1px solid ${it.alerta ? T.status.warning : T.border.default}`, background: it.alerta ? T.status.warningBg : '#fff',
                    display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0,
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      {it.senha && <SenhaChip senha={it.senha} />}
                      <span style={{ fontSize: 13, fontWeight: 650, color: T.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.titulo}</span>
                    </span>
                    <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                      {it.risco && <SeloRisco risco={it.risco} />}{it.prioridade && it.prioridade !== 'normal' && <SeloPrioridade prioridade={it.prioridade} />}
                      <span style={{ fontSize: 11.5, color: T.text.secondary }}>{it.linha}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <Card padding={0} style={{ overflow: 'hidden' }}>
          <div style={cabecalho}><span style={tituloCard}>Precisa de alguém</span></div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {precisa.length === 0 ? <div style={{ padding: '16px', fontSize: 13, color: T.text.tertiary }}>Tudo em ordem por enquanto.</div> : precisa.map((p, i) => (
              <Link key={i} href={p.href + (p.href.startsWith('/atendimento') ? demo : '')} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '11px 16px', borderTop: i ? `1px solid ${T.border.muted}` : 'none', textDecoration: 'none', color: T.text.primary, fontSize: 13.5 }}>
                <p.icon size={16} color={p.cor} style={{ flexShrink: 0 }} />{p.texto}
              </Link>
            ))}
          </div>
        </Card>
        <Card padding={0} style={{ overflow: 'hidden' }}>
          <div style={cabecalho}><span style={tituloCard}>Hoje até agora</span><Link href="/gestao" style={{ fontSize: 12.5, fontWeight: 600, color: T.brand.primary, textDecoration: 'none' }}>Ver indicadores</Link></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', padding: 16, gap: 12 }}>
            {[{ l: 'Atendidos', v: dia?.atendidos ?? '—' }, { l: 'Não vieram à chamada', v: dia?.ausentes ?? '—' }, { l: 'Espera média', v: dia?.espera != null ? esperaTexto(dia.espera) : '—' }].map(x => (
              <div key={x.l}><div style={{ fontSize: 22, fontWeight: 750, fontVariantNumeric: 'tabular-nums' }}>{x.v}</div><div style={{ fontSize: 12, color: T.text.tertiary }}>{x.l}</div></div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
