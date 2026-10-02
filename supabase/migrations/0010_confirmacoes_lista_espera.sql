-- 0010 — Confirmação automática (48h / 24h / 2h), combate à falta e lista de espera real
--
-- Idempotente: pode rodar mais de uma vez.
-- Usado por: /api/cron/confirmacoes (cron), /api/lista-espera (Agenda),
-- components/minha-clinica/Automacoes.tsx (aba Confirmações).

-- ── Configuração por médico ────────────────────────────────────────────────
create table if not exists confirmacao_config (
  id uuid primary key default gen_random_uuid(),
  medico_id uuid not null unique,
  lembrete_48h boolean not null default true,
  confirmacao_24h boolean not null default true,
  lembrete_2h boolean not null default true,
  oferecer_vaga_lista boolean not null default true,
  -- Placeholders: {nome} {data} {hora} {medico} {clinica}. Null = modelo padrão do sistema.
  modelo_48h text,
  modelo_24h text,
  modelo_2h text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ── Agendamentos: controle de lembretes e confirmação ─────────────────────
-- (confirmacao_24h_enviada / confirmacao_24h_status já existem no banco)
alter table agendamentos add column if not exists confirmacao_24h_enviada boolean default false;
alter table agendamentos add column if not exists confirmacao_24h_status text;
alter table agendamentos add column if not exists confirmacao_24h_resposta_em timestamptz;
alter table agendamentos add column if not exists lembrete_48h_enviado boolean default false;
alter table agendamentos add column if not exists lembrete_2h_enviado boolean default false;
alter table agendamentos add column if not exists confirmado_em timestamptz;
alter table agendamentos add column if not exists confirmado_via text;   -- whatsapp | manual | telefone

create index if not exists agendamentos_medico_data_idx on agendamentos (medico_id, data_hora);

-- ── Lista de espera ────────────────────────────────────────────────────────
create table if not exists lista_espera (
  id uuid primary key default gen_random_uuid(),
  medico_id uuid not null,
  paciente_id uuid,                       -- null = contato avulso (nome + telefone)
  nome text not null,
  telefone text,
  tipo text not null default 'consulta' check (tipo in ('consulta', 'retorno', 'exame')),
  preferencia_dias int[] not null default '{}',   -- 0 = domingo … 6 = sábado; vazio = qualquer dia
  preferencia_periodo text not null default 'qualquer' check (preferencia_periodo in ('manha', 'tarde', 'noite', 'qualquer')),
  observacao text,
  prioridade int not null default 0,      -- 0 normal, 1 alta, 2 urgente
  status text not null default 'aguardando' check (status in ('aguardando', 'oferecido', 'agendado', 'removido')),
  oferecido_em timestamptz,
  oferta_data_hora timestamptz,           -- horário oferecido por WhatsApp (resposta "Quero esse horário")
  oferta_duracao int,
  agendamento_id uuid,
  criado_em timestamptz not null default now()
);

alter table lista_espera add column if not exists oferta_data_hora timestamptz;
alter table lista_espera add column if not exists oferta_duracao int;

create index if not exists lista_espera_medico_status_idx on lista_espera (medico_id, status);
create index if not exists lista_espera_telefone_idx on lista_espera (telefone) where status = 'oferecido';
