'use client'
/**
 * Retornos e reativação — receita recorrente: não esquecer retornos e trazer de volta pacientes inativos.
 * Abas: Retornos (previstos/atrasados, lembrete por WhatsApp) · Reativação (inativos → campanha) · Campanhas (histórico).
 * ?demo=1 mostra dados de exemplo e não grava nada.
 */
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarClock, UserRoundSearch, Megaphone, Stethoscope } from 'lucide-react'
import { tokens } from '@/lib/design-tokens'
import { supabase } from '@/lib/supabase'
import { usePageHeader } from '@/components/shell/header-context'
import { Tabs, Select, EmptyState, Badge } from '@/components/ui'
import { ehDemo } from '@/components/retornos/datas'
import AbaRetornos from './AbaRetornos'
import AbaReativacao from './AbaReativacao'
import AbaCampanhas from './AbaCampanhas'

const T = tokens
type Aba = 'retornos' | 'reativacao' | 'campanhas'

export type MedicoCtx = { id: string; nome: string; clinicaNome: string }

export default function RetornosPage() {
  const router = useRouter()
  const demo = useMemo(ehDemo, [])
  // Selo só depois de montar: no servidor não há URL, e o HTML precisa bater na hidratação
  const [montado, setMontado] = useState(false)
  useEffect(() => setMontado(true), [])
  const [aba, setAba] = useState<Aba>('retornos')
  const [medicos, setMedicos] = useState<any[]>([])
  const [medicoId, setMedicoId] = useState<string>('')
  const [clinicaNome, setClinicaNome] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [versaoCampanhas, setVersaoCampanhas] = useState(0)

  usePageHeader('Retornos e reativação', 'Não esqueça retornos e traga de volta quem não aparece há meses')

  useEffect(() => { try { const a = localStorage.getItem('c360-retornos-aba') as Aba; if (a === 'reativacao' || a === 'campanhas') setAba(a) } catch {} }, [])
  const trocarAba = (a: string) => { setAba(a as Aba); try { localStorage.setItem('c360-retornos-aba', a) } catch {} }

  // Quem está usando: admin da clínica / recepcionista → médicos da clínica; médico → ele mesmo
  useEffect(() => {
    (async () => {
      try { const c = localStorage.getItem('clinica'); if (c) setClinicaNome(JSON.parse(c).nome || '') } catch {}
      const ca = localStorage.getItem('clinica_admin')
      const m = localStorage.getItem('medico')
      if (!ca && !m) { router.push('/login'); return }
      const usuario = JSON.parse((ca || m)!)
      const daClinica = async (clinicaId: string) => (await supabase.from('medicos').select('id, nome, clinica_id')
        .eq('clinica_id', clinicaId).eq('cargo', 'medico').eq('ativo', true).order('criado_em', { ascending: true })).data || []
      let lista: any[] = []
      if (ca || usuario.cargo === 'recepcionista') lista = usuario.clinica_id ? await daClinica(usuario.clinica_id) : []
      else lista = [usuario]
      if (demo && !lista.length) lista = [{ id: 'demo-medico', nome: usuario.nome || 'Dra. Helena Duarte' }]
      setMedicos(lista)
      let salvo = ''
      try { salvo = localStorage.getItem('c360-retornos-medico') || '' } catch {}
      setMedicoId(lista.find(x => x.id === salvo)?.id || lista[0]?.id || '')
      if (usuario.clinica_id && !clinicaNome) {
        supabase.from('clinicas').select('nome').eq('id', usuario.clinica_id).maybeSingle().then(({ data }) => data?.nome && setClinicaNome(data.nome))
      }
      setCarregando(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, demo])

  const medico = medicos.find(m => m.id === medicoId)
  const ctx: MedicoCtx | null = medico ? { id: medico.id, nome: medico.nome || '', clinicaNome } : null

  if (!carregando && !ctx) {
    return (
      <div className="c360-pagina">
        <EmptyState icon={Stethoscope} titulo="Nenhum médico ativo na clínica" descricao="Retornos e campanhas pertencem à agenda de um médico. Cadastre um médico no Painel admin para começar." />
      </div>
    )
  }

  return (
    <div className="c360-pagina" style={{ maxWidth: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', borderBottom: `1px solid ${T.border.default}`, marginBottom: 20 }}>
        <div style={{ flex: '1 1 auto', minWidth: 0, overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none', marginBottom: -1 }}>
          <Tabs
            style={{ borderBottom: 'none', marginBottom: 0, paddingBottom: 1 }}
            ativa={aba}
            onChange={trocarAba}
            tabs={[
              { id: 'retornos', label: 'Retornos', icon: <CalendarClock size={16} strokeWidth={1.6} /> },
              { id: 'reativacao', label: 'Reativação', icon: <UserRoundSearch size={16} strokeWidth={1.6} /> },
              { id: 'campanhas', label: 'Campanhas', icon: <Megaphone size={16} strokeWidth={1.6} /> },
            ]}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8, minWidth: 0 }}>
          {montado && demo && <Badge tone="accent" dot>Demonstração</Badge>}
          {medicos.length > 1 && (
            <Select value={medicoId} aria-label="Médico" style={{ width: 220, maxWidth: '60vw', minHeight: 36, padding: '6px 10px' }}
              onChange={e => { setMedicoId(e.target.value); try { localStorage.setItem('c360-retornos-medico', e.target.value) } catch {} }}>
              {medicos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </Select>
          )}
        </div>
      </div>

      {!ctx ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[0, 1, 2, 3].map(i => <div key={i} className="c360-skel" style={{ flex: '1 1 170px', height: 116, borderRadius: 16 }} />)}
          </div>
          {[0, 1, 2].map(i => <div key={i} className="c360-skel" style={{ height: 64, borderRadius: 14 }} />)}
        </div>
      ) : aba === 'retornos' ? (
        <AbaRetornos key={ctx.id} medico={ctx} demo={demo} />
      ) : aba === 'reativacao' ? (
        <AbaReativacao key={ctx.id} medico={ctx} demo={demo} onCampanhaCriada={() => setVersaoCampanhas(v => v + 1)} irParaCampanhas={() => trocarAba('campanhas')} />
      ) : (
        <AbaCampanhas key={ctx.id + versaoCampanhas} medico={ctx} demo={demo} irParaReativacao={() => trocarAba('reativacao')} />
      )}
    </div>
  )
}
