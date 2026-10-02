'use client'
import { log } from '@/lib/logger'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  SquareCheckBig, Download, Upload, UserPlus, ArrowUpDown, ChevronDown, ChevronRight, Check, X,
  Trash2, Users, Phone, Mail, IdCard, Shield, Cake, Stethoscope, CalendarDays, Mic, ArrowRight,
  ChevronsLeft, ChevronLeft, ChevronsRight, CreditCard,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ImportarPacientes } from '@/components/ImportarPacientes'
import { tokens } from '@/lib/design-tokens'
import {
  Button, IconButton, Input, Select, Field, SearchInput, SegmentedControl, Chip, Badge, Avatar,
  EmptyState, Modal, ModalAcoes, Drawer, Icon, Checkbox, type BadgeTone,
} from '@/components/ui'
import { usePageHeader } from '@/components/shell/header-context'
import { confirmar } from '@/components/ui/dialogos'

import { CONVENIOS, normalizarConvenio } from '@/lib/convenios'
import { ConvenioBadge } from '@/components/ConvenioBadge'
import { primeiroNome } from '@/lib/nome'
import { registrarAcesso } from '@/lib/auditoria'
const T = tokens

const CONVENIOS_LISTA = CONVENIOS

function formatarTelefone(v: string) {
  const nums = v.replace(/\D/g, '').slice(0, 11)
  if (nums.length <= 2) return nums
  if (nums.length <= 6) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`
  if (nums.length <= 10) return `(${nums.slice(0, 2)}) ${nums.slice(2, 6)}-${nums.slice(6)}`
  return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7)}`
}

function formatarCPF(v: string) {
  const nums = v.replace(/\D/g, '').slice(0, 11)
  if (nums.length <= 3) return nums
  if (nums.length <= 6) return `${nums.slice(0, 3)}.${nums.slice(3)}`
  if (nums.length <= 9) return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6)}`
  return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6, 9)}-${nums.slice(9)}`
}

// Tom do avatar por hash do nome (como no protótipo)
const TONS_AVATAR = ['purple', 'pink', 'blue', 'green'] as const
function tomAvatar(nome: string) {
  let hash = 0
  for (let i = 0; i < nome.length; i++) hash = nome.charCodeAt(i) + ((hash << 5) - hash)
  return TONS_AVATAR[Math.abs(hash) % TONS_AVATAR.length]
}


const fmtData = (s?: string | null) => {
  if (!s) return null
  const d = new Date(s)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '')
}

// Data de nascimento (YYYY-MM-DD) sem deslocamento de fuso
const fmtNascimento = (s?: string | null) => {
  if (!s) return null
  const [a, m, d] = String(s).slice(0, 10).split('-')
  return a && m && d ? `${d}/${m}/${a}` : s
}

const urlNovaConsulta = (p: any) => {
  const params = new URLSearchParams()
  params.set('paciente_id', p.id)
  if (p.nome) params.set('paciente_nome', p.nome)
  if (p.telefone) params.set('paciente_tel', p.telefone)
  return '/nova-consulta?' + params.toString()
}

const ORDENACOES: { id: 'nome' | 'recente'; label: string }[] = [
  { id: 'nome', label: 'Nome: A → Z' },
  { id: 'recente', label: 'Mais recentes' },
]

