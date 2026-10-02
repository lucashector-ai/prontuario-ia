import type { RegistroAuditoria, AcaoAuditoria, RecursoAuditoria, TipoUsuarioAuditoria } from '@/lib/auditoria'
import { ROTULO_ACAO, ROTULO_RECURSO, ROTULO_USUARIO } from '@/lib/auditoria'
import type { BadgeTone } from '@/components/ui'

export type FiltrosAuditoria = {
  clinicaId?: string | null
  medicoId?: string | null
  pacienteId?: string | null
  usuarioId?: string | null
  usuarioTipo?: string
  acao?: string
  recurso?: string
  de?: string
  ate?: string
}

export type RespostaAuditoria = {
  registros: RegistroAuditoria[]
  total: number
  tabela_ausente?: boolean
  error?: string
}

export async function buscarAuditoria(f: FiltrosAuditoria, pagina = 1, porPagina = 50): Promise<RespostaAuditoria> {
  const p = new URLSearchParams()
  if (f.clinicaId) p.set('clinica_id', f.clinicaId)
  if (f.medicoId) p.set('medico_id', f.medicoId)
  if (f.pacienteId) p.set('paciente_id', f.pacienteId)
  if (f.usuarioId) p.set('usuario_id', f.usuarioId)
  if (f.usuarioTipo) p.set('usuario_tipo', f.usuarioTipo)
  if (f.acao) p.set('acao', f.acao)
  if (f.recurso) p.set('recurso', f.recurso)
  if (f.de) p.set('de', f.de)
  if (f.ate) p.set('ate', f.ate)
  p.set('pagina', String(pagina))
  p.set('por_pagina', String(porPagina))
  const r = await fetch('/api/auditoria?' + p.toString())
  const d = await r.json().catch(() => ({}))
  if (!r.ok) return { registros: [], total: 0, error: d.error || 'Falha ao carregar' }
  return { registros: d.registros || [], total: d.total || 0, tabela_ausente: !!d.tabela_ausente }
}

export const TOM_ACAO: Record<AcaoAuditoria, BadgeTone> = {
  visualizou: 'neutral', editou: 'info', exportou: 'accent', imprimiu: 'accent', excluiu: 'danger',
}

/** "visualizou o prontuário" — frase curta para listas. */
export function fraseAcesso(r: Pick<RegistroAuditoria, 'acao' | 'recurso'>): string {
  const obj: Record<RecursoAuditoria, string> = {
    paciente: 'a ficha', consulta: 'uma consulta', prontuario: 'o prontuário', exame: 'um exame', conversa: 'a conversa',
  }
  return `${ROTULO_ACAO[r.acao]?.toLowerCase() || r.acao} ${obj[r.recurso] || r.recurso}`
}

