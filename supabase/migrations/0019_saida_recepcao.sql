-- ============================================================================
-- 0019 — Saída do consultório → recepção
--
-- Ao finalizar, o médico pode pedir retorno e deixar recados ("entregar pedido de
-- exames", "agendar fisioterapia"). O atendimento fica com a saída pendente até a
-- recepção resolver, e a recepção recebe o aviso na hora (sino + canto da tela).
-- Idempotente. O app funciona sem esta migration (só não guarda a pendência).
-- ============================================================================

alter table atendimentos add column if not exists retorno_id         uuid;
alter table atendimentos add column if not exists saida_status       text;          -- null | pendente | resolvida
alter table atendimentos add column if not exists saida_obs          text;          -- recado do médico para a recepção
alter table atendimentos add column if not exists saida_itens        text[];        -- retorno, exames, receita, atestado, procedimento…
alter table atendimentos add column if not exists saida_resolvida_em timestamptz;
alter table atendimentos add column if not exists saida_resolvida_por uuid;

do $$ begin
  alter table atendimentos add constraint atendimentos_saida_chk check (saida_status is null or saida_status in ('pendente', 'resolvida'));
exception when duplicate_object then null; end $$;

create index if not exists atendimentos_saida_idx on atendimentos (clinica_id, saida_status) where saida_status = 'pendente';

-- Avisos chegam na hora (sem esperar a próxima verificação)
do $$ begin
  alter publication supabase_realtime add table notificacoes_medico;
exception when duplicate_object then null; when undefined_object then null; end $$;

notify pgrst, 'reload schema';
