# Sprint 4 — Estoque + Procedimentos

**Status:** ✅ concluído (Storage upload + hook do app legado ficam pra Sprint 6)
**Branch:** `claude/exciting-hermann-93cb8c`
**Build:** `npm run build` passa — 5 rotas novas em `/estoque/*`

## O que foi feito

### Schema novo
[supabase/migrations/003_estoque.sql](supabase/migrations/003_estoque.sql) — 4 tabelas:

| Tabela | Função |
| --- | --- |
| `estoque_fornecedores` | Quem vende. CNPJ, telefone, email, observações |
| `estoque_produtos` | Catálogo de produtos. Categoria (peptideo/toxina/preenchedor/medicamento/descartavel/cosmetico/outro), unidade, estoque atual/mínimo, custo unitário, preço de venda, foto URL |
| `estoque_lotes` | Rastreabilidade ANVISA. Número, validade, fornecedor, preço de compra. FK pra produto |
| `procedimentos_realizados` | Histórico com `produtos_usados jsonb`, custo total, preço cobrado, margem valor + percentual |

Diferente de `procedimentos` (catálogo de serviços já existente no legado) — esta é o **registro de execução**.

### Lib
[lib/estoque/](lib/estoque/):
- `types.ts` — Produto, Lote, Fornecedor, ProcedimentoRealizado, ProdutoUsado + listas `CATEGORIAS`/`UNIDADES`/labels
- `queries.ts` — CRUD defensivo + helper crítico `registrarProcedimentoRealizado()`
- `vencimento.ts` — `statusValidade()` (vencido/critico/atencao/ok), `labelValidade()` ("Vence em 12 dias", "Vence em 3 meses")

### Páginas

| Rota | Destaque |
| --- | --- |
| [/estoque](app/estoque/page.tsx) | Grid de cards com foto (URL externa por agora). Banner de "X produtos com estoque baixo" quando aplicável. Busca + chips de categoria. Modal "Novo produto" com 8 campos. |
| [/estoque/[id]](app/estoque/[id]/page.tsx) | Layout duas colunas (foto + dados / stats + lotes). Stats inclui margem teórica. Lista de lotes ordenada por validade com badge colorido. Modal de novo lote (entra direto no estoque atual). |
| [/estoque/lotes](app/estoque/lotes/page.tsx) | 4 KPI cards coloridos (Vencidos, <30d, <90d, OK). Tabs filtro. Lista ordenada por risco (vencidos primeiro). Clique → detalhe do produto. |
| [/estoque/fornecedores](app/estoque/fornecedores/page.tsx) | Lista + CRUD modal (com textarea de observações). Editar/inativar. |
| [/estoque/procedimentos](app/estoque/procedimentos/page.tsx) | 4 totais (procs, receita, custo, margem). Tabela com badge de % (verde >=50, amarelo >=30, vermelho <0). Box explicando o hook que falta no legado. |

### Helper crítico — `registrarProcedimentoRealizado()`

Recebe `produtosUsados: [{ produto_id, lote_id?, quantidade, custo_unitario? }]`. Por produto:
1. Busca custo unitário atual (se não passado)
2. Acumula custo total
3. Decrementa `estoque_produtos.estoque_atual`
4. Decrementa `estoque_lotes.quantidade_atual` (se lote_id passado)

Depois insere em `procedimentos_realizados` com margem calculada.

**Pronto pra integração**: o app legado, ao finalizar uma consulta com procedimentos consumidos, só precisa chamar essa função. Decisão de onde plugar fica pro Sprint 6.

## Como testar

Pré-requisitos:
1. Logado como admin/médico (clinica_id em localStorage).
2. Aplicar [migration 003](supabase/migrations/003_estoque.sql).

```bash
npm run dev
# http://localhost:3000/estoque
```

Fluxo sugerido:
1. Cadastra 1-2 fornecedores em `/estoque/fornecedores`.
2. Cadastra 1 produto em `/estoque`.
3. Adiciona um lote ao produto (com validade próxima pra ver o alerta) em `/estoque/[id]`.
4. Confere `/estoque/lotes` — deve aparecer o lote com badge colorido.
5. Pra testar o histórico de procedimentos, é necessário chamar `registrarProcedimentoRealizado()` via SQL/API direto (Sprint 6 vai plugar no fluxo de consulta).

## Decisões importantes

| Tema | Decisão | Por quê |
| --- | --- | --- |
| `procedimentos_realizados` separado de `procedimentos` | Sim — não muda o catálogo legado | Catálogo é configuração; realização é evento. Conceitos distintos. |
| `produtos_usados jsonb` | Em vez de tabela `produtos_procedimento` | Snapshot do que foi consumido fica imutável; consulta agregada simples; sem JOINs extras na hora de listar histórico |
| Foto produto | URL externa | Storage upload precisa de bucket configurado (Sprint 6) |
| Decremento atômico | Sequencial via JS (não transação SQL) | Limitação do Supabase client; ok pro volume esperado; cron pode reconciliar |
| Alerta de vencimento | 4 thresholds (vencido / <30 / <90 / ok) | Padrão ANVISA + visualmente claro |

## Métricas de build

```
/estoque                  5.74 kB    200 kB First Load
/estoque/[id]             5.58 kB    200 kB
/estoque/fornecedores     3.82 kB    191 kB
/estoque/lotes            7.18 kB    197 kB
/estoque/procedimentos    6.31 kB    189 kB
```

Bundle compartilhado segue em 86.9 kB.

## Bloqueios

Nenhum.
