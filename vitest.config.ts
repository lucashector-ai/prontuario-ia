import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // testa apenas o código-fonte do app, ignorando worktrees e dependências
    include: ['lib/**/*.test.ts', 'app/**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**', '.claude/**'],
  },
})
