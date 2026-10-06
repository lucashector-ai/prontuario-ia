import { describe, expect, it } from 'vitest'
import { ehMensagemDeChegada, fraseChamada, nomeNoPainel, ordenarFila, prefixoSenha, prioridadePelaIdade } from '../atendimento/comum'

describe('fila de atendimento', () => {
  it('ordena 80+ → prioritários → doador → demais, e pela hora agendada dentro do grupo', () => {
    const a = (id: string, prioridade: any, h: string) => ({ id, prioridade, horario_previsto: `2026-10-06T${h}:00Z`, chegada_em: '2026-10-06T07:00:00Z' })
    const fila = ordenarFila([a('n2', 'normal', '11:00'), a('n1', 'normal', '08:00'), a('d', 'doador', '07:00'), a('p', 'prioritario', '09:00'), a('80', 'prioritario_80', '10:00')])
    expect(fila.map(x => x.id)).toEqual(['80', 'p', 'd', 'n1', 'n2'])
  })

  it('encaixe (sem horário) entra pela hora de chegada', () => {
    const fila = ordenarFila([
      { id: 'ag', prioridade: 'normal' as const, horario_previsto: '2026-10-06T13:00:00Z', chegada_em: '2026-10-06T12:00:00Z' },
      { id: 'enc', prioridade: 'normal' as const, horario_previsto: null, chegada_em: '2026-10-06T12:30:00Z' },
    ])
    expect(fila.map(x => x.id)).toEqual(['enc', 'ag'])
  })

  it('sugere prioridade pela idade', () => {
    const hoje = new Date('2026-10-06T12:00:00')
    expect(prioridadePelaIdade('1990-01-01', hoje)).toBe('normal')
    expect(prioridadePelaIdade('1966-10-06', hoje)).toBe('prioritario')      // faz 60 hoje
    expect(prioridadePelaIdade('1966-10-07', hoje)).toBe('normal')           // 60 amanhã
    expect(prioridadePelaIdade('1940-05-01', hoje)).toBe('prioritario_80')
    expect(prioridadePelaIdade(null, hoje)).toBe('normal')
    expect(prefixoSenha('normal')).toBe('A')
    expect(prefixoSenha('doador')).toBe('P')
  })

  it('nome no painel respeita a escolha da clínica (LGPD)', () => {
    expect(nomeNoPainel('Maria Aparecida da Silva', 'senha_nome')).toBe('Maria S.')
    expect(nomeNoPainel('Maria Aparecida da Silva', 'senha')).toBeNull()
    expect(nomeNoPainel('Maria Aparecida da Silva', 'nome_completo')).toBe('Maria Aparecida da Silva')
    expect(nomeNoPainel('Cher', 'senha_nome')).toBe('Cher')
  })

  it('frase da TV sem zeros à esquerda', () => {
    expect(fraseChamada({ senha: 'A007', nome_exibicao: 'Maria S.', local: 'Consultório 3' })).toBe('Senha A 7, Maria S. Consultório 3.')
    expect(fraseChamada({ senha: 'P012', nome_exibicao: null, local: 'Sala 2' })).toBe('Senha P 12. Sala 2.')
  })

  it('reconhece mensagem de chegada no WhatsApp', () => {
    for (const t of ['Cheguei', 'cheguei!', 'Bom dia, cheguei', 'já estou aqui', 'Tô aqui', 'acabei de chegar', 'oi cheguei']) expect(ehMensagemDeChegada(t), t).toBe(true)
    for (const t of ['quando eu chego?', 'cheguei a pensar em remarcar minha consulta de amanhã porque não vou conseguir ir', 'qual o endereço', 'não cheguei ainda']) expect(ehMensagemDeChegada(t), t).toBe(false)
  })
})
