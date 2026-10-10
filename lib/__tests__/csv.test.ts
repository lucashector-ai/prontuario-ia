import { describe, expect, it } from 'vitest'
import { parsearCSV } from '../csv'

describe('parsearCSV', () => {
  it('lê ponto e vírgula do Excel com BOM e campo entre aspas contendo vírgula e ponto e vírgula', () => {
    const t = '﻿nome;doencas;cidade\r\nJoão Silva;"Hipertensão, Diabetes; asma";São Paulo\r\nMaria;;Campinas\r\n'
    expect(parsearCSV(t)).toEqual([
      { nome: 'João Silva', doencas: 'Hipertensão, Diabetes; asma', cidade: 'São Paulo' },
      { nome: 'Maria', doencas: '', cidade: 'Campinas' },
    ])
  })

  it('lê vírgula, aspas escapadas e quebra de linha dentro do campo', () => {
    const t = 'nome,obs\n"Ana ""Aninha"" Souza","linha 1\nlinha 2"\n'
    expect(parsearCSV(t)).toEqual([{ nome: 'Ana "Aninha" Souza', obs: 'linha 1\nlinha 2' }])
  })

  it('ignora linhas vazias e precisa de cabeçalho + dados', () => {
    expect(parsearCSV('nome\n\n\n')).toEqual([])
    expect(parsearCSV('nome\nCarlos\n\n')).toEqual([{ nome: 'Carlos' }])
  })
})
