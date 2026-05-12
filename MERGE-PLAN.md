# Merge Plan — Clinical 360 v2 → main

Este documento descreve **como absorver o trabalho dos Sprints 1-5 no fluxo principal** do projeto `prontuario-ia`. O trabalho está num branch (`claude/exciting-hermann-93cb8c`) e foi feito sem prefixo `v2_` nas tabelas (decisão de 2026-05-12 com Lucas).

---

## 1. Migrations Supabase

**Ordem obrigatória** (cada uma depende das tabelas existentes do projeto principal):

| # | Arquivo | Cria | Risco |
| - | --- | --- | --- |
| 1 | [supabase/migrations/001_portal_paciente.sql](supabase/migrations/001_portal_paciente.sql) | `pacientes_portal`, `portal_documentos`, `portal_chat_mensagens`, `portal_protocolos` | Baixo. Não toca em existing. Adiciona `portal_chat_mensagens` em `supabase_realtime`. |
| 2 | [supabase/migrations/002_financeiro_premium.sql](supabase/migrations/002_financeiro_premium.sql) | `financeiro_pix_cobrancas`, `financeiro_planos_recorrentes` | Baixo. Não muda tabelas `financeiro_*` existentes. |
| 3 | [supabase/migrations/003_estoque.sql](supabase/migrations/003_estoque.sql) | `estoque_produtos`, `estoque_lotes`, `estoque_fornecedores`, `procedimentos_realizados` | Médio. `procedimentos_realizados` referencia `procedimentos.id` (catálogo legado) via FK opcional. |
| 4 | [supabase/migrations/004_crm.sql](supabase/migrations/004_crm.sql) | `crm_leads`, `crm_campanhas`, `crm_forms` | Baixo. |

**Como aplicar:** copie o conteúdo de cada arquivo no SQL Editor do Supabase Studio na ordem acima. Todas usam `create table if not exists` — seguras pra rodar mais de uma vez.

**Convenção de RLS:** todas têm `disable row level security` seguindo a convenção atual do projeto. Quando habilitarem RLS no projeto principal, as 11 tabelas novas precisam de policies.

---

## 2. Rotas adicionadas

### Públicas (sem auth, sem AppShell)
| Rota | Arquivo | Propósito |
| --- | --- | --- |
| `/design-system` | [app/design-system/page.tsx](app/design-system/page.tsx) | Showcase dev — remover ou esconder em prod |
| `/portal/*` | [app/portal/](app/portal/) | Portal do paciente (auth próprio via magic link) |
| `/forms/[slug]` | [app/forms/[slug]/page.tsx](app/forms/[slug]/page.tsx) | Lead capture embedável |

Já registradas em:
- [components/AppShell.tsx](components/AppShell.tsx): `PREFIXOS_PUBLICOS`
- [middleware.ts](middleware.ts): rotas que evitam redirect entre subdomínios

### Autenticadas (entram no AppShell padrão)
| Rota | Arquivo | Convive com legado? |
| --- | --- | --- |
| `/financeiro-premium/*` | [app/financeiro-premium/](app/financeiro-premium/) | **Sim** — em paralelo a `/financeiro`. Decisão final no merge. |
| `/estoque/*` | [app/estoque/](app/estoque/) | Novo. Sem conflito. |
| `/crm/*` | [app/crm/](app/crm/) | Novo. Sem conflito. |

### API routes adicionadas
- `/api/portal/login`
- `/api/portal/verify`
- `/api/portal/explicar-exame` (Anthropic — opcional)

---

## 3. Arquivos do design system

Tudo em `components/ui/` e `components/motion/`. **Funções puramente visuais**, sem dependência de Supabase:

| Componente | Arquivo |
| --- | --- |
| Button, Input, Card, Tabs, Badge, Modal, Sheet, Skeleton | [components/ui/](components/ui/) |
| FadeIn, SlideIn | [components/motion/](components/motion/) |

Toast já existia em [components/Toast.tsx](components/Toast.tsx) — re-exportado no barrel `components/ui/index.ts`.

**Recomendação:** manter onde estão. Extrair pra package `@clinical360/ui` só se houver consumo externo (segundo app, marketing site, etc).

---

## 4. Lib helpers compartilhados

| Caminho | Função |
| --- | --- |
| [lib/portal/](lib/portal/) | types, queries defensivas, session/magic-link, formatadores |
| [lib/financeiro/](lib/financeiro/) | types, queries (KPIs, fluxo de caixa, comissões), format BR, `useClinicaId()` |
| [lib/estoque/](lib/estoque/) | types, queries CRUD + `registrarProcedimentoRealizado()`, `statusValidade()` |
| [lib/crm/](lib/crm/) | types, queries CRUD + `calcularScorePacientes()` + `submeterForm()` |

Não conflitam com `lib/` existente. Padrão de queries: try/catch retorna array vazio — degrada gracefully.

---

## 5. Pacotes (package.json)

**Adicionados:**
```json
"framer-motion": "<latest>",     // animações premium
"next-themes": "<latest>"        // preparado pra dark mode (não usado ainda)
```

Próximos sprints podem precisar:
- `jspdf` ou `react-pdf` — pra export PDF no financeiro
- `@playwright/test` — smoke tests (opt-in, ver seção 7)

