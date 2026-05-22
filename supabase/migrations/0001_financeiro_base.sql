-- ============================================================================
-- Clinical 360 — Módulo Financeiro (baseado em comanda)
-- Fase 0 + Fase 1 — datado 2026-05-21
--
-- Rodar UMA VEZ no SQL Editor do Supabase. Bloco idempotente: pode reexecutar.
-- RLS desligado em todas as tabelas (convenção do projeto para tabelas
-- financeiras / multi-tenant por clinica_id em camada de aplicação).
--
-- ATENÇÃO: as tabelas 'comandas' e 'comanda_itens' JÁ EXISTEM. Este script
-- as MIGRA via ALTER preservando os dados — não recria.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 0. Função utilitária — touch de updated_at
-- ────────────────────────────────────────────────────────────────────────────
create or replace function fn_touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;


-- ────────────────────────────────────────────────────────────────────────────
-- 1. formas_pagamento — lookup
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists formas_pagamento (
  id                   uuid primary key default gen_random_uuid(),
  codigo               text not null unique,
  nome                 text not null,
  permite_parcelamento boolean not null default false,
  ordem                int not null default 0,
  ativo                boolean not null default true,
  created_at           timestamptz not null default now()
);
alter table formas_pagamento disable row level security;

insert into formas_pagamento (codigo, nome, permite_parcelamento, ordem) values
  ('dinheiro',       'Dinheiro',          false, 1),
  ('pix',            'PIX',               false, 2),
  ('cartao_credito', 'Cartão de crédito', true,  3),
  ('cartao_debito',  'Cartão de débito',  false, 4),
  ('transferencia',  'Transferência',     false, 5),
  ('convenio',       'Convênio',          false, 6),
  ('boleto',         'Boleto',            true,  7)
on conflict (codigo) do nothing;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. comandas — MIGRAÇÃO da tabela existente
-- ────────────────────────────────────────────────────────────────────────────
do $$
begin
  -- renomeia colunas para o novo padrão
  if  exists (select 1 from information_schema.columns where table_name='comandas' and column_name='medico_id')
  and not exists (select 1 from information_schema.columns where table_name='comandas' and column_name='profissional_id')
  then alter table comandas rename column medico_id to profissional_id; end if;

  if  exists (select 1 from information_schema.columns where table_name='comandas' and column_name='observacao')
  and not exists (select 1 from information_schema.columns where table_name='comandas' and column_name='observacoes')
  then alter table comandas rename column observacao to observacoes; end if;

  if  exists (select 1 from information_schema.columns where table_name='comandas' and column_name='total')
  and not exists (select 1 from information_schema.columns where table_name='comandas' and column_name='valor_total')
  then alter table comandas rename column total to valor_total; end if;

  if  exists (select 1 from information_schema.columns where table_name='comandas' and column_name='criada_em')
  and not exists (select 1 from information_schema.columns where table_name='comandas' and column_name='created_at')
  then alter table comandas rename column criada_em to created_at; end if;

  if  exists (select 1 from information_schema.columns where table_name='comandas' and column_name='fechada_em')
  and not exists (select 1 from information_schema.columns where table_name='comandas' and column_name='fechado_em')
  then alter table comandas rename column fechada_em to fechado_em; end if;

  if  exists (select 1 from information_schema.columns where table_name='comandas' and column_name='fechada_por')
  and not exists (select 1 from information_schema.columns where table_name='comandas' and column_name='fechado_por')
  then alter table comandas rename column fechada_por to fechado_por; end if;
end $$;

-- coluna legada substituída pela generated valor_final
alter table comandas drop column if exists total_liquido;

-- novas colunas
alter table comandas add column if not exists clinica_id      uuid;
alter table comandas add column if not exists agendamento_id  uuid;
alter table comandas add column if not exists profissional_id uuid;
alter table comandas add column if not exists origem          text not null default 'avulsa';
alter table comandas add column if not exists valor_estimado  numeric(10,2);
alter table comandas add column if not exists valor_total     numeric(10,2);
alter table comandas add column if not exists desconto        numeric(10,2);
alter table comandas add column if not exists acrescimo       numeric(10,2) not null default 0;
alter table comandas add column if not exists observacoes     text;
alter table comandas add column if not exists aberto_em       timestamptz;
alter table comandas add column if not exists fechado_em      timestamptz;
alter table comandas add column if not exists fechado_por     uuid;
alter table comandas add column if not exists created_at      timestamptz not null default now();
alter table comandas add column if not exists updated_at      timestamptz not null default now();