export default function Pacientes() {
  const router = useRouter()
  const [medico, setMedico] = useState<any>(null)
  const [medicosClinica, setMedicosClinica] = useState<any[]>([])
  const [ehClinicaAdmin, setEhClinicaAdmin] = useState(false)
  const [pacientes, setPacientes] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [mostrarImport, setMostrarImport] = useState(false)
  const [form, setForm] = useState({ nome: '', data_nascimento: '', sexo: '', telefone: '', email: '', cpf: '', convenio: '', convenio_outro: '', medico_id: '' })
  const [salvando, setSalvando] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtroSexo, setFiltroSexo] = useState('todos')
  const [filtroConvenio, setFiltroConvenio] = useState('todos')
  const [ordenar, setOrdenar] = useState<'nome' | 'recente'>('nome')
  const [menuOrdenar, setMenuOrdenar] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro', texto: string } | null>(null)
  const [modoSelecao, setModoSelecao] = useState(false)
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [deletandoLote, setDeletandoLote] = useState(false)
  const [pagina, setPagina] = useState(1)
  const [paginaInput, setPaginaInput] = useState('')
  const [drawerId, setDrawerId] = useState<string | null>(null)
  const PACIENTES_POR_PAGINA = 10

  useEffect(() => {
    const ca_ = localStorage.getItem('clinica_admin')
    const m = ca_ || localStorage.getItem('medico')
    if (!m) { router.push('/login'); return }
    const med = JSON.parse(m)
    setMedico(med)
    carregarPacientes(med.id)

    // Se for clinica admin, carrega lista de medicos da clinica
    const clinicaIdAdmin = ca_ ? med.clinica_id : null
    if (clinicaIdAdmin) {
      setEhClinicaAdmin(true)
      import('@/lib/supabase').then(({ supabase }) => {
        supabase
          .from('medicos')
          .select('id, nome')
          .eq('clinica_id', clinicaIdAdmin)
          .eq('ativo', true)
          .neq('cargo', 'recepcionista')
          .order('nome')
          .then(({ data, error }) => {
            if (error) log.error('Erro carregando medicos:', error)
            log.info('Medicos da clinica:', data?.length, data)
            setMedicosClinica(data || [])
          })
      })
    } else {
      log.info('Nao eh admin OU sem clinica_id', { temCa: !!ca_, clinicaId: med.clinica_id })
    }
  }, [router])

  const carregarPacientes = async (id: string) => {
    setCarregando(true)
    // Se for clinica admin, busca pacientes de todos medicos da clinica
    const ca = localStorage.getItem('clinica_admin')
    let url = '/api/pacientes?medico_id=' + id
    if (ca) {
      const admin = JSON.parse(ca)
      if (admin.clinica_id) url = '/api/pacientes?clinica_id=' + admin.clinica_id
    }
    const res = await fetch(url)
    const data = await res.json()
    setPacientes(data.pacientes || [])
    setCarregando(false)
  }

  const mostrarMsg = (tipo: 'ok' | 'erro', texto: string) => {
    setMsg({ tipo, texto })
    setTimeout(() => setMsg(null), 3500)
  }

  const toggleSelecionado = (id: string) => {
    setSelecionados(prev => {
      const novo = new Set(prev)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  const sairSelecao = () => {
    setModoSelecao(false)
    setSelecionados(new Set())
  }

  const selecionarTodos = () => {
    setSelecionados(new Set(pacientesFiltrados.map((p: any) => p.id)))
  }

  const deletarSelecionados = async () => {
    if (selecionados.size === 0) return
    if (!(await confirmar({ titulo: `Excluir ${selecionados.size} paciente${selecionados.size !== 1 ? 's' : ''}?`, mensagem: 'Todas as consultas e agendamentos desses pacientes também serão removidos. Essa ação não pode ser desfeita.', confirmar: 'Excluir', perigo: true }))) return
    setDeletandoLote(true)
    const ids = Array.from(selecionados)
    ids.forEach(id => registrarAcesso({ acao: 'excluiu', recurso: 'paciente', recursoId: id, pacienteId: id, forcar: true }))
    const resultados = await Promise.all(
      ids.map(id => fetch('/api/pacientes?id=' + id, { method: 'DELETE' }))
    )
    const ok = resultados.filter(r => r.ok).length
    setPacientes(prev => prev.filter(p => !selecionados.has(p.id)))
    sairSelecao()
    mostrarMsg('ok', ok + ' paciente' + (ok !== 1 ? 's' : '') + ' removido' + (ok !== 1 ? 's' : ''))
    setDeletandoLote(false)
  }

  const salvarPaciente = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!medico) return
    setSalvando(true)
    const convenioFinal = form.convenio === 'Outro' ? normalizarConvenio(form.convenio_outro) : form.convenio
    const medicoIdFinal = form.medico_id || medico.id
    const payload = {
      nome: form.nome,
      data_nascimento: form.data_nascimento || null,
      sexo: form.sexo || null,
      telefone: form.telefone || null,
      email: form.email || null,
      cpf: form.cpf || null,
      convenio: convenioFinal || null,
      medico_id: medicoIdFinal,
    }
    const res = await fetch('/api/pacientes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (data.paciente) {
      router.push(`/pacientes/${data.paciente.id}`)
    } else {
      mostrarMsg('erro', data.error || 'Erro ao cadastrar')
    }
    setSalvando(false)
  }

  const exportarCSV = () => {
    if (pacientes.length === 0) {
      mostrarMsg('erro', 'Nenhum paciente pra exportar')
      return
    }
    registrarAcesso({ acao: 'exportou', recurso: 'paciente', detalhes: { quantidade: pacientes.length } })
    // Helper pra escapar CSV
    const esc = (v: any) => {
      if (v === null || v === undefined) return ''
      const s = String(v)
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"'
      }
      return s
    }
    const cabecalho = ['nome', 'cpf', 'data_nascimento', 'telefone', 'sexo', 'email', 'convenio']
    const linhas = pacientes.map(p => [
      esc(p.nome),
      esc(p.cpf),
      esc(p.data_nascimento),
      esc(p.telefone),
      esc(p.sexo),
      esc(p.email),
      esc(p.convenio),
    ].join(','))
    const csv = cabecalho.join(',') + '\n' + linhas.join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const data = new Date().toISOString().slice(0, 10)
    link.href = url
    link.download = 'pacientes-' + data + '.csv'
    link.click()
    URL.revokeObjectURL(url)
    mostrarMsg('ok', pacientes.length + ' paciente' + (pacientes.length !== 1 ? 's' : '') + ' exportado' + (pacientes.length !== 1 ? 's' : ''))
  }

  const deletar = async (e: React.MouseEvent, p: any) => {
    e.stopPropagation()
    if (!(await confirmar({ titulo: `Excluir ${p.nome}?`, mensagem: 'Todas as consultas e agendamentos do paciente também serão removidos. Essa ação não pode ser desfeita.', confirmar: 'Excluir', perigo: true }))) return
    registrarAcesso({ acao: 'excluiu', recurso: 'paciente', recursoId: p.id, pacienteId: p.id, detalhes: { nome: p.nome }, forcar: true })
    await fetch(`/api/pacientes?id=${p.id}`, { method: 'DELETE' })
    setPacientes(prev => prev.filter(x => x.id !== p.id))
    mostrarMsg('ok', 'Paciente removido')
  }

  const calcularIdade = (nasc: string) => {
    if (!nasc) return null
    const hoje = new Date(); const dn = new Date(nasc)
    let idade = hoje.getFullYear() - dn.getFullYear()
    if (hoje.getMonth() < dn.getMonth() || (hoje.getMonth() === dn.getMonth() && hoje.getDate() < dn.getDate())) idade--
    return idade
  }

  // Reset pagina quando muda filtro
  useEffect(() => { setPagina(1) }, [busca, filtroSexo, filtroConvenio, ordenar])

  const pacientesFiltrados = pacientes
    .filter(p => {
      if (busca && !(p.nome || '').toLowerCase().includes(busca.toLowerCase()) && !(p.telefone || '').includes(busca)) return false
      if (filtroSexo !== 'todos' && p.sexo !== filtroSexo) return false
      if (filtroConvenio === 'particular' && normalizarConvenio(p.convenio) !== 'Particular') return false
      if (filtroConvenio === 'convenio' && normalizarConvenio(p.convenio) === 'Particular') return false
      return true
    })
    .sort((a, b) => ordenar === 'nome'
      ? (a.nome || '').localeCompare(b.nome || '')
      : new Date(b.criado_em || 0).getTime() - new Date(a.criado_em || 0).getTime()
    )

  const totalHomens = pacientes.filter(p => p.sexo === 'Masculino').length
  const totalMulheres = pacientes.filter(p => p.sexo === 'Feminino').length
  const filtroAtivo = busca || filtroSexo !== 'todos' || filtroConvenio !== 'todos'
  // Coluna "Médico" só faz sentido quando a lista traz o médico (admin de clínica)
  const mostrarMedico = pacientes.some(p => p.medico?.nome)
  const pacienteDrawer = drawerId ? pacientes.find(p => p.id === drawerId) : null

  const descricaoHeader = carregando
    ? 'Cadastro e acompanhamento dos seus pacientes'
    : `${pacientes.length} paciente${pacientes.length !== 1 ? 's' : ''} cadastrado${pacientes.length !== 1 ? 's' : ''}`
      + (totalHomens + totalMulheres > 0 ? ` · ${totalHomens} ${totalHomens === 1 ? 'homem' : 'homens'}, ${totalMulheres} ${totalMulheres === 1 ? 'mulher' : 'mulheres'}` : '')
  usePageHeader('Pacientes', descricaoHeader)

  // Celular: só paciente (telefone vai embaixo do nome) + ações — sem rolagem lateral
  const [compacto, setCompacto] = useState(false)
  useEffect(() => {
    const f = () => setCompacto(window.innerWidth < 760)
    f(); window.addEventListener('resize', f)
    return () => window.removeEventListener('resize', f)
  }, [])
  const colunas = (compacto
    ? [modoSelecao ? '28px' : null, 'minmax(0, 1fr)', '64px']
    : [modoSelecao ? '28px' : null, 'minmax(220px, 2.2fr)', '1.3fr', '1.1fr', '1fr', mostrarMedico ? '1.1fr' : null, '72px']
  ).filter(Boolean).join(' ')

  const totalPaginas = Math.max(1, Math.ceil(pacientesFiltrados.length / PACIENTES_POR_PAGINA))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const inicioPag = (paginaAtual - 1) * PACIENTES_POR_PAGINA
  const fimPag = Math.min(inicioPag + PACIENTES_POR_PAGINA, pacientesFiltrados.length)
  const visiveis = pacientesFiltrados.slice(inicioPag, inicioPag + PACIENTES_POR_PAGINA)
  const irPara = (n: number) => setPagina(Math.max(1, Math.min(totalPaginas, n)))
  const confirmarPaginaInput = () => {
    const n = parseInt(paginaInput || '0')
    if (n >= 1 && n <= totalPaginas) setPagina(n)
    setPaginaInput('')
  }

  const cabecalhoTabela: React.CSSProperties = {
    display: 'grid', gridTemplateColumns: colunas, gap: 12, alignItems: 'center',
    padding: '11px 16px', background: T.bg.muted, borderBottom: `1px solid ${T.border.default}`,
    fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: T.text.quaternary,
  }

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, minHeight: '100%', boxSizing: 'border-box' }}>
      {/* Linha 1: busca + ações */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 280px', minWidth: 0 }}>
          <SearchInput
            value={busca}
            onChange={setBusca}
            placeholder="Buscar por nome ou telefone"
            trailing={busca ? (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); setBusca('') }}
                aria-label="Limpar busca"
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: T.text.tertiary, padding: 0, display: 'flex' }}
              >
                <Icon icon={X} size={15} />
              </button>
            ) : undefined}
          />
        </div>
        {!modoSelecao && pacientes.length > 0 && (
          <Button variant="secondary" icon={SquareCheckBig} onClick={() => setModoSelecao(true)}>Selecionar</Button>
        )}
        {pacientes.length > 0 && (
          <Button variant="secondary" icon={Download} onClick={exportarCSV} title={'Exportar ' + pacientes.length + ' pacientes para CSV'}>Exportar</Button>
        )}
        <Button variant="secondary" icon={Upload} onClick={() => setMostrarImport(true)} className="pac-btn-importar">Importar</Button>
        <Button variant="primary" icon={UserPlus} onClick={() => setMostrarForm(true)} className="pac-btn-novo">
          <span className="pac-btn-novo-text">Novo paciente</span>
        </Button>
      </div>

      {/* Linha 2: filtros + ordenação + contagem */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <SegmentedControl
          options={[{ value: 'todos', label: 'Todos' }, { value: 'Masculino', label: 'Masculino' }, { value: 'Feminino', label: 'Feminino' }]}
          value={filtroSexo}
          onChange={setFiltroSexo}
        />
        <SegmentedControl
          options={[{ value: 'todos', label: 'Todos' }, { value: 'particular', label: 'Particular' }, { value: 'convenio', label: 'Convênio' }]}
          value={filtroConvenio}
          onChange={setFiltroConvenio}
        />
        <div style={{ position: 'relative' }}>
          <Button variant="secondary" icon={ArrowUpDown} iconRight={ChevronDown} onClick={() => setMenuOrdenar(v => !v)}>
            {ORDENACOES.find(o => o.id === ordenar)?.label}
          </Button>
          {menuOrdenar && (
            <>
              <div onClick={() => setMenuOrdenar(false)} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: 220, zIndex: 50,
                background: T.bg.card, border: `1px solid ${T.border.default}`, borderRadius: T.radius.xl,
                boxShadow: T.shadow.lg, padding: 6,
              }}>
                {ORDENACOES.map(o => (
                  <ItemMenu key={o.id} ativo={o.id === ordenar} onClick={() => { setOrdenar(o.id); setMenuOrdenar(false) }}>
                    {o.label}
                  </ItemMenu>
                ))}
              </div>
            </>
          )}
        </div>
        {filtroAtivo && (
          <Button variant="ghost" size="sm" icon={X} onClick={() => { setFiltroSexo('todos'); setFiltroConvenio('todos'); setBusca('') }}>
            Limpar filtros
          </Button>
        )}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12.5, color: T.text.quaternary }}>
          {pacientesFiltrados.length} {pacientesFiltrados.length === 1 ? 'paciente' : 'pacientes'}
        </span>
      </div>

      {/* Tabela */}
      <div style={{ border: `1px solid ${T.border.default}`, borderRadius: T.radius['2xl'], overflow: 'auto' }}>
        <div style={{ minWidth: compacto ? 0 : mostrarMedico ? 900 : 780 }}>
          <div style={cabecalhoTabela}>
            {modoSelecao && <span />}
            <span>Paciente</span>
            {!compacto && <>
              <span>Telefone</span>
              <span>Convênio</span>
              <span>Cadastro</span>
              {mostrarMedico && <span>Médico</span>}
            </>}
            <span />
          </div>

          {carregando ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: `1px solid ${T.border.muted}` }}>
                <div className="c360-skel" style={{ width: 36, height: 36, borderRadius: '50%' }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div className="c360-skel" style={{ height: 12, width: '30%', borderRadius: 6 }} />
                  <div className="c360-skel" style={{ height: 10, width: '18%', borderRadius: 6 }} />
                </div>
              </div>
            ))
          ) : pacientesFiltrados.length === 0 ? (
            <EmptyState
              icon={Users}
              titulo={filtroAtivo ? 'Nenhum paciente encontrado' : 'Nenhum paciente cadastrado ainda'}
              descricao={filtroAtivo ? 'Tente outro nome ou ajuste os filtros acima.' : 'Cadastre o primeiro paciente ou importe uma planilha.'}
              acao={!filtroAtivo ? <Button icon={UserPlus} onClick={() => setMostrarForm(true)}>Novo paciente</Button> : undefined}
            />
          ) : (
            visiveis.map(p => (
              <LinhaPaciente
                compacto={compacto}
                key={p.id}
                p={p}
                colunas={colunas}
                idade={calcularIdade(p.data_nascimento)}
                modoSelecao={modoSelecao}
                selecionado={selecionados.has(p.id)}
                mostrarMedico={mostrarMedico}
                onClick={() => {
                  if (modoSelecao) toggleSelecionado(p.id)
                  else setDrawerId(p.id)
                }}
                onAbrir={() => router.push('/pacientes/' + p.id)}
                onDeletar={(e) => deletar(e, p)}
              />
            ))
          )}
        </div>
      </div>

      {/* Paginação */}
      {!carregando && pacientesFiltrados.length > PACIENTES_POR_PAGINA && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <span style={{ fontSize: 13, color: T.text.secondary }}>
            Mostrando <strong style={{ color: T.text.primary }}>{inicioPag + 1}–{fimPag}</strong> de <strong style={{ color: T.text.primary }}>{pacientesFiltrados.length}</strong>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <IconButton icon={ChevronsLeft} variant="outline" size={34} onClick={() => irPara(1)} disabled={paginaAtual === 1} title="Primeira página" style={paginaAtual === 1 ? { opacity: 0.4, cursor: 'not-allowed' } : undefined} />
            <IconButton icon={ChevronLeft} variant="outline" size={34} onClick={() => irPara(paginaAtual - 1)} disabled={paginaAtual === 1} title="Página anterior" style={paginaAtual === 1 ? { opacity: 0.4, cursor: 'not-allowed' } : undefined} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 6px' }}>
              <span style={{ fontSize: 13, color: T.text.secondary }}>Página</span>
              <Input
                type="number"
                min={1}
                max={totalPaginas}
                value={paginaInput !== '' ? paginaInput : paginaAtual}
                onChange={e => setPaginaInput(e.target.value)}
                onBlur={confirmarPaginaInput}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    confirmarPaginaInput()
                    ;(e.target as HTMLInputElement).blur()
                  }
                }}
                style={{ width: 56, minHeight: 34, height: 34, padding: '0 8px', textAlign: 'center', borderRadius: 10 }}
              />
              <span style={{ fontSize: 13, color: T.text.secondary }}>de <strong style={{ color: T.text.primary }}>{totalPaginas}</strong></span>
            </div>
            <IconButton icon={ChevronRight} variant="outline" size={34} onClick={() => irPara(paginaAtual + 1)} disabled={paginaAtual === totalPaginas} title="Próxima página" style={paginaAtual === totalPaginas ? { opacity: 0.4, cursor: 'not-allowed' } : undefined} />
            <IconButton icon={ChevronsRight} variant="outline" size={34} onClick={() => irPara(totalPaginas)} disabled={paginaAtual === totalPaginas} title="Última página" style={paginaAtual === totalPaginas ? { opacity: 0.4, cursor: 'not-allowed' } : undefined} />
          </div>
        </div>
      )}

      {/* Barra flutuante de seleção */}
      {modoSelecao && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 90,
          background: T.night[800], color: '#fff', borderRadius: T.radius.xl, padding: '8px 8px 8px 18px',
          display: 'flex', alignItems: 'center', gap: 12, boxShadow: T.shadow.lg,
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
            {selecionados.size === 0
              ? 'Selecione pacientes'
              : selecionados.size + ' selecionado' + (selecionados.size !== 1 ? 's' : '')}
          </span>
          <span style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.18)' }} />
          <button onClick={selecionarTodos} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 12.5, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
            Selecionar todos
          </button>
          <Button
            variant="dangerSolid"
            size="sm"
            icon={Trash2}
            onClick={deletarSelecionados}
            disabled={selecionados.size === 0 || deletandoLote}
          >
            {deletandoLote ? 'Deletando...' : 'Deletar' + (selecionados.size > 0 ? ' (' + selecionados.size + ')' : '')}
          </Button>
          <Button variant="dark" size="sm" onClick={sairSelecao} style={{ background: 'transparent', borderColor: 'transparent', color: T.text.tertiary }}>
            Cancelar
          </Button>
        </div>
      )}

      {/* Toast */}
      {msg && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 300,
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '11px 16px', borderRadius: T.radius.input,
          background: T.bg.card, border: `1px solid ${T.border.default}`, boxShadow: T.shadow.lg,
          color: T.text.strong, fontSize: 13, fontWeight: 600,
        }}>
          <span style={{
            width: 20, height: 20, borderRadius: '50%', display: 'grid', placeItems: 'center',
            background: msg.tipo === 'ok' ? T.status.successBg : T.status.dangerBg,
            color: msg.tipo === 'ok' ? T.status.success : T.status.danger,
          }}>
            <Icon icon={msg.tipo === 'ok' ? Check : X} size={12} strokeWidth={2.4} />
          </span>
          {msg.texto}
        </div>
      )}

      {/* Drawer de pré-visualização (usa só os dados já carregados na lista) */}
      {pacienteDrawer && (
        <DrawerPaciente
          p={pacienteDrawer}
          idade={calcularIdade(pacienteDrawer.data_nascimento)}
          onClose={() => setDrawerId(null)}
          onAbrir={() => router.push('/pacientes/' + pacienteDrawer.id)}
          onConsulta={() => router.push(urlNovaConsulta(pacienteDrawer))}
          onDeletar={(e) => deletar(e, pacienteDrawer)}
        />
      )}

      {/* Modal de novo paciente */}
      {mostrarForm && (
        <Modal titulo="Novo paciente" largura={540} onClose={() => setMostrarForm(false)}>
          <form onSubmit={salvarPaciente} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Nome completo *">
              <Input
                required
                value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                placeholder="Ex.: Maria da Silva"
                autoFocus
              />
            </Field>

            <div className="pac-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="CPF">
                <Input
                  value={form.cpf}
                  onChange={e => setForm(f => ({ ...f, cpf: formatarCPF(e.target.value) }))}
                  placeholder="000.000.000-00"
                  maxLength={14}
                />
              </Field>
              <Field label="Data de nascimento">
                <Input
                  type="date"
                  value={form.data_nascimento}
                  onChange={e => setForm(f => ({ ...f, data_nascimento: e.target.value }))}
                />
              </Field>
              <Field label="Telefone">
                <Input
                  value={form.telefone}
                  onChange={e => setForm(f => ({ ...f, telefone: formatarTelefone(e.target.value) }))}
                  placeholder="(11) 90000-0000"
                  maxLength={15}
                />
              </Field>
              <Field label="E-mail">
                <Input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="email@exemplo.com"
                />
              </Field>
            </div>

            <Field label="Sexo">
              <SegmentedControl
                options={['Feminino', 'Masculino', 'Outro']}
                value={form.sexo}
                onChange={v => setForm(f => ({ ...f, sexo: f.sexo === v ? '' : v }))}
              />
            </Field>

            <Field label="Convênio">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {CONVENIOS_LISTA.map(c => (
                  <Chip
                    key={c}
                    ativo={form.convenio === c}
                    onClick={() => setForm(f => ({ ...f, convenio: f.convenio === c ? '' : c, convenio_outro: '' }))}
                  >
                    {c}
                  </Chip>
                ))}
              </div>
            </Field>

            {form.convenio === 'Outro' && (
              <Field label="Qual convênio?">
                <Input
                  value={form.convenio_outro}
                  onChange={e => setForm(f => ({ ...f, convenio_outro: e.target.value }))}
                  placeholder="Nome do convênio"
                />
              </Field>
            )}

            {ehClinicaAdmin && medicosClinica.length > 0 && (
              <Field label="Vincular ao médico">
                <Select
                  value={form.medico_id}
                  onChange={e => setForm(f => ({ ...f, medico_id: e.target.value }))}
                  style={{ cursor: 'pointer' }}
                >
                  <option value="">Sem vínculo (atribui no atendimento)</option>
                  {medicosClinica.map(m => (
                    <option key={m.id} value={m.id}>Dr(a). {m.nome}</option>
                  ))}
                </Select>
              </Field>
            )}

            <ModalAcoes>
              <Button type="button" variant="secondary" onClick={() => setMostrarForm(false)}>Cancelar</Button>
              <Button type="submit" variant="primary" disabled={salvando}>
                {salvando ? 'Cadastrando...' : 'Cadastrar e abrir ficha'}
              </Button>
            </ModalAcoes>
          </form>
        </Modal>
      )}

      <ImportarPacientes
        aberto={mostrarImport}
        onFechar={() => setMostrarImport(false)}
        onImportado={() => { if (medico) carregarPacientes(medico.id) }}
        medicoId={medico?.id || ''}
        clinicaId={medico?.clinica_id || ''}
      />
    </div>
  )
}

