-- 0009 — Chat omnicanal (WhatsApp, Instagram, Messenger) dentro do app
--
-- As tabelas whatsapp_conversas / whatsapp_mensagens foram criadas fora do repo.
-- Aqui só ACRESCENTAMOS colunas (idempotente) para: etapa do kanban, fixar,
-- arquivar, silenciar, bloquear — e a tabela de respostas rápidas.
-- Notas internas usam whatsapp_mensagens.metadata->>'nota' = 'true' (sem coluna nova).

alter table whatsapp_conversas add column if not exists etapa text;            -- novo | atendimento | aguardando | agendado | concluido
alter table whatsapp_conversas add column if not exists fixada boolean not null default false;
alter table whatsapp_conversas add column if not exists arquivada boolean not null default false;
alter table whatsapp_conversas add column if not exists silenciada_ate timestamptz; -- null = não silenciada; 'infinity' = sempre
alter table whatsapp_conversas add column if not exists bloqueada boolean not null default false;
alter table whatsapp_conversas add column if not exists canal text;            -- já usado pelos webhooks de Instagram/Messenger

create index if not exists whatsapp_conversas_medico_etapa_idx on whatsapp_conversas (medico_id, etapa);

create table if not exists chat_respostas_rapidas (
  id uuid primary key default gen_random_uuid(),
  medico_id uuid not null,
  atalho text not null,          -- ex.: "horarios" → digitar /horarios no chat
  texto text not null,
  criado_em timestamptz not null default now()
);
create index if not exists chat_respostas_rapidas_medico_idx on chat_respostas_rapidas (medico_id);
