-- ============================================================================
-- 0020 — Triagem (enfermagem) antes do médico
--
-- Com a triagem ligada na sala de espera, o check-in manda o paciente para
-- "aguardando_triagem". A enfermagem chama (TV), registra sinais vitais, queixa e
-- a classificação de risco (cores), e o paciente entra na fila do médico ordenado
-- pela gravidade. Classificação própria por cores — não usa o protocolo
-- Manchester (marca/licença do GBCR).
-- Idempotente.
-- ============================================================================

alter table setores add column if not exists usa_triagem boolean not null default false;

alter table atendimentos add column if not exists risco text;   -- vermelho | laranja | amarelo | verde | azul
do $$ begin
  alter table atendimentos add constraint atendimentos_risco_chk check (risco is null or risco in ('vermelho', 'laranja', 'amarelo', 'verde', 'azul'));
exception when duplicate_object then null; end $$;

-- Novos estados da fila
alter table atendimentos drop constraint if exists atendimentos_status_chk;
alter table atendimentos add constraint atendimentos_status_chk
  check (status in ('aguardando_triagem', 'em_triagem', 'aguardando', 'chamado', 'em_atendimento', 'finalizado', 'ausente', 'cancelado'));

create table if not exists triagens (
  id              uuid primary key default gen_random_uuid(),
  clinica_id      uuid not null,
  atendimento_id  uuid references atendimentos(id) on delete cascade,
  paciente_id     uuid references pacientes(id) on delete set null,
  profissional_id uuid,                 -- quem fez a triagem (medicos.id da enfermagem/recepção)
  pa_sistolica    integer,
  pa_diastolica   integer,
  fc              integer,              -- frequência cardíaca (bpm)
  fr              integer,              -- frequência respiratória (irpm)
  temperatura     numeric(4,1),
  spo2            integer,              -- saturação (%)
  glicemia        integer,              -- mg/dL
  peso            numeric(5,1),         -- kg
  altura          integer,              -- cm
  dor             integer,              -- 0 a 10
  queixa          text,
  observacoes     text,
  risco           text not null,
  criado_em       timestamptz not null default now()
);
do $$ begin
  alter table triagens add constraint triagens_risco_chk check (risco in ('vermelho', 'laranja', 'amarelo', 'verde', 'azul'));
exception when duplicate_object then null; end $$;
create index if not exists triagens_atendimento_idx on triagens (atendimento_id);
create index if not exists triagens_paciente_idx on triagens (paciente_id, criado_em desc);

alter table triagens enable row level security;
drop policy if exists c360_acesso on public.triagens;
create policy c360_acesso on public.triagens for all to authenticated
  using (c360_clinica() is not null and clinica_id = c360_clinica())
  with check (c360_clinica() is not null and clinica_id = c360_clinica());

-- Fila do médico: gravidade da triagem primeiro, depois prioridade da lei, depois horário
create or replace function public.c360_chamar_proximo(p_medico uuid, p_dia date, p_consultorio uuid)
returns setof atendimentos language plpgsql security definer set search_path = public as $$
declare alvo uuid;
begin
  select id into alvo from atendimentos
  where medico_id = p_medico and dia = p_dia and status = 'aguardando'
  order by case risco when 'vermelho' then 0 when 'laranja' then 1 when 'amarelo' then 2 else 3 end,
           case prioridade when 'prioritario_80' then 0 when 'prioritario' then 1 when 'doador' then 2 else 3 end,
           coalesce(horario_previsto, chegada_em), chegada_em
  limit 1
  for update skip locked;

  if alvo is null then return; end if;

  return query
  update atendimentos set status = 'chamado', chamado_em = now(), chamadas = chamadas + 1,
         consultorio_id = coalesce(p_consultorio, consultorio_id), atualizado_em = now()
  where id = alvo
  returning *;
end $$;
revoke all on function public.c360_chamar_proximo(uuid, date, uuid) from public, anon, authenticated;

notify pgrst, 'reload schema';
