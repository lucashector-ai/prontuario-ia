-- ============================================================================
-- Clinical 360 — Módulo Financeiro Fase 7
-- Multiunidade: vínculo médico ↔ unidade — datado 2026-05-21
--
-- Rodar DEPOIS de supabase_financeiro_setup.sql e fase6. Idempotente.
-- ============================================================================

-- Unidade principal do médico. Comandas geradas a partir de agendamentos
-- confirmados herdam a unidade do médico responsável.
alter table medicos add column if not exists unidade_id uuid references unidades(id) on delete set null;
create index if not exists idx_medicos_unidade on medicos(unidade_id);

-- ────────────────────────────────────────────────────────────────────────────
-- Trigger atualizado — comanda herda a unidade do médico do agendamento
-- ────────────────────────────────────────────────────────────────────────────
create or replace function fn_criar_comanda_agendamento()
returns trigger as $$
declare
  v_clinica_id uuid;
  v_unidade_id uuid;
  v_valor      numeric(10,2);
begin
  if new.status = 'confirmado'
     and (tg_op = 'INSERT' or old.status is distinct from 'confirmado') then

    if not exists (select 1 from comandas where agendamento_id = new.id) then
      select clinica_id, unidade_id
        into v_clinica_id, v_unidade_id
        from medicos where id = new.medico_id;
      select valor into v_valor from procedimentos where id = new.procedimento_id;

      insert into comandas
        (clinica_id, unidade_id, agendamento_id, paciente_id, profissional_id,
         valor_estimado, status, origem)
      values
        (v_clinica_id, v_unidade_id, new.id, new.paciente_id, new.medico_id,
         v_valor, 'rascunho', 'agendamento');
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

-- ============================================================================
-- FIM
-- ============================================================================
