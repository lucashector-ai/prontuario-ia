-- 0012 — Faturamento de convênios no padrão TISS (ANS)
--
-- Fluxo: operadora → guias (consulta / SP-SADT) → lote → XML TISS exportado e
-- enviado no portal/webservice da operadora → retorno (pagamento / glosa).
-- Escopo: cada operadora pertence a uma clínica (clinica_id) OU a um médico
-- autônomo (medico_id). Guias e lotes herdam o escopo pela operadora.
-- Idempotente: pode rodar mais de uma vez.

create table if not exists operadoras (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid,
  medico_id uuid,
  nome text not null,
  registro_ans varchar(6) not null,                 -- registro da operadora na ANS (6 dígitos)
  codigo_prestador varchar(20),                     -- código do prestador (clínica/médico) NA operadora
  cnpj_operadora varchar(14),
  cnes varchar(7) default '9999999',                -- CNES do prestador (9999999 = não possui)
  nome_contratado text,                             -- razão social / nome do prestador
  versao_tiss varchar(10) not null default '4.01.00',
  prazo_pagamento_dias int default 30,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
alter table operadoras add column if not exists cnes varchar(7) default '9999999';
alter table operadoras add column if not exists nome_contratado text;
alter table operadoras add column if not exists ultimo_numero_guia int not null default 0;  -- sequencial de guias
alter table operadoras add column if not exists ultimo_numero_lote int not null default 0;  -- sequencial de lotes
create index if not exists operadoras_clinica_idx on operadoras (clinica_id);
create index if not exists operadoras_medico_idx on operadoras (medico_id);

create table if not exists tabela_precos (
  id uuid primary key default gen_random_uuid(),
  operadora_id uuid not null references operadoras(id) on delete cascade,
  codigo_tuss varchar(10) not null,
  descricao text not null,
  valor numeric(12,2) not null default 0,
  criado_em timestamptz not null default now()
);
create unique index if not exists tabela_precos_operadora_codigo_uk on tabela_precos (operadora_id, codigo_tuss);

create table if not exists lotes_tiss (
  id uuid primary key default gen_random_uuid(),
  operadora_id uuid not null references operadoras(id) on delete cascade,
  numero_lote int not null,
  tipo_guia text not null default 'consulta' check (tipo_guia in ('consulta','sp_sadt')),  -- TISS: um lote só tem um tipo de guia
  competencia varchar(7) not null,                  -- yyyy-mm
  quantidade_guias int not null default 0,
  valor_total numeric(12,2) not null default 0,
  status text not null default 'aberto' check (status in ('aberto','enviado','processado')),
  enviado_em timestamptz,
  protocolo text,
  xml_hash varchar(32),
  criado_em timestamptz not null default now()
);
alter table lotes_tiss add column if not exists tipo_guia text not null default 'consulta';
create unique index if not exists lotes_tiss_operadora_numero_uk on lotes_tiss (operadora_id, numero_lote);

create table if not exists guias_tiss (
  id uuid primary key default gen_random_uuid(),
  operadora_id uuid not null references operadoras(id) on delete restrict,
  medico_id uuid,
  paciente_id uuid,
  consulta_id uuid,
  agendamento_id uuid,
  tipo text not null default 'consulta' check (tipo in ('consulta','sp_sadt')),
  numero_guia_prestador varchar(20) not null,        -- sequencial por operadora
  numero_guia_operadora varchar(20),                 -- senha/nº de autorização, quando houver
  numero_carteira varchar(20),
  nome_beneficiario text,
  data_atendimento date not null default current_date,
  cid_principal varchar(6),                          -- uso interno (as guias de consulta/SP-SADT TISS 4 não levam CID)
  procedimentos jsonb not null default '[]'::jsonb,  -- [{codigo_tuss, descricao, quantidade, valor_unitario}]
  valor_total numeric(12,2) not null default 0,
  tipo_consulta varchar(1) default '1',              -- 1 primeira | 2 seguimento | 3 pré-natal | 4 por encaminhamento
  tipo_atendimento varchar(2) default '05',          -- SP/SADT (tabela 50): 04 consulta, 05 exame ambulatorial...
  indicacao_acidente varchar(1) not null default '9',-- 9 = não acidente
  carater_atendimento varchar(1) not null default '1',-- 1 eletivo | 2 urgência/emergência
  profissional jsonb,                                -- {nome, conselho:'06', numero, uf:'35', cbos}
  observacao text,
  status text not null default 'rascunho'
    check (status in ('rascunho','pronta','em_lote','enviada','paga','glosada','paga_parcial')),
  valor_pago numeric(12,2),
  valor_glosado numeric(12,2),
  motivo_glosa text,
  retorno_em timestamptz,
  historico jsonb not null default '[]'::jsonb,      -- [{em, evento, detalhe}]
  lote_id uuid references lotes_tiss(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table guias_tiss add column if not exists numero_guia_operadora varchar(20);
alter table guias_tiss add column if not exists tipo_atendimento varchar(2) default '05';
alter table guias_tiss add column if not exists profissional jsonb;
alter table guias_tiss add column if not exists observacao text;
alter table guias_tiss add column if not exists retorno_em timestamptz;
alter table guias_tiss add column if not exists historico jsonb not null default '[]'::jsonb;

create unique index if not exists guias_tiss_operadora_numero_uk on guias_tiss (operadora_id, numero_guia_prestador);
create index if not exists guias_tiss_operadora_status_idx on guias_tiss (operadora_id, status);
create index if not exists guias_tiss_lote_idx on guias_tiss (lote_id);
create index if not exists guias_tiss_consulta_idx on guias_tiss (consulta_id);
create index if not exists guias_tiss_data_idx on guias_tiss (data_atendimento);
