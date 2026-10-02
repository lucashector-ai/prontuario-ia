-- 0011 — Retornos e reativação de pacientes
--
-- retornos               : retorno previsto de um paciente (manual, sugerido pela IA ou vindo da consulta).
--                          O cron /api/cron/retornos lembra o paciente N dias antes (lembrete_enviado_em).
-- campanhas_reativacao   : campanha de WhatsApp para pacientes inativos.
-- campanhas_envios       : uma linha por destinatário da campanha.
--                          Além de enviado|falhou|respondeu, usa 'pendente' (fila) e 'processando'
--                          (reservado por um lote) para o envio ser retomável e nunca duplicar.
-- Idempotente.

create table if not exists retornos (
  id uuid primary key default gen_random_uuid(),
  medico_id uuid not null,
  paciente_id uuid not null references pacientes(id) on delete cascade,
  consulta_id uuid,
  data_prevista date not null,
  motivo text,
  origem text not null default 'manual',
  status text not null default 'pendente',
  lembrete_enviado_em timestamptz,
  agendamento_id uuid,
  criado_em timestamptz not null default now()
);

do $$ begin
  alter table retornos add constraint retornos_origem_chk check (origem in ('manual', 'ia', 'consulta'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table retornos add constraint retornos_status_chk check (status in ('pendente', 'lembrado', 'agendado', 'concluido', 'descartado'));
exception when duplicate_object then null; end $$;

create index if not exists retornos_medico_data_idx on retornos (medico_id, data_prevista);
create index if not exists retornos_medico_status_idx on retornos (medico_id, status);
create index if not exists retornos_paciente_idx on retornos (paciente_id);
-- Cron: pendentes ainda sem lembrete
create index if not exists retornos_lembrete_idx on retornos (data_prevista) where status = 'pendente' and lembrete_enviado_em is null;

create table if not exists campanhas_reativacao (
  id uuid primary key default gen_random_uuid(),
  medico_id uuid not null,
  nome text not null,
  mensagem text not null,
  filtro jsonb not null default '{}'::jsonb,
  total_destinatarios integer not null default 0,
  enviados integer not null default 0,
  falhas integer not null default 0,
  status text not null default 'rascunho',
  criado_em timestamptz not null default now(),
  concluida_em timestamptz
);

do $$ begin
  alter table campanhas_reativacao add constraint campanhas_reativacao_status_chk check (status in ('rascunho', 'enviando', 'concluida'));
exception when duplicate_object then null; end $$;

create index if not exists campanhas_reativacao_medico_idx on campanhas_reativacao (medico_id, criado_em desc);
create index if not exists campanhas_reativacao_status_idx on campanhas_reativacao (status) where status = 'enviando';

create table if not exists campanhas_envios (
  id uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references campanhas_reativacao(id) on delete cascade,
  paciente_id uuid,
  telefone text,
  status text not null default 'pendente',
  erro text,
  enviado_em timestamptz
);

do $$ begin
  alter table campanhas_envios add constraint campanhas_envios_status_chk check (status in ('pendente', 'processando', 'enviado', 'falhou', 'respondeu'));
exception when duplicate_object then null; end $$;

create index if not exists campanhas_envios_campanha_idx on campanhas_envios (campanha_id, status);
create unique index if not exists campanhas_envios_unico_idx on campanhas_envios (campanha_id, paciente_id);
create index if not exists campanhas_envios_paciente_idx on campanhas_envios (paciente_id);
