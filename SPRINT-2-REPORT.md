# Sprint 2 — Portal do Paciente Premium

**Status:** ✅ concluído (com TODOs documentados pra integrações externas)
**Branch:** `claude/exciting-hermann-93cb8c`
**Build:** `npm run build` passa — 11 rotas novas em `/portal/*`

## O que foi feito

### Schema (migration aplicável)

[supabase/migrations/001_portal_paciente.sql](supabase/migrations/001_portal_paciente.sql) — cria 4 tabelas + habilita realtime na de chat:

| Tabela | Função |
| --- | --- |
| `pacientes_portal` | Vínculo paciente↔portal + magic-link token + preferências |
| `portal_documentos` | Atestados, receitas, laudos, recibos visíveis ao paciente |
| `portal_chat_mensagens` | Chat real-time paciente ↔ clínica ↔ Sofia (realtime publication) |
| `portal_protocolos` | Planos de tratamento com progresso visual |

RLS desligado seguindo convenção atual (comentário na migration sugere policy quando habilitar).

### Lib compartilhada

| Arquivo | Função |
| --- | --- |
| [lib/portal/types.ts](lib/portal/types.ts) | Tipos TS pras 4 tabelas novas + Consulta/Exame/Prescricao/Agendamento existentes |
| [lib/portal/session.ts](lib/portal/session.ts) | Magic-link client, `usePortalSession`, `localStorage` session |
| [lib/portal/queries.ts](lib/portal/queries.ts) | Queries defensivas (try/catch → empty); `montarTimeline` agrega 4 fontes |
| [lib/portal/format.ts](lib/portal/format.ts) | `formatDataLonga`, `formatHora`, `formatRelativo`, `formatMoeda` (pt-BR) |

### Páginas (rota `/portal/*`)

| Rota | Destaque |
| --- | --- |
| [/portal/login](app/portal/login/page.tsx) | Email → token de 6 dígitos. Fundo com radial gradient roxo. Suporta `?email=&token=` (link direto). |
| [/portal](app/portal/page.tsx) | Hero gradient roxo com próxima consulta. 3 cards resumo (último exame, msgs, protocolos). Próximos passos com progress bar. |
| [/portal/timeline](app/portal/timeline/page.tsx) | Feed cronológico com timeline rail (linha vertical + bolas coloridas por tipo). Anima entrada via FadeIn escalonado. |
| [/portal/consultas](app/portal/consultas/page.tsx) | Lista clicável. Detalhe em [/portal/consultas/[id]](app/portal/consultas/[id]/page.tsx) seccionado (resumo, hipóteses, conduta). |
| [/portal/exames](app/portal/exames/page.tsx) | Lista. Detalhe em [/portal/exames/[id]](app/portal/exames/[id]/page.tsx) com botão **"Explicar pra mim"** chamando Anthropic Claude. |
| [/portal/receitas](app/portal/receitas/page.tsx) | Cards com preview + botões de reenvio (email / WhatsApp). |
| [/portal/pagamentos](app/portal/pagamentos/page.tsx) | Tabs (em aberto / histórico / métodos). Modal de exemplo Pix com QR placeholder. |
| [/portal/protocolos](app/portal/protocolos/page.tsx) | Cards com progress bar gradient + chip "próximo passo" destacado. |
| [/portal/chat](app/portal/chat/page.tsx) | Bubbles WhatsApp-style. Supabase Realtime via channel. Envio otimista. Textarea com Enter-to-send. |
| [/portal/documentos](app/portal/documentos/page.tsx) | Lista filtrável por tipo (Tabs). Cards com ícone PDF + badges. |

### API routes

| Rota | Função |
| --- | --- |
| [POST /api/portal/login](app/api/portal/login/route.ts) | Gera token 6 dígitos, salva em `pacientes_portal`, devolve `devToken` em dev. **TODO**: integrar Resend pra envio real. |
| [POST /api/portal/verify](app/api/portal/verify/route.ts) | Valida token + expiração, limpa, retorna sessão. |
| [POST /api/portal/explicar-exame](app/api/portal/explicar-exame/route.ts) | Chama `claude-opus-4-7` com prompt de tradução pra leigo. Retorna 503 sem `ANTHROPIC_API_KEY`. |

