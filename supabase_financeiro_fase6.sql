-- ============================================================================
-- Clinical 360 — Módulo Financeiro Fase 6
-- Multiunidade + scaffold de gateway de pagamento — datado 2026-05-21
--
-- Rodar DEPOIS de supabase_financeiro_setup.sql. Idempotente.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. unidades — filiais / unidades da clínica
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists unidades (
  id          uuid primary key default gen_random_uuid(),
  clinica_id  uuid not null references clinicas(id) on delete cascade,
  nome        text not null,
  endereco    text,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_unidades_clinica on unidades(clinica_id);

drop trigger if exists trg_unidades_touch on unidades;
create trigger trg_unidades_touch before update on unidades
  for each row execute function fn_touch_updated_at();

alter table unidades disable row level security;

-- unidade_id nas tabelas financeiras (nulo = consolidado / matriz)
alter table comandas            add column if not exists unidade_id uuid references unidades(id) on delete set null;
alter table despesas            add column if not exists unidade_id uuid references unidades(id) on delete set null;
alter table recebimentos        add column if not exists unidade_id uuid references unidades(id) on delete set null;
alter table movimentacoes_caixa add column if not exists unidade_id uuid references unidades(id) on delete set null;
alter table repasses            add column if not exists unidade_id uuid references unidades(id) on delete set null;

create index if not exists idx_comandas_unidade            on comandas(unidade_id);
create index if not exists idx_despesas_unidade            on despesas(unidade_id);
create index if not exists idx_recebimentos_unidade        on recebimentos(unidade_id);
create index if not exists idx_movcaixa_unidade            on movimentacoes_caixa(unidade_id);
create index if not exists idx_repasses_unidade            on repasses(unidade_id);


-- ────────────────────────────────────────────────────────────────────────────
-- 2. gateway_config — configuração do provedor de pagamento (scaffold)
--    Credenciais sensíveis NÃO ficam aqui — entram via env quando o
--    provedor real for conectado. 'config' guarda apenas ajustes não-secretos.
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists gateway_config (
  id          uuid primary key default gen_random_uuid(),
  clinica_id  uuid not null unique references clinicas(id) on delete cascade,
  provedor    text,
  ativo       boolean not null default false,
  ambiente    text not null default 'sandbox' check (ambiente in ('sandbox','producao')),
  config      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_gateway_config_touch on gateway_config;
create trigger trg_gateway_config_touch before update on gateway_config
  for each row execute function fn_touch_updated_at();

alter table gateway_config disable row level security;


-- ────────────────────────────────────────────────────────────────────────────
-- 3. cobrancas — cobranças geradas via gateway (PIX, cartão, boleto, link)
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists cobrancas (
  id             uuid primary key default gen_random_uuid(),
  clinica_id     uuid not null references clinicas(id) on delete cascade,
  unidade_id     uuid references unidades(id) on delete set null,
  recebimento_id uuid references recebimentos(id) on delete set null,
  paciente_id    uuid references pacientes(id) on delete set null,
  valor          numeric(10,2) not null,
  metodo         text not null check (metodo in ('pix','cartao','boleto','link')),
  provedor       text,
  status         text not null default 'pendente'
                   check (status in ('pendente','pago','expirado','cancelado','erro')),
  link_pagamento text,
  qr_code        text,
  external_id    text,
  expira_em      timestamptz,
  pago_em        timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_cobrancas_clinica        on cobrancas(clinica_id);
create index if not exists idx_cobrancas_clinica_status on cobrancas(clinica_id, status);
create index if not exists idx_cobrancas_recebimento    on cobrancas(recebimento_id);

drop trigger if exists trg_cobrancas_touch on cobrancas;
create trigger trg_cobrancas_touch before update on cobrancas
  for each row execute function fn_touch_updated_at();

alter table cobrancas disable row level security;

-- ============================================================================
-- FIM
-- ============================================================================
