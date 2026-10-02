import { describe, it, expect, beforeAll } from 'vitest'
import { createHmac } from 'node:crypto'
import { assinarToken, verificarToken, lerToken } from '../token'

const SEGREDO = 'segredo-de-teste-com-tamanho-suficiente-123456'
beforeAll(() => { process.env.SUPABASE_JWT_SECRET = SEGREDO })

const claims = { sub: 'u1', tipo: 'clinica' as const, clinica_id: 'c1', medico_id: null }

describe('token de sessão', () => {
  it('assina e verifica', async () => {
    const t = await assinarToken(claims)
    const v = await verificarToken(t)
    expect(v?.clinica_id).toBe('c1')
    expect(v?.role).toBe('authenticated')
  })

  it('assinatura bate com HS256 padrão (o Supabase aceita)', async () => {
    const t = await assinarToken(claims)
    const [h, p, s] = t.split('.')
    const esperado = createHmac('sha256', SEGREDO).update(`${h}.${p}`).digest('base64url')
    expect(s).toBe(esperado)
  })

  it('rejeita token adulterado', async () => {
    const t = await assinarToken(claims)
    const [h, , s] = t.split('.')
    const falso = Buffer.from(JSON.stringify({ ...lerToken(t), clinica_id: 'outra' })).toString('base64url')
    expect(await verificarToken(`${h}.${falso}.${s}`)).toBeNull()
  })

  it('rejeita token vencido', async () => {
    const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
    const p = Buffer.from(JSON.stringify({ ...claims, iss: 'clinical360', exp: 1 })).toString('base64url')
    const s = createHmac('sha256', SEGREDO).update(`${h}.${p}`).digest('base64url')
    expect(await verificarToken(`${h}.${p}.${s}`)).toBeNull()
  })
})
