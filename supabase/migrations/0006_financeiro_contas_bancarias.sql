-- ============================================================================
-- Clinical 360 — Financeiro 2.0 · Estágio 1
-- Contas bancárias — datado 2026-05-21
--
-- Rodar DEPOIS de 0001..0005. Idempotente.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. contas_bancarias — onde o dinheiro fica (bancos, caixa, carteiras)
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists contas_bancarias (
  id            uuid primary key default gen_random_uuid(),
  clinica_id    uuid not null references clinicas(id) on delete cascade,
  unidade_id    uuid references unidades(id) on delete set null,
  nome          text not null,
  instituicao   text,
  tipo          text not null default 'corrente'
                  check (tipo in ('corrente','poupanca','caixa','carteira_digital')),
  saldo_inicial numeric(12,2) not null default 0,
  ativo         boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_contas_bancarias_clinica on contas_bancarias(clinica_id);

drop trigger if exists trg_contas_bancarias_touch on contas_bancarias;
create trigger trg_contas_bancarias_touch before update on contas_bancarias
  for each row execute function fn_touch_updated_at();

alter table contas_bancarias disable row level security;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. movimentacoes_caixa — cada movimento pertence a uma conta
-- ────────────────────────────────────────────────────────────────────────────
alter table movimentacoes_caixa
  add column if not exists conta_id uuid references contas_bancarias(id) on delete set null;
create index if not exists idx_movcaixa_conta on movimentacoes_caixa(conta_id);

-- 'transferencia' entra como origem válida (transferência entre contas)
alter table movimentacoes_caixa drop constraint if exists movimentacoes_caixa_origem_check;
alter table movimentacoes_caixa add  constraint movimentacoes_caixa_origem_check
  check (origem in ('recebimento','despesa','ajuste_manual','estorno','repasse','transferencia'));

-- ============================================================================
-- FIM
-- ============================================================================
