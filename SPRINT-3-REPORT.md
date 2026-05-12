# Sprint 3 — Financeiro Premium

**Status:** ✅ concluído (com TODOs documentados pra gateway de pagamento e PDF)
**Branch:** `claude/exciting-hermann-93cb8c`
**Build:** `npm run build` passa — 7 rotas novas em `/financeiro-premium/*`

## Estratégia

`/financeiro` (legado, em produção) **não foi tocado**. Construí `/financeiro-premium` em paralelo, reusando as tabelas existentes (`financeiro_movimentacoes`, `financeiro_categorias`, `financeiro_contas`, `financeiro_comissoes_config`) e adicionando só duas tabelas novas. Decisão de substituir vs coexistir fica pro Sprint 6 (merge plan).

## O que foi feito

### Schema novo
[supabase/migrations/002_financeiro_premium.sql](supabase/migrations/002_financeiro_premium.sql):
- `financeiro_pix_cobrancas` — cobranças Pix on-demand
- `financeiro_planos_recorrentes` — assinaturas mensais (diferente de `financeiro_pacotes` que é venda única)

### Lib compartilhada

| Arquivo | Função |
| --- | --- |
| [lib/financeiro/types.ts](lib/financeiro/types.ts) | Movimentacao, Categoria, Conta, ComissaoConfig, PixCobranca, PlanoRecorrente, KPIs, FluxoDiario |
| [lib/financeiro/clinica.ts](lib/financeiro/clinica.ts) | `useClinicaId()` — lê de `localStorage` (convenção do projeto) |
| [lib/financeiro/queries.ts](lib/financeiro/queries.ts) | `calcularKPIs`, `fluxoCaixaDiario`, `listarMovimentacoes`, `calcularComissoesPeriodo`, etc. Todas defensivas. |
| [lib/financeiro/format.ts](lib/financeiro/format.ts) | `moeda`, `moedaCompacta` (k/M), `percentual`, `dataBR`, `dataCurta` |

### Páginas

| Rota | Destaque |
| --- | --- |
| [/financeiro-premium](app/financeiro-premium/page.tsx) | Hero título + segmented control de período (7/30/90/180/365 dias). 4 KPIs (Receita, Despesa, Lucro, A Receber) com variação % vs período anterior. Chart SVG custom premium. Lista das últimas 8 movimentações. |
| [/financeiro-premium/movimentacoes](app/financeiro-premium/movimentacoes/page.tsx) | Tabela filtrável (tipo: receita/despesa, status, busca por descrição/paciente/médico). Categoria com chip colorido. |
| [/financeiro-premium/comissoes](app/financeiro-premium/comissoes/page.tsx) | 3 KPIs no topo. Ranking de médicos com bar gradient mostrando receita relativa. Mostra regra configurada (% ou fixo). |
| [/financeiro-premium/pix](app/financeiro-premium/pix/page.tsx) | Tabs (Pendentes/Pagos/Todos). Modal "Nova cobrança" cria registro mock no banco. Modal "Ver cobrança" mostra QR placeholder + copia-e-cola + ação "marcar como paga". |
| [/financeiro-premium/recorrencia](app/financeiro-premium/recorrencia/page.tsx) | Cards de planos com progress bar gradient. Form cria plano vinculado a paciente por email. |
| [/financeiro-premium/dre](app/financeiro-premium/dre/page.tsx) | Receitas e despesas agrupadas por categoria, com % e valor. Margem operacional no topo. |
| [/financeiro-premium/exportar](app/financeiro-premium/exportar/page.tsx) | CSV (BOM UTF-8, decimal vírgula, escape correto) e JSON funcionais — clica baixa. PDF stub. |

### Componentes premium

- [SubNav](app/financeiro-premium/_components/SubNav.tsx) — tabs estilo Stripe com underline animado, scroll horizontal em mobile
- [KPICard](app/financeiro-premium/_components/KPICard.tsx) — número grande + variação com seta colorida + icon contextual
- [FluxoCaixaChart](app/financeiro-premium/_components/FluxoCaixaChart.tsx) — chart SVG **custom** (não Recharts):
  - Áreas de receita (verde) e despesa (vermelho) com gradient stops
  - Linha de saldo dashed roxa
  - Hover tooltip com 3 valores
  - Animação de entrada (paths fade-in escalonado)
  - Grid sutil + labels de eixo X automáticos
  - Sem dependência externa — 350 linhas de SVG inline
- [PeriodoSelect](app/financeiro-premium/_components/PeriodoSelect.tsx) — segmented control iOS-style

### Layout
[app/financeiro-premium/layout.tsx](app/financeiro-premium/layout.tsx) injeta o SubNav em todas as sub-rotas. Max-width 1280px, padding fluído.

## Como testar

Pré-requisitos:
1. Estar logado como admin de clínica ou médico (escreve `clinica_admin` ou `medico` em localStorage com `clinica_id`).
2. Para Sprint 3 com dados reais: aplicar [migration 002](supabase/migrations/002_financeiro_premium.sql) no Supabase Studio.

```bash
npm run dev
# http://localhost:3000/financeiro-premium  (logado)
```

Sem dados: tudo degrada pra empty states. Com dados em `financeiro_movimentacoes`, KPIs e chart populam.

## Decisões importantes

| Tema | Decisão | Por quê |
| --- | --- | --- |
| Rota | `/financeiro-premium` em paralelo a `/financeiro` | Não bater no que está em prod; merge no Sprint 6 |
| Chart | SVG custom (não Recharts) | -90KB, controle total visual, sem look "de biblioteca" |
| Comissões | Reusa `financeiro_comissoes_config` existente | Já tem CRUD em `/financeiro` legado; aqui só visualização premium |
| Pix gateway | Mock no DB sem chamada externa | Lucas pediu pra não usar chaves; UI 100% pronta |
| PDF export | Stub | jsPDF adiciona ~70KB; deixa pra quando for prioritário |
| KPI variação | Compara mesmo período anterior | Padrão Stripe/Linear |
| Empty state na tabela DRE | Mensagem inline | Não polui com EmptyState gigante; tabela mantém ritmo |

## Métricas de build

```
/financeiro-premium                4.67 kB    191 kB
/financeiro-premium/movimentacoes  3.43 kB    190 kB
/financeiro-premium/comissoes      2.94 kB    190 kB
/financeiro-premium/pix            6.22 kB    193 kB
/financeiro-premium/recorrencia    5.96 kB    193 kB
/financeiro-premium/dre            2.66 kB    189 kB
/financeiro-premium/exportar       4.0 kB     191 kB
```

Todas estáticas. Shared bundle inalterado (86.9 kB).

## Bloqueios

Nenhum. TODOs de integração externa documentados.
