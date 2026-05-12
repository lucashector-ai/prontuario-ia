# Sprint 5 — CRM Médico

**Status:** ✅ concluído (envio efetivo de campanhas e reCAPTCHA ficam pra Sprint 6)
**Branch:** `claude/exciting-hermann-93cb8c`
**Build:** passa — 4 rotas em `/crm` + 1 rota pública `/forms/[slug]`

## O que foi feito

### Schema novo
[supabase/migrations/004_crm.sql](supabase/migrations/004_crm.sql):
- `crm_leads` (7 origens, 5 status, FK opcional a paciente, FK ao form de origem)
- `crm_campanhas` (4 canais: whatsapp/email/sms/sofia, segmento jsonb, agendamento, contadores)
- `crm_forms` (slug único, campos jsonb, total_submissoes, ativo)

### Lib
[lib/crm/types.ts](lib/crm/types.ts) + [queries.ts](lib/crm/queries.ts):
- CRUD defensivo de leads/campanhas/forms
- `calcularScorePacientes()` — agrupa `financeiro_movimentacoes` por paciente, calcula consultas/ticket/total
- `submeterForm()` — endpoint público que mapeia campos comuns (nome/email/telefone/interesse) pra colunas do lead, e mantém payload completo em `observacoes`

### Páginas

**[/crm](app/crm/page.tsx) — Kanban**
- 5 colunas: Novo → Qualificado → Agendado → Atendido → Perdido, cada uma com dot colorido + contador
- Drag-and-drop nativo HTML5 (sem dnd-kit pra evitar 30KB de bundle): card é `draggable`, colunas têm `onDragOver`/`onDrop`
- Hovering visual: coluna alvo fica roxa quando arrastando por cima
- Optimistic update + atualizadEm patch
- Click no card → modal edit; botão "Novo lead" → modal create
- Toast confirma cada movimentação

**[/crm/campanhas](app/crm/campanhas/page.tsx)**
- Grid de cards: nome + canal badge + status badge + preview da mensagem (3 linhas) + datas + contador alcançados/total
- Modal "Nova campanha":
  - Nome
  - Canal (4 chips clicáveis)
  - Segmento (6 checkboxes: aniversariantes, sem consulta 3/6 meses, status lead novo/qualificado, todos pacientes)
  - Mensagem template (textarea com hint de `{nome}` pra personalização)
  - Agendamento opcional (datetime-local) → se preenchido, status='agendada'; senão 'rascunho'

**[/crm/forms](app/crm/forms/page.tsx)**
- Lista de forms com URL pública, contador de submissões
- Modal "Novo formulário":
  - Slug auto-sanitizado (lowercase, hifens)
  - Título + descrição
  - **Builder dinâmico de campos**: 5 tipos (texto, email, telefone, textarea, select), label customizável, flag obrigatório, botão + adicionar / × remover
  - Default sensato: já vem com 4 campos (nome, telefone, email, interesse)
- Modal "Embed code":
  - URL pública (com botão copiar + abrir em nova aba)
  - Snippet `<iframe>` pronto pra colar em qualquer site externo

**[/forms/[slug]](app/forms/[slug]/page.tsx) — público embedável**
- Sem AppShell (registrado em `PREFIXOS_PUBLICOS`), sem middleware redirect
- Layout: gradient roxo suave + card centrado, max-width 480px
- Renderiza campos dinâmicos baseado no schema
- Submissão → POST chama `submeterForm()` → cria lead em `crm_leads` com `origem='site'` e `origem_form_id`
- Tela de sucesso animada com checkmark verde
- Funciona dentro de iframe em qualquer site

**[/crm/score](app/crm/score/page.tsx)**
- 4 KPIs: VIPs, Ativos (visita < 90d), Dormentes (>90d), Nunca atendidos
- Lista ordenada por total gerado, com:
  - Rank #1, #2, ...
  - Nome + badge categórico (VIP roxo / Ativo verde / Dormente amarelo / Sem visita)
  - Consultas, ticket médio, última visita (formatRelativo)
  - Total em destaque + bar de progresso relativo ao top

## Como testar

```bash
npm run dev
```

1. **Kanban**: login admin → `/crm` → "Novo lead" → arrasta entre colunas.
2. **Campanha**: `/crm/campanhas` → "Nova" → escolher canal + segmento + mensagem.
3. **Form embed**:
   - `/crm/forms` → "Novo" → cria com slug `agendamento-botox`
   - Click no card → "Embed code" → copia URL ou iframe
   - Abre `http://localhost:3000/forms/agendamento-botox` → preenche → submete
   - Volta pra `/crm` → o lead aparece na coluna "Novo" com origem 'Site' e observações com payload completo
4. **Score**: `/crm/score` → ranking aparece se houver `financeiro_movimentacoes` com `paciente_id`.

## Decisões importantes

| Tema | Decisão | Por quê |
| --- | --- | --- |
| Drag-and-drop | HTML5 nativo (sem dnd-kit) | Kanban simples não justifica 30KB. Funciona em todos navegadores modernos. Touch no mobile precisa polyfill — TODO se for relevante |
| Form público | Página standalone `/forms/[slug]` | Sem AppShell pra ficar limpa em iframe; sem auth pra qualquer um submeter |
| Spam protection | Não implementado | reCAPTCHA precisa de chave (Lucas pediu sem chaves) — Sprint 6 |
| Segmentação | Salva como jsonb com flags | Resolver em tempo de envio (Sprint 6) — facilita criar mais opções sem migration |
| Score: pesos | Total monetário gerado | Mais reto que score composto; já filtra naturalmente VIP vs casual |
| Iframe security | X-Frame-Options não setado (default Next) | Permite embed em qualquer domínio — alinhado com caso de uso |

## Métricas de build

```
/crm              6.08 kB    193 kB
/crm/campanhas    5.94 kB    193 kB
/crm/forms        5.88 kB    193 kB
/crm/score        7.18 kB    190 kB
/forms/[slug]     6.61 kB    189 kB
```

## Bloqueios

Nenhum.
