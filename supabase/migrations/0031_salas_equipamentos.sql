-- 0031 · Salas e equipamentos sem conflito na agenda
-- Sala = consultório que já existe (0018), agora com tipo e local. Equipamentos fixos numa sala ou móveis.
-- O procedimento diz do que precisa (tipo de sala e tipos de equipamento). Cada reserva ocupa UMA
-- sala ou UM equipamento num período; o banco recusa sobreposição (exclusion constraint), inclusive
-- com duas pessoas marcando ao mesmo tempo. Manutenção = reserva sem agendamento.
create extension if not exists btree_gist;

alter table consultorios add column if not exists tipo text not null default 'consultorio';
alter table consultorios add column if not exists descricao_local text;

alter table procedimentos add column if not exists tipo_sala text;                       -- null = qualquer sala
alter table procedimentos add column if not exists equipamentos_tipos text[] not null default '{}';

create table if not exists equipamentos (
  id             uuid primary key default gen_random_uuid(),
  clinica_id     uuid not null,
  nome           text not null,
  tipo           text not null,                      -- 'laser', 'ultrassom'... (o procedimento pede pelo tipo)
  consultorio_id uuid references consultorios(id) on delete set null,   -- fixo na sala; null = móvel
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now()
);
create index if not exists equipamentos_clinica_idx on equipamentos (clinica_id, tipo);

create table if not exists medico_sala_padrao (
  clinica_id     uuid not null,
  medico_id      uuid not null references medicos(id) on delete cascade,
  consultorio_id uuid not null references consultorios(id) on delete cascade,
  primary key (clinica_id, medico_id)
);

create table if not exists reservas_recurso (
  id             uuid primary key default gen_random_uuid(),
  clinica_id     uuid not null,
  agendamento_id uuid references agendamentos(id) on delete cascade,   -- null = manutenção/bloqueio
  consultorio_id uuid references consultorios(id) on delete cascade,
  equipamento_id uuid references equipamentos(id) on delete cascade,
  periodo        tstzrange not null,
  motivo         text not null default 'agendamento' check (motivo in ('agendamento', 'manutencao')),
  observacao     text,
  criado_em      timestamptz not null default now(),
  check ((consultorio_id is null) <> (equipamento_id is null)),
  constraint reservas_sala_sem_conflito exclude using gist (consultorio_id with =, periodo with &&) where (consultorio_id is not null),
  constraint reservas_equip_sem_conflito exclude using gist (equipamento_id with =, periodo with &&) where (equipamento_id is not null)
);
create index if not exists reservas_agendamento_idx on reservas_recurso (agendamento_id);
create index if not exists reservas_clinica_periodo_idx on reservas_recurso using gist (clinica_id, periodo);

-- Agendamento mudou de horário/duração: move as reservas (se o novo horário colidir, solta a reserva
-- em vez de travar a remarcação). Cancelado ou faltou: libera as reservas.
create or replace function public.c360_sincronizar_reservas() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  novo tstzrange;
begin
  if new.status in ('cancelado', 'faltou') then
    delete from reservas_recurso where agendamento_id = new.id;
    return new;
  end if;
  if new.data_hora is distinct from old.data_hora or new.duracao is distinct from old.duracao then
    novo := tstzrange(new.data_hora, new.data_hora + make_interval(mins => coalesce(nullif(regexp_replace(coalesce(new.duracao, '30'), '\D', '', 'g'), '')::int, 30)), '[)');
    begin
      update reservas_recurso set periodo = novo where agendamento_id = new.id;
    exception when exclusion_violation then
      delete from reservas_recurso where agendamento_id = new.id;
    end;
  end if;
  return new;
end $$;
drop trigger if exists c360_reservas_agendamento on agendamentos;
create trigger c360_reservas_agendamento after update of data_hora, duracao, status on agendamentos
  for each row execute function public.c360_sincronizar_reservas();

alter table equipamentos enable row level security;
alter table medico_sala_padrao enable row level security;
alter table reservas_recurso enable row level security;
revoke all on equipamentos from anon, authenticated;
revoke all on medico_sala_padrao from anon, authenticated;
revoke all on reservas_recurso from anon, authenticated;
revoke all on function public.c360_sincronizar_reservas() from public, anon, authenticated;
