# Clinical 360

Plataforma de prontuário eletrônico com IA para clínicas brasileiras.
Estética alvo: Stripe + Linear + Apple + Nubank.

Produção: [clinical360.vercel.app](https://clinical360.vercel.app)

## Stack

- **Next.js 14** (App Router) + TypeScript
- **Tailwind 3.4** (utilities raras; padrão é inline-style com `tokens`)
- **Supabase** (PostgreSQL + Auth + Realtime) — `us-east-1`
- **Anthropic Claude API** — IA contextual (explicação de exames, Sofia)
- **Memed** — prescrição médica (CPF + nascimento obrigatórios)
- **Deepgram** — transcrição de áudio
- **Framer Motion** — animações premium

## Estrutura

```
app/
├── (rotas legadas: dashboard, agenda, pacientes, prontuario, etc)
├── design-system/         # showcase dos UI primitives (rota pública)
├── portal/                # Portal do Paciente (10 páginas) — Sprint 2
├── financeiro-premium/    # Financeiro 2.0 (7 sub-rotas)   — Sprint 3
├── estoque/               # Estoque + lotes + procedimentos — Sprint 4
├── crm/                   # Funil + campanhas + score      — Sprint 5
├── forms/[slug]/          # Lead capture embedável         — Sprint 5
└── api/portal/            # Auth + IA do portal

components/
├── ui/                    # 8 primitives (Button, Input, Card, Tabs, Badge, Modal, Sheet, Skeleton)
├── motion/                # FadeIn, SlideIn (framer-motion)
├── AppShell.tsx           # sidebar/topbar/bottom-nav do app autenticado
└── (Sidebar, Topbar, BottomNav, Toast etc do legado)

lib/
├── supabase.ts            # singleton — sempre usar este import
├── design-tokens.ts       # cores/raios/sombras (fonte única)
├── portal/                # types + queries + session do Portal
├── financeiro/            # types + queries (KPIs, fluxo, comissões)
├── estoque/               # types + queries + registrarProcedimentoRealizado()
└── crm/                   # types + queries + score + submeterForm()

supabase/migrations/       # SQL pra aplicar no Studio (4 arquivos)
```

## Setup local

```bash
git clone https://github.com/lucashector-ai/prontuario-ia.git
cd prontuario-ia
npm install

# .env.local com chaves reais — Supabase obrigatório, resto opcional
cp .env.local.example .env.local  # se houver; senão criar manualmente

npm run dev
# http://localhost:3000
```

Sem chaves reais, o build **passa** com placeholders mas o app renderiza empty states em todas as queries.

### Variáveis essenciais

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...      # /api/portal/* precisa
```

Opcionais (cada feature degrada gracefully sem elas):
- `ANTHROPIC_API_KEY` — IA explicando exames
- `DEEPGRAM_API_KEY` — transcrição
- `MEMED_*` — prescrição
- `RESEND_*` — email
- `WHATSAPP_*` — integração com WhatsApp Business

## Migrations Supabase

Após clonar, antes de testar as features do v2, aplica as 4 migrations em ordem no SQL Editor do Supabase Studio:

1. [`001_portal_paciente.sql`](supabase/migrations/001_portal_paciente.sql)
2. [`002_financeiro_premium.sql`](supabase/migrations/002_financeiro_premium.sql)
3. [`003_estoque.sql`](supabase/migrations/003_estoque.sql)
4. [`004_crm.sql`](supabase/migrations/004_crm.sql)

Todas usam `create table if not exists`, então rodar de novo é seguro.

## Scripts

```bash
npm run dev      # dev server
npm run build    # production build (valida tudo)
npm run start    # serve o build de produção
```

## Padrões de código

- **Componentes UI**: inline-style + `tokens` from `@/lib/design-tokens`. Tailwind utilities apenas em casos legados.
- **Server components por default**; `'use client'` só onde precisa.
- **Estado em React** (`useState`/`useReducer`). Sem `localStorage` em blocos sensíveis (exceto session do portal).
- **Mobile-first** sempre.
- **Sem emoji em UI** funcional (use Lucide ou SVG inline).
- **Skeleton shimmer** para loading; spinner só em ações imediatas (ex: botão).
- **`npm run build`** SEMPRE antes de commit.
- **Commits semânticos**: `feat(scope):`, `fix(scope):`, etc.

## Trabalho em sprints (v2)

| Sprint | Tema | Status | Report |
| ------ | ---- | ------ | ------ |
| 1 | Design system + motion + portal shell | ✅ | [SPRINT-1-REPORT.md](SPRINT-1-REPORT.md) |
| 2 | Portal do Paciente (10 páginas) | ✅ | [SPRINT-2-REPORT.md](SPRINT-2-REPORT.md) |
| 3 | Financeiro Premium (7 sub-rotas + chart custom) | ✅ | [SPRINT-3-REPORT.md](SPRINT-3-REPORT.md) |
| 4 | Estoque + lotes ANVISA + procedimentos | ✅ | [SPRINT-4-REPORT.md](SPRINT-4-REPORT.md) |
| 5 | CRM com kanban + campanhas + forms embed | ✅ | [SPRINT-5-REPORT.md](SPRINT-5-REPORT.md) |
| 6 | Integração + merge plan | ✅ | [MERGE-PLAN.md](MERGE-PLAN.md) · [FINAL-REPORT.md](FINAL-REPORT.md) |

## Como mergear de volta na main

Ver [MERGE-PLAN.md](MERGE-PLAN.md) — passo a passo de 1-2h.

## Documentação adicional

- [CLAUDE.md](CLAUDE.md) — contexto persistente pra agentes Claude Code
- [BACKLOG.md](BACKLOG.md) — checklist completo por sprint
- [MERGE-PLAN.md](MERGE-PLAN.md) — plano de absorção no main
- [FINAL-REPORT.md](FINAL-REPORT.md) — relatório executivo

## Licença

Privado · Clinical Lab Ltda · CNPJ 47.206.210/0001-02
