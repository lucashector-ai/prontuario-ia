import { test, expect } from '@playwright/test'

/**
 * Smoke tests dos 5 pilares novos do v2. Verifica apenas:
 * - Página carrega (200 ou 308 ok)
 * - Heading principal aparece
 * - Sem erros 500 / crash
 *
 * Rodar com:
 *   npm run dev (outro terminal)
 *   npx playwright test tests/smoke/v2-rotas.spec.ts
 */

test.describe('design-system', () => {
  test('showcase carrega e tabs renderizam', async ({ page }) => {
    await page.goto('/design-system')
    await expect(page.getByRole('heading', { name: /Design System/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /Botões/i })).toBeVisible()
    await page.getByRole('tab', { name: /Overlays/i }).click()
    await expect(page.getByRole('button', { name: /Abrir Modal/i })).toBeVisible()
  })
})

test.describe('portal (sem auth)', () => {
  test('login carrega e mostra campo de email', async ({ page }) => {
    await page.goto('/portal')
    // sem sessão → redireciona pra /portal/login
    await page.waitForURL('**/portal/login**', { timeout: 5_000 })
    await expect(page.getByRole('heading', { name: /Portal do paciente/i })).toBeVisible()
    await expect(page.getByLabel(/Email/i)).toBeVisible()
  })
})

test.describe('financeiro-premium (autenticado)', () => {
  test('redireciona pra login se não autenticado, ou mostra título', async ({ page }) => {
    const res = await page.goto('/financeiro-premium')
    // Aceita 200 com SubNav OU redirect pra login
    expect(res?.status()).toBeLessThan(500)
  })
})

test.describe('estoque', () => {
  test('rota não dá 500', async ({ page }) => {
    const res = await page.goto('/estoque')
    expect(res?.status()).toBeLessThan(500)
  })
})

test.describe('crm', () => {
  test('rota não dá 500', async ({ page }) => {
    const res = await page.goto('/crm')
    expect(res?.status()).toBeLessThan(500)
  })
})

test.describe('forms público', () => {
  test('slug inexistente mostra mensagem amigável', async ({ page }) => {
    await page.goto('/forms/__inexistente__')
    await expect(page.getByText(/Formulário não encontrado/i)).toBeVisible()
  })
})
