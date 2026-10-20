-- 0026 · Portal do paciente (/p/<token>)
-- Link pessoal do paciente, sem login: próxima consulta (confirmar, remarcar, "cheguei"),
-- formulários pendentes e retorno. Só o servidor (service role) lê esta tabela.
create table if not exists portal_tokens (
  token        text primary key,
  paciente_id  uuid not null references pacientes(id) on delete cascade,
  clinica_chave uuid not null,          -- clinicas.id, ou o id do médico autônomo
  criado_em    timestamptz not null default now(),
  expira_em    timestamptz not null default now() + interval '30 days',
  revogado_em  timestamptz,
  ultimo_acesso_em timestamptz
);
create index if not exists portal_tokens_paciente_idx on portal_tokens (paciente_id);
alter table portal_tokens enable row level security;
revoke all on portal_tokens from anon, authenticated;

-- Check-in feito pelo próprio paciente no portal
alter table atendimentos drop constraint if exists atendimentos_origem_chk;
alter table atendimentos add constraint atendimentos_origem_chk
  check (origem in ('recepcao', 'whatsapp', 'totem', 'encaixe', 'portal'));
