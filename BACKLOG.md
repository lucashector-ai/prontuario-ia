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

## Sprint 4 — Estoque + Procedimentos ✅

Schema ([supabase/migrations/003_estoque.sql](supabase/migrations/003_estoque.sql)):
- [x] `estoque_produtos` (7 categorias, 7 unidades, estoque min/max, custo/preço, foto)
- [x] `estoque_lotes` (rastreabilidade + validade ANVISA)
- [x] `estoque_fornecedores`
- [x] `procedimentos_realizados` (jsonb `produtos_usados`, margem calculada)

Páginas (`/estoque/*`):
- [x] [/estoque](app/estoque/page.tsx) — grid de produtos com foto, busca, chips de categoria, alerta de baixo estoque
- [x] [/estoque/[id]](app/estoque/[id]/page.tsx) — detalhe + lotes + form de novo lote (entra automaticamente no estoque)
- [x] [/estoque/lotes](app/estoque/lotes/page.tsx) — consolidado com 4 KPIs (vencidos / <30 / <90 / OK), tabs de filtro
- [x] [/estoque/fornecedores](app/estoque/fornecedores/page.tsx) — CRUD completo
- [x] [/estoque/procedimentos](app/estoque/procedimentos/page.tsx) — histórico com receita/custo/margem agregados + tabela

Helper:
- [x] [`registrarProcedimentoRealizado()`](lib/estoque/queries.ts) — função única que decrementa estoque + decrementa lote + calcula margem + grava registro. Pronta pra hook do app legado (TODO Sprint 6).

TODOs:
- [ ] Upload de foto via Supabase Storage (atualmente URL externa)
- [ ] Hook real "consulta finalizada → registrarProcedimentoRealizado" no app legado
- [ ] UI in-app pra registrar procedimento manualmente
- [ ] Notificação automática de lotes < 30 dias (cron)

---

## Sprint 5 — CRM Médico ✅

Schema ([supabase/migrations/004_crm.sql](supabase/migrations/004_crm.sql)):
- [x] `crm_leads` (origem, status, vínculo opcional a paciente, origem_form_id)
- [x] `crm_campanhas` (segmento jsonb, canal, agendamento, contadores)
- [x] `crm_forms` (campos jsonb, slug único, contador de submissões)

Páginas:
- [x] [/crm](app/crm/page.tsx) — kanban com 5 colunas, drag-and-drop HTML5 nativo, contagem por coluna
- [x] [/crm/campanhas](app/crm/campanhas/page.tsx) — cards canal+status+preview; modal com 4 canais, 6 segmentos predef
- [x] [/crm/forms](app/crm/forms/page.tsx) — gerador com campos dinâmicos (5 tipos); modal embed (URL + iframe HTML)
- [x] [/forms/[slug]](app/forms/[slug]/page.tsx) — público embedável (sem AppShell, sem auth); cria lead automático
- [x] [/crm/score](app/crm/score/page.tsx) — ranking VIP/Ativo/Dormente/Nunca, calculado a partir de `financeiro_movimentacoes`

TODOs:
- [ ] Envio efetivo das campanhas (WhatsApp Business / Sofia / Resend)
- [ ] Resolver segmentos em tempo de envio (`aniversariantes_mes` → lista real)
- [ ] reCAPTCHA no form público
- [ ] Customização visual do form (cor primária ainda não exposta na UI)

---

## Sprint 6 — Integração + Merge Plan ⏳

- [ ] `MERGE-PLAN.md` consolidado
- [ ] Smoke tests Playwright das rotas principais
- [ ] README detalhado
- [ ] FINAL-REPORT.md

---

## Bloqueios conhecidos (BLOCKED.md)

Nenhum até o momento.
