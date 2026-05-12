-- ============================================================================
-- Sprint 2 — Portal do Paciente Premium
-- Schema novo (sem prefixo, será mergeado direto no schema principal).
-- Datado: 2026-05-12
-- ============================================================================

-- 1) Vínculo paciente ↔ portal + auth via magic link
create table if not exists pacientes_portal (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes(id) on delete cascade,
  email text not null unique,
  magic_link_token text,
  magic_link_expira_em timestamptz,
  ultima_visita timestamptz,
  preferencias jsonb not null default '{
    "notificacoes_email": true,
    "notificacoes_whatsapp": true,
    "idioma": "pt-BR"
  }'::jsonb,
  criado_em timestamptz not null default now()
);

create index if not exists idx_pacientes_portal_paciente on pacientes_portal(paciente_id);
create index if not exists idx_pacientes_portal_email on pacientes_portal(email);

-- 2) Documentos visíveis pelo paciente (atestados, receitas, exames, etc)
create table if not exists portal_documentos (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes(id) on delete cascade,
  tipo text not null check (tipo in ('atestado', 'receita', 'exame_laudo', 'recibo', 'outro')),
  titulo text not null,
  url text not null,
  assinado_em timestamptz,
  criado_em timestamptz not null default now()
);

create index if not exists idx_portal_documentos_paciente on portal_documentos(paciente_id, criado_em desc);

-- 3) Chat real-time paciente ↔ clínica/Sofia
create table if not exists portal_chat_mensagens (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes(id) on delete cascade,
  remetente text not null check (remetente in ('paciente', 'clinica', 'sofia')),
  conteudo text not null,
  lida boolean not null default false,
  criada_em timestamptz not null default now()
);

create index if not exists idx_portal_chat_paciente_data on portal_chat_mensagens(paciente_id, criada_em);
create index if not exists idx_portal_chat_nao_lidas on portal_chat_mensagens(paciente_id, lida) where lida = false;

-- 4) Protocolos de tratamento (visão paciente)
create table if not exists portal_protocolos (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes(id) on delete cascade,
  nome text not null,
  descricao text,
  iniciado_em date not null,
  termina_em date,
  proximo_passo text,
  progresso_percentual int not null default 0 check (progresso_percentual between 0 and 100),
  status text not null default 'ativo' check (status in ('ativo', 'concluido', 'pausado', 'cancelado')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_portal_protocolos_paciente on portal_protocolos(paciente_id, status);

-- ============================================================================
-- RLS — alinhado com convenção do projeto atual (DESLIGADO nas tabelas críticas).
-- Quando habilitar, política sugerida:
--   USING (paciente_id = (select paciente_id from pacientes_portal where email = auth.email()))
-- ============================================================================
alter table pacientes_portal disable row level security;
alter table portal_documentos disable row level security;
alter table portal_chat_mensagens disable row level security;
alter table portal_protocolos disable row level security;

-- ============================================================================
-- Realtime: habilitar replicação para chat
-- ============================================================================
alter publication supabase_realtime add table portal_chat_mensagens;
