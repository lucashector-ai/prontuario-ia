-- 0027 · Créditos de IA
-- Uso: cada ação de IA cobrada vira uma linha (o saldo do mês = créditos do plano + pacotes − uso).
-- Pacotes: créditos extras comprados (ou cortesia), válidos por 60 dias.
-- clinica_chave = clinicas.id (ou o id do médico em contas antigas sem clínica).
create table if not exists creditos_uso (
  id            uuid primary key default gen_random_uuid(),
  clinica_chave uuid not null,
  usuario_id    uuid,
  motivo        text not null check (motivo in ('consulta', 'exame', 'assistente', 'sofia')),
  creditos      numeric(8,2) not null check (creditos >= 0),
  detalhe       text,
  criado_em     timestamptz not null default now()
);
create index if not exists creditos_uso_chave_data_idx on creditos_uso (clinica_chave, criado_em desc);

create table if not exists creditos_pacotes (
  id            uuid primary key default gen_random_uuid(),
  clinica_chave uuid not null,
  creditos      numeric(8,2) not null check (creditos > 0),
  origem        text not null default 'compra' check (origem in ('compra', 'cortesia', 'profissional_extra')),
  observacao    text,
  criado_em     timestamptz not null default now(),
  expira_em     timestamptz not null default now() + interval '60 days'
);
create index if not exists creditos_pacotes_chave_idx on creditos_pacotes (clinica_chave, expira_em);

alter table creditos_uso enable row level security;
alter table creditos_pacotes enable row level security;
revoke all on creditos_uso from anon, authenticated;
revoke all on creditos_pacotes from anon, authenticated;
