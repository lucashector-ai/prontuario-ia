'use client'
/**
 * Minha clínica → Salas e equipamentos: tipo e local de cada sala (as salas são os consultórios da
 * aba Recepção e painel), equipamentos fixos ou móveis, manutenção e a sala padrão de cada profissional.
 * A agenda usa isso para escolher sala e equipamento livres e impedir conflitos.
 */
import { useCallback, useEffect, useState } from 'react'
import { DoorOpen, Wrench, Plus, Trash2, Cpu } from 'lucide-react'
import { tokens as T } from '@/lib/design-tokens'
import { Button, Card, EmptyState, Field, Input, Modal, Select } from '@/components/ui'
import { confirmar, notificar } from '@/components/ui/dialogos'
import { supabase } from '@/lib/supabase'
import { FILTRO_APOIO } from '@/lib/cargos'
import { ehDemo, avisoDemo } from '@/lib/demo'

export const TIPOS_SALA = [
  { value: 'consultorio', label: 'Consultório' },
  { value: 'procedimentos', label: 'Sala de procedimentos' },
  { value: 'exames', label: 'Sala de exames' },
  { value: 'imagem', label: 'Imagem (ultrassom, raio-x)' },
  { value: 'triagem', label: 'Triagem' },
]

type Dados = {
  salas: { id: string; nome: string; setor_id: string; tipo: string; descricao_local: string | null; ativo: boolean }[]
  setores: { id: string; nome: string }[]
  equipamentos: { id: string; nome: string; tipo: string; consultorio_id: string | null; ativo: boolean }[]
  padroes: { medico_id: string; consultorio_id: string }[]
  manutencoes: { id: string; equipamento_id: string | null; consultorio_id: string | null; periodo: string; observacao: string | null }[]
}

const DEMO: Dados = {
  setores: [{ id: 's1', nome: 'Recepção' }],
  salas: [
    { id: 'c1', nome: 'Consultório 1', setor_id: 's1', tipo: 'consultorio', descricao_local: '1º andar', ativo: true },
    { id: 'c2', nome: 'Consultório 2', setor_id: 's1', tipo: 'consultorio', descricao_local: '1º andar', ativo: true },
    { id: 'c3', nome: 'Sala de procedimentos', setor_id: 's1', tipo: 'procedimentos', descricao_local: '2º andar', ativo: true },
    { id: 'c4', nome: 'Ultrassom', setor_id: 's1', tipo: 'imagem', descricao_local: 'Térreo', ativo: true },
  ],
  equipamentos: [
    { id: 'e1', nome: 'Ultrassom GE Logiq', tipo: 'ultrassom', consultorio_id: 'c4', ativo: true },
    { id: 'e2', nome: 'Eletrocardiógrafo', tipo: 'eletrocardiografo', consultorio_id: null, ativo: true },
    { id: 'e3', nome: 'Laser CO2', tipo: 'laser', consultorio_id: 'c3', ativo: true },
  ],
  padroes: [], manutencoes: [],
}