-- normaliza nulos antes de aplicar defaults / not null
update comandas set valor_total = 0  where valor_total is null;
update comandas set desconto    = 0  where desconto is null;
update comandas set acrescimo   = 0  where acrescimo is null;
update comandas set aberto_em   = created_at where aberto_em is null and status <> 'rascunho';

alter table comandas alter column valor_total set default 0;
alter table comandas alter column valor_total set not null;
alter table comandas alter column desconto    set default 0;
alter table comandas alter column desconto    set not null;
alter table comandas alter column status      set default 'rascunho';

-- valor_final = valor_total - desconto + acrescimo (coluna gerada)
alter table comandas add column if not exists valor_final numeric(10,2)
  generated always as (coalesce(valor_total,0) - coalesce(desconto,0) + coalesce(acrescimo,0)) stored;

-- recria check de status com os novos estados
alter table comandas drop constraint if exists comandas_status_check;
alter table comandas add  constraint comandas_status_check
  check (status in ('rascunho','aberta','fechada','paga','cancelada'));

alter table comandas drop constraint if exists comandas_origem_check;
alter table comandas add  constraint comandas_origem_check
  check (origem in ('agendamento','avulsa'));

create index if not exists idx_comandas_clinica          on comandas(clinica_id);
create index if not exists idx_comandas_clinica_status   on comandas(clinica_id, status);
create index if not exists idx_comandas_clinica_paciente on comandas(clinica_id, paciente_id);
create index if not exists idx_comandas_agendamento      on comandas(agendamento_id);

drop trigger if exists trg_comandas_touch on comandas;
create trigger trg_comandas_touch before update on comandas
  for each row execute function fn_touch_updated_at();

alter table comandas disable row level security;


-- ────────────────────────────────────────────────────────────────────────────
-- 3. comanda_itens — MIGRAÇÃO da tabela existente
-- ────────────────────────────────────────────────────────────────────────────
do $$
begin
  if  exists (select 1 from information_schema.columns where table_name='comanda_itens' and column_name='criado_em')
  and not exists (select 1 from information_schema.columns where table_name='comanda_itens' and column_name='created_at')
  then alter table comanda_itens rename column criado_em to created_at; end if;
end $$;

alter table comanda_itens add column if not exists tipo            text not null default 'outro';
alter table comanda_itens add column if not exists profissional_id uuid;
alter table comanda_itens add column if not exists observacoes     text;
alter table comanda_itens add column if not exists created_at      timestamptz not null default now();

update comanda_itens set quantidade = 1 where quantidade is null;
alter table comanda_itens alter column quantidade set default 1;

-- valor_total passa a ser coluna gerada (quantidade * valor_unitario)
alter table comanda_itens drop column if exists valor_total;
alter table comanda_itens add  column valor_total numeric(10,2)
  generated always as (coalesce(quantidade,1) * coalesce(valor_unitario,0)) stored;

alter table comanda_itens drop constraint if exists comanda_itens_tipo_check;
alter table comanda_itens add  constraint comanda_itens_tipo_check
  check (tipo in ('consulta','procedimento','exame','produto','pacote','outro'));

create index if not exists idx_comanda_itens_comanda on comanda_itens(comanda_id);

alter table comanda_itens disable row level security;


