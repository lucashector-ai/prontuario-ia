# Clinical 360 — Contexto persistente

## Identidade
- Produto: Clinical 360 (prontuário eletrônico com IA pra clínicas brasileiras)
- Produção: clinical360.vercel.app
- Fundador: Lucas Hector (1lucashector@gmail.com)
- Empresa: Clinical Lab Ltda, CNPJ 47.206.210/0001-02
- Estética alvo: Stripe + Linear + Apple + Nubank
- NÃO copiar ERPs hospitalares (Feegow, iClinic). Profundidade premium > volume de features.

## Stack
- Next.js 14 (App Router), TypeScript, Tailwind 3.4 (utilities raras — padrão é inline-style com tokens)
- Supabase (us-east-1) — singleton em `lib/supabase.ts`
- Vercel deploy automático
- Anthropic Claude API (IA)
- Memed (prescrição) — exige CPF + nascimento do prescritor
- Deepgram (transcrição)

## Schema do banco
Tabelas existentes em produção (não quebrar):
- `clinicas`, `clinica_admins`, `medicos`, `pacientes`
- `agendamentos`, `consultas`, `prescricoes`
- `comandas`, `comanda_itens`, `financeiro_*`
- `notificacoes_admin`, `notificacoes_medico`
- `sofia_config`, `sofia_relatorios_log`

Tabelas novas do v2 (Sprints 2-5) entram **no mesmo schema sem prefixo** — decisão tomada em 2026-05-12: merge final junta tudo, prefixar agora seria churn.

RLS está DESLIGADO em `financeiro_*`, `prescricoes`, `comandas`, `comanda_itens`. Tratar com cuidado.

**Singleton Supabase**: usar `import { supabase } from '@/lib/supabase'`. NUNCA chamar `createClient` direto em componente client.

## Padrões de código
- Componentes UI primitives em `components/ui/` (Button, Input, Card, Tabs, Badge, Modal, Sheet, Skeleton)
- Utilities de animação em `components/motion/` (FadeIn, SlideIn) — usam framer-motion
- Design tokens em `lib/design-tokens.ts` — fonte única da verdade pra cores/raios/sombras
- Estilo: **inline-style com tokens**, não classes Tailwind (`tokens.bg.card`, `tokens.brand.primary`, etc)
- Server components por default; `'use client'` só onde precisa
- Estado em `useState`/`useReducer`. Sem `localStorage` em blocos sensíveis.
- `npm run build` SEMPRE antes de commit
- Commits semânticos: `feat:`, `fix:`, `refactor:`, `style:`, `docs:`

## Princípios de design
- Mobile-first sempre
- Sem emoji em UI funcional — SVG inline ou Lucide
- Tipografia grande (h1 32-40px), muita respiração
- Border-radius generoso (16-24px em cards, `tokens.radius.3xl`)
- Esconder IDs/timestamps brutos do usuário
- Skeleton shimmer pra loading — nunca spinner em produção
- Animações sutis (140-240ms, easing `[0.16, 1, 0.3, 1]`)

## Acessibilidade
- ARIA labels obrigatórios em ícones-botão
- Keyboard nav em modais/sheets (ESC fecha)
- Contraste WCAG AA mínimo

## Performance
- `next/image` pra imagens
- Lazy loading em sections pesadas
- API routes com cache quando aplicável

## Estrutura de rotas
- `/` — landing pública
- `/dashboard`, `/agenda`, `/pacientes`, etc — app autenticado (médico/admin)
- `/portal/*` — Portal do Paciente premium (Sprint 2+) — público, magic-link
- `/design-system` — showcase dos primitives (público, dev)
- `/api/*` — server routes

## Trabalho em sprints
- Sprint 1: Foundation (concluído — UI primitives, motion utils, portal shell, design system page)
- Sprint 2: Portal do Paciente Premium
- Sprint 3: Financeiro Premium
- Sprint 4: Estoque + Procedimentos
- Sprint 5: CRM Médico
- Sprint 6: Integração + merge plan

Cada sprint: `npm run build` passa, commit semântico, atualizar `BACKLOG.md`, criar `SPRINT-X-REPORT.md`.
