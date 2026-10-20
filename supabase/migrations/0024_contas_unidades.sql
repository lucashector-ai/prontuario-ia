-- 0024 — Contas com uma ou várias unidades
--
--   organizacoes   quem contrata o Clinical 360 (consultório individual, clínica ou rede)
--   clinicas       cada UNIDADE (continua sendo a chave de todos os dados: clinica_id)
--   usuarios       a pessoa, pelo email (uma só, mesmo trabalhando em várias unidades)
--   vinculos       onde a pessoa trabalha e com que papel; aponta para o login que já existe
--                  (clinica_admins ou medicos) daquela unidade. clinica_id vazio = todas as
--                  unidades da organização (dono/gestor da rede).
--
-- Só acrescenta: nenhuma coluna antiga muda e as senhas continuam onde estavam.
-- Tabelas novas: só o servidor lê e grava (RLS ligado, sem política).
-- Idempotente: pode rodar mais de uma vez (o preenchimento só cria o que falta).

create table if not exists organizacoes (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  tipo_conta  text not null default 'clinica' check (tipo_conta in ('individual', 'clinica', 'rede')),
  criado_em   timestamptz not null default now()
);

alter table clinicas add column if not exists organizacao_id  uuid references organizacoes(id) on delete set null;
alter table clinicas add column if not exists apelido_unidade text;   -- "Unidade Centro" (opcional)
create index if not exists idx_clinicas_organizacao on clinicas(organizacao_id);

create table if not exists usuarios (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  nome       text,
  criado_em  timestamptz not null default now()
);
create unique index if not exists usuarios_email_uq on usuarios (lower(trim(email)));

create table if not exists vinculos (
  id                uuid primary key default gen_random_uuid(),
  usuario_id        uuid not null references usuarios(id) on delete cascade,
  organizacao_id    uuid not null references organizacoes(id) on delete cascade,
  clinica_id        uuid references clinicas(id) on delete cascade,      -- null = todas as unidades
  papel             text not null check (papel in ('dono', 'admin', 'medico', 'recepcao', 'enfermagem', 'atendente')),
  clinica_admin_id  uuid,     -- login de administrador usado neste vínculo
  medico_id         uuid,     -- login de médico/recepção/enfermagem usado neste vínculo
  ativo             boolean not null default true,
  criado_em         timestamptz not null default now()
);
create unique index if not exists vinculos_login_uq on vinculos (usuario_id, coalesce(clinica_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(clinica_admin_id, medico_id));
create index if not exists idx_vinculos_usuario on vinculos(usuario_id) where ativo;
create index if not exists idx_vinculos_clinica on vinculos(clinica_id) where ativo;

alter table organizacoes enable row level security;
alter table usuarios     enable row level security;
alter table vinculos     enable row level security;

-- ── Preenchimento a partir do que já existe ─────────────────────────────────
-- 1. Uma organização por clínica que ainda não tem
do $$
declare c record; nova uuid;
begin
  for c in select id, nome, tipo from clinicas where organizacao_id is null loop
    insert into organizacoes (nome, tipo_conta)
    values (coalesce(nullif(c.nome, ''), 'Clínica'), case when c.tipo = 'autonomo' then 'individual' else 'clinica' end)
    returning id into nova;
    update clinicas set organizacao_id = nova where id = c.id;
  end loop;
end $$;

-- 2. Uma pessoa por email
insert into usuarios (email, nome)
select distinct on (lower(trim(email))) lower(trim(email)), nome
from (
  select email, nome, 1 as ordem from clinica_admins where email is not null and trim(email) <> ''
  union all
  select email, nome, 2 from medicos where email is not null and trim(email) <> ''
) x
order by lower(trim(email)), ordem
on conflict do nothing;

-- 3. Vínculos dos administradores
insert into vinculos (usuario_id, organizacao_id, clinica_id, papel, clinica_admin_id)
select u.id, cl.organizacao_id, a.clinica_id, case when coalesce(a.role, 'owner') = 'owner' then 'dono' else 'admin' end, a.id
from clinica_admins a
join usuarios u on lower(trim(u.email)) = lower(trim(a.email))
join clinicas cl on cl.id = a.clinica_id
where cl.organizacao_id is not null
on conflict do nothing;

-- 4. Vínculos de médicos, recepção e enfermagem
insert into vinculos (usuario_id, organizacao_id, clinica_id, papel, medico_id, ativo)
select u.id, cl.organizacao_id, m.clinica_id,
  case m.cargo when 'admin' then (case when cl.tipo = 'autonomo' then 'dono' else 'admin' end)
               when 'recepcionista' then 'recepcao' when 'enfermagem' then 'enfermagem' else 'medico' end,
  m.id, coalesce(m.ativo, true)
from medicos m
join usuarios u on lower(trim(u.email)) = lower(trim(m.email))
join clinicas cl on cl.id = m.clinica_id
where cl.organizacao_id is not null
on conflict do nothing;

notify pgrst, 'reload schema';
