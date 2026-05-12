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

## Sprint 2 — Portal do Paciente Premium ⏳

Schema (sem prefixo — merge final):
- [ ] `pacientes_portal` (auth via magic link)
- [ ] `portal_documentos`
- [ ] `portal_chat_mensagens`
- [ ] `portal_protocolos`

Páginas (rota `/portal/*`):
- [x] `/portal` — dashboard placeholder (Sprint 1)
- [ ] `/portal/login` — magic link
- [ ] `/portal/timeline` — jornada Strava-style
- [ ] `/portal/consultas` — lista + detalhe legível
- [ ] `/portal/exames` — lista + IA explicando em linguagem leiga
- [ ] `/portal/receitas` — reenvio Memed/WhatsApp
- [ ] `/portal/pagamentos` — fatura + Pix on-demand
- [ ] `/portal/protocolos` — progresso visual
- [ ] `/portal/chat` — Supabase Realtime
- [ ] `/portal/documentos` — PDFs

---

## Sprint 3 — Financeiro Premium ⏳

Schema:
- [ ] `financeiro_movimentacoes_v2` (decidir naming vs existing `financeiro_*`)
- [ ] `financeiro_comissoes`
- [ ] `financeiro_planos_recorrentes`
- [ ] `financeiro_pix_cobrancas`

Páginas (`/financeiro-premium/*` ou novo route group):
- [ ] Visão geral (KPIs + fluxo de caixa)
- [ ] Movimentações
- [ ] Comissionamento
- [ ] Pix (cobranças avulsas/agendamento)
- [ ] Recorrência
- [ ] DRE simplificada
- [ ] Exportar contábil (CSV/PDF)

Hooks:
- [ ] Agendamento "realizado" → movimentação
- [ ] Consulta finalizada → comissão

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
