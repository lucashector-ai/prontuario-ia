-- ============================================================================
-- Sprint 4 — Estoque + Procedimentos
-- Datado: 2026-05-12
-- ============================================================================

-- Fornecedores
create table if not exists estoque_fornecedores (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references clinicas(id) on delete cascade,
  nome text not null,
  cnpj text,
  telefone text,
  email text,
  observacoes text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create index if not exists idx_fornecedores_clinica on estoque_fornecedores(clinica_id);

-- Produtos
create table if not exists estoque_produtos (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references clinicas(id) on delete cascade,
  nome text not null,
  marca text,
  categoria text not null check (categoria in ('peptideo', 'toxina', 'preenchedor', 'medicamento', 'descartavel', 'cosmetico', 'outro')),
  unidade text not null check (unidade in ('ml', 'mg', 'frasco', 'caixa', 'unidade', 'ampola', 'sachê')),
  estoque_atual numeric(10,3) not null default 0,
  estoque_minimo numeric(10,3) not null default 0,
  custo_unitario numeric(10,2) not null default 0,
  preco_venda numeric(10,2),
  foto_url text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists idx_produtos_clinica on estoque_produtos(clinica_id, ativo);
create index if not exists idx_produtos_categoria on estoque_produtos(clinica_id, categoria);

-- Lotes (rastreabilidade + validade ANVISA)
create table if not exists estoque_lotes (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references estoque_produtos(id) on delete cascade,
  numero_lote text not null,
  validade date,
  quantidade_inicial numeric(10,3) not null,
  quantidade_atual numeric(10,3) not null,
  fornecedor_id uuid references estoque_fornecedores(id) on delete set null,
  preco_compra numeric(10,2),
  data_compra date,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create index if not exists idx_lotes_produto on estoque_lotes(produto_id, ativo);
create index if not exists idx_lotes_validade on estoque_lotes(validade) where ativo = true;

-- Procedimentos realizados (vs `procedimentos` que é catálogo)
create table if not exists procedimentos_realizados (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references clinicas(id) on delete cascade,
  agendamento_id uuid references agendamentos(id) on delete set null,
  paciente_id uuid references pacientes(id) on delete set null,
  medico_id uuid references medicos(id) on delete set null,
  procedimento_id uuid references procedimentos(id) on delete set null,
  nome_procedimento text,                                  -- snapshot caso o catálogo mude
  produtos_usados jsonb not null default '[]'::jsonb,      -- [{produto_id, lote_id, quantidade, custo_unitario}]
  realizado_em timestamptz not null default now(),
  custo_total numeric(10,2) not null default 0,
  preco_cobrado numeric(10,2) not null default 0,
  margem_valor numeric(10,2) not null default 0,
  margem_percentual numeric(5,2),
  observacoes text,
  criado_em timestamptz not null default now()
);
create index if not exists idx_proc_realizados_clinica_data on procedimentos_realizados(clinica_id, realizado_em desc);
create index if not exists idx_proc_realizados_paciente on procedimentos_realizados(paciente_id);
create index if not exists idx_proc_realizados_medico on procedimentos_realizados(medico_id);

-- RLS desligado (convenção do projeto)
alter table estoque_fornecedores disable row level security;
alter table estoque_produtos disable row level security;
alter table estoque_lotes disable row level security;
alter table procedimentos_realizados disable row level security;
