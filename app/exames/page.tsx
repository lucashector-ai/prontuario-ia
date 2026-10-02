'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { tokens } from '@/lib/design-tokens'
import {
  Badge, Button, EmptyState, Field, Icon, IconButton, IconTile, Modal, Select, Textarea,
  type BadgeTone,
} from '@/components/ui'
import {
  AlertTriangle, Check, FileDown, FileText, FileUp, Image as ImageIcon, Paperclip,
  Save, ScanSearch, Sparkles, Upload, Users, X,
} from 'lucide-react'

import { registrarAcesso } from '@/lib/auditoria'
export default function Exames() {
  const router = useRouter()
  const [medico, setMedico] = useState<any>(null)
  const [imagem, setImagem] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [contexto, setContexto] = useState('')
  const [analisando, setAnalisando] = useState(false)
  const [analise, setAnalise] = useState<any>(null)
  const [erro, setErro] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const [loadingMsg, setLoadingMsg] = useState('Recebendo o exame...')
  const [arrastando, setArrastando] = useState(false)
  const [hoverDrop, setHoverDrop] = useState(false)

  // Mensagens rotativas durante a análise (pra parecer ativo)
  useEffect(() => {
    if (!analisando) return
    const msgs = [
      'Recebendo o exame...',
      'Lendo valores e referências...',
      'Identificando especialidade...',
      'Analisando achados clínicos...',
      'Pensando em hipóteses diagnósticas...',
      'Consultando diretrizes médicas...',
      'Estruturando interpretação final...',
    ]
    let i = 0
    setLoadingMsg(msgs[0])
    const t = setInterval(() => {
      i = Math.min(i + 1, msgs.length - 1)
      setLoadingMsg(msgs[i])
    }, 4000)
    return () => clearInterval(t)
  }, [analisando])

  useEffect(() => {
    const ca_ = localStorage.getItem('clinica_admin')
    const m = ca_ || localStorage.getItem('medico')
    if (!m) { router.push('/login'); return }
    setMedico(JSON.parse(m))
  }, [router])

  const handleImagem = (file: File) => {
    setImagem(file)
    setAnalise(null)
    setErro('')
    const reader = new FileReader()
    reader.onload = e => setPreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) handleImagem(file)
  }

  const handleAnalisar = async () => {
    if (!imagem) return
    setAnalisando(true); setErro('')
    try {
      const form = new FormData()
      form.append('file', imagem)
      if (contexto) form.append('contexto', contexto)
      const res = await fetch('/api/analisar-exame', { method: 'POST', body: form })
      const data = await res.json()
      if (data.analise) {
        setAnalise(data.analise)
        registrarAcesso({ acao: 'visualizou', recurso: 'exame', detalhes: { tipo: data.analise.tipo || data.analise.tipo_exame || null } })
      }
      else setErro(data.error || 'Erro ao analisar')
    } catch (e: any) { setErro(e.message) }
    finally { setAnalisando(false) }
  }

  // Estados para Exportar / Adicionar ao prontuário
  const [modalPaciente, setModalPaciente] = useState(false)
  const [pacientesList, setPacientesList] = useState<any[]>([])
  const [salvandoConsulta, setSalvandoConsulta] = useState(false)
  const [salvouMsg, setSalvouMsg] = useState('')

  const carregarPacientes = async () => {
    if (!medico) return
    const ca = localStorage.getItem('clinica_admin')
    let medicoIdParaBusca = medico.id
    if (ca) {
      // Admin: pega pacientes de todos os médicos da clínica
      const { data: meds } = await supabase.from('medicos').select('id').eq('clinica_id', medico.clinica_id).eq('cargo', 'medico')
      const ids = (meds || []).map((m: any) => m.id)
      const { data: pacs } = await supabase.from('pacientes').select('id, nome').in('medico_id', ids).order('nome')
      setPacientesList(pacs || [])
    } else {
      const { data: pacs } = await supabase.from('pacientes').select('id, nome').eq('medico_id', medicoIdParaBusca).order('nome')
      setPacientesList(pacs || [])
    }
  }

  const exportarPDF = async () => {
    if (!analise) return
    registrarAcesso({ acao: 'exportou', recurso: 'exame', detalhes: { tipo: analise.tipo || analise.tipo_exame || null } })
    const res = await fetch('/api/pdf-exame', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ medico, analise, contexto }),
    })
    const html = await res.text()
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(html)
      win.document.close()
    }
  }

  const abrirModalPaciente = () => {
    carregarPacientes()
    setModalPaciente(true)
  }

  const [pacienteSelecionadoId, setPacienteSelecionadoId] = useState('')

  const adicionarAoPaciente = async () => {
    if (!medico || !analise || salvandoConsulta) return
    if (!pacienteSelecionadoId) { setSalvouMsg('Erro: selecione um paciente'); setTimeout(() => setSalvouMsg(''), 3000); return }
    const paciente = pacientesList.find((p: any) => p.id === pacienteSelecionadoId)
    if (!paciente) return

    setSalvandoConsulta(true)
    try {
      // Monta texto formatado com todos os campos da análise pra entrar como "objetivo"
      const partes: string[] = []
      if (analise.tipo) partes.push('TIPO DE EXAME: ' + analise.tipo)
      if (analise.resumo) partes.push('RESUMO: ' + analise.resumo)
      if ((analise.valores || []).length > 0) {
        partes.push('\nVALORES ENCONTRADOS:')
        for (const v of analise.valores) {
          partes.push('• ' + v.nome + ': ' + v.valor + ' (ref: ' + v.referencia + ') — ' + (v.status || '') + (v.interpretacao ? '. ' + v.interpretacao : ''))
        }
      }
      const objetivo = partes.join('\n')
      const alertasTxt = (analise.alertas || []).join(' | ')
      const conclusaoTxt = analise.conclusao || ''
      const planoTxt = (analise.recomendacoes || []).join(' • ')

      // Resolve medico_id: se admin, pega medico_id do paciente
      let medicoIdFinal = medico.id
      const ca = localStorage.getItem('clinica_admin')
      if (ca) {
        const { data: pac } = await supabase.from('pacientes').select('medico_id').eq('id', pacienteSelecionadoId).single()
        if (pac?.medico_id) medicoIdFinal = pac.medico_id
      }

      // Body sem 'tipo' (coluna não existe). Mesmo padrão da Nova Consulta.
      const body = {
        medico_id: medicoIdFinal,
        paciente_id: pacienteSelecionadoId,
        transcricao: contexto || '',
        subjetivo: contexto || 'Análise de exame realizada via IA',
        objetivo,
        avaliacao: alertasTxt || conclusaoTxt.slice(0, 200),
        plano: planoTxt,
        cids: [],
        alertas: analise.alertas || [],
        hipoteses: [],
        receita: '',
      }
      const r = await fetch('/api/consultas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await r.json()
      if (d.id) {
        setSalvouMsg('Adicionado ao histórico de ' + paciente.nome + '!')
        setModalPaciente(false)
        setPacienteSelecionadoId('')
        setTimeout(() => setSalvouMsg(''), 4000)
      } else {
        setSalvouMsg('Erro: ' + (d.error || 'falha ao salvar'))
        setTimeout(() => setSalvouMsg(''), 5000)
      }
    } catch (err: any) {
      setSalvouMsg('Erro: ' + err.message)
    }
    setSalvandoConsulta(false)
  }

  // Status do parâmetro (API: critico | alterado | normal) → Badge + cor do valor
  const statusParam = (s: string): { label: string; tone: BadgeTone; cor: string } => {
    if (s === 'critico') return { label: 'Crítico', tone: 'danger', cor: tokens.status.danger }
    if (s === 'alterado') return { label: 'Alterado', tone: 'warning', cor: tokens.status.warning }
    return { label: 'Normal', tone: 'success', cor: tokens.text.primary }
  }

  const ehPdf = imagem?.type === 'application/pdf'
  const temAtencao = !!analise && ((analise.alertas?.length ?? 0) > 0 || (analise.valores || []).some((v: any) => v.status && v.status !== 'normal'))
  const statusArquivo: { label: string; tone: BadgeTone } = analisando
    ? { label: 'Lendo…', tone: 'pending' }
    : analise
      ? (temAtencao ? { label: 'Atenção', tone: 'danger' } : { label: 'Normal', tone: 'success' })
      : { label: 'Aguardando', tone: 'neutral' }
  const tamanhoArquivo = imagem ? (imagem.size / 1024 / 1024 >= 1 ? (imagem.size / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(imagem.size / 1024)) + ' KB') : ''
  const tituloExame = analise?.tipo || analise?.tipo_exame || 'Resultado da análise'
  const salvouErro = salvouMsg.startsWith('Erro')

  return (
    <main style={{ minHeight: '100%', padding: 20, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Dropzone */}
      <div
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); if (!arrastando) setArrastando(true) }}
        onDragLeave={() => setArrastando(false)}
        onDropCapture={() => setArrastando(false)}
        onClick={() => inputRef.current?.click()}
        style={{
          display: 'flex', alignItems: 'center', gap: 18, padding: '22px 24px', borderRadius: 18,
          border: `1.5px dashed ${arrastando ? tokens.brand.primary : tokens.brand.primaryAccentSoft}`,
          background: arrastando || hoverDrop ? '#F8F6FF' : '#FCFBFF', cursor: 'pointer', flexWrap: 'wrap',
          transition: 'background .15s, border-color .15s',
        }}
        onMouseEnter={() => setHoverDrop(true)}
        onMouseLeave={() => setHoverDrop(false)}
      >
        <IconTile icon={FileUp} size={52} iconSize={24} radius={16} />
        <span style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: tokens.text.primary }}>
            {imagem ? 'Arraste outro exame aqui ou selecione um novo arquivo' : 'Arraste o exame aqui ou selecione um arquivo'}
          </span>
          <span style={{ fontSize: 12.5, color: tokens.text.quaternary }}>JPG, PNG ou PDF até 10 MB · a leitura leva poucos segundos</span>
        </span>
        <Button icon={Upload} onClick={e => { e.stopPropagation(); inputRef.current?.click() }}>
          {imagem ? 'Trocar arquivo' : 'Selecionar arquivo'}
        </Button>
      </div>
      <input ref={inputRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleImagem(f); e.target.value = '' }}/>

      <div className="exames-grid">
        {/* COLUNA ESQUERDA — arquivo + contexto + botão */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: tokens.text.secondary, padding: '0 4px' }}>Exame selecionado</span>

          {imagem ? (
            <div style={{ border: `1px solid ${tokens.brand.primary}`, background: tokens.brand.primarySoftBg, borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12 }}>
                <span style={{ width: 38, height: 38, borderRadius: 12, background: tokens.bg.page, color: tokens.text.secondary, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <Icon icon={ehPdf ? FileText : ImageIcon} size={17} />
                </span>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: tokens.text.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{imagem.name}</span>
                  <span style={{ fontSize: 12, color: tokens.text.quaternary }}>{ehPdf ? 'PDF' : 'Imagem'} · {tamanhoArquivo}</span>
                </span>
                <Badge tone={statusArquivo.tone}>{statusArquivo.label}</Badge>
                <IconButton icon={X} size={30} aria-label="Remover exame" title="Remover exame"
                  onClick={() => { setImagem(null); setPreview(null); setAnalise(null) }} />
              </div>
              {preview && !ehPdf && (
                <div style={{ borderTop: `1px solid ${tokens.border.muted}`, background: '#fff', padding: 8 }}>
                  <img src={preview} alt="Exame" style={{ width: '100%', maxHeight: 260, objectFit: 'contain', display: 'block', borderRadius: 8 }}/>
                </div>
              )}
            </div>
          ) : (
            <div style={{ border: `1px solid ${tokens.border.default}`, borderRadius: 14, padding: '18px 14px', fontSize: 12.5, color: tokens.text.quaternary, textAlign: 'center', lineHeight: 1.5 }}>
              Nenhum arquivo selecionado ainda.
            </div>
          )}

          <Field label="Contexto clínico (opcional)" hint="Quanto mais contexto, melhor a análise. A IA usa para comparar valores com o histórico do paciente.">
            <Textarea
              value={contexto}
              onChange={e => setContexto(e.target.value)}
              placeholder="Ex.: paciente com diabetes e hipertensão, 58 anos, em acompanhamento por dislipidemia…"
              style={{ minHeight: 96, fontSize: 13 }}
            />
          </Field>

          {erro && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: tokens.status.dangerBg, borderRadius: 12, padding: '10px 12px', fontSize: 13, color: tokens.status.danger, fontWeight: 500, lineHeight: 1.45 }}>
              <Icon icon={AlertTriangle} size={15} style={{ marginTop: 1, flexShrink: 0 }} />
              {erro}
            </div>
          )}

          <Button block size="lg" icon={analisando ? undefined : ScanSearch} onClick={handleAnalisar} disabled={!imagem || analisando}>
            {analisando ? (<><span className="exames-spin" />Analisando exame com IA…</>) : 'Analisar exame'}
          </Button>
        </div>

        {/* COLUNA DIREITA — resultado */}
        <div style={{ border: `1px solid ${tokens.border.default}`, borderRadius: 16, minWidth: 0 }}>
          {analisando ? (
            <div style={{ padding: '48px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
              <IconTile icon={ScanSearch} size={52} iconSize={22} radius={16} active />
              <span style={{ fontSize: 15, fontWeight: 700, color: tokens.text.primary }}>Lendo o exame…</span>
              <span style={{ fontSize: 12.5, color: tokens.text.quaternary }}>{loadingMsg}</span>
              <span style={{ fontSize: 12, color: tokens.text.tertiary, maxWidth: 380, lineHeight: 1.5 }}>
                Pode levar até 30 segundos. Estamos identificando a especialidade, comparando valores com referências e consultando diretrizes médicas.
              </span>
            </div>
          ) : !analise ? (
            <EmptyState
              icon={ScanSearch}
              titulo="Nenhum exame analisado"
              descricao="Envie um exame ou laudo e clique em “Analisar exame”. A leitura organizada aparece aqui."
            />
          ) : (
            <>
              {/* Cabeçalho do resultado */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '18px 20px', borderBottom: `1px solid ${tokens.border.muted}`, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-.01em', color: tokens.text.primary }}>{tituloExame}</span>
                  <span style={{ fontSize: 12.5, color: tokens.text.quaternary }}>
                    {[imagem?.name, analise.data_exame ? 'Data do exame: ' + analise.data_exame : null, 'Analisado pela IA'].filter(Boolean).join(' · ')}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Button variant="secondary" icon={FileDown} onClick={exportarPDF}>Exportar PDF</Button>
                  <Button icon={Paperclip} onClick={abrirModalPaciente}>Adicionar ao prontuário</Button>
                </div>
              </div>

              <div style={{ padding: '18px 20px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                {salvouMsg && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 12, fontSize: 13, fontWeight: 600,
                    background: salvouErro ? tokens.status.dangerBg : tokens.status.successBg,
                    color: salvouErro ? tokens.status.danger : tokens.status.success,
                  }}>
                    <Icon icon={salvouErro ? AlertTriangle : Check} size={15} />
                    {salvouMsg}
                  </div>
                )}

                {/* Resumo IA */}
                {analise.resumo && (
                  <div style={{ display: 'flex', gap: 12, padding: '14px 16px', borderRadius: 14, background: tokens.brand.primarySoftBg, border: '1px solid #ECE8FB' }}>
                    <Icon icon={Sparkles} size={17} color={tokens.brand.primary} style={{ marginTop: 2, flexShrink: 0 }} />
                    <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: tokens.text.strong, textWrap: 'pretty' } as React.CSSProperties}>{analise.resumo}</p>
                  </div>
                )}

                {/* Tabela de parâmetros */}
                {analise.valores?.length > 0 && (
                  <div style={{ border: `1px solid ${tokens.border.default}`, borderRadius: 14, overflow: 'auto' }}>
                    <div style={{ minWidth: 560 }}>
                      <div style={{ ...gridTabela, padding: '10px 14px', background: tokens.bg.muted, fontSize: 11, fontWeight: 700, letterSpacing: '.05em', color: '#9A98A5' }}>
                        <span>PARÂMETRO</span><span>RESULTADO</span><span>REFERÊNCIA</span><span>STATUS</span>
                      </div>
                      {analise.valores.map((v: any, i: number) => {
                        const st = statusParam(v.status)
                        return (
                          <div key={i} style={{ ...gridTabela, alignItems: 'start', padding: '11px 14px', borderTop: `1px solid ${tokens.border.muted}`, fontSize: 13 }}>
                            <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                              <span style={{ fontWeight: 600, color: tokens.text.primary }}>{v.nome}</span>
                              {v.interpretacao && <span style={{ fontSize: 12, color: tokens.text.quaternary, lineHeight: 1.45 }}>{v.interpretacao}</span>}
                            </span>
                            <span className="mono" style={{ fontSize: 12.5, fontWeight: 500, color: st.cor, wordBreak: 'break-word' }}>{v.valor}</span>
                            <span style={{ color: tokens.text.quaternary, fontSize: 12.5, wordBreak: 'break-word' }}>{v.referencia}</span>
                            <span><Badge tone={st.tone}>{st.label}</Badge></span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Pontos de atenção (alertas da IA) */}
                {analise.alertas?.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.05em', color: '#9A98A5' }}>PONTOS DE ATENÇÃO</span>
                    {analise.alertas.map((a: string, i: number) => (
                      <div key={i} style={{ display: 'flex', gap: 10, fontSize: 13, lineHeight: 1.5, color: tokens.text.strong }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: tokens.status.dangerStrong, marginTop: 7, flexShrink: 0 }} />
                        {a}
                      </div>
                    ))}
                  </div>
                )}

                {/* Conclusão clínica */}
                {analise.conclusao && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.05em', color: '#9A98A5' }}>CONCLUSÃO CLÍNICA</span>
                    <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65, color: tokens.text.strong, whiteSpace: 'pre-wrap' }}>{analise.conclusao}</p>
                  </div>
                )}

                {/* Recomendações */}
                {analise.recomendacoes?.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.05em', color: '#9A98A5' }}>RECOMENDAÇÕES</span>
                    {analise.recomendacoes.map((r: string, i: number) => (
                      <div key={i} style={{ display: 'flex', gap: 10, fontSize: 13, lineHeight: 1.5, color: tokens.text.strong }}>
                        <span style={{ width: 18, height: 18, borderRadius: 6, background: tokens.brand.primaryLight, color: tokens.brand.primary, display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 1 }}>
                          <Icon icon={Check} size={12} strokeWidth={2} />
                        </span>
                        {r}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal: escolher paciente para adicionar análise ao prontuário */}
      {modalPaciente && (
        <Modal
          titulo="Adicionar ao prontuário"
          largura={440}
          onClose={() => setModalPaciente(false)}
          rodape={pacientesList.length > 0 ? (
            <>
              <Button variant="secondary" onClick={() => setModalPaciente(false)}>Cancelar</Button>
              <Button icon={salvandoConsulta ? undefined : Save} onClick={adicionarAoPaciente} disabled={salvandoConsulta || !pacienteSelecionadoId}>
                {salvandoConsulta ? (<><span className="exames-spin" />Salvando…</>) : 'Salvar no histórico'}
              </Button>
            </>
          ) : undefined}
        >
          <p style={{ fontSize: 12.5, color: tokens.text.quaternary, margin: '0 0 14px' }}>A análise será adicionada ao histórico do paciente.</p>
          {pacientesList.length === 0 ? (
            <EmptyState icon={Users} titulo="Nenhum paciente cadastrado" />
          ) : (
            <Field label="Paciente">
              <Select value={pacienteSelecionadoId} onChange={e => setPacienteSelecionadoId(e.target.value)}>
                <option value="">Selecionar paciente…</option>
                {pacientesList.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </Select>
            </Field>
          )}
        </Modal>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .exames-grid { display: grid; grid-template-columns: 320px minmax(0, 1fr); gap: 20px; align-items: start; }
        @media (max-width: 900px) { .exames-grid { grid-template-columns: minmax(0, 1fr); } }
        .exames-spin { width: 14px; height: 14px; border-radius: 50%; border: 2px solid rgba(255,255,255,.35); border-top-color: #fff; animation: exames-spin .8s linear infinite; display: inline-block; }
        @keyframes exames-spin { to { transform: rotate(360deg) } }
      ` }} />
    </main>
  )
}

const gridTabela: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1.6fr 1fr 1.2fr 96px', gap: 12 }
