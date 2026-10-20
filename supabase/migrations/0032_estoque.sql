-- 0032 · Estoque de insumos
-- Itens com lote e validade; entradas criam lotes; saídas usam primeiro o lote que vence antes (FEFO).
-- estoque_movimentos é o livro-razão: nunca se apaga (correções viram estorno/ajuste).
-- Baixa automática: quando o agendamento vira "realizado", sai o que o procedimento consome
-- (procedimento_insumos), uma única vez por agendamento, com o paciente gravado (rastreabilidade).
-- clinica_chave = clinicas.id (ou o id do médico em contas antigas sem clínica).
create table if not exists estoque_itens (
  id             uuid primary key default gen_random_uuid(),
  clinica_chave  uuid not null,
  nome           text not null,
  unidade        text not null default 'un',
  estoque_minimo numeric(10,2) not null default 0,
  controla_lote  boolean not null default true,
  custo_unitario numeric(10,2),
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now()
);
create index if not exists estoque_itens_chave_idx on estoque_itens (clinica_chave, nome);

create table if not exists estoque_lotes (
  id            uuid primary key default gen_random_uuid(),
  clinica_chave uuid not null,
  item_id       uuid not null references estoque_itens(id) on delete cascade,
  lote          text,
  validade      date,
  saldo         numeric(10,2) not null default 0 check (saldo >= 0),
  criado_em     timestamptz not null default now()
);
create index if not exists estoque_lotes_fefo_idx on estoque_lotes (item_id, validade nulls last, criado_em) where saldo > 0;

create table if not exists estoque_movimentos (
  id             uuid primary key default gen_random_uuid(),
  clinica_chave  uuid not null,
  item_id        uuid not null references estoque_itens(id) on delete cascade,
  lote_id        uuid references estoque_lotes(id) on delete set null,
  tipo           text not null check (tipo in ('entrada','baixa_procedimento','saida_avulsa','perda','vencido','ajuste','estorno')),
  quantidade     numeric(10,2) not null,              -- positivo entra, negativo sai
  falta          numeric(10,2) not null default 0,    -- quanto não havia em estoque na saída
  agendamento_id uuid references agendamentos(id) on delete set null,
  paciente_id    uuid references pacientes(id) on delete set null,
  fornecedor     text,
  motivo         text,
  usuario_id     uuid,
  criado_em      timestamptz not null default now()
);
create index if not exists estoque_mov_item_idx on estoque_movimentos (item_id, criado_em desc);
create index if not exists estoque_mov_chave_idx on estoque_movimentos (clinica_chave, criado_em desc);
create index if not exists estoque_mov_agendamento_idx on estoque_movimentos (agendamento_id) where agendamento_id is not null;

create table if not exists procedimento_insumos (
  id              uuid primary key default gen_random_uuid(),
  clinica_chave   uuid not null,
  procedimento_id uuid not null references procedimentos(id) on delete cascade,
  item_id         uuid not null references estoque_itens(id) on delete cascade,
  quantidade      numeric(10,2) not null check (quantidade > 0),
  unique (procedimento_id, item_id)
);

-- Saída FEFO atômica: tira dos lotes que vencem antes; devolve quanto faltou (0 = tudo certo).
create or replace function public.c360_saida_estoque(p_chave uuid, p_item uuid, p_qtd numeric, p_tipo text,
  p_agendamento uuid default null, p_paciente uuid default null, p_motivo text default null, p_usuario uuid default null)
returns numeric language plpgsql security definer set search_path = public as $$
declare
  resta numeric := p_qtd;
  l record;
  tira numeric;
begin
  if p_qtd <= 0 then return 0; end if;
  if not exists (select 1 from estoque_itens where id = p_item and clinica_chave = p_chave) then
    raise exception 'item de outra clínica';
  end if;
  for l in select id, saldo from estoque_lotes where item_id = p_item and saldo > 0
           order by validade nulls last, criado_em for update loop
    exit when resta <= 0;
    tira := least(l.saldo, resta);
    update estoque_lotes set saldo = saldo - tira where id = l.id;
    insert into estoque_movimentos (clinica_chave, item_id, lote_id, tipo, quantidade, agendamento_id, paciente_id, motivo, usuario_id)
      values (p_chave, p_item, l.id, p_tipo, -tira, p_agendamento, p_paciente, p_motivo, p_usuario);
    resta := resta - tira;
  end loop;
  if resta > 0 then
    insert into estoque_movimentos (clinica_chave, item_id, tipo, quantidade, falta, agendamento_id, paciente_id, motivo, usuario_id)
      values (p_chave, p_item, p_tipo, 0, resta, p_agendamento, p_paciente, coalesce(p_motivo, 'sem saldo'), p_usuario);
  end if;
  return resta;
end $$;

-- Baixa dos insumos do procedimento do agendamento (idempotente).
create or replace function public.c360_baixa_procedimento(p_agendamento uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  a record;
  i record;
begin
  select ag.id, ag.paciente_id, ag.procedimento_id, p.clinica_id as chave into a
    from agendamentos ag join procedimentos p on p.id = ag.procedimento_id where ag.id = p_agendamento;
  if a.id is null then return; end if;
  if exists (select 1 from estoque_movimentos where agendamento_id = p_agendamento and tipo = 'baixa_procedimento') then return; end if;
  perform pg_advisory_xact_lock(hashtext('baixa:' || p_agendamento::text));
  if exists (select 1 from estoque_movimentos where agendamento_id = p_agendamento and tipo = 'baixa_procedimento') then return; end if;
  for i in select item_id, quantidade from procedimento_insumos where procedimento_id = a.procedimento_id loop
    perform public.c360_saida_estoque(a.chave, i.item_id, i.quantidade, 'baixa_procedimento', a.id, a.paciente_id, null, null);
  end loop;
end $$;

create or replace function public.c360_baixa_ao_realizar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'realizado' and old.status is distinct from 'realizado' and new.procedimento_id is not null then
    begin
      perform public.c360_baixa_procedimento(new.id);
    exception when others then
      raise warning 'baixa de estoque falhou para %: %', new.id, sqlerrm;  -- nunca impede concluir o atendimento
    end;
  end if;
  return new;
end $$;
drop trigger if exists c360_estoque_ao_realizar on agendamentos;
create trigger c360_estoque_ao_realizar after update of status on agendamentos
  for each row execute function public.c360_baixa_ao_realizar();

alter table estoque_itens enable row level security;
alter table estoque_lotes enable row level security;
alter table estoque_movimentos enable row level security;
alter table procedimento_insumos enable row level security;
revoke all on estoque_itens, estoque_lotes, estoque_movimentos, procedimento_insumos from anon, authenticated;
revoke all on function public.c360_saida_estoque(uuid, uuid, numeric, text, uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.c360_baixa_procedimento(uuid) from public, anon, authenticated;
revoke all on function public.c360_baixa_ao_realizar() from public, anon, authenticated;