### Components compartilhados do portal

- [PortalShell](app/portal/_components/PortalShell.tsx) — sidebar agrupado (Principal + Saúde&finanças) desktop / bottom nav 4-tabs + sheet "Mais" mobile / botão sair
- [PortalGate](app/portal/_components/PortalGate.tsx) — redirect pra login sem sessão, skeleton durante loading
- [PageHeader](app/portal/_components/PageHeader.tsx) — header padrão (eyebrow + h1 + descrição + action)
- [EmptyState](app/portal/_components/EmptyState.tsx) — ilustração + título + descrição + action opcional

## Como testar

### Pré-requisitos
1. `.env.local` com chaves reais de Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`). Sem elas: portal degrada pra empty state em tudo.
2. Aplicar a migration: copiar [supabase/migrations/001_portal_paciente.sql](supabase/migrations/001_portal_paciente.sql) no SQL editor do Supabase Studio.

### Fluxo de teste
```bash
npm run dev
```

1. Acesse `http://localhost:3000/portal` → redireciona pra `/portal/login`.
2. Insira email de um paciente cadastrado em `pacientes`. A API cria vínculo em `pacientes_portal` automaticamente.
3. Em dev, a resposta da API traz o `devToken` no JSON — cole no campo de código.
4. Após verify, sessão grava em localStorage → acesso ao portal.
5. Navegue por todas as 10 rotas. Sem dados, empty states aparecem. Adicione registros via Supabase Studio pra ver com dados.

### Para o chat real-time
Inserir mensagem direto em `portal_chat_mensagens` via SQL — a página `/portal/chat` reage em tempo real.

### Para a IA explicando exames
Setar `ANTHROPIC_API_KEY` no `.env.local`. Adicionar um exame com `resultado_texto` preenchido → botão "Explicar pra mim" funciona.

## Decisões importantes

| Tema | Decisão | Por quê |
| --- | --- | --- |
| Auth | Magic link com token de 6 dígitos salvo na tabela (não Supabase Auth) | Mais simples no MVP, integra direto com `pacientes` existente sem migrar usuários |
| Sessão | localStorage simples (não cookie httpOnly) | Compatível com SSR estático; trade-off de segurança aceito pra portal de paciente (sem dados financeiros sensíveis editáveis) |
| Realtime | Supabase Realtime subscribe direto no client | Sem precisar de backend extra; channel por `paciente_id` filtra mensagens |
| Pix | UI completa, gateway ausente | Lucas pediu pra não usar chaves; Sprint 3 (Financeiro) plugga Mercado Pago/Asaas |
| Memed/WhatsApp | Toast informativo nos botões de reenvio | Stub honesto; integração no Sprint 4/6 |
| Anthropic | API route real com fallback 503 | Quando chave estiver setada, funciona; sem chave, mensagem clara |

## TODOs deixados pra próximas sprints

- [ ] Envio de magic link via Resend (token volta no JSON em dev pra desenvolver)
- [ ] Integração Memed pro reenvio de receita
- [ ] Integração Mercado Pago/Asaas pra Pix on-demand
- [ ] Geração de URL signed do Supabase Storage pros laudos PDF
- [ ] Push notifications de chat (PWA)
- [ ] RLS habilitado nas tabelas do portal quando convenção do projeto evoluir

## Bloqueios

Nenhum bloqueio crítico — todas as integrações dependem de chaves/contas externas que Lucas pediu pra não usar agora.

## Métricas de build

```
/portal              3.57 kB    197 kB First Load
/portal/login        5.65 kB    132 kB
/portal/timeline     3.41 kB    197 kB
/portal/consultas    2.26 kB    196 kB
/portal/consultas/*  1.95 kB    195 kB
/portal/exames       2.26 kB    196 kB
/portal/exames/*     3.61 kB    197 kB
/portal/receitas     3.9 kB     190 kB
/portal/pagamentos   2.32 kB    134 kB
/portal/protocolos   3.01 kB    190 kB
/portal/chat         3.07 kB    190 kB
/portal/documentos   3.42 kB    190 kB
```

11 rotas novas. Bundle compartilhado seguiu igual (86.9 kB).