export function fmtDataHora(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function fmtRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.round(diff / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `há ${h} h`
  const dias = Math.round(h / 24)
  if (dias < 7) return dias === 1 ? 'ontem' : `há ${dias} dias`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

/** Navegador/sistema legível a partir do user-agent. */
export function resumoUA(ua: string | null): string {
  if (!ua) return ''
  const nav = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Navegador'
  const so = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : ''
  return so ? `${nav} · ${so}` : nav
}

export function gerarCSV(registros: RegistroAuditoria[]): string {
  const esc = (v: any) => {
    const s = v == null ? '' : String(v)
    return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const cab = ['Data/hora', 'Usuário', 'Perfil', 'Ação', 'Recurso', 'ID do recurso', 'Paciente', 'ID do paciente', 'IP', 'Navegador', 'Detalhes']
  const linhas = registros.map(r => [
    fmtDataHora(r.criado_em), r.usuario_nome, ROTULO_USUARIO[r.usuario_tipo] || r.usuario_tipo,
    ROTULO_ACAO[r.acao] || r.acao, ROTULO_RECURSO[r.recurso] || r.recurso, r.recurso_id,
    r.paciente_nome, r.paciente_id, r.ip, r.user_agent,
    r.detalhes && Object.keys(r.detalhes).length ? JSON.stringify(r.detalhes) : '',
  ].map(esc).join(';'))
  // BOM + ";" para abrir certo no Excel em pt-BR
  return '﻿' + [cab.join(';'), ...linhas].join('\r\n')
}

export function baixarArquivo(conteudo: string, nome: string, tipo = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }))
  const a = document.createElement('a')
  a.href = url; a.download = nome
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ── Dados de demonstração (?demo=1) ─────────────────────────────────────────
export function dadosDemoAuditoria(pacienteId?: string | null): RegistroAuditoria[] {
  const usuarios: { nome: string; tipo: TipoUsuarioAuditoria; ip: string; ua: string }[] = [
    { nome: 'Dra. Mariana Costa', tipo: 'medico', ip: '189.45.12.201', ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15' },
    { nome: 'Dr. Rafael Almeida', tipo: 'medico', ip: '177.92.33.18', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36' },
    { nome: 'Juliana Ferreira', tipo: 'recepcionista', ip: '189.45.12.207', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36' },
    { nome: 'Carlos Menezes', tipo: 'admin', ip: '200.150.7.44', ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile Safari/604.1' },
    { nome: 'Patrícia Lima', tipo: 'atendente', ip: '187.11.90.3', ua: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36' },
  ]
  const pacientes = [
    { id: pacienteId || 'demo-pac-1', nome: 'Ana Beatriz Souza' },
    { id: 'demo-pac-2', nome: 'João Pedro Martins' },
    { id: 'demo-pac-3', nome: 'Luiza Ribeiro' },
    { id: 'demo-pac-4', nome: 'Marcos Oliveira' },
    { id: 'demo-pac-5', nome: 'Fernanda Carvalho' },
  ]
  const eventos: [number, number, AcaoAuditoria, RecursoAuditoria, number, Record<string, any>?][] = [
    // [usuário, minutos atrás, ação, recurso, paciente, detalhes]
    [0, 4, 'visualizou', 'paciente', 0],
    [0, 6, 'visualizou', 'prontuario', 0, { consulta: 'Consulta de 12/09' }],
    [0, 9, 'exportou', 'prontuario', 0, { formato: 'PDF' }],
    [2, 38, 'visualizou', 'paciente', 1],
    [2, 41, 'editou', 'paciente', 1, { campos: ['telefone', 'convenio'] }],
    [1, 95, 'visualizou', 'prontuario', 2],
    [1, 120, 'imprimiu', 'prontuario', 2, { documento: 'Atestado' }],
    [4, 180, 'visualizou', 'conversa', 3],
    [3, 60 * 5, 'visualizou', 'paciente', 0],
    [0, 60 * 26, 'editou', 'consulta', 0, { secoes: ['avaliacao', 'plano'] }],
    [1, 60 * 28, 'visualizou', 'exame', 4, { exame: 'Hemograma completo' }],
    [2, 60 * 30, 'visualizou', 'paciente', 4],
    [0, 60 * 50, 'visualizou', 'prontuario', 3],
    [3, 60 * 72, 'exportou', 'paciente', 1, { formato: 'CSV' }],
    [1, 60 * 75, 'excluiu', 'consulta', 2, { motivo: 'Registro duplicado' }],
    [0, 60 * 120, 'visualizou', 'paciente', 0],
    [2, 60 * 140, 'visualizou', 'paciente', 2],
    [4, 60 * 160, 'visualizou', 'conversa', 0],
  ]
  return eventos.map(([u, min, acao, recurso, p, detalhes], i) => {
    const us = usuarios[u]; const pac = pacientes[p]
    return {
      id: 'demo-' + i, clinica_id: null, medico_id: null, usuario_id: 'demo-u-' + u,
      usuario_nome: us.nome, usuario_tipo: us.tipo, acao, recurso,
      recurso_id: recurso === 'paciente' ? pac.id : 'demo-rec-' + i,
      paciente_id: pac.id, paciente_nome: pac.nome, detalhes: detalhes || {},
      ip: us.ip, user_agent: us.ua, criado_em: new Date(Date.now() - min * 60000).toISOString(),
    }
  })
}
