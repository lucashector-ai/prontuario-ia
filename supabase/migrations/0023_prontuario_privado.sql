-- 0023 — Prontuário só de quem atendeu, com opção de compartilhar
--
-- Antes: qualquer médico da clínica lia as consultas (prontuário) e as prescrições dos colegas.
-- Agora, para quem entra como MÉDICO:
--   • vê as próprias consultas e prescrições;
--   • vê as de colegas só se a clínica ligar "prontuário compartilhado" (clinicas.prontuario_compartilhado)
--     ou se o médico que atendeu compartilhar aquela consulta (consultas.compartilhada);
--   • recepção (cargo recepcionista) não lê prontuário.
-- A conta de administrador da clínica (tipo 'clinica') continua vendo, por enquanto, porque
-- indicadores e relatórios dependem disso — será restrita na reorganização dos tipos de conta.
--
-- Idempotente: pode rodar mais de uma vez.

alter table clinicas  add column if not exists prontuario_compartilhado boolean not null default false;
alter table consultas add column if not exists compartilhada boolean not null default false;

-- Pode ler este registro clínico? (medico = quem atendeu; paciente = de quem é)
create or replace function public.c360_ve_prontuario(p_medico uuid, p_paciente uuid, p_compartilhada boolean)
returns boolean
language sql stable security definer set search_path = public as $$
  select case
    -- quem atendeu
    when p_medico is not null and p_medico = c360_medico() then true
    -- administrador da clínica (sem perfil de médico): mantém o acesso de antes
    when coalesce(auth.jwt() ->> 'tipo', '') = 'clinica' then
      p_medico in (select c360_medicos()) or p_paciente in (select c360_pacientes())
    -- recepção não lê prontuário
    when exists (select 1 from medicos m where m.id = c360_medico() and m.cargo = 'recepcionista') then false
    -- outro médico da clínica: só se compartilhado (na consulta ou na clínica toda)
    when (p_medico in (select c360_medicos()) or p_paciente in (select c360_pacientes())) then
      coalesce(p_compartilhada, false)
      or exists (select 1 from clinicas c where c.id = c360_clinica() and c.prontuario_compartilhado)
    else false
  end
$$;
grant execute on function public.c360_ve_prontuario(uuid, uuid, boolean) to authenticated;

-- Consultas: leitura pela regra acima; escrita só por quem atendeu (ou o administrador)
drop policy if exists c360_acesso on public.consultas;
drop policy if exists c360_leitura on public.consultas;
drop policy if exists c360_escrita on public.consultas;
create policy c360_leitura on public.consultas for select to authenticated
  using (c360_ve_prontuario(medico_id, paciente_id, compartilhada));
create policy c360_escrita on public.consultas for all to authenticated
  using (medico_id = c360_medico() or (coalesce(auth.jwt() ->> 'tipo', '') = 'clinica' and medico_id in (select c360_medicos())))
  with check (medico_id = c360_medico() or (coalesce(auth.jwt() ->> 'tipo', '') = 'clinica' and medico_id in (select c360_medicos())));

-- Prescrições: mesma regra (sem compartilhamento por item; segue a clínica)
drop policy if exists c360_acesso on public.prescricoes;
drop policy if exists c360_leitura on public.prescricoes;
drop policy if exists c360_escrita on public.prescricoes;
create policy c360_leitura on public.prescricoes for select to authenticated
  using (c360_ve_prontuario(medico_id, paciente_id, false));
create policy c360_escrita on public.prescricoes for all to authenticated
  using (medico_id = c360_medico() or (coalesce(auth.jwt() ->> 'tipo', '') = 'clinica' and medico_id in (select c360_medicos())))
  with check (medico_id = c360_medico() or (coalesce(auth.jwt() ->> 'tipo', '') = 'clinica' and medico_id in (select c360_medicos())));

notify pgrst, 'reload schema';
