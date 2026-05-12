# Clinical 360 v2 — Backlog

Versão premium da plataforma, construída em sprints sequenciais no mesmo repositório (branch `claude/exciting-hermann-93cb8c`).

---

## Sprint 1 — Foundation Premium ✅

- [x] Instalar `framer-motion` e `next-themes`
- [x] Criar UI primitives em `components/ui/`
  - [x] Button (4 variantes, 3 tamanhos, loading, icons)
  - [x] Input (label, hint, error, icons, focus ring)
  - [x] Card (3 variantes, interactive hover)
  - [x] Tabs (estilo Vercel sublinhado)
  - [x] Badge (6 variantes, 2 tamanhos, dot)
  - [x] Modal (backdrop blur, ESC-to-close, body scroll lock)
  - [x] Sheet (bottom sheet mobile)
  - [x] Skeleton + SkeletonText (shimmer animado)
  - [x] Toast (já existia — re-exportado no index)
- [x] Motion utilities (`components/motion/`)
  - [x] FadeIn
  - [x] SlideIn
- [x] Route group `/portal` com layout shell próprio (sidebar desktop + bottom nav mobile)
- [x] Página showcase `/design-system` com tabs pra cada primitive
- [x] Registrar `/portal` e `/design-system` como rotas públicas em `AppShell` e `middleware.ts`
- [x] Build `npm run build` passa
- [x] CLAUDE.md, BACKLOG.md, SPRINT-1-REPORT.md

---

## Sprint 2 — Portal do Paciente Premium ✅

Schema (sem prefixo — merge final): migration em [supabase/migrations/001_portal_paciente.sql](supabase/migrations/001_portal_paciente.sql)
- [x] `pacientes_portal` (auth via magic link)
- [x] `portal_documentos`
- [x] `portal_chat_mensagens` (+ adicionado em `supabase_realtime` publication)
- [x] `portal_protocolos`

Páginas (rota `/portal/*`):
- [x] `/portal` — dashboard com próxima consulta hero + cards de resumo + próximos passos
- [x] `/portal/login` — magic link via Supabase (token 6 dígitos)
- [x] `/portal/timeline` — feed cronológico com timeline rail visual
- [x] `/portal/consultas` + `/portal/consultas/[id]` — lista + detalhe seccionado
- [x] `/portal/exames` + `/portal/exames/[id]` — lista + detalhe com "Explicar pra mim" via Anthropic
- [x] `/portal/receitas` — lista + botões de reenvio (TODO: Memed/WhatsApp wire)
- [x] `/portal/pagamentos` — UI Pix em modal (TODO: gateway de cobrança real)
- [x] `/portal/protocolos` — progresso visual com gradient bar
- [x] `/portal/chat` — bubbles + Supabase Realtime + optimistic send
- [x] `/portal/documentos` — lista filtrável por tipo

Infra:
- [x] `lib/portal/session.ts` — magic-link client + `usePortalSession`
- [x] `lib/portal/queries.ts` — queries defensivas (degradam pra empty)
- [x] `lib/portal/format.ts` — formatadores BR
- [x] API routes: `/api/portal/login`, `/api/portal/verify`, `/api/portal/explicar-exame`
- [x] `PortalGate` — redirect pra `/portal/login` sem sessão
- [x] `PortalShell` atualizado: bottom nav (4 items + "Mais" abre sheet com restante)

---

## Sprint 3 — Financeiro Premium ✅

Schema (migration em [supabase/migrations/002_financeiro_premium.sql](supabase/migrations/002_financeiro_premium.sql)):
- [x] Reuso de `financeiro_movimentacoes` (já existia — não duplicado)
- [x] Reuso de `financeiro_comissoes_config` (já existia)
- [x] `financeiro_pix_cobrancas` (nova)
- [x] `financeiro_planos_recorrentes` (nova — assinatura mensal, diferente de pacotes)

Páginas (`/financeiro-premium/*` — coexiste com `/financeiro` legado):
- [x] [Visão geral](app/financeiro-premium/page.tsx) — 4 KPIs com variação + chart SVG custom + últimas movimentações
- [x] [Movimentações](app/financeiro-premium/movimentacoes/page.tsx) — tabela filtrável (tipo, status, busca)
- [x] [Comissões](app/financeiro-premium/comissoes/page.tsx) — KPIs + ranking de médicos com bar gradient
- [x] [Pix](app/financeiro-premium/pix/page.tsx) — geração mock + lista + modal de detalhe
- [x] [Recorrência](app/financeiro-premium/recorrencia/page.tsx) — planos recorrentes com progress bar
- [x] [DRE simplificada](app/financeiro-premium/dre/page.tsx) — receitas/despesas agrupadas por categoria
- [x] [Exportar](app/financeiro-premium/exportar/page.tsx) — CSV (BOM UTF-8 + decimal vírgula) e JSON funcionais; PDF stub

Infra:
- [x] [lib/financeiro/](lib/financeiro/) — types, queries defensivas, format, useClinicaId
- [x] [SubNav](app/financeiro-premium/_components/SubNav.tsx) Stripe-style com underline animado
- [x] [FluxoCaixaChart](app/financeiro-premium/_components/FluxoCaixaChart.tsx) — SVG custom com gradient, hover tooltip, fade-in animation
- [x] [KPICard](app/financeiro-premium/_components/KPICard.tsx) + [PeriodoSelect](app/financeiro-premium/_components/PeriodoSelect.tsx) (segmented control)

TODOs deixados:
- [ ] Integração gateway Pix real (Mercado Pago/Asaas/AbacatePay) — atualmente mock
- [ ] Cobrança automática de planos recorrentes (cron + gateway)
- [ ] PDF export com jsPDF/react-pdf
- [ ] Hooks de agendamento "realizado" → movimentação (depende de evento no app legado)

---

## Sprint 4 — Estoque + Procedimentos ⏳

Schema:
- [ ] `estoque_produtos`
- [ ] `estoque_lotes`
- [ ] `estoque_fornecedores`
- [ ] `procedimentos_realizados`

Páginas (`/estoque/*`):
- [ ] Lista de produtos
- [ ] Detalhe produto + lotes
- [ ] Lotes (alerta vencimento)
- [ ] Fornecedores
- [ ] Histórico de procedimentos com margem

Hook: ao finalizar consulta → decrementa estoque + calcula margem.

---

## Sprint 5 — CRM Médico ⏳

Schema:
- [ ] `crm_leads`
- [ ] `crm_campanhas`
- [ ] `crm_forms`

Páginas:
- [ ] Kanban de leads (drag-and-drop entre colunas)
- [ ] Campanhas (segmento + mensagem + agendamento)
- [ ] Lead capture forms embedáveis (iframe)
- [ ] Score de paciente (frequência, ticket médio)

---

## Sprint 6 — Integração + Merge Plan ⏳

- [ ] `MERGE-PLAN.md` consolidado
- [ ] Smoke tests Playwright das rotas principais
- [ ] README detalhado
- [ ] FINAL-REPORT.md

---

## Bloqueios conhecidos (BLOCKED.md)

Nenhum até o momento.
