# Clinical 360 v2 — Branch dormindo

**Status:** Trabalho completo, não mergeado. Aguardando demanda real de clientes.
**Branch:** `claude/exciting-hermann-93cb8c` (no GitHub e em worktree local)
**Data:** Maio/2026

## O que tem lá

4 pilares completos (~10.000 linhas, 106 arquivos, 31 rotas novas):
- Portal do Paciente Premium (10 rotas)
- Financeiro Premium (7 rotas)
- Estoque + Procedimentos (5 rotas)
- CRM Médico (4 rotas)
- Foundation: design system completo + Framer Motion

Tudo com build limpo. Migrations SQL prontas em `supabase/migrations/`.

## Por que está pausado

Decisão de Maio/2026: priorizar landing page + aquisição de clientes antes de
ativar funcionalidades novas. Features sem feedback de clientes pagantes são
hipóteses não validadas — melhor ouvir primeiro.

## Como reativar quando fizer sentido

1. Ler `MERGE-PLAN.md` na branch (11 seções, super detalhado)
2. Aplicar 4 migrations SQL no Supabase (15min)
3. Merge da branch no main pelo GitHub
4. Adicionar entradas no Sidebar pras 3 novas seções
5. Decidir: substituir `/financeiro` legado ou manter ambos?
6. Plugar Resend (magic link) e gateway Pix

Estimativa: 4-6h de trabalho focado quando você decidir ativar.

## Caminhos
- Worktree local: `~/Downloads/prontuario-ia/.claude/worktrees/exciting-hermann-93cb8c`
- Remote: `lucashector-ai/prontuario-ia` branch `claude/exciting-hermann-93cb8c`