-- ────────────────────────────────────────────────────────────────────────────
-- 4. recebimentos — contas a receber
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists recebimentos (
  id                 uuid primary key default gen_random_uuid(),
  clinica_id         uuid not null references clinicas(id) on delete cascade,
  comanda_id         uuid references comandas(id) on delete set null,
  paciente_id        uuid references pacientes(id) on delete set null,
  forma_pagamento_id uuid references formas_pagamento(id),
  status             text not null default 'pendente'
                       check (status in ('pendente','pago','parcial','atrasado','cancelado','reembolsado')),
  valor              numeric(10,2) not null,
  valor_pago         numeric(10,2) not null default 0,
  parcela_numero     int,
  parcela_total      int,
  vencimento         date,
  pago_em            timestamptz,
  pago_por           uuid,
  observacoes        text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists idx_recebimentos_clinica            on recebimentos(clinica_id);
create index if not exists idx_recebimentos_clinica_status     on recebimentos(clinica_id, status);
create index if not exists idx_recebimentos_clinica_vencimento on recebimentos(clinica_id, vencimento);
create index if not exists idx_recebimentos_comanda            on recebimentos(comanda_id);

drop trigger if exists trg_recebimentos_touch on recebimentos;
create trigger trg_recebimentos_touch before update on recebimentos
  for each row execute function fn_touch_updated_at();

alter table recebimentos disable row level security;


-- ────────────────────────────────────────────────────────────────────────────
-- 5. despesas — contas a pagar (tabela já criada; UI virá na Fase 2)
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists despesas (
  id                       uuid primary key default gen_random_uuid(),
  clinica_id               uuid not null references clinicas(id) on delete cascade,
  categoria                text,
  descricao                text not null,
  fornecedor               text,
  valor                    numeric(10,2) not null,
  vencimento               date,
  status                   text not null default 'pendente'
                             check (status in ('pendente','pago','atrasado','cancelado')),
  pago_em                  timestamptz,
  forma_pagamento_id       uuid references formas_pagamento(id),
  recorrente               boolean not null default false,
  recorrencia_periodicidade text check (recorrencia_periodicidade in ('semanal','mensal','anual')),
  observacoes              text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index if not exists idx_despesas_clinica            on despesas(clinica_id);
create index if not exists idx_despesas_clinica_status     on despesas(clinica_id, status);
create index if not exists idx_despesas_clinica_vencimento on despesas(clinica_id, vencimento);

drop trigger if exists trg_despesas_touch on despesas;
create trigger trg_despesas_touch before update on despesas
  for each row execute function fn_touch_updated_at();

alter table despesas disable row level security;


-- ────────────────────────────────────────────────────────────────────────────
-- 6. movimentacoes_caixa — fluxo de caixa unificado
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists movimentacoes_caixa (
  id                 uuid primary key default gen_random_uuid(),
  clinica_id         uuid not null references clinicas(id) on delete cascade,
  tipo               text not null check (tipo in ('entrada','saida')),
  origem             text not null check (origem in ('recebimento','despesa','ajuste_manual','estorno')),
  recebimento_id     uuid references recebimentos(id) on delete set null,
  despesa_id         uuid references despesas(id) on delete set null,
  forma_pagamento_id uuid references formas_pagamento(id),
  valor              numeric(10,2) not null,
  data_movimentacao  date not null default current_date,
  descricao          text,
  criado_por         uuid,
  created_at         timestamptz not null default now()
);
create index if not exists idx_movcaixa_clinica      on movimentacoes_caixa(clinica_id);
create index if not exists idx_movcaixa_clinica_data on movimentacoes_caixa(clinica_id, data_movimentacao);

alter table movimentacoes_caixa disable row level security;


-- ────────────────────────────────────────────────────────────────────────────
-- 7. Trigger — cria comanda rascunho quando agendamento vira 'confirmado'
-- ────────────────────────────────────────────────────────────────────────────
create or replace function fn_criar_comanda_agendamento()
returns trigger as $$
declare
  v_clinica_id uuid;
  v_valor      numeric(10,2);
begin
  if new.status = 'confirmado'
     and (tg_op = 'INSERT' or old.status is distinct from 'confirmado') then

    -- não duplica se já existe comanda para este agendamento
    if not exists (select 1 from comandas where agendamento_id = new.id) then
      select clinica_id into v_clinica_id from medicos where id = new.medico_id;
      select valor      into v_valor      from procedimentos where id = new.procedimento_id;

      insert into comandas
        (clinica_id, agendamento_id, paciente_id, profissional_id,
         valor_estimado, status, origem)
      values
        (v_clinica_id, new.id, new.paciente_id, new.medico_id,
         v_valor, 'rascunho', 'agendamento');
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_criar_comanda_agendamento on agendamentos;
create trigger trg_criar_comanda_agendamento
  after insert or update of status on agendamentos
  for each row execute function fn_criar_comanda_agendamento();

-- ============================================================================
-- FIM
-- ============================================================================
