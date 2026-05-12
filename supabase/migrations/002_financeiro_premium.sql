-- ============================================================================
-- Sprint 3 — Financeiro Premium
-- Adiciona somente tabelas NOVAS. As existentes (financeiro_movimentacoes,
-- financeiro_categorias, financeiro_contas, financeiro_comissoes_config,
-- financeiro_pacotes) permanecem intactas.
-- Datado: 2026-05-12
-- ============================================================================

-- Pix on-demand: cobranças geradas por agendamento ou avulsas
create table if not exists financeiro_pix_cobrancas (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references clinicas(id) on delete cascade,
  paciente_id uuid references pacientes(id) on delete set null,
  agendamento_id uuid references agendamentos(id) on delete set null,
  movimentacao_id uuid references financeiro_movimentacoes(id) on delete set null,
  valor numeric(10,2) not null check (valor > 0),
  descricao text,
  txid text unique,
  qr_code text,
  qr_code_image_url text,
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'expirado', 'cancelado')),
  expira_em timestamptz,
  pago_em timestamptz,
  criada_em timestamptz not null default now()
);

create index if not exists idx_pix_clinica_status on financeiro_pix_cobrancas(clinica_id, status);
create index if not exists idx_pix_paciente on financeiro_pix_cobrancas(paciente_id);
create index if not exists idx_pix_txid on financeiro_pix_cobrancas(txid);

-- Planos recorrentes: assinaturas mensais (vs pacotes que são compra única)
create table if not exists financeiro_planos_recorrentes (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references clinicas(id) on delete cascade,
  paciente_id uuid not null references pacientes(id) on delete cascade,
  nome text not null,
  descricao text,
  valor_mensal numeric(10,2) not null check (valor_mensal > 0),
  parcelas_total int not null check (parcelas_total > 0),
  parcelas_pagas int not null default 0 check (parcelas_pagas >= 0),
  proximo_vencimento date,
  iniciado_em date not null,
  status text not null default 'ativo' check (status in ('ativo', 'pausado', 'concluido', 'cancelado')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_planos_clinica_status on financeiro_planos_recorrentes(clinica_id, status);
create index if not exists idx_planos_paciente on financeiro_planos_recorrentes(paciente_id);
create index if not exists idx_planos_vencimento on financeiro_planos_recorrentes(proximo_vencimento) where status = 'ativo';

-- RLS desligado (convenção do projeto pra tabelas financeiras)
alter table financeiro_pix_cobrancas disable row level security;
alter table financeiro_planos_recorrentes disable row level security;