---

## 6. Variáveis de ambiente

Nenhuma nova **obrigatória**. As opcionais já mapeadas:

| Var | Quando precisa | Fallback |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | `/portal/exames/[id]` botão "Explicar pra mim" | HTTP 503 com mensagem clara |
| `SUPABASE_SERVICE_ROLE_KEY` | `/api/portal/login` e `/api/portal/verify` | Já existente — usado pelo legado |
| `RESEND_API_KEY` (futuro) | Enviar magic link real por email | Token retorna no JSON em dev |

---

## 7. Smoke tests (Playwright — opt-in)

Configuração em `playwright.config.ts` + `tests/smoke/`.

```bash
npm install --save-dev @playwright/test
npx playwright install chromium
npm run dev    # em um terminal
npx playwright test  # em outro
```

Cobertura mínima dos 5 pilares: build + páginas principais carregam sem 500.

---

## 8. Sidebar / menu principal

**Não modificado.** As novas seções não aparecem no Sidebar atual do app. Adicionar quando for fazer merge — sugestão de patch em [components/Sidebar.tsx](components/Sidebar.tsx), após linha 83 (depois de `/financeiro`):

```tsx
// Grupo Financeiro (substituir /financeiro pelo /financeiro-premium quando promover)
{ href: '/financeiro-premium', label: 'Financeiro', icon: <CashIcon /> },
{ href: '/estoque',            label: 'Estoque',    icon: <BoxIcon /> },
{ href: '/crm',                label: 'CRM',        icon: <UsersIcon /> },
```

E em `BottomNav.tsx` mobile — usar discrição (talvez só `/financeiro-premium` no quick-nav e os outros via "mais").

---

## 9. Riscos identificados

| # | Risco | Mitigação |
| - | --- | --- |
| 1 | `/financeiro` legado e `/financeiro-premium` divergem ao longo do tempo | No merge, decidir: substituir o legado (renomear `/financeiro-premium` → `/financeiro`) **ou** manter como "Financeiro 2.0" enquanto migra. Recomendo substituir. |
| 2 | RLS desligado em todas as 11 tabelas novas | Auditar e habilitar quando o projeto principal habilitar RLS. Policies sugeridas como comentário em cada migration. |
| 3 | Magic link do portal usa localStorage (não cookie httpOnly) | Aceito pra portal de paciente (sem dados financeiros editáveis pelo paciente). Migrar pra Supabase Auth se virar requisito. |
| 4 | Pix mock sem gateway real | Antes de promover, ligar Mercado Pago/Asaas — tabela `financeiro_pix_cobrancas` já tem campos pro provider. |
| 5 | Decremento de estoque sequencial (não atômico) | Supabase client não suporta transação multi-tabela. Pra clínica média, ok. Reconciliação por cron mensal recomendada. |
| 6 | Envio efetivo de campanhas CRM ainda não plugado | Conectar com Sofia/WhatsApp existente no Sprint pós-merge. |
| 7 | Form embedável sem reCAPTCHA | Spam controlado por rate-limit no Supabase é frágil. Adicionar Cloudflare Turnstile ou reCAPTCHA antes de divulgar URLs publicamente. |

---

## 10. Plano de merge sugerido (passo a passo)

**Quando estiver pronto pro merge — provavelmente 1-2 horas focadas:**

1. **Aplicar migrations 001-004 em produção** (5min cada, pode rodar agora — não afetam o app atual)
2. **Mergear branch `claude/exciting-hermann-93cb8c` em `main`** — deploy automático na Vercel
3. **Testar em `clinical360.vercel.app/portal/login`** com email de paciente real (ver report do Sprint 2)
4. **Adicionar entradas no Sidebar/BottomNav** pra as 3 seções novas (PR pequeno separado se quiser)
5. **Decidir sobre `/financeiro` vs `/financeiro-premium`:**
   - Opção A: renomear premium → financeiro (1 commit, link no menu atualiza)
   - Opção B: manter ambos por 1-2 sprints; legado fica como "Financeiro clássico"
6. **Integrar gateway Pix** (Mercado Pago tem doc PT-BR boa)
7. **Plugar hook do estoque no fluxo de consulta finalizada** — chamar `registrarProcedimentoRealizado()` no fim da consulta médica em [app/sala/[sala_id]](app/sala/) ou [app/nova-consulta](app/nova-consulta/)

Estimativa total: 4-6h focadas, tudo somado.

---

## 11. O que ficou pra depois (próxima rodada)

Cada sprint tem seu próprio TODO no respectivo `SPRINT-N-REPORT.md`. Consolidado das integrações externas:

- Resend (email magic-link do portal)
- Gateway Pix (Mercado Pago / Asaas / AbacatePay)
- Memed (reenvio de receita)
- WhatsApp Business API (envio de campanhas CRM)
- Anthropic key real (explicação de exames com IA)
- Supabase Storage (upload de foto de produto)
- jsPDF (export contábil em PDF)
- Cron de cobrança recorrente
- Cron de alerta de validade de lote
- Hook de consulta finalizada → registrarProcedimentoRealizado
- reCAPTCHA / Turnstile no form embedável
