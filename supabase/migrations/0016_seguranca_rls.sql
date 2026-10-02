-- ============================================================================
-- 0016 — Segurança: RLS ligado em todas as tabelas, com acesso por clínica
--
-- Como funciona:
--   * O login do app emite um token (JWT) assinado com o JWT secret do Supabase,
--     com role "authenticated" e as claims clinica_id / medico_id.
--   * Cada tabela só mostra as linhas da clínica (ou do médico) do token.
--   * Sem login (chave anon pura) não se vê nada. Páginas públicas (sala do
--     paciente, agenda online, formulários) passam pelo servidor.
--   * O servidor (service role) ignora o RLS, como sempre.
--
-- Idempotente: pode rodar de novo. Só recria as políticas com prefixo "c360_".
-- ============================================================================

-- ── Quem está logado ───────────────────────────────────────────────────────
create or replace function public.c360_clinica() returns uuid
language sql stable as $$
  select nullif(coalesce(auth.jwt() ->> 'clinica_id', ''), '')::uuid
$$;

create or replace function public.c360_medico() returns uuid
language sql stable as $$
  select nullif(coalesce(auth.jwt() ->> 'medico_id', ''), '')::uuid
$$;

-- Médicos visíveis: o próprio + todos da clínica do token
create or replace function public.c360_medicos() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from medicos
  where id = c360_medico()
     or (c360_clinica() is not null and clinica_id = c360_clinica())
$$;

create or replace function public.c360_pacientes() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from pacientes
  where (c360_clinica() is not null and clinica_id = c360_clinica())
     or medico_id in (select c360_medicos())
$$;

-- Tabelas "filhas" (sem clinica_id/medico_id próprios) seguem o registro pai
create or replace function public.c360_filhos(pai text) returns setof uuid
language plpgsql stable security definer set search_path = public as $$
begin
  if pai = 'whatsapp_conversas' then
    return query select id from whatsapp_conversas where medico_id in (select c360_medicos());
  elsif pai = 'assistente_conversas' then
    return query select id from assistente_conversas
      where (c360_clinica() is not null and clinica_id = c360_clinica()) or medico_id in (select c360_medicos());
  elsif pai = 'operadoras' then
    return query select id from operadoras
      where (c360_clinica() is not null and clinica_id = c360_clinica()) or medico_id in (select c360_medicos());
  elsif pai = 'comandas' then
    return query select id from comandas where c360_clinica() is not null and clinica_id = c360_clinica();
  elsif pai = 'formularios_envios' then
    return query select id from formularios_envios
      where (c360_clinica() is not null and clinica_id = c360_clinica()) or medico_id in (select c360_medicos());
  elsif pai = 'campanhas_reativacao' then
    return query select id from campanhas_reativacao where medico_id in (select c360_medicos());
  end if;
end $$;

create or replace function public.c360_salas() returns setof text
language sql stable security definer set search_path = public as $$
  select sala_id::text from teleconsultas where medico_id in (select c360_medicos())
$$;

grant execute on function public.c360_clinica(), public.c360_medico(), public.c360_medicos(),
  public.c360_pacientes(), public.c360_filhos(text), public.c360_salas() to authenticated;

-- ── Políticas ──────────────────────────────────────────────────────────────
do $$
declare
  t record;
  pol record;
  cols text[];
  expr text;
  leitura_extra text;
  -- Só o servidor acessa (senhas, tokens, auditoria, controle interno)
  so_servidor text[] := array['clinica_admins', 'password_resets', 'memed_tokens', 'atendentes',
                              'automacoes_estado', 'auditoria_acessos', 'sofia_relatorios_log'];
  -- Catálogos com itens do sistema (clinica_id e medico_id vazios) visíveis a todos os logados
  catalogos text[] := array['modelos_prontuario', 'financeiro_categorias', 'formularios_templates', 'procedimentos'];
  sem_regra text[] := '{}';
