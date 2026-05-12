-- ============================================================================
-- Sprint 5 — CRM Médico
-- Datado: 2026-05-12
-- ============================================================================

-- Leads (funil)
create table if not exists crm_leads (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references clinicas(id) on delete cascade,
  nome text not null,
  telefone text,
  email text,
  origem text not null default 'outro' check (origem in ('instagram', 'indicacao', 'doctoralia', 'site', 'whatsapp', 'google', 'outro')),
  interesse text,
  status text not null default 'novo' check (status in ('novo', 'qualificado', 'agendado', 'atendido', 'perdido')),
  paciente_id uuid references pacientes(id) on delete set null,
  observacoes text,
  origem_form_id uuid,                                       -- preenchido quando vem de form embedável
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_leads_clinica_status on crm_leads(clinica_id, status);
create index if not exists idx_leads_origem on crm_leads(clinica_id, origem);

-- Campanhas (whatsapp / email / sms / sofia)
create table if not exists crm_campanhas (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references clinicas(id) on delete cascade,
  nome text not null,
  segmento jsonb not null default '{}'::jsonb,   -- {aniversariantes_mes, sem_consulta_X_meses, status_lead, etc}
  mensagem_template text not null,
  canal text not null default 'whatsapp' check (canal in ('whatsapp', 'email', 'sms', 'sofia')),
  agendada_para timestamptz,
  enviada_em timestamptz,
  destinatarios_total int default 0,
  destinatarios_alcancados int default 0,
  status text not null default 'rascunho' check (status in ('rascunho', 'agendada', 'enviada', 'cancelada')),
  criada_em timestamptz not null default now()
);

create index if not exists idx_campanhas_clinica on crm_campanhas(clinica_id, status);

-- Forms embedáveis pra captura de lead
create table if not exists crm_forms (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references clinicas(id) on delete cascade,
  slug text unique not null,
  titulo text not null,
  descricao text,
  campos jsonb not null default '[]'::jsonb,    -- [{nome, label, tipo, obrigatorio, opcoes?}]
  cor_primaria text,
  mensagem_sucesso text default 'Recebemos seus dados. Em breve entraremos em contato.',
  ativo boolean not null default true,
  total_submissoes int not null default 0,
  criado_em timestamptz not null default now()
);

create index if not exists idx_forms_clinica on crm_forms(clinica_id, ativo);

alter table crm_leads disable row level security;
alter table crm_campanhas disable row level security;
alter table crm_forms disable row level security;
