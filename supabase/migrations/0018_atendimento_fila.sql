-- ============================================================================
-- 0018 — Fluxo de atendimento: recepção → senha → painel da TV → consultório
--
--   setores          áreas de espera (ex.: "Ambulatório 2º andar"), cada uma com
--                    um painel de TV próprio (link secreto painel_token)
--   consultorios     salas onde o médico atende, dentro de um setor
--   atendimentos     a passagem do paciente pela clínica num dia: chegada,
--                    senha, chamada, atendimento, fim. Liga ao agendamento.
--   chamadas_painel  cada vez que alguém foi chamado (o que a TV mostra)
--   senhas_contador  numeração das senhas por clínica, dia e prefixo
--
-- Concorrência: a senha sai de um contador atômico (nunca repete) e "chamar o
-- próximo" trava a linha escolhida (for update skip locked) — dois cliques ao
-- mesmo tempo nunca chamam o mesmo paciente.
-- Idempotente.
-- ============================================================================

create table if not exists setores (
  id              uuid primary key default gen_random_uuid(),
  clinica_id      uuid not null,
  nome            text not null,
  ordem           integer not null default 0,
  ativo           boolean not null default true,
  -- Painel da TV: link secreto, o que exibir (LGPD) e voz
  painel_token    text not null unique default replace(gen_random_uuid()::text, '-', ''),
  painel_exibicao text not null default 'senha_nome',
  painel_voz      boolean not null default true,
  painel_mensagem text,
  avisar_whatsapp boolean not null default true,  -- "é a sua vez" / "você é o próximo"
  criado_em       timestamptz not null default now()
);
do $$ begin
  alter table setores add constraint setores_exibicao_chk check (painel_exibicao in ('senha', 'senha_nome', 'nome_completo'));
exception when duplicate_object then null; end $$;
create index if not exists setores_clinica_idx on setores (clinica_id, ordem);

create table if not exists consultorios (
  id         uuid primary key default gen_random_uuid(),
  clinica_id uuid not null,
  setor_id   uuid not null references setores(id) on delete cascade,
  nome       text not null,
  ordem      integer not null default 0,
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);
create index if not exists consultorios_clinica_idx on consultorios (clinica_id, setor_id, ordem);

create table if not exists atendimentos (
  id              uuid primary key default gen_random_uuid(),
  clinica_id      uuid not null,
  medico_id       uuid not null,
  paciente_id     uuid references pacientes(id) on delete set null,
  agendamento_id  uuid,
  setor_id        uuid references setores(id) on delete set null,
  consultorio_id  uuid references consultorios(id) on delete set null,
  dia             date not null,
  senha           text not null,
  status          text not null default 'aguardando',
  prioridade      text not null default 'normal',
  origem          text not null default 'recepcao',
  horario_previsto timestamptz,           -- hora do agendamento (ordena a fila)
  chegada_em      timestamptz not null default now(),
  chamado_em      timestamptz,
  chamadas        integer not null default 0,
  inicio_em       timestamptz,
  fim_em          timestamptz,
  observacao      text,
  criado_por      uuid,
  atualizado_em   timestamptz not null default now()
);
do $$ begin
  alter table atendimentos add constraint atendimentos_status_chk
    check (status in ('aguardando', 'chamado', 'em_atendimento', 'finalizado', 'ausente', 'cancelado'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table atendimentos add constraint atendimentos_prioridade_chk
    check (prioridade in ('normal', 'prioritario', 'prioritario_80', 'doador'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table atendimentos add constraint atendimentos_origem_chk
    check (origem in ('recepcao', 'whatsapp', 'totem', 'encaixe'));
exception when duplicate_object then null; end $$;
-- Um agendamento só gera um atendimento (check-in duplo vira o mesmo)
create unique index if not exists atendimentos_agendamento_uniq on atendimentos (agendamento_id) where agendamento_id is not null;
create unique index if not exists atendimentos_senha_uniq on atendimentos (clinica_id, dia, senha);
create index if not exists atendimentos_fila_idx on atendimentos (clinica_id, dia, status);
create index if not exists atendimentos_medico_idx on atendimentos (medico_id, dia, status);

create table if not exists chamadas_painel (
  id             uuid primary key default gen_random_uuid(),
  clinica_id     uuid not null,
  setor_id       uuid references setores(id) on delete cascade,
  atendimento_id uuid references atendimentos(id) on delete cascade,
  senha          text not null,
  nome_exibicao  text,          -- já reduzido conforme painel_exibicao
  local          text not null, -- "Consultório 3"
  criado_em      timestamptz not null default now()
);
create index if not exists chamadas_painel_setor_idx on chamadas_painel (setor_id, criado_em desc);

create table if not exists senhas_contador (
  clinica_id uuid not null,
  dia        date not null,
  prefixo    text not null,
  ultimo     integer not null default 0,
  primary key (clinica_id, dia, prefixo)
);

-- Consultório onde o médico costuma atender (a recepção manda o paciente para o painel desse setor)
alter table medicos add column if not exists consultorio_id uuid;

-- ── Próxima senha (atômica: duas recepções ao mesmo tempo nunca pegam a mesma) ──
create or replace function public.c360_proxima_senha(p_clinica uuid, p_dia date, p_prefixo text)
returns text language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  insert into senhas_contador (clinica_id, dia, prefixo, ultimo) values (p_clinica, p_dia, p_prefixo, 1)
  on conflict (clinica_id, dia, prefixo) do update set ultimo = senhas_contador.ultimo + 1
  returning ultimo into n;
  return p_prefixo || lpad(n::text, 3, '0');
end $$;

-- ── Chamar o próximo da fila do médico ──────────────────────────────────────
-- Ordem: 80+ → prioritários → doador de sangue → demais; dentro de cada grupo,
-- pela hora agendada (ou chegada, para encaixes).
create or replace function public.c360_chamar_proximo(p_medico uuid, p_dia date, p_consultorio uuid)
returns setof atendimentos language plpgsql security definer set search_path = public as $$
declare alvo uuid;
begin
  select id into alvo from atendimentos
  where medico_id = p_medico and dia = p_dia and status = 'aguardando'
  order by case prioridade when 'prioritario_80' then 0 when 'prioritario' then 1 when 'doador' then 2 else 3 end,
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

revoke all on function public.c360_proxima_senha(uuid, date, text) from public, anon, authenticated;
revoke all on function public.c360_chamar_proximo(uuid, date, uuid) from public, anon, authenticated;

-- ── Segurança (mesmo padrão da 0016): só a clínica do token vê ──────────────
alter table setores          enable row level security;
alter table consultorios     enable row level security;
alter table atendimentos     enable row level security;
alter table chamadas_painel  enable row level security;
alter table senhas_contador  enable row level security;   -- só servidor

do $$
declare t text;
begin
  foreach t in array array['setores', 'consultorios', 'atendimentos', 'chamadas_painel'] loop
    execute format('drop policy if exists c360_acesso on public.%I', t);
    execute format(
      'create policy c360_acesso on public.%I for all to authenticated using (c360_clinica() is not null and clinica_id = c360_clinica()) with check (c360_clinica() is not null and clinica_id = c360_clinica())', t);
  end loop;
  -- Médico sem clínica no token ainda enxerga a própria fila
  drop policy if exists c360_medico on public.atendimentos;
  create policy c360_medico on public.atendimentos for select to authenticated using (medico_id = c360_medico());
end $$;

-- Tempo real: recepção e consultório atualizam sozinhos
do $$ begin
  alter publication supabase_realtime add table atendimentos;
exception when duplicate_object then null; when undefined_object then null; end $$;

notify pgrst, 'reload schema';