export function SalasEquipamentos() {
  const demo = ehDemo()
  const [d, setD] = useState<Dados | null>(null)
  const [medicos, setMedicos] = useState<{ id: string; nome: string }[]>([])
  const [novoEq, setNovoEq] = useState({ nome: '', tipo: '', consultorio_id: '' })
  const [manut, setManut] = useState<{ equipamento_id?: string; consultorio_id?: string; nome: string } | null>(null)
  const [manIni, setManIni] = useState('')
  const [manFim, setManFim] = useState('')
  const [manObs, setManObs] = useState('')

  const carregar = useCallback(async () => {
    if (demo) { setD(DEMO); setMedicos([{ id: 'm1', nome: 'Dra. Helena Duarte' }, { id: 'm2', nome: 'Dr. Marcos Vieira' }]); return }
    const r = await fetch('/api/salas')
    if (r.ok) setD(await r.json())
    const eu = JSON.parse(localStorage.getItem('clinica_admin') || localStorage.getItem('medico') || 'null')
    if (eu?.clinica_id) {
      const { data } = await supabase.from('medicos').select('id, nome').eq('clinica_id', eu.clinica_id).eq('ativo', true).not('cargo', 'in', FILTRO_APOIO).order('nome')
      setMedicos(data || [])
    }
  }, [demo])
  useEffect(() => { carregar() }, [carregar])

  async function post(corpo: any, ok?: string) {
    if (demo) { avisoDemo(); return false }
    const r = await fetch('/api/salas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { notificar(j.error || 'Não foi possível salvar.', 'erro'); return false }
    if (ok) notificar(ok)
    carregar()
    return j
  }

  if (!d) return <Card><div style={{ padding: 20, fontSize: 13, color: T.text.tertiary }}>Carregando…</div></Card>
  if (!d.salas.length) return (
    <Card><EmptyState icon={DoorOpen} titulo="Nenhuma sala cadastrada" descricao="As salas são os consultórios da aba Recepção e painel. Cadastre-os lá e volte aqui para dizer o tipo de cada sala e os equipamentos." /></Card>
  )
  const nomeSala = (id: string | null) => d.salas.find(s => s.id === id)?.nome
  const emManutencao = (e: { id: string }) => d.manutencoes.find(m => m.equipamento_id === e.id)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text.primary }}>Salas</div>
          <div style={{ fontSize: 12.5, color: T.text.tertiary }}>O tipo diz quais procedimentos cabem em cada sala. O local aparece para a equipe (ex.: 2º andar).</div>
        </div>
        {d.salas.map(s => (
          <div key={s.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) minmax(150px, 1fr) minmax(140px, 1fr)', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: s.ativo ? T.text.primary : T.text.tertiary }}>{s.nome}</span>
            <Select value={s.tipo} onChange={e => post({ acao: 'sala', id: s.id, tipo: e.target.value, descricao_local: s.descricao_local }, 'Sala atualizada')}>
              {TIPOS_SALA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
            <Input defaultValue={s.descricao_local || ''} placeholder="Local (opcional)" onBlur={e => e.target.value !== (s.descricao_local || '') && post({ acao: 'sala', id: s.id, tipo: s.tipo, descricao_local: e.target.value }, 'Sala atualizada')} />
          </div>
        ))}
      </Card>

      <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text.primary }}>Equipamentos</div>
          <div style={{ fontSize: 12.5, color: T.text.tertiary }}>O procedimento pede pelo tipo (ex.: "laser"); a agenda reserva um equipamento livre desse tipo. Fixo numa sala ou móvel.</div>
        </div>
        {d.equipamentos.map(e => {
          const m = emManutencao(e)
          return (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 0', borderTop: `1px solid ${T.border.muted}` }}>
              <Cpu size={16} color={T.text.secondary} />
              <span style={{ flex: '1 1 200px', minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: T.text.primary }}>{e.nome}</span>
                <span style={{ fontSize: 12, color: T.text.tertiary }}>tipo: {e.tipo} · {e.consultorio_id ? `fixo em ${nomeSala(e.consultorio_id) || 'sala'}` : 'móvel'}</span>
              </span>
              {m ? (
                <>
                  <span style={{ fontSize: 12, fontWeight: 600, color: T.status.warning, background: T.status.warningBg, padding: '3px 9px', borderRadius: 99 }}>Em manutenção{m.observacao ? ` · ${m.observacao}` : ''}</span>
                  <Button size="sm" variant="ghost" onClick={() => post({ acao: 'fim_manutencao', id: m.id }, 'Equipamento liberado')}>Liberar</Button>
                </>
              ) : (
                <Button size="sm" variant="ghost" icon={Wrench} onClick={() => { setManut({ equipamento_id: e.id, nome: e.nome }); const agora = new Date(); agora.setMinutes(0, 0, 0); setManIni(paraLocal(agora)); setManFim(paraLocal(new Date(agora.getTime() + 4 * 3600000))); setManObs('') }}>Manutenção</Button>
              )}
              <Button size="sm" variant="ghost" icon={Trash2} onClick={async () => { if (await confirmar({ titulo: `Excluir ${e.nome}?`, mensagem: 'As reservas futuras deste equipamento são apagadas.', confirmar: 'Excluir', perigo: true })) post({ acao: 'excluir_equipamento', id: e.id }, 'Equipamento excluído') }} />
            </div>
          )
        })}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 1.3fr) minmax(110px, 1fr) minmax(140px, 1fr) auto', gap: 8, alignItems: 'end', paddingTop: 8, borderTop: `1px solid ${T.border.muted}` }}>
          <Field label="Nome"><Input value={novoEq.nome} onChange={e => setNovoEq(v => ({ ...v, nome: e.target.value }))} placeholder="Ex.: Laser CO2" /></Field>
          <Field label="Tipo"><Input value={novoEq.tipo} onChange={e => setNovoEq(v => ({ ...v, tipo: e.target.value }))} placeholder="Ex.: laser" list="tipos-equip" /></Field>
          <Field label="Fica em">
            <Select value={novoEq.consultorio_id} onChange={e => setNovoEq(v => ({ ...v, consultorio_id: e.target.value }))}>
              <option value="">Móvel (qualquer sala)</option>
              {d.salas.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </Select>
          </Field>
          <Button icon={Plus} onClick={async () => { if (await post({ acao: 'equipamento', ...novoEq }, 'Equipamento adicionado')) setNovoEq({ nome: '', tipo: '', consultorio_id: '' }) }}>Adicionar</Button>
          <datalist id="tipos-equip">{Array.from(new Set(d.equipamentos.map(e => e.tipo))).map(t => <option key={t} value={t} />)}</datalist>
        </div>
      </Card>

      {medicos.length > 0 && (
        <Card style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text.primary }}>Sala padrão de cada profissional</div>
            <div style={{ fontSize: 12.5, color: T.text.tertiary }}>As consultas comuns reservam essa sala quando ela está livre.</div>
          </div>
          {medicos.map(m => (
            <div key={m.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 1fr) minmax(160px, 1fr)', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 13.5, color: T.text.primary }}>{m.nome}</span>
              <Select value={d.padroes.find(p => p.medico_id === m.id)?.consultorio_id || ''} onChange={e => post({ acao: 'padrao', medico_id: m.id, consultorio_id: e.target.value || null }, 'Sala padrão salva')}>
                <option value="">Sem sala padrão</option>
                {d.salas.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </Select>
            </div>
          ))}
        </Card>
      )}

      {manut && (
        <Modal titulo={`Manutenção · ${manut.nome}`} onClose={() => setManut(null)} largura={460}
          rodape={<><Button variant="secondary" onClick={() => setManut(null)}>Cancelar</Button>
            <Button icon={Wrench} onClick={async () => {
              const j = await post({ acao: 'manutencao', equipamento_id: manut.equipamento_id, consultorio_id: manut.consultorio_id, inicio: new Date(manIni).toISOString(), fim: new Date(manFim).toISOString(), observacao: manObs })
              if (j) { notificar(j.afetados ? `Em manutenção. ${j.afetados} agendamento${j.afetados > 1 ? 's' : ''} afetado${j.afetados > 1 ? 's' : ''}: a recepção foi avisada no sino.` : 'Em manutenção.'); setManut(null) }
            }}>Colocar em manutenção</Button></>}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="De"><Input type="datetime-local" value={manIni} onChange={e => setManIni(e.target.value)} /></Field>
            <Field label="Até"><Input type="datetime-local" value={manFim} onChange={e => setManFim(e.target.value)} /></Field>
          </div>
          <div style={{ marginTop: 12 }}><Field label="Motivo (opcional)"><Input value={manObs} onChange={e => setManObs(e.target.value)} placeholder="Ex.: revisão técnica" /></Field></div>
          <p style={{ fontSize: 12.5, color: T.text.tertiary, margin: '12px 0 0' }}>Agendamentos que usariam este equipamento no período perdem a reserva e a recepção recebe um aviso para remarcar ou trocar.</p>
        </Modal>
      )}
    </div>
  )
}

function paraLocal(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
