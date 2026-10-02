-- 0013 — Registro de acessos ao prontuário (LGPD art. 37 / CFM 1.821/2007 e 2.299/2021)
--
-- Uma linha por acesso relevante a dado de saúde: quem (usuário), o quê (ação +
-- recurso), de qual paciente, quando, de onde (IP / user-agent).
-- Gravado por POST /api/auditoria (service role) — lib/auditoria.ts no cliente.
-- Lido por GET /api/auditoria (PainelAuditoria e AcessosDoPaciente).
--
-- Tabela só de INSERÇÃO: o app nunca atualiza nem apaga linhas daqui.
-- Idempotente: pode rodar mais de uma vez.

create table if not exists auditoria_acessos (
  id           uuid primary key default gen_random_uuid(),
  clinica_id   uuid,
  medico_id    uuid,                -- médico "dono" do contexto (para admin/recepção: o médico da clínica)
  usuario_id   uuid,
  usuario_nome text,
  usuario_tipo text not null default 'medico',
  acao         text not null,
  recurso      text not null,
  recurso_id   text,                -- text: alguns recursos (sala, exame) não usam uuid
  paciente_id  uuid,
  detalhes     jsonb not null default '{}'::jsonb,
  ip           text,
  user_agent   text,
  criado_em    timestamptz not null default now()
);

do $$ begin
  alter table auditoria_acessos add constraint auditoria_acessos_usuario_tipo_chk
    check (usuario_tipo in ('medico', 'admin', 'recepcionista', 'atendente'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table auditoria_acessos add constraint auditoria_acessos_acao_chk
    check (acao in ('visualizou', 'editou', 'exportou', 'imprimiu', 'excluiu'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table auditoria_acessos add constraint auditoria_acessos_recurso_chk
    check (recurso in ('paciente', 'consulta', 'prontuario', 'exame', 'conversa'));
exception when duplicate_object then null; end $$;

create index if not exists idx_auditoria_acessos_paciente on auditoria_acessos (paciente_id, criado_em desc);
create index if not exists idx_auditoria_acessos_medico   on auditoria_acessos (medico_id, criado_em desc);
create index if not exists idx_auditoria_acessos_clinica  on auditoria_acessos (clinica_id, criado_em desc);
create index if not exists idx_auditoria_acessos_usuario  on auditoria_acessos (usuario_id, criado_em desc);
create index if not exists idx_auditoria_acessos_criado   on auditoria_acessos (criado_em desc);

-- Sem FK de propósito: o registro precisa sobreviver à exclusão do paciente/usuário.
-- RLS: projeto separado. Quando ligar, a política deve permitir só INSERT pelo
-- service role e SELECT por clinica_id/medico_id do usuário.
-- alter table auditoria_acessos enable row level security;
