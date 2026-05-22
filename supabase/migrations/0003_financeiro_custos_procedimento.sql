-- ============================================================================
-- Clinical 360 — Módulo Financeiro Fase 4
-- Custo de procedimentos (para cálculo de margem) — datado 2026-05-21
--
-- Rodar DEPOIS de supabase_financeiro_setup.sql. Idempotente.
-- ============================================================================

-- Custos por procedimento — usados para calcular margem e ROI por serviço.
alter table procedimentos add column if not exists custo_insumos     numeric(10,2) not null default 0;
alter table procedimentos add column if not exists custo_operacional numeric(10,2) not null default 0;

-- ============================================================================
-- FIM
-- ============================================================================
