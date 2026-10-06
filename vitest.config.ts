import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // mesmo atalho do tsconfig: '@/lib/...' aponta para a raiz do projeto
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  test: {
    // testa apenas o código-fonte do app, ignorando worktrees e dependências
    include: ['lib/**/*.test.ts', 'app/**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**', '.claude/**'],
  },
})