// ── Componentes locais ──────────────────────────────────────────────────────

function ItemMenu({ ativo, onClick, children }: { ativo?: boolean; onClick: () => void; children: React.ReactNode }) {
  const [h, setH] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        width: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 10px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        background: h ? T.bg.hover : 'transparent', fontSize: 13, color: T.text.strong, textAlign: 'left',
      }}
    >
      <span style={{ flex: 1, fontWeight: ativo ? 600 : 500 }}>{children}</span>
      {ativo && <Icon icon={Check} size={15} color={T.brand.primary} />}
    </button>
  )
}

function LinhaPaciente({ p, colunas, idade, modoSelecao, selecionado, mostrarMedico, onClick, onAbrir, onDeletar, compacto }: {
  compacto?: boolean
  p: any
  colunas: string
  idade: number | null
  modoSelecao: boolean
  selecionado: boolean
  mostrarMedico: boolean
  onClick: () => void
  onAbrir: () => void
  onDeletar: (e: React.MouseEvent) => void
}) {
  const [h, setH] = useState(false)
  const meta = [idade !== null ? idade + ' anos' : null, p.sexo].filter(Boolean).join(' · ')
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick() }}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: 'grid', gridTemplateColumns: colunas, gap: 12, alignItems: 'center',
        padding: '12px 16px', borderBottom: `1px solid ${T.border.muted}`, cursor: 'pointer',
        fontSize: 13, color: T.text.strong, outline: 'none',
        background: selecionado ? T.brand.primarySoftBg : h ? T.bg.muted : T.bg.card,
        boxShadow: selecionado ? `inset 3px 0 0 ${T.brand.primary}` : 'none',
        transition: 'background .15s',
      }}
    >
      {modoSelecao && (
        <span onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={selecionado} onChange={() => onClick()} />
        </span>
      )}
      <span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <Avatar nome={p.nome || '?'} size={36} tom={tomAvatar(p.nome || '')} src={p.foto_url} />
        <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
          <span style={{ fontWeight: 700, color: T.text.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nome}</span>
          {meta && <span style={{ fontSize: 12, color: T.text.quaternary }}>{meta}</span>}
          {compacto && (p.telefone || p.convenio) && (
            <span style={{ fontSize: 12, color: T.text.quaternary, display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
              {p.telefone && <span className="mono">{p.telefone}</span>}
              {p.convenio && <ConvenioBadge convenio={p.convenio} size="sm" />}
            </span>
          )}
        </span>
      </span>
      {!compacto && <>
      <span className="mono" style={{ fontSize: 12.5, color: p.telefone ? T.text.muted : T.text.tertiary, whiteSpace: 'nowrap' }}>
        {p.telefone || '—'}
      </span>
      <span>
        {p.convenio
          ? <ConvenioBadge convenio={p.convenio} />
          : <span style={{ color: T.text.tertiary }}>—</span>}
      </span>
      <span style={{ color: T.text.secondary, whiteSpace: 'nowrap' }}>{fmtData(p.criado_em) || '—'}</span>
      {mostrarMedico && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {p.medico?.nome ? (
            <>
              <Avatar nome={p.medico.nome} size={22} />
              <span style={{ fontSize: 12.5, color: T.text.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {/^dra?\.?\s/i.test(p.medico.nome || '') ? primeiroNome(p.medico.nome) : 'Dr(a). ' + primeiroNome(p.medico.nome)}
              </span>
            </>
          ) : <span style={{ color: T.text.tertiary }}>—</span>}
        </span>
      )}
      </>}
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 2 }}>
        {!modoSelecao && (
          <span style={{ opacity: h ? 1 : 0, transition: 'opacity .15s', display: 'inline-flex', gap: 2 }}>
            <IconButton icon={Trash2} tone="danger" size={30} title="Remover paciente" onClick={onDeletar} />
          </span>
        )}
        <IconButton
          icon={ChevronRight}
          size={30}
          title="Abrir ficha completa"
          onClick={(e) => { e.stopPropagation(); onAbrir() }}
          style={{ color: h ? T.brand.primary : T.text.tertiary }}
        />
      </span>
    </div>
  )
}

