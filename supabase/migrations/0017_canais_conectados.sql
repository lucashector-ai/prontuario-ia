-- ============================================================================
-- 0017 — Canais conectados (WhatsApp, Instagram, Messenger) por clínica
--
-- Cada clínica conecta as próprias contas pelo botão "Conectar" (login oficial
-- da Meta). Os webhooks usam esta tabela para saber de qual clínica é cada
-- mensagem (antes: Instagram/Messenger iam para o "primeiro médico ativo").
-- Os tokens ficam só no servidor: a tabela não tem política de RLS para o app.
-- Idempotente.
-- ============================================================================

create table if not exists canais_conectados (
  id            uuid primary key default gen_random_uuid(),
  clinica_id    uuid,
  medico_id     uuid not null,                 -- médico que recebe as conversas
  canal         text not null check (canal in ('whatsapp', 'instagram', 'messenger')),
  conta_id      text not null,                 -- phone_number_id | id do Instagram | id da página
  nome          text,                          -- número formatado, @usuario ou nome da página
  foto_url      text,
  detalhe       jsonb not null default '{}'::jsonb,  -- waba_id, page_id do Instagram, etc.
  access_token  text,                          -- token da página / do negócio (só servidor)
  status        text not null default 'ativo' check (status in ('ativo', 'erro', 'desconectado')),
  erro          text,
  conectado_em  timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (canal, conta_id)
);

create index if not exists canais_conectados_clinica_idx on canais_conectados (clinica_id);
create index if not exists canais_conectados_medico_idx on canais_conectados (medico_id);

-- Só o servidor (service role) acessa: guarda tokens
alter table canais_conectados enable row level security;

-- Conversa sabe por qual conta chegou (para responder pela conta certa)
alter table whatsapp_conversas add column if not exists canal_conta_id text;
create index if not exists whatsapp_conversas_canal_conta_idx on whatsapp_conversas (canal, canal_conta_id);

alter table whatsapp_config add column if not exists waba_id text;

notify pgrst, 'reload schema';
