-- ============================================================================
-- Clinical 360 — Financeiro 2.0 · Estágio 4
-- Conciliação bancária — datado 2026-05-21
--
-- Rodar DEPOIS de 0001..0007. Idempotente.
-- ============================================================================

-- Marca de conciliação: indica que a movimentação foi confirmada contra o
-- extrato bancário importado.
alter table movimentacoes_caixa
  add column if not exists conciliado    boolean not null default false;
alter table movimentacoes_caixa
  add column if not exists conciliado_em timestamptz;

create index if not exists idx_movcaixa_conciliacao
  on movimentacoes_caixa(conta_id, conciliado);

-- ============================================================================
-- FIM
-- ============================================================================
