-- ============================================================================
-- Clinical 360 — Financeiro 2.0 · Estágio 3
-- Log de auditoria — datado 2026-05-21
--
-- Rodar DEPOIS de 0001..0006. Idempotente.
-- ============================================================================

-- Trilha de auditoria: registra cada ação financeira sensível (fechamento de
-- comanda, baixas, pagamentos, transferências, ajustes) para rastrear erros.
create table if not exists financeiro_auditoria (
  id          uuid primary key default gen_random_uuid(),
  clinica_id  uuid not null references clinicas(id) on delete cascade,
  usuario_id  uuid,
  acao        text not null,
  entidade    text,
  entidade_id uuid,
  detalhe     text,
  valor       numeric(12,2),
  created_at  timestamptz not null default now()
);
create index if not exists idx_fin_auditoria_clinica      on financeiro_auditoria(clinica_id);
create index if not exists idx_fin_auditoria_clinica_data on financeiro_auditoria(clinica_id, created_at desc);

alter table financeiro_auditoria disable row level security;

-- ============================================================================
-- FIM
-- ============================================================================
