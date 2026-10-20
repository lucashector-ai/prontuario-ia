-- 0029 · Portal do paciente, etapa 2
-- paciente_anexos: arquivos que o paciente envia pelo portal (exames antigos, fotos de pedidos).
--   O arquivo fica no bucket privado 'paciente-anexos'; a equipe abre por link assinado.
-- documentos_paciente: documentos emitidos (atestado, pedido de exames) liberados no portal.
create table if not exists paciente_anexos (
  id            uuid primary key default gen_random_uuid(),
  paciente_id   uuid not null references pacientes(id) on delete cascade,
  clinica_chave uuid not null,
  caminho       text not null,
  nome_arquivo  text not null,
  tipo_mime     text,
  tamanho       integer,
  origem        text not null default 'portal' check (origem in ('portal', 'equipe')),
  enviado       boolean not null default false,   -- vira true quando o upload termina
  criado_em     timestamptz not null default now()
);
create index if not exists paciente_anexos_paciente_idx on paciente_anexos (paciente_id, criado_em desc);

create table if not exists documentos_paciente (
  id            uuid primary key default gen_random_uuid(),
  paciente_id   uuid not null references pacientes(id) on delete cascade,
  clinica_chave uuid not null,
  medico_id     uuid,
  tipo          text not null check (tipo in ('atestado', 'comparecimento', 'pedido_exames', 'outro')),
  titulo        text not null,
  html          text not null,
  liberado_portal boolean not null default true,
  criado_em     timestamptz not null default now()
);
create index if not exists documentos_paciente_paciente_idx on documentos_paciente (paciente_id, criado_em desc);

alter table paciente_anexos enable row level security;
alter table documentos_paciente enable row level security;
revoke all on paciente_anexos from anon, authenticated;
revoke all on documentos_paciente from anon, authenticated;
