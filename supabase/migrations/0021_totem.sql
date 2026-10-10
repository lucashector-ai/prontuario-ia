-- ============================================================================
-- 0021 — Totem de autoatendimento + senhas de balcão
--
-- Totem (tablet/tela de toque na entrada, link secreto por sala de espera):
--   • "Tenho consulta": CPF → confirma o agendamento de hoje → check-in → senha
--   • "Não tenho horário": senha de balcão (R001) que a recepção chama na TV
-- O link do totem é diferente do link da TV (o totem grava; a TV só lê).
-- Idempotente.
-- ============================================================================

alter table setores add column if not exists totem_ativo boolean not null default false;
alter table setores add column if not exists totem_token text;
update setores set totem_token = replace(gen_random_uuid()::text, '-', '') where totem_token is null;
alter table setores alter column totem_token set default replace(gen_random_uuid()::text, '-', '');
create unique index if not exists setores_totem_token_uniq on setores (totem_token);

-- Senhas de quem chega sem horário (ou sem saber o CPF): fila do balcão da recepção
create table if not exists senhas_balcao (
  id          uuid primary key default gen_random_uuid(),
  clinica_id  uuid not null,
  setor_id    uuid references setores(id) on delete set null,
  dia         date not null,
  senha       text not null,
  prioridade  text not null default 'normal',
  motivo      text,                    -- sem_horario | sem_cpf | informacao
  status      text not null default 'aguardando',
  origem      text not null default 'totem',
  chamado_em  timestamptz,
  guiche      text,
  atendido_em timestamptz,
  atendido_por uuid,
  criado_em   timestamptz not null default now()
);
do $$ begin
  alter table senhas_balcao add constraint senhas_balcao_status_chk check (status in ('aguardando', 'chamado', 'atendido', 'desistiu'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table senhas_balcao add constraint senhas_balcao_prioridade_chk check (prioridade in ('normal', 'prioritario', 'prioritario_80', 'doador'));
exception when duplicate_object then null; end $$;
create unique index if not exists senhas_balcao_uniq on senhas_balcao (clinica_id, dia, senha);
create index if not exists senhas_balcao_fila_idx on senhas_balcao (clinica_id, dia, status);

alter table senhas_balcao enable row level security;
drop policy if exists c360_acesso on public.senhas_balcao;
create policy c360_acesso on public.senhas_balcao for all to authenticated
  using (c360_clinica() is not null and clinica_id = c360_clinica())
  with check (c360_clinica() is not null and clinica_id = c360_clinica());

do $$ begin
  alter publication supabase_realtime add table senhas_balcao;
exception when duplicate_object then null; when undefined_object then null; end $$;

notify pgrst, 'reload schema';