begin
  for t in
    select c.relname as nome
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
  loop
    execute format('alter table public.%I enable row level security', t.nome);

    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t.nome and policyname like 'c360_%' loop
      execute format('drop policy %I on public.%I', pol.policyname, t.nome);
    end loop;

    if t.nome = any(so_servidor) then continue; end if;

    select array_agg(column_name::text) into cols
    from information_schema.columns where table_schema = 'public' and table_name = t.nome;

    expr := null;
    leitura_extra := null;

    if t.nome = 'medicos' then
      expr := 'id in (select c360_medicos()) or (c360_clinica() is not null and clinica_id = c360_clinica())';
    elsif t.nome = 'clinicas' then
      expr := 'id = c360_clinica()';
    elsif t.nome in ('planos', 'formas_pagamento') then
      expr := 'true';
    elsif t.nome = 'pacientes' then
      expr := '(c360_clinica() is not null and clinica_id = c360_clinica()) or medico_id in (select c360_medicos())';
    elsif t.nome = 'sala_mensagens' then
      expr := 'sala_id::text in (select c360_salas())';
    elsif t.nome = 'whatsapp_mensagens' then
      expr := 'conversa_id in (select c360_filhos(''whatsapp_conversas''))';
    elsif t.nome = 'assistente_mensagens' then
      expr := 'conversa_id in (select c360_filhos(''assistente_conversas''))';
    elsif t.nome = 'comanda_itens' then
      expr := 'comanda_id in (select c360_filhos(''comandas''))';
    elsif t.nome in ('tabela_precos', 'lotes_tiss') then
      expr := 'operadora_id in (select c360_filhos(''operadoras''))';
    elsif t.nome = 'campanhas_envios' then
      expr := 'campanha_id in (select c360_filhos(''campanhas_reativacao''))';
    elsif t.nome = 'formularios_respostas' then
      expr := 'envio_id in (select c360_filhos(''formularios_envios'')) or paciente_id in (select c360_pacientes())';
    else
      -- Regra geral pelas colunas da tabela
      if 'clinica_id' = any(cols) then
        expr := '(c360_clinica() is not null and clinica_id = c360_clinica())';
      end if;
      if 'medico_id' = any(cols) then
        expr := concat_ws(' or ', expr, 'medico_id in (select c360_medicos())');
      end if;
      if 'paciente_id' = any(cols) and expr is not null then
        -- registros ligados a um paciente da clínica (ex.: médico removido)
        expr := concat_ws(' or ', expr, 'paciente_id in (select c360_pacientes())');
      elsif 'paciente_id' = any(cols) then
        expr := 'paciente_id in (select c360_pacientes())';
      end if;
    end if;

    if expr is null then
      sem_regra := sem_regra || t.nome::text;
      continue;  -- RLS ligado e sem política: só o servidor acessa
    end if;

    execute format('create policy c360_acesso on public.%I for all to authenticated using (%s) with check (%s)', t.nome, expr, expr);

    if t.nome = any(catalogos) and 'clinica_id' = any(cols) and 'medico_id' = any(cols) then
      execute format('create policy c360_catalogo on public.%I for select to authenticated using (clinica_id is null and medico_id is null)', t.nome);
    elsif t.nome = any(catalogos) and 'clinica_id' = any(cols) then
      execute format('create policy c360_catalogo on public.%I for select to authenticated using (clinica_id is null)', t.nome);
    end if;
  end loop;

  if array_length(sem_regra, 1) > 0 then
    raise notice 'Tabelas sem coluna de clínica/médico (só o servidor acessa): %', array_to_string(sem_regra, ', ');
  end if;
end $$;

notify pgrst, 'reload schema';

-- Conferência: tabelas com RLS e quantas políticas c360 cada uma tem
select c.relname as tabela, c.relrowsecurity as rls_ligado,
       (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname and p.policyname like 'c360_%') as politicas
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p')
order by politicas, tabela;