function LinhaInfo({ icon, label, valor, ultima }: { icon: LucideIcon; label: string; valor: React.ReactNode; ultima?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: ultima ? 'none' : `1px solid ${T.border.muted}` }}>
      <Icon icon={icon} size={15} color={T.text.tertiary} />
      <span style={{ flex: 1, fontSize: 12.5, color: T.text.quaternary }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: T.text.primary, textAlign: 'right', minWidth: 0, overflowWrap: 'anywhere' }}>{valor}</span>
    </div>
  )
}

function AcaoRapida({ icon, label, primaria, tone, onClick }: { icon: LucideIcon; label: string; primaria?: boolean; tone?: 'danger'; onClick: (e: React.MouseEvent) => void }) {
  const [h, setH] = useState(false)
  const bg = primaria
    ? (h ? T.brand.primaryHover : T.brand.primary)
    : tone === 'danger' ? (h ? T.status.dangerBg : T.bg.page) : (h ? T.brand.primaryLight : T.bg.page)
  const cor = primaria ? '#fff' : tone === 'danger' ? T.status.danger : T.text.strong
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 6px',
        borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        background: bg, color: cor, fontSize: 12, fontWeight: 600, transition: 'background .15s',
      }}
    >
      <Icon icon={icon} size={17} active={h && !primaria} />
      {label}
    </button>
  )
}

