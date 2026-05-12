# Sprint 1 — Foundation Premium

**Status:** ✅ concluído
**Branch:** `claude/exciting-hermann-93cb8c` (worktree)
**Build:** `npm run build` passa (placeholder env)

## O que foi feito

### UI primitives (`components/ui/`)
8 componentes seguindo o padrão **inline-style + tokens** do repo (não classes Tailwind):

| Componente | Arquivo | API resumida |
| --- | --- | --- |
| Button | [Button.tsx](components/ui/Button.tsx) | `variant` (primary/secondary/ghost/danger), `size` (sm/md/lg), `loading`, `leftIcon`, `rightIcon`, `fullWidth` |
| Input | [Input.tsx](components/ui/Input.tsx) | `label`, `hint`, `error`, `leftIcon`, `rightIcon` + focus ring + erro |
| Card | [Card.tsx](components/ui/Card.tsx) | `variant` (default/elevated/ghost), `padding`, `interactive` (hover lift) |
| Tabs | [Tabs.tsx](components/ui/Tabs.tsx) | Estilo Vercel sublinhado, `items` + `value` + `onChange`, suporta badge por tab |
| Badge | [Badge.tsx](components/ui/Badge.tsx) | 6 variantes (neutral/brand/success/warning/danger/info), `size`, `dot` |
| Modal | [Modal.tsx](components/ui/Modal.tsx) | Backdrop blur, ESC-to-close, body scroll lock, slot `footer`, 3 tamanhos |
| Sheet | [Sheet.tsx](components/ui/Sheet.tsx) | Bottom sheet mobile, handle visual, slide-up animado |
| Skeleton | [Skeleton.tsx](components/ui/Skeleton.tsx) | Shimmer animado (keyframe em globals.css), `SkeletonText` helper |

Toast já existia em [components/Toast.tsx](components/Toast.tsx) — re-exportado pelo barrel.

### Motion utilities (`components/motion/`)
- [FadeIn.tsx](components/motion/FadeIn.tsx) — fade+lift, `delay`, `duration`, `y`
- [SlideIn.tsx](components/motion/SlideIn.tsx) — 4 direções (up/down/left/right), `distance`, `delay`

Easing curve usada nos componentes: `[0.16, 1, 0.3, 1]` (out-expo premium).

### Rotas novas
- [/design-system](app/design-system/page.tsx) — showcase com tabs (Botões, Inputs, Cards, Badges, Overlays, Skeletons, Motion). Pública via `AppShell` e `middleware.ts`.
- [/portal](app/portal/page.tsx) — placeholder da home do Portal (Sprint 2 expande). Layout próprio em [PortalShell.tsx](app/portal/_components/PortalShell.tsx) — sidebar desktop + bottom nav mobile com backdrop-blur.

### Configuração
- `framer-motion` e `next-themes` adicionados em [package.json](package.json) (next-themes ainda não usado — preparado pra dark mode futuro)
- Keyframe `skeletonShimmer` em [app/globals.css](app/globals.css)
- `/portal` e `/design-system` adicionados em [components/AppShell.tsx](components/AppShell.tsx) (`PREFIXOS_PUBLICOS`) e [middleware.ts](middleware.ts) (`ROTAS_APP`)

## Como verificar localmente

```bash
npm run dev
# abrir:
# http://localhost:3000/design-system
# http://localhost:3000/portal
```

Inspeção visual sugerida:
- `/design-system` em mobile (390px) e desktop — todas as tabs renderizam, Modal e Sheet abrem
- `/portal` mostra sidebar em ≥900px e bottom nav em <900px
- Toast dispara via botão no design system

## Decisões importantes (vs prompt original)

| Tema | Prompt | Decisão | Por quê |
| --- | --- | --- | --- |
| Projeto separado | Criar `~/clinical360` + repo novo + Vercel paralelo | Trabalhar no repo atual, branch de feature | Lucas confirmou: tudo será mergeado no final, então separar agora seria churn |
| Prefixo `v2_` no schema | Todas as tabelas com prefixo | Sem prefixo | Mesma razão acima |
| Pasta de UI | `lib/design-system/` | `components/ui/` | Segue convenção existente do repo |
| Estilização | Não especificado | Inline-style + `tokens` | Repo inteiro segue esse padrão; Tailwind utilities raras |
| Vercel paralelo | `clinical360-v2.vercel.app` | Pulado | Implica chave/dashboard — Lucas pediu pra não usar chaves |
| Push | "push pra main" | Commit local apenas | Política do harness exige confirmação antes de push |

## TODOs deixados pra próximos sprints

- Tabela de pacientes de portal + magic link (Sprint 2)
- Real-time chat via Supabase Realtime (Sprint 2)
- IA explicando exames em linguagem leiga via Anthropic API (Sprint 2)
- Pix QR gen — provedor não decidido (Sprint 3)
- Hooks de agendamento → movimentação financeira (Sprint 3)
- Decremento automático de estoque ao finalizar consulta (Sprint 4)

## Bloqueios

Nenhum. Pronto pra Sprint 2 ao receber sinal verde.

## Métricas de build

```
/design-system   8.2 kB    135 kB First Load
/portal          2.68 kB   130 kB First Load
Shared chunks    86.9 kB
Middleware       28 kB
```

Todas as rotas novas pré-renderizam estaticamente.
