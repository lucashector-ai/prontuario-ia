-- ============================================================================
-- Clinical 360 — Módulo Financeiro Fase 3
-- Repasse médico / comissões — datado 2026-05-21
--
-- Rodar DEPOIS de supabase_financeiro_setup.sql. Idempotente.
-- A tabela 'despesas' já foi criada na Fase 1 — esta fase só adiciona repasses.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. repasse_regras — configuração de comissão por profissional
--    tipo_item NULL = regra padrão do profissional; preenchido = regra específica
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists repasse_regras (
  id              uuid primary key default gen_random_uuid(),
  clinica_id      uuid not null references clinicas(id) on delete cascade,
  profissional_id uuid not null references medicos(id) on delete cascade,
  tipo_item       text check (tipo_item in ('consulta','procedimento','exame','produto','pacote','outro')),
  percentual      numeric(5,2) not null check (percentual >= 0 and percentual <= 100),
  ativo           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_repasse_regras_clinica      on repasse_regras(clinica_id);
create index if not exists idx_repasse_regras_profissional on repasse_regras(clinica_id, profissional_id);

drop trigger if exists trg_repasse_regras_touch on repasse_regras;
create trigger trg_repasse_regras_touch before update on repasse_regras
  for each row execute function fn_touch_updated_at();

alter table repasse_regras disable row level security;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. repasses — repasses gerados (1 por item de comanda paga)
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists repasses (
  id              uuid primary key default gen_random_uuid(),
  clinica_id      uuid not null references clinicas(id) on delete cascade,
  profissional_id uuid not null references medicos(id) on delete cascade,
  comanda_id      uuid references comandas(id) on delete set null,
  comanda_item_id uuid references comanda_itens(id) on delete set null,
  descricao       text,
  base_calculo    numeric(10,2) not null,
  percentual      numeric(5,2) not null,
  valor           numeric(10,2) not null,
  status          text not null default 'pendente'
                    check (status in ('pendente','aprovado','pago','cancelado')),
  competencia     date not null,
  pago_em         timestamptz,
  observacoes     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_repasses_clinica         on repasses(clinica_id);
create index if not exists idx_repasses_clinica_status  on repasses(clinica_id, status);
create index if not exists idx_repasses_profissional    on repasses(clinica_id, profissional_id);
create index if not exists idx_repasses_competencia     on repasses(clinica_id, competencia);
create index if not exists idx_repasses_comanda         on repasses(comanda_id);

drop trigger if exists trg_repasses_touch on repasses;
create trigger trg_repasses_touch before update on repasses
  for each row execute function fn_touch_updated_at();

alter table repasses disable row level security;


-- ────────────────────────────────────────────────────────────────────────────
-- 3. movimentacoes_caixa — inclui 'repasse' como origem de saída
-- ────────────────────────────────────────────────────────────────────────────
alter table movimentacoes_caixa drop constraint if exists movimentacoes_caixa_origem_check;
alter table movimentacoes_caixa add  constraint movimentacoes_caixa_origem_check
  check (origem in ('recebimento','despesa','ajuste_manual','estorno','repasse'));

-- ============================================================================
-- FIM
-- ============================================================================
