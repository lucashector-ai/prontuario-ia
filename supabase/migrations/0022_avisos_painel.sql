-- ============================================================================
-- 0022 — Recados na TV da sala de espera (ex.: médico atrasado)
--
-- Um recado aparece em destaque no painel até expirar ou ser retirado.
-- Usado pelo "Estou atrasado" do consultório e pela recepção.
-- Idempotente.
-- ============================================================================

create table if not exists avisos_painel (
  id         uuid primary key default gen_random_uuid(),
  clinica_id uuid not null,
  setor_id   uuid references setores(id) on delete cascade,   -- null = todas as salas de espera
  medico_id  uuid,                                            -- recado de atraso de um médico
  tipo       text not null default 'recado',                  -- recado | atraso
  texto      text not null,
  expira_em  timestamptz not null,
  criado_por uuid,
  criado_em  timestamptz not null default now()
);
create index if not exists avisos_painel_ativos_idx on avisos_painel (clinica_id, expira_em desc);

alter table avisos_painel enable row level security;
drop policy if exists c360_acesso on public.avisos_painel;
create policy c360_acesso on public.avisos_painel for all to authenticated
  using (c360_clinica() is not null and clinica_id = c360_clinica())
  with check (c360_clinica() is not null and clinica_id = c360_clinica());

notify pgrst, 'reload schema';