function DrawerPaciente({ p, idade, onClose, onAbrir, onConsulta, onDeletar }: {
  p: any
  idade: number | null
  onClose: () => void
  onAbrir: () => void
  onConsulta: () => void
  onDeletar: (e: React.MouseEvent) => void
}) {
  const meta = [p.sexo, idade !== null ? idade + ' anos' : null, p.convenio ? normalizarConvenio(p.convenio) : null].filter(Boolean).join(' · ')
  const condicoes: { label: string; tone: BadgeTone }[] = [
    ...(p.alergias ? [{ label: 'Alergias: ' + p.alergias, tone: 'danger' as BadgeTone }] : []),
    ...(p.comorbidades ? [{ label: p.comorbidades, tone: 'warning' as BadgeTone }] : []),
    ...(p.medicamentos_uso ? [{ label: 'Em uso: ' + p.medicamentos_uso, tone: 'accent' as BadgeTone }] : []),
  ]
  const info: { icon: LucideIcon; label: string; valor: React.ReactNode }[] = [
    ...(p.telefone ? [{ icon: Phone, label: 'Telefone', valor: <span className="mono">{p.telefone}</span> }] : []),
    ...(p.email ? [{ icon: Mail, label: 'E-mail', valor: p.email }] : []),
    ...(p.cpf ? [{ icon: IdCard, label: 'CPF', valor: <span className="mono">{p.cpf}</span> }] : []),
    ...(p.data_nascimento ? [{ icon: Cake, label: 'Nascimento', valor: fmtNascimento(p.data_nascimento) + (idade !== null ? ` (${idade} anos)` : '') }] : []),
    ...(p.convenio ? [{ icon: Shield, label: 'Convênio', valor: normalizarConvenio(p.convenio) }] : []),
    ...(p.nr_carteirinha ? [{ icon: CreditCard, label: 'Carteirinha', valor: <span className="mono">{p.nr_carteirinha}</span> }] : []),
    ...(p.medico?.nome ? [{ icon: Stethoscope, label: 'Médico', valor: 'Dr(a). ' + p.medico.nome }] : []),
    ...(p.criado_em ? [{ icon: CalendarDays, label: 'Cadastrado em', valor: fmtData(p.criado_em) }] : []),
  ]
  return (
    <Drawer
      titulo={<span style={{ fontSize: 13, fontWeight: 600, color: T.text.quaternary }}>Ficha do paciente</span>}
      onClose={onClose}
      rodape={<Button variant="secondary" block iconRight={ArrowRight} onClick={onAbrir}>Abrir ficha completa</Button>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Avatar nome={p.nome || '?'} size={56} tom={tomAvatar(p.nome || '')} src={p.foto_url} />
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-.01em', color: T.text.primary }}>{p.nome}</span>
            {meta && <span style={{ fontSize: 12.5, color: T.text.quaternary }}>{meta}</span>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {condicoes.length > 0
            ? condicoes.map((c, i) => (
              <Badge key={i} tone={c.tone} style={{ whiteSpace: 'normal', lineHeight: 1.35, padding: '4px 10px' }}>{c.label}</Badge>
            ))
            : <Badge tone="neutral" style={{ padding: '4px 10px' }}>Sem condições registradas</Badge>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <AcaoRapida icon={Mic} label="Consulta" primaria onClick={onConsulta} />
          <AcaoRapida icon={ArrowRight} label="Ficha" onClick={onAbrir} />
          <AcaoRapida icon={Trash2} label="Remover" tone="danger" onClick={onDeletar} />
        </div>

        {info.length > 0 ? (
          <div style={{ border: `1px solid ${T.border.default}`, borderRadius: T.radius.xl, padding: '4px 14px' }}>
            {info.map((it, i) => <LinhaInfo key={it.label} icon={it.icon} label={it.label} valor={it.valor} ultima={i === info.length - 1} />)}
          </div>
        ) : (
          <p style={{ fontSize: 12.5, color: T.text.quaternary, margin: 0 }}>Nenhum dado de contato preenchido.</p>
        )}

        <p style={{ fontSize: 12, color: T.text.tertiary, margin: 0, lineHeight: 1.45 }}>
          Consultas, agendamentos, prescrições e linha do tempo ficam na ficha completa.
        </p>
      </div>
    </Drawer>
  )
}
