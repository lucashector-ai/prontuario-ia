-- 0030 · Orçamentos digitais
-- Montados pela recepção a partir dos procedimentos, enviados por WhatsApp com o link do portal do
-- paciente, aprovados lá com aceite eletrônico simples (nome, data/hora, IP, navegador e hash do
-- conteúdo — não é assinatura ICP-Brasil). Só o servidor (service role) lê e grava.
-- clinica_chave = clinicas.id (ou o id do médico em contas antigas sem clínica).
create table if not exists orcamentos (
  id                 uuid primary key default gen_random_uuid(),
  clinica_chave      uuid not null,
  paciente_id        uuid not null references pacientes(id) on delete cascade,
  medico_id          uuid,
  numero             integer not null,
  status             text not null default 'rascunho'
                     check (status in ('rascunho','enviado','visto','aprovado','recusado','cancelado')),
  validade           date not null,
  desconto           numeric(10,2) not null default 0,
  total              numeric(10,2) not null default 0,
  condicoes          jsonb not null default '[]'::jsonb,   -- ["Pix à vista", "Cartão em até 3x"]
  condicao_escolhida text,
  observacoes        text,
  enviado_em         timestamptz,
  visto_em           timestamptz,
  respondido_em      timestamptz,
  motivo_recusa      text,
  aceite             jsonb,                                -- {nome, ip, navegador, hash, em}
  agendado           boolean not null default false,
  cobranca_ref       uuid,                                 -- gancho para o Financeiro
  criado_por         uuid,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now()
);
create unique index if not exists orcamentos_numero_uk on orcamentos (clinica_chave, numero);
create index if not exists orcamentos_paciente_idx on orcamentos (paciente_id);
create index if not exists orcamentos_status_idx on orcamentos (clinica_chave, status, validade);

create table if not exists orcamento_itens (
  id              uuid primary key default gen_random_uuid(),
  orcamento_id    uuid not null references orcamentos(id) on delete cascade,
  procedimento_id uuid,
  descricao       text not null,
  quantidade      numeric(8,2) not null default 1 check (quantidade > 0),
  valor_unitario  numeric(10,2) not null check (valor_unitario >= 0),
  ordem           integer not null default 0
);
create index if not exists orcamento_itens_orc_idx on orcamento_itens (orcamento_id, ordem);

alter table orcamentos enable row level security;
alter table orcamento_itens enable row level security;
revoke all on orcamentos from anon, authenticated;
revoke all on orcamento_itens from anon, authenticated;
