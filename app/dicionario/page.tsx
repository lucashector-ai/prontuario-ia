'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { tokens } from '@/lib/design-tokens'
import { usePageHeader } from '@/components/shell/header-context'
import { BookOpen, Info, Plus, Trash2, X } from 'lucide-react'
import { Badge, Button, Card, Chip, EmptyState, Field, IconButton, IconTile, Input, SearchInput, Select, type BadgeTone } from '@/components/ui'

import { confirmar } from '@/components/ui/dialogos'
const T = tokens

const CATEGORIAS = ['Medicamento', 'Patologia', 'Procedimento', 'Anatomia', 'Sigla', 'Outro']

export default function Dicionario() {
  usePageHeader('Dicionário clínico', 'Termos personalizados pra melhorar a transcrição da IA e gerar prontuários mais precisos')
  const router = useRouter()
  const { toast } = useToast()
  const [medico, setMedico] = useState<any>(null)
  const [termos, setTermos] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const [novoTermo, setNovoTermo] = useState('')
  const [novaDescricao, setNovaDescricao] = useState('')
  const [novaCategoria, setNovaCategoria] = useState('Medicamento')
  const [salvando, setSalvando] = useState(false)
  const [filtro, setFiltro] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todas')

  useEffect(() => {
    const ca_ = localStorage.getItem('clinica_admin')
    const m = ca_ || localStorage.getItem('medico')
    if (!m) { router.push('/login'); return }
    const med = JSON.parse(m)
    setMedico(med)
    carregarTermos(med.id)
  }, [router])

  const carregarTermos = async (medicoId: string) => {
    const { data } = await supabase
      .from('dicionario_clinico')
      .select('*')
      .eq('medico_id', medicoId)
      .order('categoria', { ascending: true })
    setTermos(data || [])
    setCarregando(false)
  }

  const handleAdicionar = async () => {
    if (!novoTermo.trim()) { toast('Digite o termo', 'error'); return }
    setSalvando(true)
    const { data, error } = await supabase
      .from('dicionario_clinico')
      .insert({ medico_id: medico.id, termo: novoTermo.trim(), descricao: novaDescricao.trim(), categoria: novaCategoria })
      .select().single()
    if (!error && data) {
      setTermos(prev => [...prev, data])
      setNovoTermo(''); setNovaDescricao('')
      toast('Termo adicionado!')
    } else {
      toast(error?.message || 'Erro ao salvar', 'error')
    }
    setSalvando(false)
  }

  const handleDeletar = async (id: string) => {
    if (!(await confirmar({ titulo: 'Remover este termo?', mensagem: 'A IA deixa de usar este termo nas próximas transcrições.', confirmar: 'Remover', perigo: true }))) return
    await supabase.from('dicionario_clinico').delete().eq('id', id)
    setTermos(prev => prev.filter(t => t.id !== id))
    toast('Termo removido', 'info')
  }

  if (!medico) return null

  const termosFiltrados = termos.filter(t => {
    const txtOk = !filtro || t.termo.toLowerCase().includes(filtro.toLowerCase()) || t.descricao?.toLowerCase().includes(filtro.toLowerCase())
    const catOk = filtroCategoria === 'todas' || t.categoria === filtroCategoria
    return txtOk && catOk
  })

  const tomCategoria: Record<string, BadgeTone> = {
    'Medicamento': 'info', 'Patologia': 'danger', 'Procedimento': 'accent',
    'Anatomia': 'success', 'Sigla': 'warning', 'Outro': 'neutral',
  }

  // Contagem por categoria pra chips de filtro
  const contagem: Record<string, number> = { todas: termos.length }
  for (const cat of CATEGORIAS) contagem[cat] = termos.filter(t => t.categoria === cat).length

  return (
    <div style={{ padding: 20 }}>
      <style>{`
        .dic-grid { display: grid; grid-template-columns: 1fr; gap: 16px; align-items: start; }
        @media (min-width: 960px) { .dic-grid { grid-template-columns: 340px minmax(0, 1fr); } }
      `}</style>

      <div className="dic-grid">
        {/* COLUNA ESQUERDA — adicionar + info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card padding={20} titulo="Adicionar termo" acao={<Badge tone="accent">{termos.length} {termos.length === 1 ? 'termo' : 'termos'}</Badge>}>
            <p style={{ fontSize: 12.5, color: T.text.quaternary, margin: '-6px 0 16px' }}>Amplie o vocabulário da IA</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Termo *">
                <Input
                  value={novoTermo}
                  onChange={e => setNovoTermo(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAdicionar()}
                  placeholder="Ex: BDZ, Quetiapina, PCR..."
                />
              </Field>
              <Field label="Descrição">
                <Input
                  value={novaDescricao}
                  onChange={e => setNovaDescricao(e.target.value)}
                  placeholder="Ex: Benzodiazepínico"
                />
              </Field>
              <Field label="Categoria">
                <Select value={novaCategoria} onChange={e => setNovaCategoria(e.target.value)} style={{ cursor: 'pointer' }}>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
              <Button icon={Plus} block onClick={handleAdicionar} disabled={salvando} style={{ marginTop: 4 }}>
                {salvando ? 'Salvando…' : 'Adicionar ao dicionário'}
              </Button>
            </div>
          </Card>

          <Card padding={18}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <IconTile icon={Info} size={34} radius={10} />
              <div>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: T.text.primary, margin: '0 0 4px' }}>Como funciona</p>
                <p style={{ fontSize: 12.5, color: T.text.secondary, margin: 0, lineHeight: 1.55 }}>
                  Os termos aqui cadastrados são usados pela IA pra corrigir a transcrição da consulta e gerar prontuários mais precisos pra sua especialidade.
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* COLUNA DIREITA — busca + chips + grid de termos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <SearchInput
            value={filtro}
            onChange={setFiltro}
            placeholder="Buscar termo…"
            trailing={filtro ? <IconButton icon={X} size={26} onClick={() => setFiltro('')} aria-label="Limpar busca" /> : undefined}
          />

          {/* Chips de categoria */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {['todas', ...CATEGORIAS].map(cat => {
              const ativo = filtroCategoria === cat
              const count = contagem[cat] || 0
              const vazio = count === 0 && cat !== 'todas'
              const label = cat === 'todas' ? 'Todas' : cat
              return (
                <Chip
                  key={cat}
                  ativo={ativo}
                  onClick={vazio ? undefined : () => setFiltroCategoria(cat)}
                  style={vazio ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
                >
                  {label}
                  <span style={{
                    fontSize: 11, padding: '1px 6px', borderRadius: 99, fontWeight: 700,
                    background: ativo ? T.bg.card : T.bg.hover,
                    color: ativo ? T.brand.primary : T.text.tertiary,
                  }}>{count}</span>
                </Chip>
              )
            })}
          </div>

          {/* Lista */}
          {carregando ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
              {[0, 1, 2, 3].map(i => <div key={i} className="c360-skel" style={{ height: 72, borderRadius: T.radius['2xl'] }} />)}
            </div>
          ) : termosFiltrados.length === 0 ? (
            <Card padding={8}>
              <EmptyState
                icon={BookOpen}
                titulo={termos.length === 0 ? 'Nenhum termo cadastrado' : 'Nenhum resultado'}
                descricao={termos.length === 0 ? 'Adicione termos específicos da sua especialidade no formulário ao lado.' : 'Tente outro filtro ou busca.'}
              />
            </Card>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
              {termosFiltrados.map(t => (
                <Card key={t.id} padding="14px 12px 14px 16px" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: T.text.primary }}>{t.termo}</span>
                      <Badge tone={tomCategoria[t.categoria] || 'neutral'}>{t.categoria}</Badge>
                    </div>
                    {t.descricao && (
                      <p style={{ fontSize: 12.5, color: T.text.secondary, margin: 0, lineHeight: 1.5 }}>{t.descricao}</p>
                    )}
                  </div>
                  <BotaoRemover onClick={() => handleDeletar(t.id)} />
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** Lixeira cinza em repouso, vermelha no hover. */
function BotaoRemover({ onClick }: { onClick: () => void }) {
  const [h, setH] = useState(false)
  return (
    <IconButton
      icon={Trash2}
      tone={h ? 'danger' : 'default'}
      size={30}
      title="Remover"
      aria-label="Remover termo"
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      onClick={onClick}
    />
  )
}
