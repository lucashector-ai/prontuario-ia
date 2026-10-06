'use client'
/**
 * Central de notificações — todas as notificações, lidas e não lidas, por data.
 * Carrega mais ao rolar (20 por vez) e para quando acaba; marcar como lida nunca apaga.
 * ?demo=1 mostra dados de exemplo e não grava nada.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BellOff, CheckCheck, RotateCw } from 'lucide-react'
import { tokens as T } from '@/lib/design-tokens'
import { usePageHeader } from '@/components/shell/header-context'
import { Button, Card, EmptyState } from '@/components/ui'
import { ItemNotificacao, EsqueletoNotificacao } from '@/components/notificacoes/ItemNotificacao'
import {
  listarNotificacoes, marcarNotificacao, marcarTodasLidas, destinoDaNotificacao, agruparPorData, avisarMudanca,
  type Notificacao, type FiltroNotificacoes,
} from '@/lib/notificacoes'

export default function NotificacoesPage() {
  const router = useRouter()
  usePageHeader('Notificações', 'Tudo o que aconteceu na clínica, em um só lugar')

  const [filtro, setFiltro] = useState<FiltroNotificacoes>('todas')
  const [itens, setItens] = useState<Notificacao[]>([])
  const [naoLidas, setNaoLidas] = useState(0)
  const [temMais, setTemMais] = useState(true)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(false)

  const cursor = useRef<string | null>(null)
  const ocupado = useRef(false)
  const versao = useRef(0)            // descarta respostas de um filtro antigo
  const fim = useRef<HTMLDivElement>(null)

  const carregar = useCallback(async (reiniciar = false) => {
    if (ocupado.current && !reiniciar) return
    const v = reiniciar ? ++versao.current : versao.current
    ocupado.current = true; setCarregando(true); setErro(false)
    try {
      const pg = await listarNotificacoes({ filtro, antes: reiniciar ? null : cursor.current })
      if (v !== versao.current) return
      cursor.current = pg.cursor
      setItens(prev => reiniciar ? pg.itens : [...prev, ...pg.itens.filter(n => !prev.some(p => p.id === n.id))])
      setNaoLidas(pg.naoLidas)
      setTemMais(pg.temMais)
    } catch {
      if (v === versao.current) setErro(true)
    } finally {
      if (v === versao.current) { ocupado.current = false; setCarregando(false) }
    }
  }, [filtro])

  useEffect(() => { cursor.current = null; setItens([]); setTemMais(true); carregar(true) }, [carregar])

  // Rolagem infinita: busca a próxima página quando o fim da lista aparece
  useEffect(() => {
    const el = fim.current
    if (!el || !temMais || erro) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) carregar() }, { rootMargin: '300px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [carregar, temMais, erro, itens.length])

  const alternarLida = async (n: Notificacao, lida = !n.lida) => {
    setItens(prev => prev.map(x => x.id === n.id ? { ...x, lida } : x))
    setNaoLidas(c => Math.max(0, c + (lida ? -1 : 1)))
    await marcarNotificacao(n.id, lida)
    avisarMudanca()
  }

  const abrir = (n: Notificacao) => {
    if (!n.lida) alternarLida(n, true)
    router.push(destinoDaNotificacao(n))
  }

  const lerTodas = async () => {
    setItens(prev => prev.map(x => ({ ...x, lida: true })))
    setNaoLidas(0)
    await marcarTodasLidas()
    avisarMudanca()
  }

  // Em "Não lidas", as que acabaram de ser lidas continuam visíveis até trocar de aba
  const grupos = agruparPorData(itens)
  const vazio = !carregando && !erro && itens.length === 0

  return (
    <div className="c360-pagina" style={{ maxWidth: 760, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {(['todas', 'nao_lidas'] as const).map(f => (
          <button key={f} onClick={() => setFiltro(f)} style={{
            height: 36, padding: '0 16px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600,
            border: `1px solid ${filtro === f ? 'transparent' : T.border.default}`,
            background: filtro === f ? T.brand.primaryLight : '#fff', color: filtro === f ? T.brand.primary : T.text.secondary,
          }}>
            {f === 'todas' ? 'Tudo' : 'Não lidas'}
            {f === 'nao_lidas' && naoLidas > 0 && (
              <span style={{ marginLeft: 7, fontSize: 11.5, padding: '1px 7px', borderRadius: 999, background: T.brand.primary, color: '#fff' }}>{naoLidas > 99 ? '99+' : naoLidas}</span>
            )}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        {naoLidas > 0 && <Button variant="secondary" size="sm" icon={CheckCheck} onClick={lerTodas}>Marcar todas como lidas</Button>}
      </div>

      <Card padding={8}>
        {vazio ? (
          <EmptyState
            icon={BellOff}
            titulo={filtro === 'nao_lidas' ? 'Nenhuma notificação não lida' : 'Nenhuma notificação ainda'}
            descricao={filtro === 'nao_lidas' ? 'Você está em dia. As lidas continuam na aba Tudo.' : 'Consultas, confirmações e formulários aparecem aqui.'}
          />
        ) : (
          <>
            {grupos.map(g => (
              <section key={g.titulo}>
                <h2 style={{ fontSize: 13, fontWeight: 700, color: T.text.secondary, margin: 0, padding: '12px 12px 6px' }}>{g.titulo}</h2>
                {g.itens.map(n => <ItemNotificacao key={n.id} n={n} onAbrir={abrir} onAlternarLida={x => alternarLida(x)} />)}
              </section>
            ))}

            {carregando && <><EsqueletoNotificacao /><EsqueletoNotificacao /><EsqueletoNotificacao /></>}

            {erro && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 18, fontSize: 13, color: T.text.secondary }}>
                Não foi possível carregar.
                <Button variant="secondary" size="sm" icon={RotateCw} onClick={() => carregar(itens.length === 0)}>Tentar de novo</Button>
              </div>
            )}

            {!temMais && !carregando && itens.length > 0 && (
              <div style={{ textAlign: 'center', fontSize: 12.5, color: T.text.quaternary, padding: '16px 12px 12px' }}>
                Você viu todas as notificações
              </div>
            )}
          </>
        )}
        <div ref={fim} style={{ height: 1 }} />
      </Card>
    </div>
  )
}
